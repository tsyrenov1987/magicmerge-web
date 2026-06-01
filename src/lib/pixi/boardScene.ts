/**
 * Board scene — square N×N grid plus inventory row, with interactive items.
 *
 * Unified address space:
 *   slot 0 .. cols²-1            → board
 *   slot cols² .. cols²+invSize-1 → inventory
 *
 * Drag/drop and generator-tap both surface via callbacks the GameCanvas
 * wires to actions.applyDrop / applyGeneratorTap.
 */

import { Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { createItemSprite, attachIdleAnimation } from "./itemSprite";
import { tweenTo, tweenAlpha, squashPulse, ease } from "./tween";
import {
  spawnSparkleBurst,
  spawnTierRing,
  spawnScorePopup,
  spawnComboBanner,
  spawnChainBanner,
  spawnJackpotBanner,
} from "./effects";
import { isGenerator, type BoardItem } from "$lib/game/boardItem";
import type { LineId } from "$lib/game/lines";
import { onTextureLoaded } from "$lib/assets/loader";

export interface BoardSceneOptions {
  parent: Container;
  width: number;
  height: number;
  margin?: number;
  /** Drag/drop ended — caller resolves the move. Return true to acknowledge. */
  onDrop: (fromIdx: number, toIdx: number) => boolean;
  /** Tap on a generator (board only) — caller spawns an item. */
  onGeneratorTap: (boardIdx: number) => boolean;
}

const CELL_BG = 0x2c2240;
const CELL_BG_HOVER = 0x4a3a70;
const CELL_BORDER = 0x423560;
const INVENTORY_BG = 0x1f1733;
const CORNER_RADIUS_RATIO = 0.18;
const CELL_GAP_RATIO = 0.06;
const ITEM_INSET_RATIO = 0.78;

const PICKUP_SCALE = 1.12;
const PICKUP_DURATION = 120;
const DROP_BACK_DURATION = 220;
const MERGE_PULSE_DURATION = 280;
const MERGE_FADE_DURATION = 180;
const TAP_THRESHOLD_PX = 8;
const TAP_THRESHOLD_MS = 250;

interface SlotPos {
  cx: number;
  cy: number;
}

export class BoardScene {
  private parent: Container;
  private root: Container;
  private cellsLayer: Container;
  private itemsLayer: Container;
  private dragLayer: Container;
  private effectsLayer!: Container;
  private cellSize = 0;
  private boardCols = 0;
  private boardCellCount = 0;
  private inventorySize = 0;
  private margin: number;
  private onDrop: BoardSceneOptions["onDrop"];
  private onGeneratorTap: BoardSceneOptions["onGeneratorTap"];

  /** Per-slot positions (board first, then inventory) in local space */
  private slots: SlotPos[] = [];
  /** Per-slot cell-rect Graphics */
  private cellGraphics: Graphics[] = [];
  /** Per-slot item sprite refs */
  private spriteAt: Array<Container | null> = [];
  /** True if slot is a generator (used to distinguish tap vs drag) */
  private isGeneratorAt: boolean[] = [];

  /** Snapshot of last rebuild state so a texture-loaded callback can re-render. */
  private lastBuild: { cols: number; board: Array<BoardItem | null>; inventory: Array<BoardItem | null> } | null = null;
  private unsubscribeTexture: (() => void) | null = null;
  /** Coalesce many texture-loaded events into a single rebuild via rAF. */
  private rebuildScheduled = false;

  /** Drag state */
  private dragging:
    | {
        fromIdx: number;
        sprite: Container;
        origin: SlotPos;
        pointerOffset: { dx: number; dy: number };
        hoverIdx: number;
        startX: number;
        startY: number;
        startTimeMs: number;
        movedPastThreshold: boolean;
      }
    | null = null;

  constructor(opts: BoardSceneOptions) {
    this.parent = opts.parent;
    this.margin = opts.margin ?? 16;
    this.onDrop = opts.onDrop;
    this.onGeneratorTap = opts.onGeneratorTap;

    this.root = new Container();
    this.root.label = "board";
    this.parent.addChild(this.root);

    this.cellsLayer = new Container();
    this.cellsLayer.label = "board:cells";
    this.itemsLayer = new Container();
    this.itemsLayer.label = "board:items";
    this.dragLayer = new Container();
    this.dragLayer.label = "board:drag";
    this.effectsLayer = new Container();
    this.effectsLayer.label = "board:effects";
    this.effectsLayer.eventMode = "none";

    this.root.addChild(this.cellsLayer);
    this.root.addChild(this.itemsLayer);
    this.root.addChild(this.dragLayer);
    this.root.addChild(this.effectsLayer);

    this.parent.eventMode = "static";
    this.parent.on("globalpointermove", this.handlePointerMove);
    this.parent.on("pointerup", this.handlePointerUp);
    this.parent.on("pointerupoutside", this.handlePointerUp);

    // When a lazy texture finishes loading, refresh from the last
    // known state so the procedural fallback upgrades to the real
    // sprite without waiting for a player action.
    this.unsubscribeTexture = onTextureLoaded(() => this.scheduleRebuild());

    this.resize(opts.width, opts.height);
  }

  private scheduleRebuild(): void {
    if (this.rebuildScheduled) return;
    this.rebuildScheduled = true;
    requestAnimationFrame(() => {
      this.rebuildScheduled = false;
      if (!this.lastBuild) return;
      const { cols, board, inventory } = this.lastBuild;
      this.rebuild(cols, board, inventory);
    });
  }

  resize(width: number, height: number, cols?: number, invSize?: number): void {
    if (cols !== undefined) {
      this.boardCols = cols;
      this.boardCellCount = cols * cols;
    }
    if (invSize !== undefined) this.inventorySize = invSize;
    if (this.boardCols === 0) return;

    // Reserve a strip at the bottom for inventory. The inventory row's
    // height = one cell of the board, so we compute layout treating board
    // as a square and inventory as a row below it.
    const reservedForInventory = this.inventorySize > 0 ? 1 : 0;
    const sideHeight = height - this.margin * 2;
    const sideWidth = width - this.margin * 2;
    const heightForBoardAndInventory =
      sideHeight - 16 * reservedForInventory; // gap between board and inventory
    // Solve: cellSize × (boardCols + reservedForInventory) <= height
    //        cellSize × boardCols <= width
    const cellByH = heightForBoardAndInventory / (this.boardCols + reservedForInventory);
    const cellByW = sideWidth / this.boardCols;
    this.cellSize = Math.min(cellByH, cellByW);

    // Center board horizontally, inventory horizontally; vertical layout
    // pins board to top, inventory below with a small gap.
    const boardWidth = this.cellSize * this.boardCols;
    const boardHeight = this.cellSize * this.boardCols;
    const inventoryWidth = this.cellSize * Math.min(this.inventorySize, this.boardCols);
    const totalHeight = boardHeight + (reservedForInventory ? this.cellSize + 16 : 0);

    this.root.x = (width - boardWidth) / 2;
    this.root.y = (height - totalHeight) / 2;

    // Store useful layout for slot lookups
    this._boardWidth = boardWidth;
    this._boardHeight = boardHeight;
    this._inventoryY = boardHeight + 16;
    this._inventoryOffsetX = (boardWidth - inventoryWidth) / 2;
  }

  private _boardWidth = 0;
  private _boardHeight = 0;
  private _inventoryY = 0;
  private _inventoryOffsetX = 0;

  /** Rebuild from current state. Cancels any in-flight drag. */
  rebuild(
    cols: number,
    boardItems: Array<BoardItem | null>,
    inventoryItems: Array<BoardItem | null>
  ): void {
    if (cols * cols !== boardItems.length) {
      console.warn(`[boardScene] cols²=${cols * cols} != boardItems.length=${boardItems.length}`);
    }
    this.boardCols = cols;
    this.boardCellCount = cols * cols;
    this.inventorySize = inventoryItems.length;

    // Remember for scheduleRebuild() — texture-load callbacks rebuild
    // from this snapshot without needing the caller to pass state again.
    this.lastBuild = { cols, board: boardItems, inventory: inventoryItems };

    this.cancelDrag(false);

    this.cellsLayer.removeChildren();
    this.itemsLayer.removeChildren();
    // dragLayer is normally empty between drags, but a sprite mid-merge-anim
    // can be parked here when the store update fires. Wipe defensively so
    // we never leak orphans across rebuilds.
    this.dragLayer.removeChildren();
    const totalSlots = this.boardCellCount + this.inventorySize;
    this.slots = new Array(totalSlots);
    this.cellGraphics = new Array(totalSlots);
    this.spriteAt = new Array(totalSlots).fill(null);
    this.isGeneratorAt = new Array(totalSlots).fill(false);

    const cellSize = this.cellSize;
    const gap = cellSize * CELL_GAP_RATIO;
    const corner = cellSize * CORNER_RADIUS_RATIO;
    const innerSize = cellSize - gap;
    const itemSize = innerSize * ITEM_INSET_RATIO;

    // --- Board cells ---
    for (let i = 0; i < boardItems.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const cx = col * cellSize + cellSize / 2;
      const cy = row * cellSize + cellSize / 2;
      this.slots[i] = { cx, cy };

      const cell = new Graphics();
      this.drawCellGraphic(cell, cx, cy, innerSize, corner, false);
      this.cellsLayer.addChild(cell);
      this.cellGraphics[i] = cell;

      const item = boardItems[i];
      if (item) {
        this.placeItemSprite(item, itemSize, i, { cx, cy });
      }
    }

    // --- Inventory row ---
    if (this.inventorySize > 0) {
      for (let i = 0; i < this.inventorySize; i++) {
        const slotIdx = this.boardCellCount + i;
        const cx = this._inventoryOffsetX + i * cellSize + cellSize / 2;
        const cy = this._inventoryY + cellSize / 2;
        this.slots[slotIdx] = { cx, cy };

        const cell = new Graphics();
        cell
          .roundRect(
            cx - innerSize / 2,
            cy - innerSize / 2,
            innerSize,
            innerSize,
            corner
          )
          .fill({ color: INVENTORY_BG, alpha: 0.85 })
          .stroke({ color: CELL_BORDER, width: 1, alpha: 0.5 });
        this.cellsLayer.addChild(cell);
        this.cellGraphics[slotIdx] = cell;

        const item = inventoryItems[i];
        if (item) {
          this.placeItemSprite(item, itemSize, slotIdx, { cx, cy });
        }
      }
    }
  }

  private placeItemSprite(
    item: BoardItem,
    size: number,
    slotIdx: number,
    pos: SlotPos
  ): void {
    const sprite = createItemSprite(item, size);
    sprite.x = pos.cx;
    sprite.y = pos.cy;
    sprite.eventMode = "static";
    sprite.cursor = isGenerator(item) ? "pointer" : "grab";
    sprite.on("pointerdown", (e) => this.beginInteraction(slotIdx, e));
    this.itemsLayer.addChild(sprite);
    this.spriteAt[slotIdx] = sprite;
    this.isGeneratorAt[slotIdx] = isGenerator(item);
    // Give the sprite a gentle idle animation so the board feels alive.
    // No-op under prefers-reduced-motion.
    attachIdleAnimation(sprite, pos.cx, pos.cy, item);
  }

  // ---- pointer flow: tap vs drag ----

  private beginInteraction(idx: number, e: FederatedPointerEvent): void {
    if (this.dragging) return;
    const sprite = this.spriteAt[idx];
    if (!sprite) return;
    const origin = this.slots[idx];
    const local = this.root.toLocal(e.global);

    this.dragging = {
      fromIdx: idx,
      sprite,
      origin,
      pointerOffset: { dx: sprite.x - local.x, dy: sprite.y - local.y },
      hoverIdx: idx,
      startX: local.x,
      startY: local.y,
      startTimeMs: performance.now(),
      movedPastThreshold: false,
    };
  }

  private handlePointerMove = (e: FederatedPointerEvent): void => {
    if (!this.dragging) return;
    const local = this.root.toLocal(e.global);
    const dx = local.x - this.dragging.startX;
    const dy = local.y - this.dragging.startY;
    const movedFar = Math.hypot(dx, dy) > TAP_THRESHOLD_PX;

    // Promote to drag once movement passes threshold OR enough time elapsed
    if (!this.dragging.movedPastThreshold && movedFar) {
      this.dragging.movedPastThreshold = true;
      this.promoteToDrag();
    }
    if (!this.dragging.movedPastThreshold) return;

    const { sprite, pointerOffset } = this.dragging;
    sprite.x = local.x + pointerOffset.dx;
    sprite.y = local.y + pointerOffset.dy;

    const newHover = this.slotIndexAt(local.x, local.y);
    if (newHover !== this.dragging.hoverIdx) {
      this.updateCellHighlight(this.dragging.hoverIdx, false);
      this.dragging.hoverIdx = newHover;
      if (newHover >= 0 && newHover !== this.dragging.fromIdx) {
        this.updateCellHighlight(newHover, true);
      }
    }
  };

  private promoteToDrag(): void {
    if (!this.dragging) return;
    // Generators can't be dragged — taps on them resolve immediately on
    // pointerUp via the tap branch, and short drags on them are no-ops.
    if (this.isGeneratorAt[this.dragging.fromIdx]) return;
    const { sprite } = this.dragging;
    this.itemsLayer.removeChild(sprite);
    this.dragLayer.addChild(sprite);
    sprite.cursor = "grabbing";
    sprite.zIndex = 999;
    squashPulse(sprite, PICKUP_SCALE, PICKUP_DURATION);
  }

  private handlePointerUp = (): void => {
    if (!this.dragging) return;
    // Snapshot drag state and CLEAR `this.dragging` first. onDrop may
    // synchronously trigger a state update → store subscription →
    // rebuild() → cancelDrag(); without the early clear we'd null out
    // a future drag from another pointer reaching us mid-callback.
    const dragInfo = this.dragging;
    this.dragging = null;
    const { fromIdx, hoverIdx, movedPastThreshold, startTimeMs } = dragInfo;
    const elapsed = performance.now() - startTimeMs;
    const isTap = !movedPastThreshold && elapsed < TAP_THRESHOLD_MS;

    if (hoverIdx >= 0) this.updateCellHighlight(hoverIdx, false);

    // TAP path — generators only; other taps are reserved for 2.B+
    if (isTap) {
      if (this.isGeneratorAt[fromIdx] && fromIdx < this.boardCellCount) {
        this.onGeneratorTap(fromIdx);
      }
      return;
    }

    // DRAG path
    if (!movedPastThreshold) {
      // Long press without movement — release without action
      return;
    }
    if (hoverIdx < 0 || hoverIdx === fromIdx) {
      this.bounceBack(dragInfo);
      return;
    }
    const accepted = this.onDrop(fromIdx, hoverIdx);
    if (!accepted) {
      this.bounceBack(dragInfo);
    }
  };

  private bounceBack(d: NonNullable<typeof this.dragging>): void {
    const { sprite, origin, fromIdx } = d;
    tweenTo(sprite, origin.cx, origin.cy, DROP_BACK_DURATION, ease.outBack, () => {
      if (sprite.destroyed) return;
      sprite.cursor = "grab";
      sprite.zIndex = 0;
      if (sprite.parent === this.dragLayer) {
        this.dragLayer.removeChild(sprite);
        this.itemsLayer.addChild(sprite);
      }
      this.spriteAt[fromIdx] = sprite;
    });
  }

  private cancelDrag(animate: boolean): void {
    if (!this.dragging) return;
    if (animate) {
      const d = this.dragging;
      this.dragging = null;
      this.bounceBack(d);
    } else {
      this.dragging = null;
    }
  }

  // ---- visuals ----

  private drawCellGraphic(
    g: Graphics,
    cx: number,
    cy: number,
    innerSize: number,
    corner: number,
    highlight: boolean
  ): void {
    g.clear();
    g.roundRect(
      cx - innerSize / 2,
      cy - innerSize / 2,
      innerSize,
      innerSize,
      corner
    )
      .fill({
        color: highlight ? CELL_BG_HOVER : CELL_BG,
        alpha: highlight ? 0.85 : 0.7,
      })
      .stroke({
        color: highlight ? 0x8a7ad9 : CELL_BORDER,
        width: highlight ? 2 : 1,
        alpha: highlight ? 0.9 : 0.5,
      });
  }

  private updateCellHighlight(idx: number, on: boolean): void {
    if (idx < 0 || idx >= this.cellGraphics.length) return;
    // Inventory cells use a different default style; respect that
    const cellSize = this.cellSize;
    const gap = cellSize * CELL_GAP_RATIO;
    const corner = cellSize * CORNER_RADIUS_RATIO;
    const innerSize = cellSize - gap;
    const { cx, cy } = this.slots[idx];
    if (idx < this.boardCellCount) {
      this.drawCellGraphic(this.cellGraphics[idx], cx, cy, innerSize, corner, on);
    } else {
      // Inventory highlight = slightly stronger fill
      const g = this.cellGraphics[idx];
      g.clear();
      g.roundRect(
        cx - innerSize / 2,
        cy - innerSize / 2,
        innerSize,
        innerSize,
        corner
      )
        .fill({ color: on ? CELL_BG_HOVER : INVENTORY_BG, alpha: 0.85 })
        .stroke({
          color: on ? 0x8a7ad9 : CELL_BORDER,
          width: on ? 2 : 1,
          alpha: on ? 0.9 : 0.5,
        });
    }
  }

  /** Local-space hit test across both board and inventory rows. */
  private slotIndexAt(x: number, y: number): number {
    if (this.cellSize === 0) return -1;
    // Board area
    if (y >= 0 && y < this._boardHeight) {
      const col = Math.floor(x / this.cellSize);
      const row = Math.floor(y / this.cellSize);
      if (col < 0 || col >= this.boardCols) return -1;
      if (row < 0 || row >= this.boardCols) return -1;
      return row * this.boardCols + col;
    }
    // Inventory row
    if (this.inventorySize > 0) {
      const invTop = this._inventoryY - this.cellSize / 2;
      const invBot = this._inventoryY + this.cellSize / 2;
      if (y >= invTop && y <= invBot) {
        const localX = x - this._inventoryOffsetX;
        const i = Math.floor(localX / this.cellSize);
        if (i >= 0 && i < this.inventorySize) {
          return this.boardCellCount + i;
        }
      }
    }
    return -1;
  }

  /** Punch animation on merge (source fades, target pulses). */
  async playMergeAnim(fromIdx: number, toIdx: number): Promise<void> {
    const source = this.spriteAt[fromIdx];
    const target = this.spriteAt[toIdx];
    return new Promise((resolve) => {
      let done = 0;
      const finish = () => {
        done += 1;
        if (done >= 2) resolve();
      };
      if (source) {
        tweenAlpha(source, source.alpha, 0, MERGE_FADE_DURATION, ease.outQuad, finish);
      } else {
        finish();
      }
      if (target) {
        squashPulse(target, 1.22, MERGE_PULSE_DURATION);
        setTimeout(finish, MERGE_PULSE_DURATION);
      } else {
        finish();
      }
      setTimeout(resolve, 500);
    });
  }

  /**
   * Public lookup: world-space (stage-relative) center of a slot.
   * Used by Lily / dialogue bubbles / future hint overlays to position
   * themselves relative to board content without needing scene internals.
   * Returns null for invalid indices.
   */
  slotWorldCenter(slotIdx: number): { x: number; y: number } | null {
    if (slotIdx < 0 || slotIdx >= this.slots.length) return null;
    const slot = this.slots[slotIdx];
    if (!slot) return null;
    return {
      x: this.root.x + slot.cx,
      y: this.root.y + slot.cy,
    };
  }

  /**
   * Bounding rectangle of the board grid in world (stage) coords.
   * Inventory row is not included (Lily can freely hover beside it).
   * Used by GameCanvas to keep Lily OUTSIDE the play area on attention /
   * celebrate moves.
   */
  boardWorldBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.root.x,
      y: this.root.y,
      width: this._boardWidth,
      height: this._boardHeight,
    };
  }

  /** Play merge effects at a board slot: tier ring + sparkles + score popup. */
  playMergeEffects(opts: {
    slotIdx: number;
    line?: LineId;
    coinsText?: string;
    combo?: number;
    chainDepth?: number;
    jackpot?: boolean;
    jackpotCoins?: number;
  }): void {
    const slot = this.slots[opts.slotIdx];
    if (!slot) return;
    const x = slot.cx;
    const y = slot.cy;

    if (opts.jackpot) {
      spawnJackpotBanner(this.effectsLayer, x, y, opts.jackpotCoins ?? 0);
      spawnSparkleBurst(this.effectsLayer, x, y, 26, undefined, 140);
      spawnTierRing(this.effectsLayer, x, y, 0xffd24a);
      return;
    }

    spawnTierRing(this.effectsLayer, x, y);
    spawnSparkleBurst(this.effectsLayer, x, y, 12, opts.line, 80);

    if (opts.coinsText) {
      spawnScorePopup(this.effectsLayer, x, y - 4, opts.coinsText);
    }
    if (opts.chainDepth && opts.chainDepth >= 2) {
      spawnChainBanner(this.effectsLayer, x, y, opts.chainDepth);
    } else if (opts.combo && opts.combo >= 3) {
      spawnComboBanner(this.effectsLayer, x, y, opts.combo);
    }
  }

  /** Play a sparkle trail for a chain step's path. */
  playChainTrail(fromIdx: number, toIdx: number, line?: LineId): void {
    const from = this.slots[fromIdx];
    const to = this.slots[toIdx];
    if (!from || !to) return;
    const midX = (from.cx + to.cx) / 2;
    const midY = (from.cy + to.cy) / 2;
    spawnSparkleBurst(this.effectsLayer, midX, midY, 6, line, 50);
  }

  /** Brief celebration on a newly-spawned item. */
  playSpawnAnim(idx: number): void {
    const sprite = this.spriteAt[idx];
    if (!sprite) return;
    sprite.scale.set(0);
    squashPulse(sprite, 1.0, 240);
  }

  destroy(): void {
    this.parent.off("globalpointermove", this.handlePointerMove);
    this.parent.off("pointerup", this.handlePointerUp);
    this.parent.off("pointerupoutside", this.handlePointerUp);
    this.unsubscribeTexture?.();
    this.unsubscribeTexture = null;
    this.lastBuild = null;
    this.rebuildScheduled = false;
    this.root.destroy({ children: true });
  }
}
