import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import { RepoGameSpec, GameInteractiveObject } from "../../types";

interface GameCanvasProps {
  spec: RepoGameSpec;
  discoveredObjectIds: string[];
  activeObjectId: string | null;
  onInteractWithObject: (object: GameInteractiveObject) => void;
  isPaused: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  spec,
  discoveredObjectIds,
  activeObjectId,
  onInteractWithObject,
  isPaused,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  // Keep latest props in refs for Phaser scene access
  const discoveredRef = useRef<string[]>(discoveredObjectIds);
  discoveredRef.current = discoveredObjectIds;

  const activeObjRef = useRef<string | null>(activeObjectId);
  activeObjRef.current = activeObjectId;

  const onInteractRef = useRef(onInteractWithObject);
  onInteractRef.current = onInteractWithObject;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any old instance
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }

    const worldWidth = 820;
    const worldHeight = 440;

    class CodeAdventureScene extends Phaser.Scene {
      private player!: Phaser.GameObjects.Container;
      private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
      private wasdKeys!: {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
        E: Phaser.Input.Keyboard.Key;
        SPACE: Phaser.Input.Keyboard.Key;
      };
      private targetX: number = 80;
      private targetY: number = 240;
      private movingToClick: boolean = false;
      private stations: Array<{
        obj: GameInteractiveObject;
        container: Phaser.GameObjects.Container;
        glowCircle: Phaser.GameObjects.Arc;
        promptText: Phaser.GameObjects.Text;
        checkMark: Phaser.GameObjects.Text;
      }> = [];
      private nearbyStation: GameInteractiveObject | null = null;
      private proximityPrompt!: Phaser.GameObjects.Container;
      private proximityLabel!: Phaser.GameObjects.Text;
      private animStep: number = 0;

      constructor() {
        super({ key: "CodeAdventureScene" });
      }

      preload() {
        // Procedural assets are generated in create()
      }

      create() {
        const category = spec.category;

        // 1. World Background & Themed Paths
        const bg = this.add.graphics();
        this.drawEnvironmentBackground(bg, category, worldWidth, worldHeight);

        // 2. Stations / Buildings
        this.stations = [];
        spec.interactive_objects.forEach((obj, idx) => {
          const container = this.add.container(obj.coordinates.x, obj.coordinates.y);

          // Pulsing Glow for Target
          const glowCircle = this.add.circle(0, 0, 42, 0x06b6d4, 0.15);
          glowCircle.setStrokeStyle(2, 0x38bdf8, 0.5);

          // Building Base Box
          const bldg = this.add.graphics();
          this.drawBuildingSprite(bldg, obj.entity_type, category, idx);

          // Station Label Tag
          const labelBg = this.add.graphics();
          labelBg.fillStyle(0x0f172a, 0.85);
          labelBg.lineStyle(1, 0x334155, 1);
          labelBg.fillRoundedRect(-65, 30, 130, 22, 6);
          labelBg.strokeRoundedRect(-65, 30, 130, 22, 6);

          const label = this.add.text(0, 41, obj.name, {
            fontSize: "10px",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            color: "#f8fafc",
            align: "center",
          });
          label.setOrigin(0.5, 0.5);

          // Floating Action Prompt (appears when nearby)
          const promptText = this.add.text(0, -38, `[E] ${obj.action_prompt}`, {
            fontSize: "10px",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            color: "#38bdf8",
            backgroundColor: "#082f49",
            padding: { x: 6, y: 3 },
          });
          promptText.setOrigin(0.5, 0.5);
          promptText.setVisible(false);

          // Checkmark Icon if discovered
          const isDone = discoveredRef.current.includes(obj.id);
          const checkMark = this.add.text(26, -26, isDone ? "✓" : "", {
            fontSize: "12px",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            color: "#10b981",
            backgroundColor: "#064e3b",
            padding: { x: 4, y: 2 },
          });
          checkMark.setOrigin(0.5, 0.5);

          container.add([glowCircle, bldg, labelBg, label, promptText, checkMark]);
          container.setSize(80, 80);
          container.setInteractive({ useHandCursor: true });

          container.on("pointerdown", () => {
            // Click to interact or walk to station
            const dist = Phaser.Math.Distance.Between(
              this.player.x,
              this.player.y,
              obj.coordinates.x,
              obj.coordinates.y
            );
            if (dist < 80) {
              onInteractRef.current(obj);
            } else {
              this.targetX = obj.coordinates.x - 40;
              this.targetY = obj.coordinates.y;
              this.movingToClick = true;
            }
          });

          this.stations.push({
            obj,
            container,
            glowCircle,
            promptText,
            checkMark,
          });
        });

        // 3. Player Character (Explorer / Courier / Shopper)
        this.player = this.add.container(60, 220);
        const playerGraphics = this.add.graphics();
        this.drawPlayerAvatar(playerGraphics, category);

        // Player Name Tag
        const pLabel = this.add.text(0, -22, "You", {
          fontSize: "9px",
          fontFamily: "monospace",
          color: "#cbd5e1",
          backgroundColor: "#0f172a",
          padding: { x: 3, y: 1 },
        });
        pLabel.setOrigin(0.5, 0.5);

        this.player.add([playerGraphics, pLabel]);
        this.player.setSize(28, 28);

        // 4. Proximity Floating Toast
        this.proximityPrompt = this.add.container(worldWidth / 2, worldHeight - 26);
        const pToastBg = this.add.graphics();
        pToastBg.fillStyle(0x0f172a, 0.9);
        pToastBg.lineStyle(1, 0x06b6d4, 0.8);
        pToastBg.fillRoundedRect(-160, -14, 320, 28, 14);
        pToastBg.strokeRoundedRect(-160, -14, 320, 28, 14);

        this.proximityLabel = this.add.text(0, 0, "Press [E] or Click to Explore Station", {
          fontSize: "11px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          color: "#38bdf8",
        });
        this.proximityLabel.setOrigin(0.5, 0.5);

        this.proximityPrompt.add([pToastBg, this.proximityLabel]);
        this.proximityPrompt.setVisible(false);

        // 5. Controls
        if (this.input.keyboard) {
          this.cursors = this.input.keyboard.createCursorKeys();
          this.wasdKeys = {
            W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
            SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
          };
        }

        // Click to move anywhere on map
        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          this.targetX = Phaser.Math.Clamp(pointer.x, 30, worldWidth - 30);
          this.targetY = Phaser.Math.Clamp(pointer.y, 40, worldHeight - 40);
          this.movingToClick = true;
        });
      }

      update(time: number, delta: number) {
        if (isPausedRef.current) return;

        let vx = 0;
        let vy = 0;
        const speed = 2.8;

        // Keyboard Movement
        const left = this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown;
        const right = this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown;
        const up = this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown;
        const down = this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown;

        if (left) vx -= speed;
        if (right) vx += speed;
        if (up) vy -= speed;
        if (down) vy += speed;

        if (vx !== 0 || vy !== 0) {
          this.movingToClick = false;
          this.player.x += vx;
          this.player.y += vy;
        } else if (this.movingToClick) {
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.targetX, this.targetY);
          if (dist > 4) {
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.targetX, this.targetY);
            this.player.x += Math.cos(angle) * speed;
            this.player.y += Math.sin(angle) * speed;
          } else {
            this.movingToClick = false;
          }
        }

        // Clamp boundaries
        this.player.x = Phaser.Math.Clamp(this.player.x, 24, worldWidth - 24);
        this.player.y = Phaser.Math.Clamp(this.player.y, 30, worldHeight - 30);

        // Gentle Bobbing Animation
        if (vx !== 0 || vy !== 0 || this.movingToClick) {
          this.animStep += 0.2;
          this.player.scaleY = 1 + Math.sin(this.animStep) * 0.05;
        } else {
          this.player.scaleY = 1;
        }

        // Station Proximity & Highlights
        let foundNearby: GameInteractiveObject | null = null;
        let closestDist = 999;

        for (const s of this.stations) {
          const isTarget = activeObjRef.current === s.obj.id;
          const isDone = discoveredRef.current.includes(s.obj.id);

          // Update checkmark
          s.checkMark.setText(isDone ? "✓" : "");

          // Pulse target
          if (isTarget) {
            s.glowCircle.setScale(1 + Math.sin(time / 200) * 0.12);
            s.glowCircle.setAlpha(0.35 + Math.sin(time / 200) * 0.15);
            s.glowCircle.setStrokeStyle(2, 0xf59e0b, 0.9);
          } else {
            s.glowCircle.setScale(1);
            s.glowCircle.setAlpha(0.12);
            s.glowCircle.setStrokeStyle(1, 0x38bdf8, 0.4);
          }

          const dist = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            s.obj.coordinates.x,
            s.obj.coordinates.y
          );

          if (dist < 65) {
            s.promptText.setVisible(true);
            if (dist < closestDist) {
              closestDist = dist;
              foundNearby = s.obj;
            }
          } else {
            s.promptText.setVisible(false);
          }
        }

        this.nearbyStation = foundNearby;

        // Update Bottom Proximity Banner
        if (foundNearby) {
          this.proximityPrompt.setVisible(true);
          this.proximityLabel.setText(`Press [E] or Click: ${foundNearby.action_prompt}`);
        } else {
          this.proximityPrompt.setVisible(false);
        }

        // Interaction Key Trigger (E or Space)
        if (
          (Phaser.Input.Keyboard.JustDown(this.wasdKeys?.E) ||
            Phaser.Input.Keyboard.JustDown(this.wasdKeys?.SPACE)) &&
          foundNearby
        ) {
          onInteractRef.current(foundNearby);
        }
      }

      private drawEnvironmentBackground(
        g: Phaser.GameObjects.Graphics,
        category: string,
        w: number,
        h: number
      ) {
        // Base Ground Color
        g.fillStyle(0x090d16, 1);
        g.fillRect(0, 0, w, h);

        if (category === "food_delivery") {
          // City Layout: Roads and intersections
          g.fillStyle(0x1e293b, 1);
          // Main East-West Boulevard
          g.fillRect(0, 190, w, 60);
          // North-South Avenues
          g.fillRect(110, 0, 55, h);
          g.fillRect(310, 0, 55, h);
          g.fillRect(450, 0, 55, h);
          g.fillRect(630, 0, 55, h);

          // Road Dashed Lines
          g.lineStyle(2, 0xfacc15, 0.7);
          for (let x = 10; x < w; x += 30) {
            g.lineBetween(x, 220, x + 15, 220);
          }

          // Grass sidewalks
          g.fillStyle(0x064e3b, 0.35);
          g.fillRect(170, 30, 130, 150);
          g.fillRect(375, 30, 65, 150);
          g.fillRect(515, 30, 105, 150);
          g.fillRect(170, 260, 130, 150);
          g.fillRect(515, 260, 105, 150);
        } else if (category === "ecommerce") {
          // Department Store Tile Grid
          g.fillStyle(0x0f172a, 1);
          g.fillRect(20, 20, w - 40, h - 40);

          // Store Aisles & Tile Grid
          g.lineStyle(1, 0x1e293b, 0.8);
          for (let x = 20; x <= w - 20; x += 40) {
            g.lineBetween(x, 20, x, h - 20);
          }
          for (let y = 20; y <= h - 20; y += 40) {
            g.lineBetween(20, y, w - 20, y);
          }

          // Department Zones (Aisle Carpet Mats)
          g.fillStyle(0x065f46, 0.25);
          g.fillRoundedRect(110, 120, 90, 110, 8);
          g.fillStyle(0x0369a1, 0.25);
          g.fillRoundedRect(280, 190, 90, 110, 8);
          g.fillStyle(0x4338ca, 0.25);
          g.fillRoundedRect(460, 100, 90, 110, 8);
          g.fillStyle(0x991b1b, 0.25);
          g.fillRoundedRect(620, 180, 90, 110, 8);
        } else if (category === "music") {
          // Audio Lounge Stage with Neon Traces
          g.fillStyle(0x130e26, 1);
          g.fillRect(0, 0, w, h);

          // Soundwave tracks
          g.lineStyle(1, 0x7c3aed, 0.3);
          for (let y = 60; y < h; y += 40) {
            g.lineBetween(20, y, w - 20, y);
          }

          // Stage Circles
          g.fillStyle(0x581c87, 0.3);
          g.fillCircle(160, 180, 50);
          g.fillCircle(340, 140, 50);
          g.fillCircle(500, 250, 50);
          g.fillCircle(660, 170, 50);
        } else {
          // Systems & General Explorer: Modern Hub Grid with Glowing Conduits
          g.fillStyle(0x0b132b, 1);
          g.fillRect(0, 0, w, h);

          // Circuit Conduits linking stations
          g.lineStyle(2, 0x0284c7, 0.4);
          g.lineBetween(150, 170, 320, 240);
          g.lineBetween(320, 240, 500, 140);
          g.lineBetween(500, 140, 660, 230);
          g.lineBetween(150, 170, 660, 230);

          // Node Pods
          [
            [150, 170],
            [320, 240],
            [500, 140],
            [660, 230],
          ].forEach(([px, py]) => {
            g.fillStyle(0x0c4a6e, 0.35);
            g.fillCircle(px, py, 45);
          });
        }
      }

      private drawBuildingSprite(
        g: Phaser.GameObjects.Graphics,
        type: string,
        category: string,
        idx: number
      ) {
        // Colors palette per genre
        const colors = [0x0284c7, 0x059669, 0xd97706, 0x7c3aed];
        const primary = colors[idx % colors.length];

        // Station Building Base
        g.fillStyle(0x1e293b, 0.95);
        g.lineStyle(2, primary, 1);
        g.fillRoundedRect(-24, -24, 48, 48, 10);
        g.strokeRoundedRect(-24, -24, 48, 48, 10);

        // Icon Graphic Inside
        g.fillStyle(primary, 0.8);
        if (category === "food_delivery") {
          if (type === "restaurant") {
            // Pizza / Plate shape
            g.fillCircle(0, 0, 11);
            g.fillStyle(0xf8fafc, 0.9);
            g.fillCircle(-3, -2, 2.5);
            g.fillCircle(3, 2, 2.5);
          } else if (type === "dispatch") {
            // Package Box
            g.fillRect(-10, -10, 20, 20);
            g.lineStyle(1.5, 0xf8fafc, 1);
            g.lineBetween(-10, 0, 10, 0);
          } else if (type === "courier") {
            // Scooter Wheels
            g.fillCircle(-8, 6, 5);
            g.fillCircle(8, 6, 5);
            g.lineStyle(2, primary, 1);
            g.lineBetween(-8, 6, 0, -4);
            g.lineBetween(0, -4, 8, 6);
          } else {
            // Home / Customer Door
            g.fillRect(-8, -2, 16, 14);
            g.fillTriangle(-12, -2, 0, -14, 12, -2);
          }
        } else if (category === "ecommerce") {
          if (type === "catalog") {
            // Shelf / Items
            g.fillRect(-11, -8, 22, 5);
            g.fillRect(-11, 2, 22, 5);
          } else if (type === "cart") {
            // Shopping Cart Basket
            g.fillRect(-9, -7, 18, 12);
            g.fillCircle(-5, 9, 3);
            g.fillCircle(5, 9, 3);
          } else if (type === "checkout") {
            // Credit Card Terminal
            g.fillRect(-10, -10, 20, 16);
            g.lineStyle(1, 0x10b981, 1);
            g.lineBetween(-7, -4, 7, -4);
          } else {
            // Warehouse Forklift Box
            g.fillRect(-12, -8, 24, 18);
          }
        } else {
          // Systems / General Terminal Console
          g.fillRect(-10, -9, 20, 15);
          g.fillStyle(0x38bdf8, 1);
          g.fillRect(-7, -6, 14, 9);
          g.fillRect(-3, 6, 6, 4);
        }
      }

      private drawPlayerAvatar(g: Phaser.GameObjects.Graphics, category: string) {
        if (category === "food_delivery") {
          // Delivery Scooter & Courier Helmet
          g.fillStyle(0xf97316, 1);
          g.fillCircle(0, -6, 7); // Helmet
          g.fillStyle(0x0f172a, 1);
          g.fillRect(-3, -7, 6, 3); // Visor

          g.fillStyle(0x334155, 1);
          g.fillRect(-9, 1, 18, 8); // Bike chassis
          g.fillStyle(0x0284c7, 1);
          g.fillRect(-8, -4, 6, 7); // Delivery Thermal Backpack

          g.fillStyle(0x0f172a, 1);
          g.fillCircle(-8, 9, 3.5); // Wheel 1
          g.fillCircle(8, 9, 3.5); // Wheel 2
        } else {
          // Friendly Explorer with Backpack
          g.fillStyle(0x38bdf8, 1);
          g.fillCircle(0, -6, 7); // Head

          g.fillStyle(0x0284c7, 1);
          g.fillRect(-6, 0, 12, 12); // Torso

          g.fillStyle(0xf59e0b, 1);
          g.fillRect(-8, 2, 3, 8); // Backpack

          g.fillStyle(0x0f172a, 1);
          g.fillRect(-5, 12, 4, 6); // Left leg
          g.fillRect(1, 12, 4, 6); // Right leg
        }
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: worldWidth,
      height: worldHeight,
      backgroundColor: "#090d16",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
        },
      },
      scene: [CodeAdventureScene],
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [spec.category]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950 flex flex-col items-center">
      <div
        ref={containerRef}
        className="w-full flex items-center justify-center cursor-crosshair overflow-hidden"
        style={{ minHeight: "440px" }}
      />
    </div>
  );
};
