<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { gameState } from "$lib/store/game";
  import {
    spinState,
    isSpinReady,
    spinCooldownRemaining,
    markSpinUsed,
  } from "$lib/store/spin";
  import { SPIN_PRIZES, rollPrize, prizeIndex, type SpinPrizeDef } from "$lib/spin/prizes";
  import { locale, tt } from "$lib/i18n";
  import { haptic, hapticNotify } from "$lib/telegram";
  import TabBar from "$components/TabBar.svelte";

  let now = $state(Date.now());
  let cooldownTimer: ReturnType<typeof setInterval> | undefined;

  let rotation = $state(0);
  let spinning = $state(false);
  let lastResult: SpinPrizeDef | null = $state(null);
  let showResult = $state(false);

  const SEGMENT_COUNT = SPIN_PRIZES.length;
  const SEGMENT_DEG = 360 / SEGMENT_COUNT;

  const labelTitle = $derived(tt($locale, "Ежедневное колесо", "Daily Spin", "Ruleta diaria"));
  const labelSubtitle = $derived(tt($locale, "Один раз в сутки — крути и забирай", "Once a day — spin and claim", "Una vez al día — gira y reclama"));
  const labelSpin = $derived(tt($locale, "Крутить", "Spin", "Girar"));
  const labelComeBack = $derived(tt($locale, "Возвращайся через", "Come back in", "Vuelve en"));
  const labelClaim = $derived(tt($locale, "Забрать", "Claim", "Recoger"));
  const labelWon = $derived(tt($locale, "Ты выиграл!", "You won!", "¡Ganaste!"));

  const ready = $derived(isSpinReady($spinState, now));
  const remainingMs = $derived(spinCooldownRemaining($spinState, now));

  function formatRemaining(ms: number): string {
    const totalSec = Math.ceil(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function localizeName(p: SpinPrizeDef): string {
    return tt($locale, p.name[0], p.name[1], p.name[2]);
  }

  function awardPrize(prize: SpinPrizeDef) {
    gameState.update((g) => {
      let next = { ...g };
      if (prize.coins) next.coins = g.coins + prize.coins;
      if (prize.energy) next.energy = Math.min(g.energyMax + prize.energy, g.energy + prize.energy);
      if (prize.booster) {
        const b = { ...(g.boosters ?? {}) };
        const k = prize.booster.type;
        b[k] = (b[k] ?? 0) + prize.booster.amount;
        next.boosters = b;
      }
      return next;
    });
  }

  function spin() {
    if (!ready || spinning) return;
    spinning = true;
    haptic("medium");

    const prize = rollPrize();
    const idx = prizeIndex(prize);

    // Compute the final rotation so the target segment lands under the pointer
    // (which sits at the top, angle 0 / -90 in standard coords).
    // Each segment center is at SEGMENT_DEG * idx + SEGMENT_DEG / 2 from "top".
    // We want that center pointing UP after rotation.
    const segmentCenter = SEGMENT_DEG * idx + SEGMENT_DEG / 2;
    // Add a generous number of full revolutions for visual flair.
    const extraTurns = 6;
    const target = 360 * extraTurns + (360 - segmentCenter);
    // Reset rotation to avoid unbounded growth across many spins
    rotation = rotation % 360;
    // Trigger CSS transition by setting new target value
    requestAnimationFrame(() => {
      rotation = target;
    });

    // Match the CSS transition duration
    setTimeout(() => {
      spinning = false;
      lastResult = prize;
      showResult = true;
      markSpinUsed();
      hapticNotify(prize.id === "jackpot" ? "success" : "warning");
    }, 4200);
  }

  function claimAndClose() {
    if (lastResult) {
      awardPrize(lastResult);
      haptic("heavy");
    }
    showResult = false;
    lastResult = null;
  }

  onMount(() => {
    cooldownTimer = setInterval(() => {
      now = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    if (cooldownTimer) clearInterval(cooldownTimer);
  });
</script>

<div class="root">
  <header class="hud">
    <div class="title">
      <span class="title-emoji" aria-hidden="true">🎡</span>
      <span class="title-text">{labelTitle}</span>
    </div>
    <div class="coins">
      <span class="coins-emoji" aria-hidden="true">🪙</span>
      <span class="coins-value">{$gameState.coins}</span>
    </div>
  </header>

  <p class="subtitle">{labelSubtitle}</p>

  <div class="wheel-area">
    <div class="pointer" aria-hidden="true">▼</div>
    <div class="wheel" style="transform: rotate({rotation}deg);">
      {#each SPIN_PRIZES as prize, i (prize.id)}
        {@const startAngle = i * SEGMENT_DEG}
        {@const accent = `#${prize.accent.toString(16).padStart(6, "0")}`}
        <div
          class="segment"
          style="
            --start: {startAngle}deg;
            --end: {startAngle + SEGMENT_DEG}deg;
            --accent: {accent};
            transform: rotate({startAngle + SEGMENT_DEG / 2}deg);
          "
        >
          <div class="segment-content">
            <img
              src={prize.url}
              alt=""
              draggable="false"
              decoding="async"
              loading="lazy"
            />
          </div>
        </div>
      {/each}
      <div class="hub" aria-hidden="true">
        <div class="hub-inner">🎡</div>
      </div>
    </div>
  </div>

  <div class="action">
    {#if ready}
      <button
        type="button"
        class="spin-btn"
        onclick={spin}
        disabled={spinning}
      >
        {spinning ? "…" : labelSpin}
      </button>
    {:else}
      <div class="cooldown">
        <span class="cooldown-label">{labelComeBack}</span>
        <span class="cooldown-value">{formatRemaining(remainingMs)}</span>
      </div>
    {/if}
  </div>

  <TabBar />
</div>

{#if showResult && lastResult}
  <div
    class="backdrop"
    transition:fade={{ duration: 180 }}
    role="presentation"
  ></div>
  <div
    class="result-card"
    transition:fly={{ y: 30, duration: 300 }}
    style="--accent: #{lastResult.accent.toString(16).padStart(6, '0')};"
    role="dialog"
    aria-modal="true"
  >
    <div class="result-burst" aria-hidden="true">✨</div>
    <div class="result-icon">
      <img src={lastResult.url} alt="" draggable="false" />
    </div>
    <div class="result-label">{labelWon}</div>
    <div class="result-prize">{localizeName(lastResult)}</div>
    <button type="button" class="claim-btn" onclick={claimAndClose}>
      {labelClaim}
    </button>
  </div>
{/if}

<style>
  .root {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    background:
      radial-gradient(circle at 50% 30%, rgba(232, 164, 242, 0.12), transparent 60%),
      linear-gradient(180deg, #1f1733 0%, #2B1B3D 60%, #1A1424 100%);
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
  .subtitle {
    text-align: center;
    margin: 8px 16px 0;
    font-size: 12px;
    opacity: 0.6;
    letter-spacing: 0.2px;
  }
  .wheel-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 20px;
  }
  .pointer {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 28px;
    color: #ffd96b;
    text-shadow: 0 4px 12px rgba(255, 200, 0, 0.6);
    z-index: 3;
  }
  .wheel {
    position: relative;
    width: min(340px, calc(100% - 32px));
    aspect-ratio: 1 / 1;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.4));
    box-shadow:
      0 0 0 3px rgba(255, 255, 255, 0.12),
      0 0 40px rgba(232, 164, 242, 0.18),
      inset 0 0 30px rgba(0, 0, 0, 0.5);
    transition: transform 4s cubic-bezier(0.17, 0.67, 0.32, 1.01);
    overflow: hidden;
  }
  .segment {
    position: absolute;
    top: 0;
    left: 50%;
    width: 50%;
    height: 50%;
    transform-origin: 0 100%;
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 50%, transparent), color-mix(in srgb, var(--accent) 22%, transparent));
    border-left: 1px solid rgba(255, 255, 255, 0.18);
  }
  .segment-content {
    position: absolute;
    left: -50%;
    top: 20%;
    width: 100%;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }
  .segment-content img {
    width: 42px;
    height: 42px;
    object-fit: contain;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
  }
  .hub {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: radial-gradient(circle, #E8A4F2, #8B7FD9);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
    z-index: 2;
  }
  .hub-inner {
    font-size: 28px;
  }
  .action {
    padding: 14px 16px 16px;
    display: flex;
    justify-content: center;
  }
  .spin-btn {
    background: linear-gradient(135deg, #E8A4F2 0%, #B47AD9 100%);
    color: #1A1424;
    border: none;
    padding: 14px 56px;
    border-radius: 14px;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.4px;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(180, 122, 217, 0.36);
    transition: transform 0.12s ease;
    min-width: 200px;
  }
  .spin-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }
  .spin-btn:active:not(:disabled) {
    transform: translateY(0);
  }
  .spin-btn:disabled {
    cursor: progress;
    opacity: 0.7;
  }
  .cooldown {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 28px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .cooldown-label {
    font-size: 11px;
    opacity: 0.6;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .cooldown-value {
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #ffd96b;
  }

  /* Result modal */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 4, 20, 0.66);
    backdrop-filter: blur(3px);
    z-index: 8;
  }
  .result-card {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(320px, calc(100% - 32px));
    padding: 28px 28px 20px;
    background: linear-gradient(180deg, #2B1B3D 0%, #1A1424 100%);
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.6),
      0 0 0 2px var(--accent) inset;
    color: #fff;
    text-align: center;
    z-index: 9;
  }
  .result-burst {
    font-size: 40px;
    margin-bottom: 6px;
  }
  .result-icon img {
    width: 96px;
    height: 96px;
    object-fit: contain;
    filter: drop-shadow(0 8px 24px color-mix(in srgb, var(--accent) 60%, transparent));
  }
  .result-label {
    margin-top: 16px;
    font-size: 13px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 700;
  }
  .result-prize {
    margin-top: 6px;
    font-size: 19px;
    font-weight: 700;
  }
  .claim-btn {
    margin-top: 20px;
    width: 100%;
    background: var(--accent);
    color: #1A1424;
    border: none;
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  }
</style>
