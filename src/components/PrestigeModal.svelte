<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { gameState, applyPrestige } from "$lib/store/game";
  import { trigger as triggerStory } from "$lib/lily/story";
  import { locale, tt } from "$lib/i18n";
  import { haptic, hapticNotify } from "$lib/telegram";
  import { MAX_LEVEL, BOARD_COLS_MAX } from "$lib/game/logic";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const labelTitle = $derived(tt($locale, "Звёздная пыль", "Stardust", "Polvo estelar"));
  const labelDescription = $derived(
    tt(
      $locale,
      "Доска L12 достигнута — можно начать круг заново. Ты сохранишь монеты, бустеры, мастерство и сад.",
      "L12 reached — you can start a fresh run. You'll keep coins, boosters, mastery, and the garden.",
      "Has llegado a L12 — puedes empezar de nuevo. Conservas monedas, potenciadores, maestría y el jardín."
    )
  );
  const labelWipes = $derived(tt($locale, "Сбросится", "Will reset", "Se reinicia"));
  const labelKeeps = $derived(tt($locale, "Останется", "Will keep", "Se conserva"));
  const labelBoardSize = $derived(tt($locale, "Размер доски", "Board size", "Tamaño del tablero"));
  const labelGain = $derived(tt($locale, "Награда", "Reward", "Recompensa"));
  const labelStardust = $derived(tt($locale, "звёздной пыли", "stardust", "polvo estelar"));
  const labelConfirm = $derived(tt($locale, "Перерождение", "Prestige", "Renacer"));
  const labelCancel = $derived(tt($locale, "Не сейчас", "Not now", "Ahora no"));

  const wipes = $derived(
    tt($locale, "доска, инвентарь, энергия", "board, inventory, energy", "tablero, inventario, energía")
  );
  const keeps = $derived(
    tt(
      $locale,
      "монеты, бустеры, мастерство, сад",
      "coins, boosters, mastery, garden",
      "monedas, potenciadores, maestría, jardín"
    )
  );

  const currentCols = $derived($gameState.boardCols);
  const nextCols = $derived(Math.min(BOARD_COLS_MAX, currentCols + 1));
  const colsBoosts = $derived(nextCols > currentCols);

  function close() {
    open = false;
  }

  function confirm() {
    haptic("heavy");
    const isFirst = $gameState.prestige === 0;
    gameState.update(applyPrestige);
    hapticNotify("success");
    if (isFirst) {
      triggerStory("first_prestige");
    }
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") close();
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <div
    class="backdrop"
    transition:fade={{ duration: 180 }}
    onclick={close}
    onkeydown={onKeydown}
    role="button"
    tabindex="-1"
    aria-label={labelCancel}
  ></div>
  <article
    class="panel"
    transition:fly={{ y: 30, duration: 280 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="prestige-title"
  >
    <header>
      <div class="emoji" aria-hidden="true">✨</div>
      <h2 id="prestige-title">{labelTitle}</h2>
    </header>
    <p class="body">{labelDescription}</p>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">{labelGain}</div>
        <div class="stat-value gain">+1 ✨ {labelStardust}</div>
      </div>
      {#if colsBoosts}
        <div class="stat">
          <div class="stat-label">{labelBoardSize}</div>
          <div class="stat-value">{currentCols}×{currentCols} → <span class="next">{nextCols}×{nextCols}</span></div>
        </div>
      {/if}
    </div>

    <ul class="lists">
      <li>
        <span class="bullet wipes" aria-hidden="true">−</span>
        <strong>{labelWipes}:</strong>
        <span class="dim">{wipes}</span>
      </li>
      <li>
        <span class="bullet keeps" aria-hidden="true">+</span>
        <strong>{labelKeeps}:</strong>
        <span class="dim">{keeps}</span>
      </li>
    </ul>

    <div class="actions">
      <button type="button" class="cancel" onclick={close}>{labelCancel}</button>
      <button type="button" class="confirm" onclick={confirm}>
        ✨ {labelConfirm}
      </button>
    </div>
  </article>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 4, 20, 0.7);
    backdrop-filter: blur(4px);
    z-index: 14;
    cursor: pointer;
  }
  .panel {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100% - 24px));
    max-height: 85dvh;
    overflow-y: auto;
    padding: 24px;
    background: linear-gradient(180deg, #2B1B3D 0%, #1A1424 100%);
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.6),
      0 0 0 2px #b068df inset;
    color: #fff;
    z-index: 15;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .emoji {
    font-size: 38px;
    filter: drop-shadow(0 6px 18px rgba(176, 104, 223, 0.5));
  }
  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.2px;
    color: #fff;
  }
  .body {
    font-size: 14px;
    line-height: 1.6;
    margin: 0 0 18px;
    color: rgba(255, 255, 255, 0.82);
  }
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 18px;
  }
  .stat {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 10px 12px;
  }
  .stat-label {
    font-size: 11px;
    opacity: 0.55;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .stat-value {
    font-size: 15px;
    font-weight: 700;
  }
  .stat-value.gain {
    color: #b068df;
  }
  .next {
    color: #ffd96b;
  }
  .lists {
    list-style: none;
    margin: 0 0 22px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .lists li {
    font-size: 13px;
    line-height: 1.5;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .bullet {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    font-weight: 700;
    font-size: 13px;
    line-height: 1;
  }
  .bullet.wipes {
    background: rgba(255, 138, 138, 0.18);
    color: #ff8a8a;
  }
  .bullet.keeps {
    background: rgba(78, 205, 160, 0.18);
    color: #4ecda0;
  }
  .dim {
    opacity: 0.7;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .actions button {
    flex: 1;
    padding: 12px 14px;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.2px;
    cursor: pointer;
  }
  .cancel {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }
  .cancel:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .confirm {
    background: linear-gradient(135deg, #b068df 0%, #6e3cae 100%);
    color: #fff;
    box-shadow: 0 8px 22px rgba(176, 104, 223, 0.36);
  }
  .confirm:hover {
    transform: translateY(-1px);
    transition: transform 0.12s ease;
  }
</style>
