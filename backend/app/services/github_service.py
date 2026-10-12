import re
import time
import base64
import logging
from typing import Dict, Any, Optional, Tuple, List
from urllib.parse import urlparse
import httpx
from fastapi import HTTPException
from app.config import settings
from app.services.demo_data import (
    FLASK_DEMO_METADATA,
    FLASK_DEMO_README,
    FLASK_DEMO_TREE,
    FLASK_FILE_SAMPLES
)

logger = logging.getLogger(__name__)

class GitHubRateLimitError(Exception):
    def __init__(self, message: str, reset_time: Optional[int] = None):
        super().__init__(message)
        self.reset_time = reset_time

class GitHubNotFoundError(Exception):
    pass

class GitHubService:
    def __init__(self):
        # In-memory cache: key -> (timestamp, data)
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self.rate_limit_remaining: Optional[int] = None
        self.rate_limit_reset: Optional[int] = None

    def _get_cache(self, key: str) -> Optional[Any]:
        if key in self._cache:
            ts, val = self._cache[key]
            if time.time() - ts < settings.GITHUB_CACHE_TTL_SECONDS:
                return val
            del self._cache[key]
        return None

    def _set_cache(self, key: str, value: Any):
        self._cache[key] = (time.time(), value)

    def parse_repo_url(self, url: str) -> Tuple[str, str]:
        """
        Validate and extract owner and repository from a GitHub URL.
        Accepts:
          - https://github.com/owner/repo
          - http://github.com/owner/repo
          - github.com/owner/repo
        Rejects invalid domains, malicious schemes, or non-github targets.
        """
        cleaned = url.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Repository URL cannot be empty.")

        if not cleaned.startswith(("http://", "https://")):
            cleaned = "https://" + cleaned

        parsed = urlparse(cleaned)
        netloc = parsed.netloc.lower()
        if netloc not in ("github.com", "www.github.com"):
            raise HTTPException(
                status_code=400,
                detail=f"Only public GitHub repositories (github.com) are supported. Provided domain: '{netloc}'"
            )

        # Path looks like /owner/repo or /owner/repo/ or /owner/repo.git
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]
        if len(path_parts) < 2:
            raise HTTPException(
                status_code=400,
                detail="Invalid GitHub repository URL format. Expected 'https://github.com/owner/repository'."
            )

        owner = path_parts[0]
        repo = path_parts[1]

        # Clean .git suffix if present
        if repo.endswith(".git"):
            repo = repo[:-4]

        # Validate owner and repo against standard GitHub naming patterns
        # GitHub usernames: alphanumeric and single hyphens, 1-39 chars
        # Repositories: alphanumeric, hyphens, underscores, dots, 1-100 chars
        if not re.match(r"^[a-zA-Z0-9_\-\.]+$", owner) or not re.match(r"^[a-zA-Z0-9_\-\.]+$", repo):
            raise HTTPException(
                status_code=400,
                detail="Owner or repository name contains invalid characters."
            )

        return owner, repo

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "RepoQuest-AI-Explorer/1.0"
        }
        token = settings.GITHUB_TOKEN.strip().strip("\"'")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _track_rate_limits(self, response: httpx.Response):
        rem = response.headers.get("x-ratelimit-remaining")
        rst = response.headers.get("x-ratelimit-reset")
        if rem is not None:
            try:
                self.rate_limit_remaining = int(rem)
            except ValueError:
                pass
        if rst is not None:
            try:
                self.rate_limit_reset = int(rst)
            except ValueError:
                pass

    async def get_repo_metadata(self, owner: str, repo: str) -> Dict[str, Any]:
        """Fetch repository metadata from GitHub REST API."""
        cache_key = f"meta:{owner}/{repo}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                res = await client.get(url, headers=self._get_headers())
                self._track_rate_limits(res)

                if res.status_code == 404:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Repository '{owner}/{repo}' was not found on GitHub. Verify that it is public and spelled correctly."
                    )
                elif res.status_code in (403, 429):
                    if owner.lower() == "pallets" and repo.lower() == "flask":
                        logger.info("GitHub API rate limited; returning curated demo metadata for pallets/flask.")
                        demo_meta = dict(FLASK_DEMO_METADATA)
                        demo_meta["_is_demo_fallback"] = True
                        self._set_cache(cache_key, demo_meta)
                        return demo_meta

                    reset_min = ""
                    if self.rate_limit_reset:
                        diff = max(0, int((self.rate_limit_reset - time.time()) / 60))
                        reset_min = f" Limit resets in approx {diff} minutes."
                    raise HTTPException(
                        status_code=429,
                        detail=f"GitHub API rate limit exceeded.{reset_min} You can configure a GITHUB_TOKEN in backend .env to increase limits, or explore 'pallets/flask' demo."
                    )
                res.raise_for_status()
                data = res.json()
                self._set_cache(cache_key, data)
                return data
            except httpx.RequestError as e:
                if owner.lower() == "pallets" and repo.lower() == "flask":
                    logger.info("Network error; returning curated demo metadata for pallets/flask.")
                    demo_meta = dict(FLASK_DEMO_METADATA)
                    demo_meta["_is_demo_fallback"] = True
                    self._set_cache(cache_key, demo_meta)
                    return demo_meta
                logger.error("Network error fetching GitHub repo %s/%s: %s", owner, repo, e)
                raise HTTPException(
                    status_code=503,
                    detail=f"Unable to connect to GitHub API: {str(e)}"
                )

    async def get_readme(self, owner: str, repo: str, default_branch: str = "main") -> Optional[str]:
        """Fetch raw README content."""
        cache_key = f"readme:{owner}/{repo}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        # Try README endpoint with raw content header
        headers = self._get_headers()
        headers["Accept"] = "application/vnd.github.raw+json"
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/readme"

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                res = await client.get(url, headers=headers)
                self._track_rate_limits(res)
                if res.status_code == 200:
                    text = res.text
                    self._set_cache(cache_key, text)
                    return text
                elif res.status_code in (403, 429) or res.status_code == 404:
                    if owner.lower() == "pallets" and repo.lower() == "flask":
                        logger.info("Returning curated demo README for pallets/flask.")
                        self._set_cache(cache_key, FLASK_DEMO_README)
                        return FLASK_DEMO_README
                    if res.status_code == 404:
                        logger.info("No README found for %s/%s", owner, repo)
                        self._set_cache(cache_key, None)
                    return None
            except Exception as e:
                if owner.lower() == "pallets" and repo.lower() == "flask":
                    self._set_cache(cache_key, FLASK_DEMO_README)
                    return FLASK_DEMO_README
                logger.warning("Error fetching README for %s/%s: %s", owner, repo, e)
                return None
        return None

    async def get_git_tree(self, owner: str, repo: str, branch: str) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Fetch recursive Git tree for the repository branch.
        Returns (tree_items, is_truncated).
        """
        cache_key = f"tree:{owner}/{repo}:{branch}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                res = await client.get(url, headers=self._get_headers())
                self._track_rate_limits(res)

                if res.status_code != 200:
                    if owner.lower() == "pallets" and repo.lower() == "flask":
                        logger.info("Returning curated demo git tree for pallets/flask.")
                        result = (FLASK_DEMO_TREE, False)
                        self._set_cache(cache_key, result)
                        return result
                    logger.warning("Recursive tree failed on branch %s with %s", branch, res.status_code)
                    return [], False

                data = res.json()
                raw_tree = data.get("tree", [])
                is_truncated = data.get("truncated", False)

                result = (raw_tree, is_truncated)
                self._set_cache(cache_key, result)
                return result
            except Exception as e:
                if owner.lower() == "pallets" and repo.lower() == "flask":
                    result = (FLASK_DEMO_TREE, False)
                    self._set_cache(cache_key, result)
                    return result
                logger.error("Failed to fetch git tree for %s/%s: %s", owner, repo, e)
                return [], False

    async def get_file_content(self, owner: str, repo: str, path: str, ref: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetch single file content from GitHub without downloading the entire repository.
        Limits file size and handles binary content safely.
        """
        cache_key = f"file:{owner}/{repo}:{path}:{ref or 'default'}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        # Check binary file extension heuristics
        binary_extensions = (
            ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
            ".pdf", ".zip", ".tar", ".gz", ".7z", ".exe", ".bin",
            ".pyc", ".whl", ".so", ".dll", ".dylib", ".wasm", ".mp3", ".mp4"
        )
        is_binary_ext = any(path.lower().endswith(ext) for ext in binary_extensions)

        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{path}"
        params = {}
        if ref:
            params["ref"] = ref

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                res = await client.get(url, headers=self._get_headers(), params=params)
                self._track_rate_limits(res)

                if res.status_code in (403, 429) or (res.status_code == 404 and owner.lower() == "pallets" and repo.lower() == "flask"):
                    if owner.lower() == "pallets" and repo.lower() == "flask":
                        sample_text = FLASK_FILE_SAMPLES.get(
                            path,
                            f'"""\nFlask Demo Snapshot: {path}\n(Content preserved for offline exploration)\n"""\n\n# Source file from pallets/flask repository.\n'
                        )
                        result = {
                            "path": path,
                            "content": sample_text,
                            "size": len(sample_text.encode("utf-8")),
                            "truncated": False,
                            "is_binary": False,
                            "html_url": f"https://github.com/pallets/flask/blob/main/{path}"
                        }
                        self._set_cache(cache_key, result)
                        return result

                if res.status_code == 404:
                    raise HTTPException(status_code=404, detail=f"File '{path}' not found in repository.")
                res.raise_for_status()

                data = res.json()
                file_size = data.get("size", 0)
                html_url = data.get("html_url", f"https://github.com/{owner}/{repo}/blob/{ref or 'main'}/{path}")

                if is_binary_ext:
                    result = {
                        "path": path,
                        "content": f"[Binary or media file preview not supported directly ({file_size} bytes)]",
                        "size": file_size,
                        "truncated": False,
                        "is_binary": True,
                        "html_url": html_url
                    }
                    self._set_cache(cache_key, result)
                    return result

                # Check size
                if file_size > settings.MAX_FILE_BYTES:
                    # File is too large, fetch only partial or raw with warning
                    result = {
                        "path": path,
                        "content": f"[File size {file_size} bytes exceeds maximum preview limit of {settings.MAX_FILE_BYTES} bytes. View full file on GitHub]",
                        "size": file_size,
                        "truncated": True,
                        "is_binary": False,
                        "html_url": html_url
                    }
                    self._set_cache(cache_key, result)
                    return result

                raw_content = ""
                encoding = data.get("encoding")
                if encoding == "base64" and data.get("content"):
                    try:
                        decoded_bytes = base64.b64decode(data["content"])
                        # Check for null bytes indicating binary
                        if b"\x00" in decoded_bytes[:1024]:
                            raw_content = "[Binary file detected]"
                            is_binary_ext = True
                        else:
                            raw_content = decoded_bytes.decode("utf-8", errors="replace")
                    except Exception:
                        raw_content = "[Unable to decode base64 file content]"
                else:
                    # Fallback to download_url
                    download_url = data.get("download_url")
                    if download_url:
                        dl_res = await client.get(download_url, timeout=10.0)
                        if dl_res.status_code == 200:
                            raw_content = dl_res.text
                        else:
                            raw_content = "[Unable to download file content]"

                truncated = False
                if len(raw_content) > settings.MAX_FILE_BYTES:
                    raw_content = raw_content[:settings.MAX_FILE_BYTES] + "\n\n... [Content truncated for preview] ..."
                    truncated = True

                result = {
                    "path": path,
                    "content": raw_content,
                    "size": file_size,
                    "truncated": truncated,
                    "is_binary": is_binary_ext,
                    "html_url": html_url
                }
                self._set_cache(cache_key, result)
                return result

            except HTTPException:
                raise
            except Exception as e:
                logger.error("Failed to fetch file %s in %s/%s: %s", path, owner, repo, e)
                raise HTTPException(status_code=500, detail=f"Failed to fetch file '{path}': {str(e)}")

github_service = GitHubService()
