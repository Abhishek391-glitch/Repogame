import pytest
from app.models.schemas import RepositoryAnalysis, FileTreeNode, TechStackDetection
from app.services.game_spec_service import game_spec_service

def test_classify_food_delivery():
    analysis = RepositoryAnalysis(
        owner="foodie",
        repo="swiggy-clone-app",
        full_name="foodie/swiggy-clone-app",
        description="A full stack Swiggy food ordering and restaurant delivery platform with real-time courier tracking.",
        stars=120,
        forks=30,
        default_branch="main",
        html_url="https://github.com/foodie/swiggy-clone-app",
        has_readme=True,
        readme_preview="Food delivery app connecting customers with local restaurants and delivery riders.",
        tree=[
            FileTreeNode(path="src/restaurants/menu.ts", type="blob", category="source", name="menu.ts", importance="high"),
            FileTreeNode(path="src/orders/checkout.ts", type="blob", category="source", name="checkout.ts", importance="high"),
            FileTreeNode(path="src/delivery/tracking.ts", type="blob", category="source", name="tracking.ts", importance="medium"),
            FileTreeNode(path="package.json", type="blob", category="config", name="package.json", importance="high"),
        ],
        entry_points=["src/restaurants/menu.ts"],
        config_files=["package.json"],
        test_files=[],
        doc_files=["README.md"]
    )
    category = game_spec_service.classify_category(analysis)
    assert category == "food_delivery"

def test_classify_ecommerce():
    analysis = RepositoryAnalysis(
        owner="shopcorp",
        repo="ecommerce-storefront",
        full_name="shopcorp/ecommerce-storefront",
        description="Modern e-commerce online shop with product catalog, cart management, and Stripe checkout.",
        stars=250,
        forks=50,
        default_branch="main",
        html_url="https://github.com/shopcorp/ecommerce-storefront",
        has_readme=True,
        readme_preview="Shopping platform for merchants and customers.",
        tree=[
            FileTreeNode(path="src/products/catalog.ts", type="blob", category="source", name="catalog.ts", importance="high"),
            FileTreeNode(path="src/cart/store.ts", type="blob", category="source", name="store.ts", importance="high"),
            FileTreeNode(path="src/checkout/payment.ts", type="blob", category="source", name="payment.ts", importance="high"),
            FileTreeNode(path="package.json", type="blob", category="config", name="package.json", importance="high"),
        ],
        entry_points=["src/products/catalog.ts"],
        config_files=["package.json"],
        test_files=[],
        doc_files=["README.md"]
    )
    category = game_spec_service.classify_category(analysis)
    assert category == "ecommerce"

def test_classify_music_audio():
    analysis = RepositoryAnalysis(
        owner="soundlab",
        repo="web-audio-player",
        full_name="soundlab/web-audio-player",
        description="Lightweight music player and playlist manager with frequency spectrum visualizer.",
        stars=80,
        forks=12,
        default_branch="main",
        html_url="https://github.com/soundlab/web-audio-player",
        has_readme=True,
        readme_preview="Play songs, manage playlists, and stream tracks.",
        tree=[
            FileTreeNode(path="src/player/engine.ts", type="blob", category="source", name="engine.ts", importance="high"),
            FileTreeNode(path="src/tracks/playlist.ts", type="blob", category="source", name="playlist.ts", importance="high"),
            FileTreeNode(path="package.json", type="blob", category="config", name="package.json", importance="high"),
        ],
        entry_points=["src/player/engine.ts"],
        config_files=["package.json"],
        test_files=[],
        doc_files=["README.md"]
    )
    category = game_spec_service.classify_category(analysis)
    assert category == "music"

def test_classify_developer_tool():
    analysis = RepositoryAnalysis(
        owner="devtools",
        repo="ast-code-linter",
        full_name="devtools/ast-code-linter",
        description="Fast CLI parser and code linter framework for static analysis.",
        stars=400,
        forks=75,
        default_branch="main",
        html_url="https://github.com/devtools/ast-code-linter",
        has_readme=True,
        readme_preview="CLI tool to parse AST and lint code.",
        tree=[
            FileTreeNode(path="cli/main.go", type="blob", category="entrypoint", name="main.go", importance="high"),
            FileTreeNode(path="parser/ast.go", type="blob", category="source", name="ast.go", importance="high"),
            FileTreeNode(path="go.mod", type="blob", category="config", name="go.mod", importance="high"),
        ],
        entry_points=["cli/main.go"],
        config_files=["go.mod"],
        test_files=[],
        doc_files=["README.md"]
    )
    category = game_spec_service.classify_category(analysis)
    assert category == "developer_tool"

@pytest.mark.asyncio
async def test_game_spec_generation_grounding():
    analysis = RepositoryAnalysis(
        owner="swiggy-fan",
        repo="quick-bites-delivery",
        full_name="swiggy-fan/quick-bites-delivery",
        description="Food ordering app with delivery tracking.",
        stars=10,
        forks=2,
        default_branch="main",
        html_url="https://github.com/swiggy-fan/quick-bites-delivery",
        has_readme=True,
        tree=[
            FileTreeNode(path="src/menu.ts", type="blob", category="source", name="menu.ts", importance="high"),
            FileTreeNode(path="src/orders.ts", type="blob", category="source", name="orders.ts", importance="high"),
            FileTreeNode(path="src/courier.ts", type="blob", category="source", name="courier.ts", importance="medium"),
            FileTreeNode(path="src/user.ts", type="blob", category="source", name="user.ts", importance="medium"),
            FileTreeNode(path="package.json", type="blob", category="config", name="package.json", importance="high"),
        ],
        entry_points=["src/menu.ts"],
        config_files=["package.json"],
        test_files=[],
        doc_files=["README.md"]
    )

    spec = await game_spec_service.generate_game_spec(analysis)

    assert spec.category == "food_delivery"
    assert len(spec.activities) >= 4
    assert len(spec.interactive_objects) >= 4

    tree_paths = {n.path for n in analysis.tree}
    # Crucial acceptance check: all interactive objects reference verified existing paths
    for obj in spec.interactive_objects:
        assert obj.verified_file_path in tree_paths or obj.verified_file_path == "README.md"
        assert obj.xp_reward > 0
        assert obj.name
        assert obj.action_prompt
