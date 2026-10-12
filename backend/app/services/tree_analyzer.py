import os
import re
from typing import List, Dict, Any, Tuple
from app.models.schemas import FileTreeNode, TechStackDetection
from app.config import settings

# Recognized manifests and their hints
CONFIG_PATTERNS = {
    "package.json": ("JavaScript / Node.js", "npm / yarn / pnpm configuration and scripts"),
    "package-lock.json": ("JavaScript", "npm lockfile"),
    "pnpm-lock.yaml": ("JavaScript", "pnpm lockfile"),
    "yarn.lock": ("JavaScript", "yarn lockfile"),
    "tsconfig.json": ("TypeScript", "TypeScript compiler configuration"),
    "vite.config.ts": ("Vite", "Vite build tool configuration"),
    "vite.config.js": ("Vite", "Vite build tool configuration"),
    "webpack.config.js": ("Webpack", "Webpack bundler configuration"),
    "pyproject.toml": ("Python", "Python project build configuration & dependencies (PEP 518/621)"),
    "setup.py": ("Python", "Python legacy packaging configuration"),
    "setup.cfg": ("Python", "Python packaging settings"),
    "requirements.txt": ("Python", "Python pip dependencies list"),
    "Pipfile": ("Python", "Pipenv package manifest"),
    "poetry.lock": ("Python", "Poetry dependency lockfile"),
    "Cargo.toml": ("Rust", "Cargo Rust crate manifest & dependencies"),
    "Cargo.lock": ("Rust", "Cargo lockfile"),
    "go.mod": ("Go", "Go modules dependency manifest"),
    "go.sum": ("Go", "Go checksum lockfile"),
    "pom.xml": ("Java", "Maven project object model"),
    "build.gradle": ("Java / Kotlin", "Gradle build script"),
    "build.gradle.kts": ("Kotlin", "Gradle Kotlin DSL build script"),
    "Makefile": ("Make", "Makefile build targets & tasks"),
    "Dockerfile": ("Docker", "Container build instructions"),
    "docker-compose.yml": ("Docker", "Multi-container Docker orchestration"),
    "docker-compose.yaml": ("Docker", "Multi-container Docker orchestration"),
    ".env.example": ("Config", "Environment variable template"),
}

DOC_PATTERNS = (
    "readme.md", "readme.rst", "readme.txt", "readme",
    "contributing.md", "contributing.rst", "contributing",
    "code_of_conduct.md", "code_of_conduct",
    "license", "license.md", "license.txt",
    "changelog.md", "security.md", "architecture.md"
)

# Common entrypoint patterns
ENTRY_POINT_REGEXES = [
    r"(^|/)(main|app|cli|server|run|index|wsgi|asgi)\.(py|js|ts|jsx|tsx|go|rs|cpp|c|java)$",
    r"(^|/)__main__\.py$",
    r"^cmd/[^/]+/main\.go$",
]

def is_entry_point(path: str) -> bool:
    normalized = path.replace("\\", "/").lower()
    for pattern in ENTRY_POINT_REGEXES:
        if re.search(pattern, normalized):
            return True
    return False

def is_test_file(path: str) -> bool:
    normalized = path.replace("\\", "/").lower()
    # Check directory
    if any(part in ("tests", "test", "__tests__", "spec") for part in normalized.split("/")):
        return True
    # Check filename
    filename = os.path.basename(normalized)
    if filename.startswith("test_") or filename.endswith(("_test.py", ".test.js", ".test.ts", ".test.tsx", ".spec.js", ".spec.ts", "_spec.rb")):
        return True
    return False

def is_documentation_file(path: str) -> bool:
    normalized = path.replace("\\", "/").lower()
    filename = os.path.basename(normalized)
    if filename in DOC_PATTERNS:
        return True
    if normalized.startswith("docs/") or "/docs/" in normalized or normalized.startswith(".github/"):
        return True
    return False

def is_config_file(path: str) -> bool:
    filename = os.path.basename(path)
    if filename in CONFIG_PATTERNS:
        return True
    if filename.startswith((".", "config.")) or filename.endswith((".conf", ".toml", ".yaml", ".yml", ".ini")):
        return True
    return False

def get_file_language(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    mapping = {
        ".py": "Python",
        ".js": "JavaScript",
        ".jsx": "React JSX",
        ".ts": "TypeScript",
        ".tsx": "React TSX",
        ".go": "Go",
        ".rs": "Rust",
        ".java": "Java",
        ".c": "C",
        ".cpp": "C++",
        ".h": "C/C++ Header",
        ".hpp": "C++ Header",
        ".cs": "C#",
        ".rb": "Ruby",
        ".php": "PHP",
        ".html": "HTML",
        ".css": "CSS",
        ".scss": "SCSS",
        ".json": "JSON",
        ".yaml": "YAML",
        ".yml": "YAML",
        ".toml": "TOML",
        ".md": "Markdown",
        ".rst": "reStructuredText",
        ".sql": "SQL",
        ".sh": "Shell",
        ".ps1": "PowerShell"
    }
    return mapping.get(ext, "Plain Text")

def classify_node(item: Dict[str, Any]) -> FileTreeNode:
    path = item.get("path", "")
    item_type = item.get("type", "blob")
    name = os.path.basename(path)
    ext = os.path.splitext(name)[1].lower()
    size = item.get("size")

    if item_type == "tree":
        return FileTreeNode(
            path=path,
            type="tree",
            category="directory",
            name=name,
            extension="",
            size=None,
            importance="medium",
            reason="Subdirectory / package namespace",
            language=None
        )

    # Blob classification
    lang = get_file_language(path)
    
    if is_entry_point(path):
        return FileTreeNode(
            path=path,
            type="blob",
            category="entrypoint",
            name=name,
            extension=ext,
            size=size,
            importance="high",
            reason="Likely primary entry point or application runner",
            language=lang
        )
    
    if is_config_file(path):
        config_desc = CONFIG_PATTERNS.get(name, ("", "Configuration file"))[1]
        return FileTreeNode(
            path=path,
            type="blob",
            category="config",
            name=name,
            extension=ext,
            size=size,
            importance="high" if name in CONFIG_PATTERNS else "medium",
            reason=config_desc,
            language=lang
        )
        
    if is_documentation_file(path):
        return FileTreeNode(
            path=path,
            type="blob",
            category="doc",
            name=name,
            extension=ext,
            size=size,
            importance="high" if name.lower().startswith(("readme", "contributing")) else "medium",
            reason="Project documentation and guides",
            language=lang
        )

    if is_test_file(path):
        return FileTreeNode(
            path=path,
            type="blob",
            category="test",
            name=name,
            extension=ext,
            size=size,
            importance="medium",
            reason="Automated test suite verification",
            language=lang
        )

    # Assets
    asset_exts = (".png", ".jpg", ".jpeg", ".svg", ".ico", ".gif", ".webp", ".ttf", ".woff", ".woff2")
    if ext in asset_exts:
        return FileTreeNode(
            path=path,
            type="blob",
            category="asset",
            name=name,
            extension=ext,
            size=size,
            importance="low",
            reason="Static asset or graphic",
            language=lang
        )

    # General source file
    return FileTreeNode(
        path=path,
        type="blob",
        category="source",
        name=name,
        extension=ext,
        size=size,
        importance="medium",
        reason="Core source code module",
        language=lang
    )

def analyze_git_tree(raw_tree: List[Dict[str, Any]]) -> Tuple[List[FileTreeNode], TechStackDetection, Dict[str, List[str]]]:
    """
    Takes raw GitHub git tree list and produces:
    - Classified FileTreeNode list (bounded to MAX_TREE_ITEMS)
    - Detected TechStackDetection
    - Categorized lists: entry_points, config_files, test_files, doc_files
    """
    classified_nodes: List[FileTreeNode] = []
    
    entry_points = []
    config_files = []
    test_files = []
    doc_files = []
    
    languages_seen = set()
    frameworks_seen = set()
    package_managers = set()
    test_frameworks = set()
    build_tools = set()

    for item in raw_tree:
        node = classify_node(item)
        classified_nodes.append(node)

        if node.type == "blob":
            if node.language and node.language not in ("Plain Text", "Markdown"):
                languages_seen.add(node.language)

            if node.category == "entrypoint":
                entry_points.append(node.path)
            elif node.category == "config":
                config_files.append(node.path)
                # Infer tools from config files
                fname = node.name.lower()
                if fname == "package.json":
                    package_managers.add("npm")
                elif fname == "pnpm-lock.yaml":
                    package_managers.add("pnpm")
                elif fname == "yarn.lock":
                    package_managers.add("yarn")
                elif fname == "cargo.toml":
                    package_managers.add("cargo")
                    build_tools.add("Cargo")
                elif fname in ("requirements.txt", "pyproject.toml", "pipfile"):
                    package_managers.add("pip")
                elif fname == "go.mod":
                    package_managers.add("go modules")
                elif fname == "pom.xml":
                    build_tools.add("Maven")
                elif fname.startswith("build.gradle"):
                    build_tools.add("Gradle")
                elif fname == "dockerfile":
                    build_tools.add("Docker")
                elif fname.startswith("vite.config"):
                    frameworks_seen.add("Vite")
                elif fname.startswith("webpack.config"):
                    build_tools.add("Webpack")
            elif node.category == "test":
                test_files.append(node.path)
                p_lower = node.path.lower()
                if "pytest" in p_lower or p_lower.endswith(".py"):
                    test_frameworks.add("pytest / unittest")
                if "jest" in p_lower or p_lower.endswith((".test.js", ".spec.js")):
                    test_frameworks.add("Jest / Vitest")
                if "go" in p_lower and p_lower.endswith("_test.go"):
                    test_frameworks.add("testing (Go)")
                if "cargo" in p_lower or p_lower.endswith("_test.rs"):
                    test_frameworks.add("cargo test")
            elif node.category == "doc":
                doc_files.append(node.path)

    # Sort nodes by importance so map display prioritizes high-value files
    importance_order = {"high": 0, "medium": 1, "low": 2}
    classified_nodes.sort(key=lambda n: (0 if n.type == "tree" else 1, importance_order.get(n.importance, 1), n.path))

    # Bounded subset for frontend map clarity
    bounded_nodes = classified_nodes[:settings.MAX_TREE_ITEMS]

    tech_stack = TechStackDetection(
        languages=sorted(list(languages_seen)),
        frameworks=sorted(list(frameworks_seen)),
        package_managers=sorted(list(package_managers)),
        test_frameworks=sorted(list(test_frameworks)),
        build_tools=sorted(list(build_tools))
    )

    categorized = {
        "entry_points": entry_points,
        "config_files": config_files,
        "test_files": test_files,
        "doc_files": doc_files
    }

    return bounded_nodes, tech_stack, categorized
