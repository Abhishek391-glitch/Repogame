import pytest
from app.services.github_service import github_service
from app.services.tree_analyzer import classify_node, analyze_git_tree, is_entry_point
from app.services.quest_service import quest_service
from app.services.ollama_service import ollama_service
from fastapi import HTTPException

# 1. GitHub URL Parsing & Validation Tests
def test_parse_valid_github_urls():
    owner, repo = github_service.parse_repo_url("https://github.com/pallets/flask")
    assert owner == "pallets"
    assert repo == "flask"

    owner, repo = github_service.parse_repo_url("http://github.com/fastapi/fastapi.git")
    assert owner == "fastapi"
    assert repo == "fastapi"

    owner, repo = github_service.parse_repo_url("github.com/torvalds/linux/")
    assert owner == "torvalds"
    assert repo == "linux"

def test_parse_invalid_github_urls():
    with pytest.raises(HTTPException) as exc1:
        github_service.parse_repo_url("https://gitlab.com/owner/repo")
    assert exc1.value.status_code == 400

    with pytest.raises(HTTPException) as exc2:
        github_service.parse_repo_url("https://malicious-site.com/fake")
    assert exc2.value.status_code == 400

    with pytest.raises(HTTPException) as exc3:
        github_service.parse_repo_url("https://github.com/onlyonepart")
    assert exc3.value.status_code == 400

    with pytest.raises(HTTPException) as exc4:
        github_service.parse_repo_url("")
    assert exc4.value.status_code == 400

# 2. Tree Classification & Categorization Tests
def test_classify_entry_points():
    assert is_entry_point("main.py") is True
    assert is_entry_point("src/index.ts") is True
    assert is_entry_point("app.js") is True
    assert is_entry_point("utils/helpers.py") is False

    node = classify_node({"path": "src/main.py", "type": "blob", "size": 1024})
    assert node.category == "entrypoint"
    assert node.importance == "high"

def test_classify_config_and_manifests():
    node_py = classify_node({"path": "pyproject.toml", "type": "blob", "size": 512})
    assert node_py.category == "config"

    node_js = classify_node({"path": "package.json", "type": "blob", "size": 800})
    assert node_js.category == "config"

def test_classify_test_files():
    node_test = classify_node({"path": "tests/test_api.py", "type": "blob", "size": 1200})
    assert node_test.category == "test"

    node_spec = classify_node({"path": "src/auth.spec.ts", "type": "blob", "size": 900})
    assert node_spec.category == "test"

def test_analyze_git_tree_stack_detection():
    sample_tree = [
        {"path": "package.json", "type": "blob", "size": 500},
        {"path": "src/index.ts", "type": "blob", "size": 1200},
        {"path": "src/App.tsx", "type": "blob", "size": 2000},
        {"path": "tests/App.test.ts", "type": "blob", "size": 800},
        {"path": "README.md", "type": "blob", "size": 3500},
        {"path": "Dockerfile", "type": "blob", "size": 400},
    ]
    nodes, tech_stack, categorized = analyze_git_tree(sample_tree)

    assert "TypeScript" in tech_stack.languages
    assert "npm" in tech_stack.package_managers
    assert "Docker" in tech_stack.build_tools
    assert len(categorized["entry_points"]) > 0
    assert len(categorized["config_files"]) > 0
    assert len(categorized["test_files"]) > 0
    assert len(categorized["doc_files"]) > 0

# 3. Quest Generation Tests
def test_quest_generation_grounding():
    quests = quest_service.generate_quests_for_repo(
        owner="testowner",
        repo="testrepo",
        entry_points=["src/main.py"],
        config_files=["pyproject.toml"],
        test_files=["tests/test_core.py"],
        doc_files=["CONTRIBUTING.md", "README.md"],
        all_paths=["src/main.py", "pyproject.toml", "tests/test_core.py", "CONTRIBUTING.md", "README.md"],
        has_readme=True
    )

    assert len(quests) == 5
    ids = [q.id for q in quests]
    assert "quest-entry" in ids
    assert "quest-config" in ids
    assert "quest-test" in ids
    assert "quest-feature" in ids
    assert "quest-contrib" in ids

    # Check that knowledge checks have valid correct answers
    for q in quests:
        assert 0 <= q.knowledge_check.correct_index < len(q.knowledge_check.options)
        assert q.xp_reward > 0
        assert len(q.steps) > 0

# 4. AI JSON Extraction & Robustness Tests
def test_ai_extract_json_markdown():
    markdown_wrapped = """Here is the analysis:
```json
{
  "summary": "FastAPI modern framework",
  "what_it_does": "High performance API framework",
  "target_audience": "Python developers",
  "architecture_summary": "ASGI application",
  "learning_recommendations": ["Read docs"],
  "grounded_facts": ["Built on Starlette"]
}
```
Hope this helps!"""
    parsed = ollama_service._extract_json(markdown_wrapped)
    assert parsed is not None
    assert parsed["summary"] == "FastAPI modern framework"

def test_ai_extract_json_raw():
    raw_json = '{"role_summary": "Main handler", "key_components": ["def run()"], "connections": [], "beginner_tips": "Start here", "citations": ["main.py"]}'
    parsed = ollama_service._extract_json(raw_json)
    assert parsed is not None
    assert parsed["role_summary"] == "Main handler"

# 5. Missing README & Fallbacks
def test_fallback_project_overview():
    fallback = ollama_service._fallback_project_overview(
        owner="psf",
        repo="requests",
        description="A simple, yet elegant, HTTP library.",
        readme_excerpt=None,
        tech_stack=["Python"],
        entry_points=["requests/__init__.py"],
        key_directories=["requests"]
    )
    assert "requests" in fallback.summary
    assert len(fallback.learning_recommendations) > 0
    assert len(fallback.grounded_facts) > 0

# 6. Multilingual Language Detection & Grounded Fallbacks
def test_multilingual_language_detection():
    # Devanagari Hindi
    assert ollama_service._detect_language("इस प्रोजेक्ट में ऑथेंटिकेशन कैसे काम करता है?", "auto") == "hi"
    # Hinglish Hindi
    assert ollama_service._detect_language("Mujhe batao ki application mein authentication kaise kaam karta hai", "auto") == "hi"
    # Telugu script
    assert ollama_service._detect_language("ఈ ప్రాజెక్ట్‌లో అథెంటికేషన్ ఎలా పనిచేస్తుంది?", "auto") == "te"
    # Tamil script
    assert ollama_service._detect_language("இந்த திட்டத்தில் அங்கீகாரம் எவ்வாறு செயல்படுகிறது?", "auto") == "ta"
    # English default
    assert ollama_service._detect_language("Where does program execution begin?", "auto") == "en"
    # Explicit selector overrides
    assert ollama_service._detect_language("Where does it begin?", "hi") == "hi"
    assert ollama_service._detect_language("Where does it begin?", "te") == "te"
    assert ollama_service._detect_language("Where does it begin?", "ta") == "ta"

def test_multilingual_offline_fallback():
    hi_res = ollama_service._fallback_ask_question("psf", "requests", "ऑथ कैसे काम करता है?", ["requests/auth.py"], "hi")
    assert hi_res.detected_language == "hi"
    assert "ऑफ़लाइन" in hi_res.answer or "Ollama" in hi_res.answer
    assert "requests/auth.py" in hi_res.cited_files

    te_res = ollama_service._fallback_ask_question("psf", "requests", "ఎలా పనిచేస్తుంది?", ["requests/auth.py"], "te")
    assert te_res.detected_language == "te"
    assert "ఆఫ్‌లైన్‌" in te_res.answer or "Ollama" in te_res.answer

    ta_res = ollama_service._fallback_ask_question("psf", "requests", "எவ்வாறு செயல்படுகிறது?", ["requests/auth.py"], "ta")
    assert ta_res.detected_language == "ta"
    assert "ஆஃப்லைனில்" in ta_res.answer or "Ollama" in ta_res.answer

