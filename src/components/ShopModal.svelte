<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { gameState, applyPurchase, type PurchaseOutcome } from "$lib/store/game";
  import { SHOP_ITEMS, itemsBySection, type ShopItem, type ShopSection } from "$lib/shop/catalog";
  import { locale, tt } from "$lib/i18n";
  import { haptic, hapticNotify } from "$lib/telegram";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let activeSection: ShopSection = $state("boosters");
  let lastFlash: { id: string; outcome: PurchaseOutcome } | null = $state(null);

  const labelTitle = $derived(tt($locale, "Магазин", "Shop", "Tienda"));
  const labelBoosters = $derived(tt($locale, "Бустеры", "Boosters", "Potenciadores"));
  const labelEnergy = $derived(tt($locale, "Энергия", "Energy", "Energía"));
  const labelUpgrades = $derived(tt($locale, "Улучшения", "Upgrades", "Mejoras"));
  const labelBuy = $derived(tt($locale, "Купить", "Buy", "Comprar"));
  const labelMaxed = $derived(tt($locale, "Максимум", "Maxed", "Al máximo"));
  const labelNotEnough = $derived(tt($locale, "Не хватает", "Not enough", "No alcanza"));

  function localize(triple: [string, string, string]): string {
    return tt($locale, triple[0], triple[1], triple[2]);
  }

  function currentTier(item: ShopItem): number {
    if (item.id === "upgrade_energy_max") return $gameState.upgrades?.energyMaxBoost ?? 0;
    if (item.id === "upgrade_regen_speed") return $gameState.upgrades?.regenSpeedBoost ?? 0;
    return 0;
  }

  function canAfford(item: ShopItem): boolean {
    if (item.coinCost !== undefined) return $gameState.coins >= item.coinCost;
    if (item.stardustCost !== undefined) return ($gameState.stardust ?? 0) >= item.stardustCost;
    return false;
  }

  function isMaxed(item: ShopItem): boolean {
    if (!item.maxTier) return false;
    return currentTier(item) >= item.maxTier;
  }

  function purchase(item: ShopItem) {
    haptic("light");
    const { next, outcome } = applyPurchase($gameState, item);
    lastFlash = { id: item.id, outcome };
    if (outcome.kind === "ok") {
      gameState.set(next);
      hapticNotify("success");
    } else {
      hapticNotify("error");
    }
    setTimeout(() => {
      if (lastFlash?.id === item.id) lastFlash = null;
    }, 1400);
  }

  function close() {
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
    aria-label="Close"
  ></div>
  <article
    class="sheet"
    transition:fly={{ y: 40, duration: 300 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="shop-title"
  >
    <header>
      <h2 id="shop-title">🛒 {labelTitle}</h2>
      <div class="wallet">
        <span class="wallet-item" title="Coins">🪙 {$gameState.coins}</span>
        <span class="wallet-item" title="Stardust">✨ {$gameState.stardust ?? 0}</span>
      </div>
    </header>

    <nav class="tabs" role="tablist">
      {#each [["boosters", labelBoosters], ["energy", labelEnergy], ["upgrades", labelUpgrades]] as const as [id, label]}
        <button
          type="button"
          class="tab"
          class:active={activeSection === id}
          role="tab"
          aria-selected={activeSection === id}
          onclick={() => (activeSection = id)}
        >
          {label}
        </button>
      {/each}
    </nav>

    <ul class="items">
      {#each itemsBySection(activeSection) as item (item.id)}
        {@const tier = currentTier(item)}
        {@const maxed = isMaxed(item)}
        {@const afford = canAfford(item)}
        {@const flash = lastFlash?.id === item.id ? lastFlash.outcome.kind : null}
        <li>
          <div
            class="card"
            class:disabled={maxed || !afford}
            class:flash-ok={flash === "ok"}
            class:flash-no={flash && flash !== "ok"}
            style="--accent: #{item.accent.toString(16).padStart(6, '0')};"
          >
            <div class="icon">
              {#if item.assetUrl}
                <img src={item.assetUrl} alt="" draggable="false" decoding="async" />
              {:else}
                <span class="icon-emoji" aria-hidden="true">{item.emoji}</span>
              {/if}
            </div>
            <div class="info">
              <div class="name">{localize(item.name)}</div>
              <div class="desc">{localize(item.description)}</div>
              {#if item.maxTier}
                <div class="tier">{tier} / {item.maxTier}</div>
              {/if}
            </div>
            <button
              type="button"
              class="buy"
              class:cant={!afford && !maxed}
              disabled={maxed || !afford}
              onclick={() => purchase(item)}
            >
              {#if maxed}
                {labelMaxed}
              {:else if item.coinCost !== undefined}
                🪙 {item.coinCost}
              {:else if item.stardustCost !== undefined}
                ✨ {item.stardustCost}
              {/if}
            </button>
          </div>
        </li>
      {/each}
    </ul>
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
  .sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(540px, 100%);
    max-height: 90dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #2B1B3D 0%, #1A1424 100%);
    border-top-left-radius: 24px;
    border-top-right-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom: none;
    box-shadow: 0 -24px 60px rgba(0, 0, 0, 0.6);
    color: #fff;
    z-index: 15;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 8px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  .wallet {
    display: flex;
    gap: 8px;
  }
  .wallet-item {
    background: rgba(255, 255, 255, 0.06);
    padding: 4px 10px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .tabs {
    display: flex;
    padding: 4px 12px 8px;
    gap: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .tab {
    flex: 1;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    border: none;
    padding: 8px 4px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.2px;
  }
  .tab:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  .tab.active {
    background: rgba(232, 164, 242, 0.16);
    color: #E8A4F2;
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 12px 12px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-left: 3px solid var(--accent);
    border-radius: 12px;
    padding: 10px 12px;
    transition: background 0.2s ease, transform 0.15s ease;
  }
  .card.disabled {
    opacity: 0.62;
  }
  .card.flash-ok {
    background: rgba(78, 205, 160, 0.18);
    border-color: #4ecda0;
  }
  .card.flash-no {
    background: rgba(255, 138, 138, 0.18);
    border-color: #ff8a8a;
    animation: shake 0.4s ease;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-3px); }
    75% { transform: translateX(3px); }
  }
  .icon {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon img {
    width: 36px;
    height: 36px;
    object-fit: contain;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
  }
  .icon-emoji {
    font-size: 26px;
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .desc {
    font-size: 12px;
    opacity: 0.7;
    line-height: 1.4;
  }
  .tier {
    font-size: 11px;
    margin-top: 4px;
    color: var(--accent);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .buy {
    flex-shrink: 0;
    background: var(--accent);
    color: #1A1424;
    border: none;
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    min-width: 84px;
    font-variant-numeric: tabular-nums;
  }
  .buy:hover:not(:disabled) {
    transform: translateY(-1px);
    transition: transform 0.1s ease;
  }
  .buy:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .buy.cant {
    background: rgba(255, 138, 138, 0.45);
    color: #fff;
  }
</style>
