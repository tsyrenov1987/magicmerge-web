<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { gameState, resetGame } from "$lib/store/game";
  import { getPixiApp, destroyPixiApp } from "$lib/pixi/app";
  import { BoardScene } from "$lib/pixi/boardScene";
  import { tt, locale } from "$lib/i18n";

  let mountTarget: HTMLDivElement;
  let scene: BoardScene | undefined;
  let mounted = false;
  let resizeObserver: ResizeObserver | undefined;

  const labelLevel = $derived(tt($locale, "Уровень", "Level", "Nivel"));
  const labelCoins = $derived(tt($locale, "Монеты", "Coins", "Monedas"));
  const labelEnergy = $derived(tt($locale, "Энергия", "Energy", "Energía"));
  const labelReset = $derived(tt($locale, "Сбросить", "Reset", "Reiniciar"));
  const confirmReset = $derived(
    tt(
      $locale,
      "Стереть прогресс и начать заново?",
      "Wipe progress and start over?",
      "¿Borrar progreso y empezar de nuevo?"
    )
  );

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
    });

    // Initial render + subscribe to subsequent state changes
    const unsubscribe = gameState.subscribe((s) => {
      scene?.rebuild(s.boardCols, s.board);
    });

    // Re-layout on viewport changes (TG resize, rotation)
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
</script>

<div class="game-root">
  <header>
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
  }
  header {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.18);
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
  /* PixiJS appends a <canvas> child; make sure it fills the host */
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
