<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { fly, fade } from "svelte/transition";
  import { gameState } from "$lib/store/game";
  import { gardenState, applyBuild, applyCollect, applyGardenTick } from "$lib/store/garden";
  import { BUILDINGS, BUILDING_IDS, meetsArtifactReqs, type BuildingId, type BuildingDef } from "$lib/garden/buildings";
  import { buildingSpriteUrl } from "$lib/assets/manifest";
  import { locale, tt } from "$lib/i18n";
  import { haptic, hapticNotify } from "$lib/telegram";
  import TabBar from "$components/TabBar.svelte";

  let now = $state(Date.now());
  let tickHandle: ReturnType<typeof setInterval> | undefined;

  // Modal state — plot picker open?
  let pickerForIdx: number | null = $state(null);

  const labelCoins = $derived(tt($locale, "Монеты", "Coins", "Monedas"));
  const labelEmpty = $derived(tt($locale, "Пусто", "Empty", "Vacío"));
  const labelBuild = $derived(tt($locale, "Строить", "Build", "Construir"));
  const labelCollect = $derived(tt($locale, "Собрать", "Collect", "Recoger"));
  const labelReady = $derived(tt($locale, "Готово!", "Ready!", "¡Listo!"));
  const labelLocked = $derived(tt($locale, "Нужны артефакты", "Artifacts needed", "Faltan artefactos"));
  const msgNoCoins = $derived(tt($locale, "Не хватает монет", "Not enough coins", "Faltan monedas"));
  const titlePicker = $derived(tt($locale, "Что построить?", "Build what?", "¿Qué construir?"));
  const close = $derived(tt($locale, "Закрыть", "Close", "Cerrar"));

  function localizeName(def: BuildingDef): string {
    return tt($locale, def.name[0], def.name[1], def.name[2]);
  }
  function localizeBonus(def: BuildingDef): string {
    return tt($locale, def.bonus[0], def.bonus[1], def.bonus[2]);
  }

  /** Format ms as h:mm or m:ss for the construction countdown. */
  function formatRemaining(ms: number): string {
    if (ms < 0) return "0:00";
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function onPlotTap(idx: number) {
    const plot = $gardenState.plots[idx];
    if (plot.kind === "empty") {
      pickerForIdx = idx;
      haptic("light");
      return;
    }
    if (plot.kind === "ready") {
      const { next, coinsReward, outcome } = applyCollect($gardenState, idx, Date.now());
      if (outcome.kind === "collected") {
        gardenState.set(next);
        gameState.update((g) => ({ ...g, coins: g.coins + coinsReward }));
        hapticNotify("success");
      }
      return;
    }
    // building — show countdown via reactive state; tap = haptic ping
    haptic("light");
  }

  function chooseBuilding(building: BuildingId) {
    if (pickerForIdx === null) return;
    const idx = pickerForIdx;
    pickerForIdx = null;
    const current = get(gameState);
    const { next, nextCoins, outcome } = applyBuild(
      $gardenState,
      current.coins,
      idx,
      building,
      Date.now()
    );
    if (outcome.kind === "no-coins") {
      hapticNotify("error");
      alert(msgNoCoins);
      return;
    }
    if (outcome.kind !== "built") {
      hapticNotify("warning");
      return;
    }
    gardenState.set(next);
    gameState.update((g) => ({ ...g, coins: nextCoins }));
    haptic("medium");
  }

  onMount(() => {
    // Ensure on entry: plots that finished while we were away get promoted
    gardenState.update((s) => applyGardenTick(s, Date.now()));
    // 1Hz tick for the countdown display + ready promotion
    tickHandle = setInterval(() => {
      now = Date.now();
      const current = get(gardenState);
      const ticked = applyGardenTick(current, now);
      if (ticked !== current) {
        gardenState.set(ticked);
        hapticNotify("success");
      }
    }, 1000);
  });

  onDestroy(() => {
    if (tickHandle) clearInterval(tickHandle);
  });

  // Sort buildings: affordable first (no artifact req), then locked
  const sortedBuildings = $derived.by(() => {
    return [...BUILDING_IDS].sort((a, b) => {
      const aLocked = !meetsArtifactReqs(BUILDINGS[a], $gardenState.artifacts);
      const bLocked = !meetsArtifactReqs(BUILDINGS[b], $gardenState.artifacts);
      if (aLocked !== bLocked) return aLocked ? 1 : -1;
      return BUILDINGS[a].coinCost - BUILDINGS[b].coinCost;
    });
  });
</script>

<div class="root">
  <header class="hud">
    <div class="title">
      <span class="title-emoji" aria-hidden="true">🌱</span>
      <span class="title-text">{tt($locale, "Зачарованный сад", "Enchanted Garden", "Jardín encantado")}</span>
    </div>
    <div class="coins">
      <span class="coins-emoji" aria-hidden="true">🪙</span>
      <span class="coins-value">{$gameState.coins}</span>
    </div>
  </header>

  <div class="grid-host" style="--grid: {$gardenState.gridSize};">
    <div class="grid">
      {#each $gardenState.plots as plot, idx (idx)}
        {@const def = plot.kind === "empty" ? null : BUILDINGS[plot.building]}
        {@const remainingMs = plot.kind === "building" ? plot.buildReadyAt - now : 0}
        <button
          type="button"
          class="plot"
          class:empty={plot.kind === "empty"}
          class:building={plot.kind === "building"}
          class:ready={plot.kind === "ready"}
          style={def ? `--accent: #${def.accent.toString(16).padStart(6, "0")};` : ""}
          onclick={() => onPlotTap(idx)}
        >
          {#if plot.kind === "empty"}
            <span class="plot-emoji empty-emoji" aria-hidden="true">＋</span>
            <span class="plot-label">{labelEmpty}</span>
          {:else if def}
            <img
              class="plot-image"
              src={buildingSpriteUrl(def.id)}
              alt=""
              loading="lazy"
              decoding="async"
              draggable="false"
            />
            {#if plot.kind === "ready"}
              <span class="plot-label ready-label">{labelReady}</span>
              <span class="plot-coins">+{def.rewardCoins} 🪙</span>
            {:else}
              <span class="plot-label">{formatRemaining(remainingMs)}</span>
            {/if}
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <TabBar />
</div>

{#if pickerForIdx !== null}
  <div
    class="backdrop"
    transition:fade={{ duration: 180 }}
    onclick={() => (pickerForIdx = null)}
    onkeydown={(e) => e.key === "Escape" && (pickerForIdx = null)}
    role="button"
    tabindex="-1"
    aria-label={close}
  ></div>
  <div class="picker" transition:fly={{ y: 24, duration: 260 }} role="dialog" aria-modal="true">
    <h3>{titlePicker}</h3>
    <ul>
      {#each sortedBuildings as id (id)}
        {@const def = BUILDINGS[id]}
        {@const locked = !meetsArtifactReqs(def, $gardenState.artifacts)}
        {@const canAfford = $gameState.coins >= def.coinCost}
        <li>
          <button
            type="button"
            class="building-row"
            class:locked
            class:disabled={!canAfford || locked}
            disabled={locked || !canAfford}
            style="--accent: #{def.accent.toString(16).padStart(6, '0')};"
            onclick={() => chooseBuilding(id)}
          >
            <img
              class="b-image"
              src={buildingSpriteUrl(def.id)}
              alt=""
              loading="lazy"
              decoding="async"
              draggable="false"
            />
            <span class="b-text">
              <span class="b-name">{localizeName(def)}</span>
              <span class="b-bonus">{localizeBonus(def)}</span>
            </span>
            <span class="b-meta">
              <span class="b-cost" class:cant={!canAfford}>{def.coinCost} 🪙</span>
              {#if locked}
                <span class="b-locked">🔒 {labelLocked}</span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .root {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    background: linear-gradient(180deg, #1f1733 0%, #2B1B3D 60%, #1A1424 100%);
    color: #fff;
    touch-action: pan-y;
    user-select: none;
  }
  .hud {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: rgba(0, 0, 0, 0.18);
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
  }
  .title-emoji {
    font-size: 18px;
  }
  .coins {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 217, 90, 0.12);
    padding: 6px 12px;
    border-radius: 10px;
    font-weight: 700;
  }
  .coins-emoji {
    font-size: 14px;
  }
  .coins-value {
    font-size: 15px;
  }
  .grid-host {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    overflow: auto;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--grid), 1fr);
    gap: 14px;
    width: 100%;
    max-width: 420px;
    aspect-ratio: 1 / 1;
  }
  .plot {
    aspect-ratio: 1 / 1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #fff;
    cursor: pointer;
    padding: 12px;
    transition: transform 0.12s ease, background 0.15s ease, border-color 0.15s ease;
  }
  .plot:hover {
    background: rgba(255, 255, 255, 0.07);
  }
  .plot:active {
    transform: scale(0.97);
  }
  .plot.empty {
    border-style: dashed;
    color: rgba(255, 255, 255, 0.5);
  }
  .plot.building {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), color-mix(in srgb, var(--accent) 14%, transparent));
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .plot.ready {
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 20%, transparent), color-mix(in srgb, var(--accent) 8%, transparent));
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent), 0 0 24px color-mix(in srgb, var(--accent) 30%, transparent);
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 2px var(--accent), 0 0 16px color-mix(in srgb, var(--accent) 30%, transparent); }
    50% { box-shadow: 0 0 0 2px var(--accent), 0 0 30px color-mix(in srgb, var(--accent) 55%, transparent); }
  }
  .plot-emoji {
    font-size: 38px;
    line-height: 1;
  }
  .empty-emoji {
    font-size: 30px;
    opacity: 0.4;
  }
  .plot-image {
    width: 72%;
    height: 72%;
    object-fit: contain;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
    pointer-events: none;
  }
  .plot-label {
    font-size: 12px;
    opacity: 0.85;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .ready-label {
    color: var(--accent);
    opacity: 1;
  }
  .plot-coins {
    font-size: 11px;
    font-weight: 700;
    color: #ffd96b;
  }

  /* Picker */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 4, 20, 0.66);
    backdrop-filter: blur(3px);
    z-index: 8;
    cursor: pointer;
  }
  .picker {
    position: fixed;
    left: 50%;
    bottom: 80px;
    transform: translateX(-50%);
    width: min(440px, calc(100% - 24px));
    max-height: 60dvh;
    overflow-y: auto;
    padding: 18px 20px 20px;
    background: linear-gradient(180deg, #2B1B3D 0%, #1A1424 100%);
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
    z-index: 9;
  }
  .picker h3 {
    margin: 0 0 14px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.2px;
    opacity: 0.92;
  }
  .picker ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .building-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-left: 3px solid var(--accent);
    border-radius: 12px;
    padding: 10px 12px;
    color: #fff;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .building-row:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.07);
  }
  .building-row:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .b-emoji {
    font-size: 26px;
    flex-shrink: 0;
    width: 36px;
    text-align: center;
  }
  .b-image {
    width: 44px;
    height: 44px;
    object-fit: contain;
    flex-shrink: 0;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
  }
  .b-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
    text-align: left;
  }
  .b-name {
    font-size: 14px;
    font-weight: 600;
  }
  .b-bonus {
    font-size: 11px;
    opacity: 0.65;
    line-height: 1.3;
  }
  .b-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }
  .b-cost {
    font-size: 13px;
    font-weight: 700;
    color: #ffd96b;
  }
  .b-cost.cant {
    color: #ff8a8a;
  }
  .b-locked {
    font-size: 10px;
    opacity: 0.75;
    letter-spacing: 0.3px;
  }
</style>
