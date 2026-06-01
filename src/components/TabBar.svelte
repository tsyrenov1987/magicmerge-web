<script lang="ts">
  import { uiView, setView, openShop } from "$lib/store/ui";
  import { locale, tt } from "$lib/i18n";
  import { haptic } from "$lib/telegram";

  const labelGame = $derived(tt($locale, "Доска", "Board", "Tablero"));
  const labelGarden = $derived(tt($locale, "Сад", "Garden", "Jardín"));
  const labelShop = $derived(tt($locale, "Магазин", "Shop", "Tienda"));
  const labelBack = $derived(tt($locale, "Назад", "Back", "Atrás"));

  function go(view: "game" | "garden" | "landing") {
    if ($uiView === view) return;
    haptic("light");
    setView(view);
  }

  function onShop() {
    haptic("light");
    openShop();
  }
</script>

<nav class="tabbar" aria-label="Sections">
  <button
    type="button"
    class="back"
    onclick={() => go("landing")}
    aria-label={labelBack}
  >
    ‹
  </button>
  <button
    type="button"
    class="tab"
    class:active={$uiView === "game"}
    onclick={() => go("game")}
  >
    <span class="emoji" aria-hidden="true">✨</span>
    <span class="label">{labelGame}</span>
  </button>
  <button
    type="button"
    class="tab"
    class:active={$uiView === "garden"}
    onclick={() => go("garden")}
  >
    <span class="emoji" aria-hidden="true">🌱</span>
    <span class="label">{labelGarden}</span>
  </button>
  <button
    type="button"
    class="tab"
    onclick={onShop}
    aria-label={labelShop}
  >
    <span class="emoji" aria-hidden="true">🛒</span>
    <span class="label">{labelShop}</span>
  </button>
</nav>

<style>
  .tabbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.28);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    z-index: 4;
  }
  .back {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 22px;
    line-height: 1;
    padding: 0;
    flex-shrink: 0;
  }
  .back:hover { background: rgba(255, 255, 255, 0.13); }
  .tab {
    flex: 1;
    background: transparent;
    border: none;
    color: #fff;
    padding: 8px 4px;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition: background 0.15s ease;
  }
  .tab:hover { background: rgba(255, 255, 255, 0.06); }
  .tab.active {
    background: rgba(232, 164, 242, 0.18);
  }
  .emoji {
    font-size: 18px;
    line-height: 1;
  }
  .label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.4px;
    opacity: 0.88;
  }
  .tab.active .label {
    color: #E8A4F2;
  }
</style>
