import re
import json
import logging
from typing import Dict, Any, List, Optional
from app.models.schemas import (
    RepositoryAnalysis,
    RepoGameSpec,
    GameTheme,
    GameActivity,
    GameInteractiveObject,
    GameCoordinates
)
from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

# In-memory cache for game specifications
_game_spec_cache: Dict[str, RepoGameSpec] = {}

class GameSpecService:
    def classify_category(self, analysis: RepositoryAnalysis) -> str:
        """
        Analyze repository metadata, README, and tree paths to determine the game style.
        Categories: 'food_delivery', 'ecommerce', 'music', 'developer_tool', 'general_explorer'.
        """
        text_corpus = f"{analysis.full_name} {analysis.description or ''} {analysis.readme_preview or ''}".lower()
        paths_str = " ".join([node.path.lower() for node in analysis.tree])
        all_text = f"{text_corpus} {paths_str}"

        scores = {
            "food_delivery": 0,
            "ecommerce": 0,
            "music": 0,
            "developer_tool": 0,
        }

        # Food Delivery Indicators
        food_keywords = [
            "swiggy", "zomato", "food", "restaurant", "menu", "dish", "meal",
            "delivery", "courier", "kitchen", "order_delivery", "uber eats",
            "doordash", "recipe", "eats"
        ]
        for kw in food_keywords:
            if kw in text_corpus:
                scores["food_delivery"] += 4
            elif kw in paths_str:
                scores["food_delivery"] += 2

        # E-Commerce Indicators
        ecommerce_keywords = [
            "ecommerce", "e-commerce", "shop", "store", "cart", "checkout",
            "product", "catalog", "inventory", "stripe", "payment", "merchant",
            "retail", "shopping", "orders"
        ]
        for kw in ecommerce_keywords:
            if kw in text_corpus:
                scores["ecommerce"] += 4
            elif kw in paths_str:
                scores["ecommerce"] += 2

        # Music & Audio Indicators
        music_keywords = [
            "music", "audio", "song", "track", "playlist", "spotify", "sound",
            "player", "synthesizer", "beat", "album", "streaming"
        ]
        for kw in music_keywords:
            if kw in text_corpus:
                scores["music"] += 4
            elif kw in paths_str:
                scores["music"] += 2

        # Developer Tool Indicators
        dev_keywords = [
            "cli", "linter", "compiler", "sdk", "parser", "generator",
            "devtool", "framework", "toolkit", "debugger", "benchmark", "ast"
        ]
        for kw in dev_keywords:
            if kw in text_corpus:
                scores["developer_tool"] += 3
            elif kw in paths_str:
                scores["developer_tool"] += 2

        best_category = max(scores, key=scores.get)
        if scores[best_category] >= 4:
            return best_category

        return "general_explorer"

    def _find_best_path(self, all_paths: List[str], keywords: List[str], fallback: str) -> str:
        """Find a verified path matching one of the keywords, or fallback to an existing path."""
        # 1. Look for filename containing keyword
        for path in all_paths:
            fname = path.split("/")[-1].lower()
            for kw in keywords:
                if kw in fname:
                    return path

        # 2. Look for any path element containing keyword
        for path in all_paths:
            p_lower = path.lower()
            for kw in keywords:
                if kw in p_lower:
                    return path

        # 3. Fallback check
        if fallback in all_paths:
            return fallback

        # 4. Default to first available path
        return all_paths[0] if all_paths else "README.md"

    async def generate_game_spec(self, analysis: RepositoryAnalysis) -> RepoGameSpec:
        """Generate a repository-grounded game specification."""
        cache_key = f"{analysis.owner.lower()}/{analysis.repo.lower()}"
        if cache_key in _game_spec_cache:
            return _game_spec_cache[cache_key]

        category = self.classify_category(analysis)
        all_paths = [n.path for n in analysis.tree if n.type == "blob"] or ["README.md"]
        entry = analysis.entry_points[0] if analysis.entry_points else (all_paths[0] if all_paths else "src/index.js")
        cfg = analysis.config_files[0] if analysis.config_files else (all_paths[0] if all_paths else "package.json")
        tst = analysis.test_files[0] if analysis.test_files else cfg

        if category == "food_delivery":
            spec = self._build_food_delivery_spec(analysis, all_paths, entry, cfg, tst)
        elif category == "ecommerce":
            spec = self._build_ecommerce_spec(analysis, all_paths, entry, cfg, tst)
        elif category == "music":
            spec = self._build_music_spec(analysis, all_paths, entry, cfg, tst)
        elif category == "developer_tool":
            spec = self._build_devtool_spec(analysis, all_paths, entry, cfg, tst)
        else:
            spec = self._build_general_explorer_spec(analysis, all_paths, entry, cfg, tst)

        # Optional: Ask Ollama to enrich title / tagline if available
        try:
            status = await ollama_service.check_status()
            if status.available and status.model_installed:
                spec = await self._enrich_spec_with_ai(spec, analysis)
        except Exception as e:
            logger.info("Ollama enrichment skipped (%s), using grounded template.", e)

        _game_spec_cache[cache_key] = spec
        return spec

    def _build_food_delivery_spec(
        self,
        analysis: RepositoryAnalysis,
        all_paths: List[str],
        entry: str,
        cfg: str,
        tst: str
    ) -> RepoGameSpec:
        menu_file = self._find_best_path(all_paths, ["menu", "restaurant", "food", "dish", "item", "catalog"], entry)
        order_file = self._find_best_path(all_paths, ["order", "cart", "checkout", "booking"], entry)
        delivery_file = self._find_best_path(all_paths, ["delivery", "driver", "courier", "tracking", "route", "dispatch"], cfg)
        customer_file = self._find_best_path(all_paths, ["user", "customer", "auth", "profile", "review"], tst)

        theme = GameTheme(
            category="food_delivery",
            title=f"{analysis.repo} Food Delivery Dash",
            tagline="Pick up delicious orders, navigate the city, and deliver happiness!",
            accent_color="#f97316",
            bg_gradient="from-orange-950/40 via-amber-950/20 to-slate-950",
            badge_label="Food Delivery Sim",
            icon="Bike"
        )

        objects = [
            GameInteractiveObject(
                id="obj_bistro",
                name="Mario's Slice & Pasta Bistro",
                entity_type="restaurant",
                feature_name="Restaurant & Menu Catalog",
                verified_file_path=menu_file,
                explanation=f"Represents the menu and restaurant listings. In code, '{menu_file}' defines dish items, prices, and restaurant metadata.",
                why_it_matters="Understanding the menu and restaurant models is the first step in implementing order features.",
                xp_reward=50,
                action_prompt="Pick Up Fresh Order #101",
                icon="UtensilsCrossed",
                activity_id="act_1",
                coordinates=GameCoordinates(x=140, y=180),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_order_hub",
                name="Central Order Dispatch Hub",
                entity_type="dispatch",
                feature_name="Order Processing & State Management",
                verified_file_path=order_file,
                explanation=f"Handles real-time order creation and status transitions. Backed by '{order_file}' in the project.",
                why_it_matters="Orders connect customers, restaurants, and delivery couriers across the lifecycle.",
                xp_reward=50,
                action_prompt="Confirm & Assign Driver",
                icon="ShoppingBag",
                activity_id="act_2",
                coordinates=GameCoordinates(x=340, y=140),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_courier_depot",
                name="Delivery Scooter Depot",
                entity_type="courier",
                feature_name="Delivery Routing & Live Tracking",
                verified_file_path=delivery_file,
                explanation=f"Simulates courier dispatch and GPS coordinates. Implemented by '{delivery_file}'.",
                why_it_matters="Crucial for route calculations, delivery ETA, and real-time courier updates.",
                xp_reward=50,
                action_prompt="Navigate to Customer Address",
                icon="Bike",
                activity_id="act_3",
                coordinates=GameCoordinates(x=480, y=260),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_customer_doorstep",
                name="Apartment 4B: Customer Doorstep",
                entity_type="customer",
                feature_name="Customer Receipt & Feedback",
                verified_file_path=customer_file,
                explanation=f"Final destination for customer handoff and reviews. Connected to '{customer_file}'.",
                why_it_matters="Handles customer order completion, ratings, and account history.",
                xp_reward=75,
                action_prompt="Complete Delivery & Collect 5★ Rating",
                icon="Home",
                activity_id="act_4",
                coordinates=GameCoordinates(x=640, y=170),
                completed=False
            )
        ]

        activities = [
            GameActivity(
                id="act_1",
                step_number=1,
                title="Pick up Order from the Bistro",
                instruction="Head over to Mario's Bistro to receive order #101 (1x Wood-fired Margherita Pizza).",
                target_object_id="obj_bistro",
                action_label="Pick Up Order",
                simulation_feedback="Order #101 picked up hot and fresh! +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_2",
                step_number=2,
                title="Process Order at Dispatch Hub",
                instruction="Check in at the Order Dispatch Hub to verify items and assign a courier route.",
                target_object_id="obj_order_hub",
                action_label="Confirm Order & Route",
                simulation_feedback="Order confirmed! Route mapped to delivery scooter. +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_3",
                step_number=3,
                title="Start Scooter at Depot",
                instruction="Visit the Scooter Depot, rev up your delivery bike, and grab the hot-bag.",
                target_object_id="obj_courier_depot",
                action_label="Start Delivery Trip",
                simulation_feedback="Scooter en route! GPS live tracking active. +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_4",
                step_number=4,
                title="Deliver Order to Apartment 4B",
                instruction="Ride to the customer's doorstep at Apartment 4B and hand off the hot pizza.",
                target_object_id="obj_customer_doorstep",
                action_label="Hand Off Order",
                simulation_feedback="Delivered! Customer left a glowing 5-star review! +75 XP",
                xp_reward=75
            )
        ]

        summary = {
            "title": "Delivery Run Complete! You Explored Food App Architecture",
            "summary": f"You simulated a complete food delivery workflow for {analysis.full_name}, discovering how menus, orders, dispatch, and customer services connect together.",
            "next_steps": [
                f"Inspect the menu structures in `{menu_file}`.",
                f"Check how order state transitions are handled in `{order_file}`.",
                "Review open issues labeled 'good first issue' to add new food categories or unit tests."
            ]
        }

        return RepoGameSpec(
            repo_full_name=analysis.full_name,
            category="food_delivery",
            title=theme.title,
            tagline=theme.tagline,
            description="A high-energy food delivery simulation mapping restaurant orders, courier routes, and customer drop-offs directly to repository source code.",
            theme=theme,
            activities=activities,
            interactive_objects=objects,
            completion_summary=summary
        )

    def _build_ecommerce_spec(
        self,
        analysis: RepositoryAnalysis,
        all_paths: List[str],
        entry: str,
        cfg: str,
        tst: str
    ) -> RepoGameSpec:
        prod_file = self._find_best_path(all_paths, ["product", "item", "catalog", "goods"], entry)
        cart_file = self._find_best_path(all_paths, ["cart", "basket", "bag", "state"], entry)
        checkout_file = self._find_best_path(all_paths, ["checkout", "payment", "stripe", "billing", "order"], cfg)
        inv_file = self._find_best_path(all_paths, ["inventory", "warehouse", "stock", "db", "admin"], tst)

        theme = GameTheme(
            category="ecommerce",
            title=f"{analysis.repo} SuperStore Market",
            tagline="Browse product aisles, load up your shopping cart, and complete checkout!",
            accent_color="#10b981",
            bg_gradient="from-emerald-950/40 via-teal-950/20 to-slate-950",
            badge_label="E-Commerce Shop Sim",
            icon="Store"
        )

        objects = [
            GameInteractiveObject(
                id="obj_product_aisle",
                name="Electronics & Gadgets Aisle",
                entity_type="catalog",
                feature_name="Product Catalog & Inventory Models",
                verified_file_path=prod_file,
                explanation=f"Displays products, prices, and specifications. In the codebase, '{prod_file}' structures product data and listings.",
                why_it_matters="The core model of any shop application; changing product schemas affects the entire store.",
                xp_reward=50,
                action_prompt="Add Wireless Headphones ($79.99) to Cart",
                icon="Package",
                activity_id="act_1",
                coordinates=GameCoordinates(x=150, y=170),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_cart_station",
                name="Smart Shopping Cart Station",
                entity_type="cart",
                feature_name="Cart State & Subtotal Calculation",
                verified_file_path=cart_file,
                explanation=f"Tracks selected items, quantities, and discount calculations. Handled in '{cart_file}'.",
                why_it_matters="Cart logic ensures prices, tax, and promotional discounts stay consistent.",
                xp_reward=50,
                action_prompt="Apply 10% Promo Code & Review Cart",
                icon="ShoppingCart",
                activity_id="act_2",
                coordinates=GameCoordinates(x=320, y=240),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_checkout_register",
                name="Express Checkout Register",
                entity_type="checkout",
                feature_name="Payment Gateway & Order Finalization",
                verified_file_path=checkout_file,
                explanation=f"Processes customer payments, invoices, and order receipts. Implemented in '{checkout_file}'.",
                why_it_matters="Critical security and transactional boundary for processing customer cards.",
                xp_reward=50,
                action_prompt="Swipe Card & Confirm Payment",
                icon="CreditCard",
                activity_id="act_3",
                coordinates=GameCoordinates(x=500, y=150),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_warehouse_dispatch",
                name="Fulfillment Warehouse Dock",
                entity_type="fulfillment",
                feature_name="Inventory Deduction & Shipping Label",
                verified_file_path=inv_file,
                explanation=f"Updates stock quantities and triggers packaging. Modeled by '{inv_file}'.",
                why_it_matters="Prevents overselling and coordinates packaging with shipping carriers.",
                xp_reward=75,
                action_prompt="Print Shipping Slip & Dispatch Box",
                icon="Truck",
                activity_id="act_4",
                coordinates=GameCoordinates(x=660, y=230),
                completed=False
            )
        ]

        activities = [
            GameActivity(
                id="act_1",
                step_number=1,
                title="Browse & Select Products",
                instruction="Explore the Electronics Aisle to select the Wireless ANC Headphones ($79.99).",
                target_object_id="obj_product_aisle",
                action_label="Add to Cart",
                simulation_feedback="Item added to shopping cart! +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_2",
                step_number=2,
                title="Review Cart & Apply Promo",
                instruction="Inspect the Smart Cart Station, calculate tax, and apply coupon 'REPOQUEST10'.",
                target_object_id="obj_cart_station",
                action_label="Apply Coupon",
                simulation_feedback="Coupon applied! Total: $71.99. +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_3",
                step_number=3,
                title="Process Checkout Payment",
                instruction="Go to the Express Checkout Register to swipe the simulated credit card.",
                target_object_id="obj_checkout_register",
                action_label="Process Payment",
                simulation_feedback="Payment authorized! Order #STORE-882 created. +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_4",
                step_number=4,
                title="Fulfill Order at Warehouse",
                instruction="Walk to the Fulfillment Dock to deduct inventory and generate the shipping label.",
                target_object_id="obj_warehouse_dispatch",
                action_label="Print Shipping Label",
                simulation_feedback="Order fulfilled! Box dispatched for delivery. +75 XP",
                xp_reward=75
            )
        ]

        summary = {
            "title": "Storefront Run Complete! You Explored E-Commerce Architecture",
            "summary": f"You simulated an end-to-end purchasing lifecycle for {analysis.full_name}, discovering how products, cart state, payment transactions, and inventory interact.",
            "next_steps": [
                f"Inspect product schema declarations in `{prod_file}`.",
                f"Review order checkout workflows in `{checkout_file}`.",
                "Check open issues for product filters, tax calculations, or payment gateway tests."
            ]
        }

        return RepoGameSpec(
            repo_full_name=analysis.full_name,
            category="ecommerce",
            title=theme.title,
            tagline=theme.tagline,
            description="A shop simulation where you browse aisles, manage carts, swipe payments, and fulfill orders while mapping features to real source code.",
            theme=theme,
            activities=activities,
            interactive_objects=objects,
            completion_summary=summary
        )

    def _build_music_spec(
        self,
        analysis: RepositoryAnalysis,
        all_paths: List[str],
        entry: str,
        cfg: str,
        tst: str
    ) -> RepoGameSpec:
        track_file = self._find_best_path(all_paths, ["track", "song", "audio", "media"], entry)
        playlist_file = self._find_best_path(all_paths, ["playlist", "queue", "collection"], entry)
        player_file = self._find_best_path(all_paths, ["player", "controls", "playback", "engine"], cfg)
        audio_cfg = self._find_best_path(all_paths, ["visualizer", "stream", "config", "synth"], tst)

        theme = GameTheme(
            category="music",
            title=f"{analysis.repo} Audio Studio & Jukebox",
            tagline="Mix tracks, queue playlists, and tune the audio engine!",
            accent_color="#8b5cf6",
            bg_gradient="from-purple-950/40 via-indigo-950/20 to-slate-950",
            badge_label="Audio & Music Sim",
            icon="Music"
        )

        objects = [
            GameInteractiveObject(
                id="obj_vinyl_shelf",
                name="Vinyl Vault & Track Library",
                entity_type="library",
                feature_name="Audio Metadata & Track Catalog",
                verified_file_path=track_file,
                explanation=f"Stores song titles, artists, duration, and audio formats. Governed by '{track_file}'.",
                why_it_matters="Defines how songs are parsed, stored, and indexed for search.",
                xp_reward=50,
                action_prompt="Load Master Track 'Neon Synths'",
                icon="Disc",
                activity_id="act_1",
                coordinates=GameCoordinates(x=160, y=180),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_playlist_jukebox",
                name="DJ Playlist Jukebox",
                entity_type="playlist",
                feature_name="Queue Management & Playlists",
                verified_file_path=playlist_file,
                explanation=f"Maintains track playback order, shuffle, and repeat state. Implemented in '{playlist_file}'.",
                why_it_matters="Controls the dynamic queue that the audio player consumes.",
                xp_reward=50,
                action_prompt="Queue 'Synthwave Drive' into Playlist",
                icon="ListMusic",
                activity_id="act_2",
                coordinates=GameCoordinates(x=340, y=140),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_dj_mixer",
                name="Studio Mixing Console",
                entity_type="player",
                feature_name="Audio Player & Playback Engine",
                verified_file_path=player_file,
                explanation=f"Executes play, pause, seek, and volume modulation. Anchored in '{player_file}'.",
                why_it_matters="Directly interfaces with browser/device audio output buffers.",
                xp_reward=50,
                action_prompt="Press Play & Slide Bass Equalizer",
                icon="Sliders",
                activity_id="act_3",
                coordinates=GameCoordinates(x=500, y=250),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_visualizer_screen",
                name="Frequency Visualizer Screen",
                entity_type="visualizer",
                feature_name="Audio Spectrum & Event Hooks",
                verified_file_path=audio_cfg,
                explanation=f"Renders audio waveforms and broadcasts playback events. Configured in '{audio_cfg}'.",
                why_it_matters="Powers interactive waveform displays and playback synchronization.",
                xp_reward=75,
                action_prompt="Sync Spectrum Waveforms",
                icon="Activity",
                activity_id="act_4",
                coordinates=GameCoordinates(x=660, y=170),
                completed=False
            )
        ]

        activities = [
            GameActivity(
                id="act_1",
                step_number=1,
                title="Select Song from Vault",
                instruction="Browse the Vinyl Vault to select the high-fidelity track 'Neon Synths'.",
                target_object_id="obj_vinyl_shelf",
                action_label="Select Track",
                simulation_feedback="Track loaded into DJ deck buffer! +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_2",
                step_number=2,
                title="Build Playlist Queue",
                instruction="Step up to the Jukebox to organize the upcoming listening session.",
                target_object_id="obj_playlist_jukebox",
                action_label="Add to Queue",
                simulation_feedback="Playlist compiled with 4 upcoming songs! +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_3",
                step_number=3,
                title="Spin the Studio Mixer",
                instruction="Move to the Mixing Console and start playback with crisp stereo balance.",
                target_object_id="obj_dj_mixer",
                action_label="Start Playback",
                simulation_feedback="Audio stream playing smoothly at 320 kbps! +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_4",
                step_number=4,
                title="Sync Frequency Visualizer",
                instruction="Check the Visualizer Screen to ensure waveform spectrum bars respond to the bass.",
                target_object_id="obj_visualizer_screen",
                action_label="Calibrate Waveform",
                simulation_feedback="Waveforms in sync! Perfect acoustics achieved. +75 XP",
                xp_reward=75
            )
        ]

        summary = {
            "title": "Studio Session Complete! You Explored Audio Architecture",
            "summary": f"You operated an interactive sound studio for {analysis.full_name}, uncovering how track metadata, playlist queues, audio players, and visualizer engines coordinate.",
            "next_steps": [
                f"Inspect track schemas in `{track_file}`.",
                f"Explore playback loops in `{player_file}`.",
                "Consider contributing audio keyboard shortcuts or format support."
            ]
        }

        return RepoGameSpec(
            repo_full_name=analysis.full_name,
            category="music",
            title=theme.title,
            tagline=theme.tagline,
            description="An interactive audio workstation simulation where you load tracks, organize playlists, and operate player decks tied to real code files.",
            theme=theme,
            activities=activities,
            interactive_objects=objects,
            completion_summary=summary
        )

    def _build_devtool_spec(
        self,
        analysis: RepositoryAnalysis,
        all_paths: List[str],
        entry: str,
        cfg: str,
        tst: str
    ) -> RepoGameSpec:
        core_file = self._find_best_path(all_paths, ["core", "engine", "parser", "compiler", "cli"], entry)
        api_file = self._find_best_path(all_paths, ["api", "route", "handler", "server"], entry)

        theme = GameTheme(
            category="developer_tool",
            title=f"{analysis.repo} Systems Control Lab",
            tagline="Initialize components, route workloads, verify tests, and deploy!",
            accent_color="#06b6d4",
            bg_gradient="from-cyan-950/40 via-sky-950/20 to-slate-950",
            badge_label="Systems & DevTool Sim",
            icon="Terminal"
        )

        objects = [
            GameInteractiveObject(
                id="obj_entry_terminal",
                name="Primary Launch Terminal",
                entity_type="entrypoint",
                feature_name="System Entry Point & Initialization",
                verified_file_path=entry,
                explanation=f"Execution begins here. In code, '{entry}' bootstraps runtime configs and registers core services.",
                why_it_matters="Every debugging or tracing journey starts at this entry point.",
                xp_reward=50,
                action_prompt="Boot System Core & Check Environment",
                icon="Terminal",
                activity_id="act_1",
                coordinates=GameCoordinates(x=150, y=170),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_manifest_station",
                name="Dependencies & Settings Console",
                entity_type="config",
                feature_name="Build Manifest & Runtime Environment",
                verified_file_path=cfg,
                explanation=f"Declares dependencies, compiler options, and build targets. Backed by '{cfg}'.",
                why_it_matters="Knowing how dependencies are pinned ensures reproducible local builds.",
                xp_reward=50,
                action_prompt="Inspect Dependencies & Config Flags",
                icon="Settings",
                activity_id="act_2",
                coordinates=GameCoordinates(x=320, y=240),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_test_proving_grounds",
                name="Automated Test Proving Grounds",
                entity_type="test",
                feature_name="Verification Suite & Quality Assurance",
                verified_file_path=tst,
                explanation=f"Validates correctness and prevents regressions. Test logic resides in '{tst}'.",
                why_it_matters="Writing a test is often the most appreciated way to contribute to open source.",
                xp_reward=50,
                action_prompt="Execute Verification Suite (Green Lights)",
                icon="ShieldCheck",
                activity_id="act_3",
                coordinates=GameCoordinates(x=500, y=140),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_dispatch_gateway",
                name="Network & Workload Switchboard",
                entity_type="core",
                feature_name="Core Logic & Request Dispatch",
                verified_file_path=core_file,
                explanation=f"The algorithmic engine processing inputs and returning outputs. Located in '{core_file}'.",
                why_it_matters="Houses the primary business logic and data transformations.",
                xp_reward=75,
                action_prompt="Route Production Workload",
                icon="Cpu",
                activity_id="act_4",
                coordinates=GameCoordinates(x=660, y=230),
                completed=False
            )
        ]

        activities = [
            GameActivity(
                id="act_1",
                step_number=1,
                title="Initialize System Entry Point",
                instruction="Step up to the Launch Terminal to bootstrap the core runtime.",
                target_object_id="obj_entry_terminal",
                action_label="Bootstrap Engine",
                simulation_feedback="Runtime initialized successfully! 0 errors. +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_2",
                step_number=2,
                title="Verify Manifests & Packages",
                instruction="Walk over to the Settings Console to check required packages and env flags.",
                target_object_id="obj_manifest_station",
                action_label="Validate Config",
                simulation_feedback="All dependencies resolved and verified. +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_3",
                step_number=3,
                title="Run Proving Grounds Test Suite",
                instruction="Trigger the automated test suite to confirm zero regressions.",
                target_object_id="obj_test_proving_grounds",
                action_label="Run Tests",
                simulation_feedback="All tests passing! 100% green build. +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_4",
                step_number=4,
                title="Dispatch Core Engine Workload",
                instruction="Activate the Network Switchboard to route simulated user requests through the core.",
                target_object_id="obj_dispatch_gateway",
                action_label="Route Workload",
                simulation_feedback="Core dispatch pipeline healthy! Low latency confirmed. +75 XP",
                xp_reward=75
            )
        ]

        summary = {
            "title": "Systems Check Complete! You Explored Tool Architecture",
            "summary": f"You operated a full systems simulation for {analysis.full_name}, discovering how entry points, build configs, test suites, and core logic interact.",
            "next_steps": [
                f"Examine `{entry}` to see initial argument parsing or routing.",
                f"Inspect `{tst}` to learn how authors verify new code.",
                "Review open issues for feature requests or performance improvements."
            ]
        }

        return RepoGameSpec(
            repo_full_name=analysis.full_name,
            category="developer_tool",
            title=theme.title,
            tagline=theme.tagline,
            description="A high-tech systems simulation where you initialize terminals, verify package manifests, run test suites, and dispatch core workloads.",
            theme=theme,
            activities=activities,
            interactive_objects=objects,
            completion_summary=summary
        )

    def _build_general_explorer_spec(
        self,
        analysis: RepositoryAnalysis,
        all_paths: List[str],
        entry: str,
        cfg: str,
        tst: str
    ) -> RepoGameSpec:
        doc_file = self._find_best_path(all_paths, ["readme", "contributing", "guide", "doc"], "README.md")
        src_file = self._find_best_path(all_paths, ["main", "index", "app", "core", "lib"], entry)

        theme = GameTheme(
            category="general_explorer",
            title=f"{analysis.repo} Code Expedition",
            tagline="Explore pavilions, discover real files, and uncover how this project works!",
            accent_color="#3b82f6",
            bg_gradient="from-blue-950/40 via-indigo-950/20 to-slate-950",
            badge_label="Codebase Adventure",
            icon="Compass"
        )

        objects = [
            GameInteractiveObject(
                id="obj_welcome_pavilion",
                name="Welcome & Documentation Pavilion",
                entity_type="docs",
                feature_name="Project Overview & Setup Guide",
                verified_file_path=doc_file,
                explanation=f"Introduces newcomers to the project purpose, architecture, and setup instructions. Found in '{doc_file}'.",
                why_it_matters="The starting point for every prospective contributor.",
                xp_reward=50,
                action_prompt="Read Project Guide & Mission",
                icon="BookOpen",
                activity_id="act_1",
                coordinates=GameCoordinates(x=150, y=170),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_code_workshop",
                name="Source Code Workshop",
                entity_type="source",
                feature_name="Core Logic & Feature Implementation",
                verified_file_path=src_file,
                explanation=f"Houses the functional modules that execute the application logic. Located at '{src_file}'.",
                why_it_matters="Where features are implemented and bugs are resolved.",
                xp_reward=50,
                action_prompt="Inspect Source Definitions",
                icon="Code",
                activity_id="act_2",
                coordinates=GameCoordinates(x=320, y=240),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_config_house",
                name="Settings & Manifest House",
                entity_type="config",
                feature_name="Dependency & Build Manifest",
                verified_file_path=cfg,
                explanation=f"Specifies language versions, build tools, and third-party packages. Encapsulated in '{cfg}'.",
                why_it_matters="Essential for understanding project dependencies and environments.",
                xp_reward=50,
                action_prompt="Review Build Manifest",
                icon="Settings",
                activity_id="act_3",
                coordinates=GameCoordinates(x=500, y=140),
                completed=False
            ),
            GameInteractiveObject(
                id="obj_contrib_bridge",
                name="Contributor Gateway Bridge",
                entity_type="contributing",
                feature_name="Contribution Guidelines & Testing",
                verified_file_path=tst,
                explanation=f"Verifies code behavior and guides PR submissions. Tied to '{tst}'.",
                why_it_matters="Ensures high code quality before pull requests are merged.",
                xp_reward=75,
                action_prompt="Cross the Contributor Bridge",
                icon="Sparkles",
                activity_id="act_4",
                coordinates=GameCoordinates(x=660, y=230),
                completed=False
            )
        ]

        activities = [
            GameActivity(
                id="act_1",
                step_number=1,
                title="Visit Documentation Pavilion",
                instruction="Head to the Welcome Pavilion to learn what this codebase accomplishes.",
                target_object_id="obj_welcome_pavilion",
                action_label="Read Docs",
                simulation_feedback="Project documentation explored! +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_2",
                step_number=2,
                title="Enter the Code Workshop",
                instruction="Walk into the Code Workshop to examine primary source files.",
                target_object_id="obj_code_workshop",
                action_label="Inspect Code",
                simulation_feedback="Primary source modules inspected! +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_3",
                step_number=3,
                title="Check Settings & Manifests",
                instruction="Visit the Settings House to inspect project dependencies.",
                target_object_id="obj_config_house",
                action_label="Inspect Settings",
                simulation_feedback="Configuration parameters mapped! +50 XP",
                xp_reward=50
            ),
            GameActivity(
                id="act_4",
                step_number=4,
                title="Cross Contributor Gateway",
                instruction="Cross the final bridge to discover how to make your first contribution.",
                target_object_id="obj_contrib_bridge",
                action_label="Cross Bridge",
                simulation_feedback="Gateway reached! Ready to contribute! +75 XP",
                xp_reward=75
            )
        ]

        summary = {
            "title": "Expedition Complete! You Explored the Codebase",
            "summary": f"You explored the architecture and organization of {analysis.full_name}, discovering documentation, core source files, configurations, and verification routines.",
            "next_steps": [
                f"Read the project overview in `{doc_file}`.",
                f"Inspect the main logic in `{src_file}`.",
                "Check out the issues list to start contributing."
            ]
        }

        return RepoGameSpec(
            repo_full_name=analysis.full_name,
            category="general_explorer",
            title=theme.title,
            tagline=theme.tagline,
            description="A welcoming exploration game taking you through key repository pavilions and revealing verified source files.",
            theme=theme,
            activities=activities,
            interactive_objects=objects,
            completion_summary=summary
        )

    async def _enrich_spec_with_ai(self, spec: RepoGameSpec, analysis: RepositoryAnalysis) -> RepoGameSpec:
        """Use local Ollama to enrich title and descriptions while preserving verified files."""
        prompt = f"""You are RepoQuest's creative game director.
Repository: {analysis.full_name}
Category: {spec.category}
Description: {analysis.description or 'Open source software'}
Verified Files in Game: {', '.join([o.verified_file_path for o in spec.interactive_objects])}

Generate a short, playful, beginner-friendly title and tagline for this repository's interactive game.
Return JSON with EXACTLY this structure:
{{
  "title": "{analysis.repo} Adventure",
  "tagline": "Short fun sentence about what players do in this game."
}}
"""
        messages = [
            {"role": "system", "content": "You are a concise, creative game designer. Output valid JSON only."},
            {"role": "user", "content": prompt}
        ]
        raw = await ollama_service._chat_completion(messages, json_format=True)
        data = ollama_service._extract_json(raw)
        if data and "title" in data and "tagline" in data:
            spec.title = data["title"]
            spec.tagline = data["tagline"]
            spec.theme.title = data["title"]
            spec.theme.tagline = data["tagline"]
        return spec

game_spec_service = GameSpecService()
