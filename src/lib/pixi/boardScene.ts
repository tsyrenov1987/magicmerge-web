/**
 * Board scene — square N×N grid with interactive item sprites.
 *
 * Architecture:
 *   - cellsLayer: static rounded squares, one per slot
 *   - itemsLayer: BoardItem sprites positioned by slot index
 *   - dragLayer: while a drag is in flight, the lifted sprite lives here
 *     so it renders above all other items
 *
 * Sprite identity is keyed by slot index, not BoardItem.id, because the
 * rebuild() path wipes and rebuilds. (1.D will switch to id-keyed diff'd
 * updates for animations across spawn.)
 */

import { Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { createItemSprite } from "./itemSprite";
import { tweenTo, tweenAlpha, squashPulse, ease } from "./tween";
import type { BoardItem } from "$lib/game/boardItem";

export interface BoardSceneOptions {
  parent: Container;
  width: number;
  height: number;
  margin?: number;
  /** Called when player drops `from → to`. Scene already played pickup + back-bounce.
   *  Return true to acknowledge mutation (scene will re-render from new state);
   *  return false to bounce the dragged sprite back. */
  onDrop: (fromIdx: number, toIdx: number) => boolean;
}

const CELL_BG = 0x2c2240;
const CELL_BG_HOVER = 0x4a3a70;
const CELL_BORDER = 0x423560;
const CORNER_RADIUS_RATIO = 0.18;
const CELL_GAP_RATIO = 0.06;
const ITEM_INSET_RATIO = 0.78;

const PICKUP_SCALE = 1.12;
const PICKUP_DURATION = 120;
const DROP_BACK_DURATION = 220;
const MERGE_PULSE_DURATION = 280;
const MERGE_FADE_DURATION = 180;

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
  private cellSize = 0;
  private boardCols = 0;
  private margin: number;
  private onDrop: BoardSceneOptions["onDrop"];

  /** Per-cell positions in local space */
  private slots: SlotPos[] = [];
  /** Per-cell cell-rect Graphics (for hover highlight) */
  private cellGraphics: Graphics[] = [];
  /** Per-cell item sprite ref. null when slot is empty. */
  private spriteAt: Array<Container | null> = [];

  /** Drag state */
  private dragging:
    | {
        fromIdx: number;
        sprite: Container;
        origin: SlotPos;
        pointerOffset: { dx: number; dy: number };
        hoverIdx: number;
      }
    | null = null;

  constructor(opts: BoardSceneOptions) {
    this.parent = opts.parent;
    this.margin = opts.margin ?? 16;
    this.onDrop = opts.onDrop;

    this.root = new Container();
    this.root.label = "board";
    this.parent.addChild(this.root);

    this.cellsLayer = new Container();
    this.cellsLayer.label = "board:cells";
    this.itemsLayer = new Container();
    this.itemsLayer.label = "board:items";
    this.dragLayer = new Container();
    this.dragLayer.label = "board:drag";

    this.root.addChild(this.cellsLayer);
    this.root.addChild(this.itemsLayer);
    this.root.addChild(this.dragLayer);

    // Scene-level pointer handling for active drags
    this.parent.eventMode = "static";
    this.parent.on("globalpointermove", this.handlePointerMove);
    this.parent.on("pointerup", this.handlePointerUp);
    this.parent.on("pointerupoutside", this.handlePointerUp);

    this.resize(opts.width, opts.height);
  }

  /** Compute layout for available area. Does NOT redraw cells/items. */
  resize(width: number, height: number, cols?: number): void {
    if (cols !== undefined) this.boardCols = cols;
    if (this.boardCols === 0) return;

    const available = Math.min(width, height) - this.margin * 2;
    this.cellSize = available / this.boardCols;

    this.root.x = (width - available) / 2;
    this.root.y = (height - available) / 2;
  }

  /** Wipe and redraw the entire board with the given state. */
  rebuild(cols: number, items: Array<BoardItem | null>): void {
    if (cols * cols !== items.length) {
      console.warn(
        `[boardScene] cols²=${cols * cols} != items.length=${items.length}`
      );
    }
    this.boardCols = cols;

    // If a drag is in progress, cancel it before wiping — the lifted sprite
    // would be orphaned otherwise.
    this.cancelDrag(false);

    this.cellsLayer.removeChildren();
    this.itemsLayer.removeChildren();
    this.slots = [];
    this.cellGraphics = [];
    this.spriteAt = new Array(items.length).fill(null);

    const cellSize = this.cellSize;
    const gap = cellSize * CELL_GAP_RATIO;
    const corner = cellSize * CORNER_RADIUS_RATIO;
    const innerSize = cellSize - gap;
    const itemSize = innerSize * ITEM_INSET_RATIO;

    for (let i = 0; i < items.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const cx = col * cellSize + cellSize / 2;
      const cy = row * cellSize + cellSize / 2;
      this.slots.push({ cx, cy });

      const cell = new Graphics();
      this.drawCellGraphic(cell, cx, cy, innerSize, corner, false);
      this.cellsLayer.addChild(cell);
      this.cellGraphics.push(cell);

      const item = items[i];
      if (item) {
        const sprite = createItemSprite(item, itemSize);
        sprite.x = cx;
        sprite.y = cy;
        sprite.eventMode = "static";
        sprite.cursor = "grab";
        const idx = i;
        sprite.on("pointerdown", (e) => this.beginDrag(idx, e));
        this.itemsLayer.addChild(sprite);
        this.spriteAt[i] = sprite;
      }
    }
  }

  // ---- drag flow ----

  private beginDrag(idx: number, e: FederatedPointerEvent): void {
    if (this.dragging) return;
    const sprite = this.spriteAt[idx];
    if (!sprite) return;

    // Move sprite to drag layer so it renders above
    this.itemsLayer.removeChild(sprite);
    this.dragLayer.addChild(sprite);

    const origin = this.slots[idx];
    const local = this.root.toLocal(e.global);
    const pointerOffset = {
      dx: sprite.x - local.x,
      dy: sprite.y - local.y,
    };

    this.dragging = {
      fromIdx: idx,
      sprite,
      origin,
      pointerOffset,
      hoverIdx: idx,
    };

    sprite.cursor = "grabbing";
    sprite.zIndex = 999;

    squashPulse(sprite, PICKUP_SCALE, PICKUP_DURATION);
  }

  private handlePointerMove = (e: FederatedPointerEvent): void => {
    if (!this.dragging) return;
    const { sprite, pointerOffset } = this.dragging;
    const local = this.root.toLocal(e.global);
    sprite.x = local.x + pointerOffset.dx;
    sprite.y = local.y + pointerOffset.dy;

    const newHover = this.cellIndexAt(local.x, local.y);
    if (newHover !== this.dragging.hoverIdx) {
      // Un-highlight previous
      this.updateCellHighlight(this.dragging.hoverIdx, false);
      this.dragging.hoverIdx = newHover;
      // Highlight new (if valid + not the origin slot)
      if (newHover >= 0 && newHover !== this.dragging.fromIdx) {
        this.updateCellHighlight(newHover, true);
      }
    }
  };

  private handlePointerUp = (): void => {
    if (!this.dragging) return;
    const { fromIdx, hoverIdx } = this.dragging;

    // Clear any active hover highlight
    if (hoverIdx >= 0) this.updateCellHighlight(hoverIdx, false);

    if (hoverIdx < 0 || hoverIdx === fromIdx) {
      this.bounceBack();
      return;
    }

    const accepted = this.onDrop(fromIdx, hoverIdx);
    if (!accepted) {
      this.bounceBack();
    }
    // If accepted, the caller will trigger a state update which calls
    // rebuild() — that wipes the in-flight sprite naturally.
    this.dragging = null;
  };

  /** Animate the dragged sprite back to its origin slot, then re-attach to itemsLayer. */
  private bounceBack(): void {
    if (!this.dragging) return;
    const { sprite, origin, fromIdx } = this.dragging;
    this.dragging = null;
    tweenTo(sprite, origin.cx, origin.cy, DROP_BACK_DURATION, ease.outBack, () => {
      if (sprite.destroyed) return;
      sprite.cursor = "grab";
      sprite.zIndex = 0;
      this.dragLayer.removeChild(sprite);
      this.itemsLayer.addChild(sprite);
      this.spriteAt[fromIdx] = sprite;
    });
  }

  /** Hard cancel — used on rebuild while drag in flight */
  private cancelDrag(animate: boolean): void {
    if (!this.dragging) return;
    if (animate) {
      this.bounceBack();
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
    const cellSize = this.cellSize;
    const gap = cellSize * CELL_GAP_RATIO;
    const corner = cellSize * CORNER_RADIUS_RATIO;
    const innerSize = cellSize - gap;
    const { cx, cy } = this.slots[idx];
    this.drawCellGraphic(this.cellGraphics[idx], cx, cy, innerSize, corner, on);
  }

  /** Local-space hit test. Returns -1 if outside any cell. */
  private cellIndexAt(x: number, y: number): number {
    if (this.cellSize === 0) return -1;
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || col >= this.boardCols) return -1;
    if (row < 0 || row >= this.boardCols) return -1;
    return row * this.boardCols + col;
  }

  /**
   * Play a merge animation on (fromIdx → toIdx) before the next rebuild().
   * Caller awaits this if they want the rebuild to come after the punch.
   * In 1.C we keep it simple: fade source out + pulse target. 1.D adds
   * particle sparkle.
   */
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
      // Safety net — never block rebuild for more than 500ms even if a sprite
      // got destroyed mid-animation.
      setTimeout(resolve, 500);
    });
  }

  destroy(): void {
    this.parent.off("globalpointermove", this.handlePointerMove);
    this.parent.off("pointerup", this.handlePointerUp);
    this.parent.off("pointerupoutside", this.handlePointerUp);
    this.root.destroy({ children: true });
  }
}
