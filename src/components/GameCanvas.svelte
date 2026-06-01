<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { gameState, resetGame, applyMasteryBonus } from "$lib/store/game";
  import type { LineId } from "$lib/game/lines";
  import type { StoryEvent } from "$lib/lily/story";
  import { getPixiApp, destroyPixiApp } from "$lib/pixi/app";
  import { BoardScene } from "$lib/pixi/boardScene";
  import { Lily } from "$lib/pixi/lily";
  import { findMergePair } from "$lib/game/hint";
  import { applyDrop, applyGeneratorTap, applyEnergyTick } from "$lib/game/actions";
  import { tt, locale } from "$lib/i18n";
  import { haptic, hapticNotify, tg } from "$lib/telegram";
  import { say, clearDialogue } from "$lib/lily/dialogue";
  import { trigger as triggerStory, clearSeenEpisodes } from "$lib/lily/story";
  import { gardenState, resetGarden, creditArtifact } from "$lib/store/garden";
  import { computeGardenBonuses } from "$lib/garden/bonuses";
  import { resetSpin } from "$lib/store/spin";
  import { claimDailyStreak, resetStreak } from "$lib/store/streak";
  import { preload } from "$lib/assets/loader";
  import { ESSENTIAL_GAME, itemSpriteUrl, generatorSpriteUrl } from "$lib/assets/manifest";
  import { schedulePush, cancelAllPushes } from "$lib/notifications";
  import { LINE_IDS } from "$lib/game/lines";
  import LilyBubble from "$components/LilyBubble.svelte";
  import TabBar from "$components/TabBar.svelte";
  import PrestigeModal from "$components/PrestigeModal.svelte";
  import ShopModal from "$components/ShopModal.svelte";
  import StoryLogView from "$components/StoryLogView.svelte";
  import { seenEpisodes } from "$lib/lily/story";
  import { MAX_LEVEL } from "$lib/game/logic";

  let mountTarget: HTMLDivElement;
  let scene: BoardScene | undefined;
  let lily: Lily | undefined;
  let mounted = false;
  let resizeObserver: ResizeObserver | undefined;
  let energyTickInterval: ReturnType<typeof setInterval> | undefined;
  let lilyBehaviorInterval: ReturnType<typeof setInterval> | undefined;
  let pendingTimeouts: ReturnType<typeof setTimeout>[] = [];
  let destroyed = false;

  // Behavior tuning
  const ATTENTION_DELAY_MS = 5000;
  const SLEEPY_DELAY_MS = 45000;
  let lastInteractionMs = performance.now();
  let lilyAwayFromHome = false;

  /** Maps a mastered line to its lore episode trigger id. */
  const MASTERY_EVENT_FOR_LINE: Record<LineId, StoryEvent> = {
    roses: "mastery_gift",
    forge: "mastery_pizza",
    fleet: "mastery_rocket",
    fae: "mastery_unicorn",
    crystals: "mastery_gem",
    symphony: "mastery_guitar",
    ocean: "mastery_dolphin",
    stellar: "mastery_trophy",
    artifacts: "mastery_phone",
  };

  const labelLevel = $derived(tt($locale, "Уровень", "Level", "Nivel"));
  const labelCoins = $derived(tt($locale, "Монеты", "Coins", "Monedas"));
  const labelEnergy = $derived(tt($locale, "Энергия", "Energy", "Energía"));
  const labelMastery = $derived(tt($locale, "Мастерство", "Mastery", "Maestría"));
  const labelPrestige = $derived(tt($locale, "Перерождение", "Prestige", "Renacer"));
  const labelCombo = $derived(tt($locale, "Комбо", "Combo", "Combo"));
  const masteryCount = $derived($gameState.masteredLines?.length ?? 0);
  const stardust = $derived($gameState.stardust ?? 0);
  const prestigeReady = $derived(($gameState.highestTierThisRun ?? 1) >= MAX_LEVEL);
  const combo = $derived($gameState.comboCount ?? 0);

  let prestigeOpen = $state(false);
  let shopOpen = $state(false);
  let storyLogOpen = $state(false);
  const labelShop = $derived(tt($locale, "Магазин", "Shop", "Tienda"));
  const labelStoryLog = $derived(tt($locale, "Дневник", "Story Log", "Diario"));
  const seenCount = $derived($seenEpisodes.size);
  const labelReset = $derived(tt($locale, "Сбросить", "Reset", "Reiniciar"));
  const confirmReset = $derived(
    tt(
      $locale,
      "Стереть прогресс и начать заново?",
      "Wipe progress and start over?",
      "¿Borrar progreso y empezar de nuevo?"
    )
  );
  const msgNoEnergy = $derived(
    tt(
      $locale,
      "Нет энергии! Подожди немного.",
      "Out of energy! Wait a bit.",
      "¡Sin energía! Espera un poco."
    )
  );
  const msgNoSpace = $derived(
    tt(
      $locale,
      "Нет места на доске.",
      "No space on the board.",
      "No hay espacio en el tablero."
    )
  );
  const msgLucky = $derived(
    tt(
      $locale,
      "✨ Сундук удачи!",
      "✨ Lucky chest!",
      "✨ ¡Cofre de la suerte!"
    )
  );

  function flash(message: string) {
    const t = tg();
    if (t) {
      t.showAlert?.(message);
    } else {
      // Browser dev fallback
      console.info("[flash]", message);
    }
  }

  /** Drag/drop landed on a valid target. */
  function handleDrop(fromIdx: number, toIdx: number): boolean {
    const current = get(gameState);
    const bonuses = computeGardenBonuses(get(gardenState));
    const { next, outcome } = applyDrop(current, fromIdx, toIdx, Math.random, bonuses);
    if (outcome.kind === "noop") return false;

    if (outcome.kind === "merge") {
      const mergeSpot = scene?.slotWorldCenter(outcome.to);
      const artifactToCredit = outcome.artifact;
      const masteredLine = outcome.newlyMastered ? outcome.line : undefined;
      const isJackpot = outcome.jackpot === true;
      const chainDepth = outcome.chainSteps?.length ?? 0;
      const combo = outcome.combo ?? 1;

      scene?.playMergeAnim(outcome.from, outcome.to).then(() => {
        const withBonus = masteredLine
          ? applyMasteryBonus(next, masteredLine)
          : next;
        gameState.set(withBonus);
        hapticNotify("success");
        if (mergeSpot) lily?.celebrate(mergeSpot.x, mergeSpot.y);
        // Prioritized dialogue: jackpot > chain > combo > praise
        if (isJackpot) say("jackpot");
        else if (chainDepth >= 2) say("chain");
        else if (combo >= 3) say("combo");
        else say("praise");

        // Artifact drops are silent (no story panel) until the player's
        // first one — then we fire the first_rare lore episode and start
        // showing a small toast for subsequent drops.
        if (artifactToCredit) {
          gardenState.update((g) => creditArtifact(g, artifactToCredit, 1));
          triggerStory("first_rare");
        }

        if (masteredLine) {
          const evt = MASTERY_EVENT_FOR_LINE[masteredLine];
          if (evt) triggerStory(evt);
          // mastery_gift is the meta lore episode shown on the FIRST line
          // mastered in the whole save. iOS triggers it once.
          triggerStory("mastery_gift");
        }
      });
      haptic("heavy");
      noteInteraction();
      return true;
    }

    if (outcome.kind === "swap" || outcome.kind === "move") {
      gameState.set(next);
      haptic("light");
      noteInteraction();
      return true;
    }

    return false;
  }

  /** Reset the activity timer + send Lily home if she's away. */
  function noteInteraction() {
    lastInteractionMs = performance.now();
    lastMood = "idle";
    if (lilyAwayFromHome && lily) {
      lily.setMood("idle");
      lily.flyHome(() => {
        lilyAwayFromHome = false;
      });
    } else {
      lily?.setMood("idle");
    }
  }

  /** Tap on a generator → spawn a new item. */
  function handleGeneratorTap(boardIdx: number): boolean {
    const current = get(gameState);
    const bonuses = computeGardenBonuses(get(gardenState));
    const { next, outcome } = applyGeneratorTap(current, boardIdx, Math.random, bonuses);

    if (outcome.kind === "no-energy") {
      hapticNotify("error");
      say("no-energy");
      return false;
    }
    if (outcome.kind === "no-space") {
      hapticNotify("warning");
      flash(msgNoSpace);
      return false;
    }
    if (outcome.kind === "not-generator") {
      return false;
    }

    // Spawned successfully.
    gameState.set(next);
    haptic(outcome.isLucky ? "heavy" : "medium");

    // Schedule an "energy full" push if the bar isn't currently full.
    // The Worker dedupes by kind so each spawn supersedes the previous
    // estimate — no spam.
    if (next.energy < next.energyMax) {
      const regenTier = next.upgrades?.regenSpeedBoost ?? 0;
      const regenIntervalMs = 60_000 * Math.pow(0.9, regenTier);
      const ticksRemaining = next.energyMax - next.energy;
      const fullAt = next.lastEnergyTimeMs + ticksRemaining * regenIntervalMs;
      const energyText = tt(
        $locale,
        "⚡ Энергия полная — пора играть!",
        "⚡ Energy is full — time to play!",
        "⚡ Energía al máximo — ¡a jugar!"
      );
      void schedulePush({
        kind: "energy_full",
        firingAt: fullAt,
        text: energyText,
        deeplinkView: "game",
      });
    }

    if (outcome.isLucky) {
      hapticNotify("success");
      flash(msgLucky);
      // Credit a random artifact so the player makes garden progress
      // even before the L5+ merge artifact drop lands in Phase 3.C.
      const pool: Array<"seed" | "pixie_dust" | "crystal" | "phoenix_feather"> =
        ["seed", "pixie_dust", "crystal", "phoenix_feather"];
      const artifact = pool[Math.floor(Math.random() * pool.length)];
      gardenState.update((g) => creditArtifact(g, artifact, 1));
      // Lore beat: first rare drop. Fires once per save.
      triggerStory("first_rare");
    }
    // Pop animation runs after the next rebuild() landed by the store subscription.
    queueMicrotask(() => scene?.playSpawnAnim(outcome.idx));
    noteInteraction();
    return true;
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
      onGeneratorTap: handleGeneratorTap,
    });

    // Lily lives in her own top-level container so she always renders above
    // the board and stays put when the board rebuilds.
    lily = new Lily({
      parent: app.stage,
      x: width - 56,
      y: height - 56,
      size: 64,
    });

    const unsubscribe = gameState.subscribe((s) => {
      scene?.resize(
        mountTarget.clientWidth,
        mountTarget.clientHeight,
        s.boardCols,
        s.inventory.length
      );
      scene?.rebuild(s.boardCols, s.board, s.inventory);
    });

    resizeObserver = new ResizeObserver(() => {
      const w = mountTarget.clientWidth;
      const h = mountTarget.clientHeight;
      const current = get(gameState);
      scene?.resize(w, h, current.boardCols, current.inventory.length);
      scene?.rebuild(current.boardCols, current.board, current.inventory);
      lily?.moveTo(w - 56, h - 56);
    });
    resizeObserver.observe(mountTarget);

    // Passive energy regen — tick every 2 seconds. Action is idempotent
    // (only mutates when ENERGY_REGEN_MS has elapsed) so 2s polling is
    // smooth enough for the player AND cheap on battery.
    energyTickInterval = setInterval(() => {
      const current = get(gameState);
      const bonuses = computeGardenBonuses(get(gardenState));
      const next = applyEnergyTick(current, Date.now(), bonuses);
      if (next !== current) {
        gameState.set(next);
      }
    }, 2000);

    // Lily behavior — checked at 1Hz, cheap.
    lilyBehaviorInterval = setInterval(updateLilyBehavior, 1000);

    mounted = true;
    // First-mount narrative beat: greeting bubble, then the intro lore
    // episode (only fires the first time per save). Held in a list so
    // onDestroy can clear them if the user nav'd away mid-delay.
    pendingTimeouts.push(setTimeout(() => { if (!destroyed) say("greeting"); }, 600));
    pendingTimeouts.push(setTimeout(() => { if (!destroyed) triggerStory("intro"); }, 1800));

    // Daily streak claim on first mount per day. Awards coins + triggers
    // the streak_N lore beats (3, 7, 14, 30 days).
    const streak = claimDailyStreak();
    if (streak.kind === "claimed") {
      gameState.update((g) => ({ ...g, coins: g.coins + streak.coins }));
      pendingTimeouts.push(setTimeout(() => {
        if (destroyed) return;
        if (streak.streak >= 30) triggerStory("streak_30");
        else if (streak.streak >= 14) triggerStory("streak_14");
        else if (streak.streak >= 7) triggerStory("streak_7");
        else if (streak.streak >= 3) triggerStory("streak_3");
      }, 2400));
    }

    // Eager preload of essential HD assets. The scene's onTextureLoaded
    // subscription handles the rebuild — we just kick off the loads.
    // Then chain a background pass over tier 2-5 sprites.
    void preload(ESSENTIAL_GAME).then(() => {
      if (destroyed) return;
      const tier2to5: string[] = [];
      for (const line of LINE_IDS) {
        for (let t = 2; t <= 5; t++) tier2to5.push(itemSpriteUrl(line, t));
      }
      for (let g = 2; g <= 5; g++) tier2to5.push(generatorSpriteUrl(g));
      void preload(tier2to5);
    });

    return unsubscribe;
  }

  let unsubscribePromise: Promise<(() => void) | undefined> | undefined;

  onMount(() => {
    unsubscribePromise = setupPixi();
  });

  let lastMood: "idle" | "attention" | "sleepy" = "idle";

  /**
   * Idle-time behavior driver. Inspects gameState + activity timer and
   * nudges Lily into attention / sleepy / idle as appropriate.
   */
  function updateLilyBehavior() {
    if (!lily || !scene) return;
    const idleFor = performance.now() - lastInteractionMs;
    const state = get(gameState);

    if (idleFor > SLEEPY_DELAY_MS) {
      if (!lilyAwayFromHome) {
        lily.setMood("sleepy");
        if (lastMood !== "sleepy") {
          say("sleepy");
          lastMood = "sleepy";
        }
      }
      return;
    }

    if (idleFor > ATTENTION_DELAY_MS) {
      const pair = findMergePair(state.board, state.boardCols);
      if (pair) {
        const targetPos = scene.slotWorldCenter(pair.toIdx);
        if (targetPos) {
          if (!lilyAwayFromHome) {
            lily.setMood("attention");
            lily.flyTo(targetPos.x, targetPos.y);
            lilyAwayFromHome = true;
            if (lastMood !== "attention") {
              say("hint");
              lastMood = "attention";
            }
          }
          return;
        }
      }
    }
  }

  onDestroy(async () => {
    destroyed = true;
    for (const t of pendingTimeouts) clearTimeout(t);
    pendingTimeouts = [];
    if (energyTickInterval) clearInterval(energyTickInterval);
    if (lilyBehaviorInterval) clearInterval(lilyBehaviorInterval);
    clearDialogue();
    resizeObserver?.disconnect();
    const unsubscribe = await unsubscribePromise;
    unsubscribe?.();
    lily?.destroy();
    lily = undefined;
    scene?.destroy();
    scene = undefined;
    destroyPixiApp();
  });

  function handleReset() {
    if (confirm(confirmReset)) {
      resetGame();
      resetGarden();
      resetSpin();
      resetStreak();
      clearSeenEpisodes();
      void cancelAllPushes();
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
    {#if combo > 1}
      <div class="stat combo" title={labelCombo}>
        <span class="stat-label">⚡</span>
        <span class="stat-value">×{combo}</span>
      </div>
    {/if}
    {#if masteryCount > 0}
      <div class="stat mastery" title={labelMastery}>
        <span class="stat-label">🏆</span>
        <span class="stat-value">{masteryCount}/9</span>
      </div>
    {/if}
    {#if stardust > 0 || prestigeReady}
      <button
        type="button"
        class="stat prestige"
        class:ready={prestigeReady}
        title={labelPrestige}
        onclick={() => (prestigeOpen = true)}
      >
        <span class="stat-label">✨</span>
        <span class="stat-value">{stardust}</span>
      </button>
    {/if}
    <button
      type="button"
      class="stat shop-btn"
      title={labelShop}
      onclick={() => (shopOpen = true)}
    >
      <span class="stat-label">🛒</span>
    </button>
    {#if seenCount > 0}
      <button
        type="button"
        class="stat log-btn"
        title={labelStoryLog}
        onclick={() => (storyLogOpen = true)}
      >
        <span class="stat-label">📖</span>
      </button>
    {/if}
  </header>

  <PrestigeModal bind:open={prestigeOpen} />
  <ShopModal bind:open={shopOpen} />
  <StoryLogView bind:open={storyLogOpen} />

  <div bind:this={mountTarget} class="canvas-host">
    <LilyBubble />
  </div>

  <footer>
    <button type="button" class="reset" onclick={handleReset}>{labelReset}</button>
    {#if !mounted}
      <span class="loading">…</span>
    {/if}
  </footer>

  <TabBar />
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
    touch-action: none;
    user-select: none;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-around;
    gap: 4px;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.18);
  }
  .mastery .stat-value {
    color: #ffd96b;
    font-variant-numeric: tabular-nums;
  }
  .combo .stat-value {
    color: #ff8542;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .combo .stat-label {
    color: #ff8542;
  }
  .prestige {
    background: rgba(176, 104, 223, 0.12);
    border: 1px solid rgba(176, 104, 223, 0.3);
    border-radius: 10px;
    padding: 4px 10px;
    color: #fff;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.12s ease;
  }
  .prestige:hover {
    background: rgba(176, 104, 223, 0.2);
  }
  .prestige .stat-value {
    color: #d8a8f5;
    font-variant-numeric: tabular-nums;
  }
  .shop-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 4px 10px;
    color: #fff;
    cursor: pointer;
  }
  .shop-btn:hover {
    background: rgba(255, 255, 255, 0.14);
  }
  .shop-btn .stat-label {
    font-size: 18px;
  }
  .log-btn {
    background: rgba(232, 164, 242, 0.1);
    border: 1px solid rgba(232, 164, 242, 0.22);
    border-radius: 10px;
    padding: 4px 10px;
    color: #fff;
    cursor: pointer;
  }
  .log-btn:hover {
    background: rgba(232, 164, 242, 0.2);
  }
  .log-btn .stat-label {
    font-size: 18px;
  }
  .prestige.ready {
    animation: prestige-pulse 1.6s ease-in-out infinite;
    background: rgba(176, 104, 223, 0.3);
    border-color: rgba(216, 168, 245, 0.7);
  }
  @keyframes prestige-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(176, 104, 223, 0.5); }
    50%      { box-shadow: 0 0 16px 2px rgba(176, 104, 223, 0.6); }
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
