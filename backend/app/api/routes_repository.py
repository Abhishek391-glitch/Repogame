import os
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import (
    RepositoryAnalyzeRequest,
    RepositoryAnalysis,
    FileContentResponse,
    ContributorReadinessReport,
    ContributorReadinessItem
)
from app.services.github_service import github_service
from app.services.tree_analyzer import analyze_git_tree
from app.database import add_explored_repo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repository", tags=["Repository"])

# In-memory repository analysis cache to power instant view switching
_analysis_cache = {}

@router.post("/analyze", response_model=RepositoryAnalysis)
async def analyze_repository(request: RepositoryAnalyzeRequest):
    """
    Analyze a public GitHub repository without cloning.
    Retrieves metadata, README, and bounded recursive git tree.
    """
    owner, repo = github_service.parse_repo_url(request.url)
    cache_key = f"{owner.lower()}/{repo.lower()}"

    # Fetch metadata
    meta = await github_service.get_repo_metadata(owner, repo)
    default_branch = meta.get("default_branch", "main")
    description = meta.get("description")
    stars = meta.get("stargazers_count", 0)
    forks = meta.get("forks_count", 0)
    html_url = meta.get("html_url", f"https://github.com/{owner}/{repo}")
    license_info = meta.get("license", {})
    license_name = license_info.get("name") if license_info else None

    # Fetch README
    readme_text = await github_service.get_readme(owner, repo, default_branch)
    has_readme = bool(readme_text and readme_text.strip())
    readme_preview = (readme_text[:1200] + "...") if has_readme else None

    # Fetch recursive Git tree
    raw_tree, is_truncated = await github_service.get_git_tree(owner, repo, default_branch)

    # If default branch tree was empty, try 'master' as fallback
    if not raw_tree and default_branch != "master":
        raw_tree, is_truncated = await github_service.get_git_tree(owner, repo, "master")

    # Analyze & categorize tree
    tree_nodes, tech_stack, categorized = analyze_git_tree(raw_tree)
    is_demo_fallback = meta.get("_is_demo_fallback", False)

    analysis = RepositoryAnalysis(
        owner=owner,
        repo=repo,
        full_name=f"{owner}/{repo}",
        description=description,
        stars=stars,
        forks=forks,
        default_branch=default_branch,
        html_url=html_url,
        license=license_name,
        has_readme=has_readme,
        readme_preview=readme_preview,
        readme_full=readme_text,
        tree=tree_nodes,
        entry_points=categorized["entry_points"],
        config_files=categorized["config_files"],
        test_files=categorized["test_files"],
        doc_files=categorized["doc_files"],
        tech_stack=tech_stack,
        is_truncated=is_truncated,
        total_files_analyzed=len(tree_nodes),
        is_demo_fallback=is_demo_fallback
    )

    _analysis_cache[cache_key] = analysis
    await add_explored_repo(f"{owner}/{repo}")

    return analysis

@router.get("/file", response_model=FileContentResponse)
async def get_file_content(
    owner: str = Query(...),
    repo: str = Query(...),
    path: str = Query(...),
    ref: Optional[str] = Query(None)
):
    """Retrieve contents of a specific file from GitHub with size limits and binary detection."""
    data = await github_service.get_file_content(owner, repo, path, ref)
    return FileContentResponse(**data)

@router.get("/readiness", response_model=ContributorReadinessReport)
async def get_contributor_readiness(owner: str = Query(...), repo: str = Query(...)):
    """Evaluate repository newcomer onboarding readiness based on concrete file evidence."""
    cache_key = f"{owner.lower()}/{repo.lower()}"
    analysis = _analysis_cache.get(cache_key)
    
    if not analysis:
        # Fetch minimal metadata to evaluate
        meta = await github_service.get_repo_metadata(owner, repo)
        branch = meta.get("default_branch", "main")
        readme = await github_service.get_readme(owner, repo, branch)
        raw_tree, _ = await github_service.get_git_tree(owner, repo, branch)
        nodes, tech, cat = analyze_git_tree(raw_tree)
        analysis = RepositoryAnalysis(
            owner=owner,
            repo=repo,
            full_name=f"{owner}/{repo}",
            description=meta.get("description"),
            default_branch=branch,
            html_url=meta.get("html_url", ""),
            has_readme=bool(readme),
            readme_full=readme,
            tree=nodes,
            doc_files=cat["doc_files"],
            test_files=cat["test_files"],
            config_files=cat["config_files"],
            entry_points=cat["entry_points"]
        )

    all_paths = [n.path.lower() for n in analysis.tree]
    items: List[ContributorReadinessItem] = []

    # 1. README
    if analysis.has_readme:
        items.append(ContributorReadinessItem(
            id="check-readme",
            label="Project README",
            status="Found",
            evidence_path="README.md",
            description="Clear documentation exists outlining the repository's goals and scope.",
            action_suggestion="Review the README for an overview before writing any code."
        ))
    else:
        items.append(ContributorReadinessItem(
            id="check-readme",
            label="Project README",
            status="Not found",
            evidence_path=None,
            description="No primary README was found in the repository root.",
            action_suggestion="Reach out to maintainers or inspect source headers for project instructions."
        ))

    # 2. Local Setup & Installation Instructions
    readme_lower = (analysis.readme_full or "").lower()
    has_setup_keywords = any(k in readme_lower for k in ("install", "setup", "getting started", "run", "npm run", "python -m", "cargo build"))
    if has_setup_keywords:
        items.append(ContributorReadinessItem(
            id="check-setup",
            label="Development Setup Guide",
            status="Found",
            evidence_path="README.md",
            description="Installation or execution instructions detected in documentation.",
            action_suggestion="Follow the local environment setup instructions to verify the app builds."
        ))
    else:
        items.append(ContributorReadinessItem(
            id="check-setup",
            label="Development Setup Guide",
            status="Needs verification",
            evidence_path=None,
            description="Standard setup keywords not explicitly found in README preview.",
            action_suggestion="Inspect build manifests (package.json, pyproject.toml, Makefile) for run scripts."
        ))

    # 3. Contribution Guidelines
    contrib_path = next((p for p in analysis.doc_files if "contributing" in p.lower()), None)
    if contrib_path:
        items.append(ContributorReadinessItem(
            id="check-contributing",
            label="Contribution Guidelines (CONTRIBUTING)",
            status="Found",
            evidence_path=contrib_path,
            description=f"Dedicated contribution guide found at `{contrib_path}`.",
            action_suggestion=f"Read `{contrib_path}` carefully to follow branch naming, style, and PR requirements."
        ))
    else:
        items.append(ContributorReadinessItem(
            id="check-contributing",
            label="Contribution Guidelines (CONTRIBUTING)",
            status="Not found",
            evidence_path=None,
            description="No dedicated CONTRIBUTING.md file was detected in the tree.",
            action_suggestion="Follow standard GitHub fork-and-pull workflow and check pull request history."
        ))

    # 4. Automated Test Suite
    if analysis.test_files:
        items.append(ContributorReadinessItem(
            id="check-tests",
            label="Automated Test Suite",
            status="Found",
            evidence_path=analysis.test_files[0],
            description=f"Found {len(analysis.test_files)} test files/directories validating codebase functionality.",
            action_suggestion="Run the test suite locally to establish a passing baseline before making changes."
        ))
    else:
        items.append(ContributorReadinessItem(
            id="check-tests",
            label="Automated Test Suite",
            status="Not found",
            evidence_path=None,
            description="No test directory or recognizable test patterns detected in the analyzed subset.",
            action_suggestion="Look into CI workflow files or ask maintainers how verification is performed."
        ))

    # 5. Issue & PR Templates
    has_issue_template = any(".github/issue_template" in p or "issue_template" in p for p in all_paths)
    if has_issue_template:
        items.append(ContributorReadinessItem(
            id="check-templates",
            label="GitHub Issue & PR Templates",
            status="Found",
            evidence_path=".github/ISSUE_TEMPLATE",
            description="Structured templates provided for reporting bugs or submitting features.",
            action_suggestion="Use the provided template when creating your first issue or pull request."
        ))
    else:
        items.append(ContributorReadinessItem(
            id="check-templates",
            label="GitHub Issue & PR Templates",
            status="Not found",
            evidence_path=None,
            description="No custom issue or PR templates found under .github.",
            action_suggestion="Write clear, thorough issue descriptions with steps to reproduce."
        ))

    # 6. Open Source License
    if analysis.license:
        items.append(ContributorReadinessItem(
            id="check-license",
            label="Open Source License",
            status="Found",
            evidence_path="LICENSE",
            description=f"Licensed under {analysis.license}.",
            action_suggestion="Ensure your contributions comply with the declared license permissions."
        ))
    else:
        has_license_file = any("license" in p for p in all_paths)
        if has_license_file:
            items.append(ContributorReadinessItem(
                id="check-license",
                label="Open Source License",
                status="Found",
                evidence_path="LICENSE",
                description="License file detected in repository tree.",
                action_suggestion="Check the LICENSE file for terms and conditions."
            ))
        else:
            items.append(ContributorReadinessItem(
                id="check-license",
                label="Open Source License",
                status="Needs verification",
                evidence_path=None,
                description="No explicit license metadata or LICENSE file identified.",
                action_suggestion="Clarify copyright and licensing permissions before submitting substantial contributions."
            ))

    passed_count = sum(1 for it in items if it.status == "Found")
    total_count = len(items)
    score = int((passed_count / total_count) * 100) if total_count else 0
    
    if score >= 80:
        level = "Welcoming & Contributor-Ready"
    elif score >= 50:
        level = "Moderate Onboarding Support"
    else:
        level = "Sparse Contributor Tooling"

    return ContributorReadinessReport(
        items=items,
        score_percent=score,
        readiness_level=level,
        total_checks=total_count,
        passed_checks=passed_count
    )
