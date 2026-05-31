<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { gameState, resetGame } from "$lib/store/game";
  import { getPixiApp, destroyPixiApp } from "$lib/pixi/app";
  import { BoardScene } from "$lib/pixi/boardScene";
  import { applyDrop } from "$lib/game/actions";
  import { tt, locale } from "$lib/i18n";
  import { haptic, hapticNotify } from "$lib/telegram";
  import { setView } from "$lib/store/ui";

  let mountTarget: HTMLDivElement;
  let scene: BoardScene | undefined;
  let mounted = false;
  let resizeObserver: ResizeObserver | undefined;

  const labelLevel = $derived(tt($locale, "Уровень", "Level", "Nivel"));
  const labelCoins = $derived(tt($locale, "Монеты", "Coins", "Monedas"));
  const labelEnergy = $derived(tt($locale, "Энергия", "Energy", "Energía"));
  const labelReset = $derived(tt($locale, "Сбросить", "Reset", "Reiniciar"));
  const labelBack = $derived(tt($locale, "Назад", "Back", "Atrás"));
  const confirmReset = $derived(
    tt(
      $locale,
      "Стереть прогресс и начать заново?",
      "Wipe progress and start over?",
      "¿Borrar progreso y empezar de nuevo?"
    )
  );

  /** Called by BoardScene when a drag ends on a valid target.
   *  Returns true to mean "I handled it, please rebuild from new state". */
  function handleDrop(fromIdx: number, toIdx: number): boolean {
    const current = get(gameState);
    const { next, outcome } = applyDrop(current, fromIdx, toIdx);
    if (outcome.kind === "noop") {
      return false;
    }

    if (outcome.kind === "merge") {
      // Punch animation BEFORE the store update so the old sprites are still
      // mounted. Then we apply the state and rebuild.
      scene?.playMergeAnim(outcome.from, outcome.to).then(() => {
        gameState.set(next);
        hapticNotify("success");
      });
      haptic("heavy");
      return true;
    }

    if (outcome.kind === "swap" || outcome.kind === "move") {
      gameState.set(next);
      haptic("light");
      return true;
    }

    return false;
  }

  async function setupPixi() {
    if (!mountTarget) return;
    const app = await getPixiApp(mountTarget);
    if (!app) return;

    const width = mountTarget.clientWidth;
    const height = mountTarget.clientHeight;

    scene = new BoardScene({
      parent: app.stage,
      width,
      height,
      margin: 12,
      onDrop: handleDrop,
    });

    const unsubscribe = gameState.subscribe((s) => {
      scene?.rebuild(s.boardCols, s.board);
    });

    resizeObserver = new ResizeObserver(() => {
      const w = mountTarget.clientWidth;
      const h = mountTarget.clientHeight;
      scene?.resize(w, h);
      const current = get(gameState);
      scene?.rebuild(current.boardCols, current.board);
    });
    resizeObserver.observe(mountTarget);

    mounted = true;
    return unsubscribe;
  }

  let unsubscribePromise: Promise<(() => void) | undefined> | undefined;

  onMount(() => {
    unsubscribePromise = setupPixi();
  });

  onDestroy(async () => {
    resizeObserver?.disconnect();
    const unsubscribe = await unsubscribePromise;
    unsubscribe?.();
    scene?.destroy();
    scene = undefined;
    destroyPixiApp();
  });

  function handleReset() {
    if (confirm(confirmReset)) {
      resetGame();
    }
  }

  function handleBack() {
    setView("landing");
  }
</script>

<div class="game-root">
  <header>
    <button type="button" class="back" onclick={handleBack} aria-label={labelBack}>
      ‹
    </button>
    <div class="stat">
      <span class="stat-label">{labelLevel}</span>
      <span class="stat-value">{$gameState.level}</span>
    </div>
    <div class="stat">
      <span class="stat-label">{labelCoins}</span>
      <span class="stat-value">{$gameState.coins}</span>
    </div>
    <div class="stat">
      <span class="stat-label">{labelEnergy}</span>
      <span class="stat-value">{$gameState.energy} / {$gameState.energyMax}</span>
    </div>
  </header>

  <div bind:this={mountTarget} class="canvas-host"></div>

  <footer>
    <button type="button" class="reset" onclick={handleReset}>{labelReset}</button>
    {#if !mounted}
      <span class="loading">…</span>
    {/if}
  </footer>
</div>

<style>
  .game-root {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    background: linear-gradient(180deg, #1A1424 0%, #2B1B3D 100%);
    color: #fff;
    touch-action: none; /* prevent scroll-pan on drag */
    user-select: none;
  }
  header {
    display: grid;
    grid-template-columns: 32px repeat(3, 1fr);
    align-items: center;
    gap: 4px;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.18);
  }
  .back {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .back:hover {
    background: rgba(255, 255, 255, 0.13);
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .stat-label {
    font-size: 10px;
    opacity: 0.55;
    text-transform: uppercase;
    letter-spacing: 0.7px;
  }
  .stat-value {
    font-size: 17px;
    font-weight: 600;
    margin-top: 2px;
  }
  .canvas-host {
    flex: 1;
    position: relative;
    width: 100%;
    overflow: hidden;
  }
  .canvas-host :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px 16px;
    font-size: 13px;
    opacity: 0.85;
  }
  .reset {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12px;
    cursor: pointer;
    letter-spacing: 0.3px;
  }
  .reset:hover {
    background: rgba(255, 255, 255, 0.13);
  }
  .loading {
    opacity: 0.5;
    font-size: 13px;
  }
</style>
