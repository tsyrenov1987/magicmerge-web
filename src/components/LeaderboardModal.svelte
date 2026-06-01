<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import {
    leaderboardOptIn,
    pushLeaderboardEntry,
    removeLeaderboardEntry,
    fetchLeaderboard,
    defaultDisplayName,
    type LeaderboardEntry,
  } from "$lib/leaderboard";
  import { currentUser } from "$lib/firebase";
  import { locale, tt } from "$lib/i18n";
  import { haptic, hapticNotify } from "$lib/telegram";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let entries: LeaderboardEntry[] = $state([]);
  let loading = $state(false);
  let displayName = $state(defaultDisplayName());
  let publishing = $state(false);

  const labelTitle = $derived(tt($locale, "Таблица лидеров", "Leaderboard", "Tabla de líderes"));
  const labelOptIn = $derived(
    tt(
      $locale,
      "Показывать меня в таблице",
      "Show me on the leaderboard",
      "Mostrarme en la tabla"
    )
  );
  const labelNamePlaceholder = $derived(tt($locale, "Имя в таблице", "Display name", "Nombre"));
  const labelEmpty = $derived(
    tt($locale, "Пока никого нет", "No one here yet", "Aún nadie aquí")
  );
  const labelOffline = $derived(
    tt(
      $locale,
      "Нужно подключение к серверу",
      "Server connection required",
      "Se requiere conexión"
    )
  );
  const labelPrestige = $derived(tt($locale, "Цикл", "Cycle", "Ciclo"));
  const labelTier = $derived(tt($locale, "Тир", "Tier", "Nivel"));
  const labelLoading = $derived(tt($locale, "Загрузка…", "Loading…", "Cargando…"));

  async function refresh() {
    loading = true;
    entries = await fetchLeaderboard(50);
    loading = false;
  }

  async function toggleOptIn(next: boolean) {
    haptic("light");
    $leaderboardOptIn = next;
    publishing = true;
    if (next) {
      const ok = await pushLeaderboardEntry(displayName || "Player");
      if (ok) hapticNotify("success");
    } else {
      const ok = await removeLeaderboardEntry();
      if (ok) hapticNotify("success");
    }
    publishing = false;
    await refresh();
  }

  async function onNameBlur() {
    if (!$leaderboardOptIn) return;
    publishing = true;
    await pushLeaderboardEntry(displayName || "Player");
    publishing = false;
    await refresh();
  }

  function close() {
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") close();
  }

  onMount(() => {
    void refresh();
  });
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
    aria-labelledby="leaderboard-title"
  >
    <header>
      <h2 id="leaderboard-title">🏅 {labelTitle}</h2>
    </header>

    <div class="optin">
      <label>
        <input
          type="checkbox"
          checked={$leaderboardOptIn}
          disabled={publishing || !$currentUser}
          onchange={(e) => toggleOptIn(e.currentTarget.checked)}
        />
        <span>{labelOptIn}</span>
      </label>
      {#if $leaderboardOptIn}
        <input
          type="text"
          class="name-input"
          bind:value={displayName}
          maxlength="24"
          placeholder={labelNamePlaceholder}
          onblur={onNameBlur}
        />
      {/if}
      {#if !$currentUser}
        <p class="offline">{labelOffline}</p>
      {/if}
    </div>

    <ul class="entries">
      {#if loading}
        <li class="status">{labelLoading}</li>
      {:else if entries.length === 0}
        <li class="status">{labelEmpty}</li>
      {:else}
        {#each entries as e, i (e.uid)}
          <li class="row" class:me={$currentUser?.uid === e.uid}>
            <span class="rank">#{i + 1}</span>
            <span class="name">{e.displayName}</span>
            <span class="cell"><span class="cell-label">{labelPrestige}</span> {e.prestige}</span>
            <span class="cell"><span class="cell-label">{labelTier}</span> {e.highestTier}</span>
            <span class="cell coins">🪙 {e.totalCoinsCount.toLocaleString()}</span>
          </li>
        {/each}
      {/if}
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
    box-shadow: 0 -24px 60px rgba(0, 0, 0, 0.6);
    color: #fff;
    z-index: 15;
  }
  header {
    padding: 16px 18px 8px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  .optin {
    padding: 8px 16px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .optin label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
  }
  .optin input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #E8A4F2;
  }
  .name-input {
    margin-top: 10px;
    width: 100%;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 13px;
    box-sizing: border-box;
  }
  .name-input:focus {
    outline: none;
    border-color: #E8A4F2;
  }
  .offline {
    margin: 8px 0 0;
    font-size: 11px;
    color: #ff8a8a;
    font-style: italic;
  }
  .entries {
    list-style: none;
    margin: 0;
    padding: 12px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .status {
    text-align: center;
    padding: 32px;
    opacity: 0.5;
    font-style: italic;
  }
  .row {
    display: grid;
    grid-template-columns: 36px 1fr auto auto auto;
    gap: 8px;
    align-items: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 13px;
  }
  .row.me {
    background: rgba(232, 164, 242, 0.16);
    border-color: rgba(232, 164, 242, 0.4);
  }
  .rank {
    font-weight: 700;
    color: #ffd96b;
    font-variant-numeric: tabular-nums;
  }
  .name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .cell {
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    opacity: 0.85;
  }
  .cell-label {
    opacity: 0.55;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-right: 2px;
  }
  .cell.coins {
    color: #ffd96b;
    font-weight: 600;
  }
  @media (max-width: 400px) {
    .row {
      grid-template-columns: 28px 1fr auto;
    }
    .cell:not(.coins) {
      display: none;
    }
  }
</style>
