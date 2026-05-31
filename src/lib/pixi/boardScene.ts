/**
 * Board scene — renders a square N×N grid of cells and the items on them.
 *
 * Phase 1.B is static: rebuild() wipes and re-renders. Drag/drop and
 * animated transitions come in 1.C; we'll switch to diff'd updates then.
 *
 * Layout responsibility:
 *   - Caller (GameCanvas.svelte) gives us the parent Container + available
 *     width/height in pixels.
 *   - We compute cell size from the smaller of width/height with margin,
 *     center the grid in the parent area, and pin the board to top-left.
 */

import { Container, Graphics } from "pixi.js";
import { createItemSprite } from "./itemSprite";
import type { BoardItem } from "$lib/game/boardItem";

export interface BoardSceneOptions {
  /** Parent Pixi container (e.g. app.stage) */
  parent: Container;
  /** Available width in CSS pixels */
  width: number;
  /** Available height in CSS pixels */
  height: number;
  /** Margin between board edge and parent edge */
  margin?: number;
}

const CELL_BG = 0x2c2240;
const CELL_BORDER = 0x423560;
const CORNER_RADIUS_RATIO = 0.18;
const CELL_GAP_RATIO = 0.06;
const ITEM_INSET_RATIO = 0.78;

export class BoardScene {
  private parent: Container;
  private root: Container;
  private cellsLayer: Container;
  private itemsLayer: Container;
  private cellSize = 0;
  private boardCols = 0;
  private margin: number;

  constructor(opts: BoardSceneOptions) {
    this.parent = opts.parent;
    this.margin = opts.margin ?? 16;

    this.root = new Container();
    this.root.label = "board";
    this.parent.addChild(this.root);

    this.cellsLayer = new Container();
    this.cellsLayer.label = "board:cells";
    this.itemsLayer = new Container();
    this.itemsLayer.label = "board:items";
    this.root.addChild(this.cellsLayer);
    this.root.addChild(this.itemsLayer);

    this.resize(opts.width, opts.height);
  }

  /**
   * Compute layout for the available area and reposition the root.
   * Called once on mount and again on every viewport resize.
   * Does NOT redraw cells/items — caller should follow up with rebuild()
   * if board contents need to be redrawn.
   */
  resize(width: number, height: number, cols?: number): void {
    if (cols !== undefined) this.boardCols = cols;
    if (this.boardCols === 0) return;

    const available = Math.min(width, height) - this.margin * 2;
    this.cellSize = available / this.boardCols;

    // Center the board area within the parent
    this.root.x = (width - available) / 2;
    this.root.y = (height - available) / 2;
  }

  /** Wipe and redraw the entire board with the given state. */
  rebuild(cols: number, items: Array<BoardItem | null>): void {
    if (cols * cols !== items.length) {
      console.warn(`[boardScene] cols²=${cols * cols} != items.length=${items.length}`);
    }
    this.boardCols = cols;

    // Recompute layout in case cols changed
    this.resize(
      this.parent.width || 360,
      this.parent.height || 600,
      cols
    );

    this.cellsLayer.removeChildren();
    this.itemsLayer.removeChildren();

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

      // Cell background
      const cell = new Graphics();
      cell
        .roundRect(
          cx - innerSize / 2,
          cy - innerSize / 2,
          innerSize,
          innerSize,
          corner
        )
        .fill({ color: CELL_BG, alpha: 0.7 })
        .stroke({ color: CELL_BORDER, width: 1, alpha: 0.5 });
      this.cellsLayer.addChild(cell);

      // Item, if any
      const item = items[i];
      if (item) {
        const sprite = createItemSprite(item, itemSize);
        sprite.x = cx;
        sprite.y = cy;
        this.itemsLayer.addChild(sprite);
      }
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
