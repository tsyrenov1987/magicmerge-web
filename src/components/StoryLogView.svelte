<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import {
    STORY,
    seenEpisodes,
    replayEpisode,
    characterEmoji,
    localizeTitle,
    type StoryCharacter,
    type StoryEvent,
  } from "$lib/lily/story";
  import { LILY_URL, SAFFI_URL, ROOT_URL } from "$lib/assets/manifest";
  import { locale, tt } from "$lib/i18n";
  import { haptic } from "$lib/telegram";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  type Filter = "all" | StoryCharacter;
  let filter: Filter = $state("all");

  const labelTitle = $derived(tt($locale, "Дневник", "Story Log", "Diario"));
  const labelAll = $derived(tt($locale, "Все", "All", "Todos"));
  const labelUnseen = $derived(tt($locale, "Не открыто", "Not yet", "Aún no"));

  const ALL_EVENTS: StoryEvent[] = Object.keys(STORY) as StoryEvent[];

  function characterImageUrl(c: StoryCharacter): string {
    switch (c) {
      case "lily": return LILY_URL;
      case "root": return ROOT_URL;
      case "sage": return SAFFI_URL;
    }
  }

  function characterAccent(c: StoryCharacter): string {
    switch (c) {
      case "lily": return "#E8A4F2";
      case "root": return "#B98E68";
      case "sage": return "#8B7FD9";
    }
  }

  const totals = $derived(() => {
    const t = { lily: 0, root: 0, sage: 0 };
    const s = { lily: 0, root: 0, sage: 0 };
    for (const evt of ALL_EVENTS) {
      const line = STORY[evt];
      t[line.character]++;
      if ($seenEpisodes.has(evt)) s[line.character]++;
    }
    return { t, s };
  });

  const visible = $derived(
    ALL_EVENTS.filter((evt) =>
      filter === "all" ? true : STORY[evt].character === filter
    )
  );

  function openEpisode(evt: StoryEvent) {
    if (!$seenEpisodes.has(evt)) return;
    haptic("light");
    replayEpisode(evt);
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
    aria-labelledby="storylog-title"
  >
    <header>
      <h2 id="storylog-title">📖 {labelTitle}</h2>
      <div class="totals">
        <span class="total-chip">{$seenEpisodes.size}/{ALL_EVENTS.length}</span>
      </div>
    </header>

    <nav class="filters" role="tablist">
      <button
        type="button"
        class="filter"
        class:active={filter === "all"}
        role="tab"
        aria-selected={filter === "all"}
        onclick={() => (filter = "all")}
      >
        {labelAll}
      </button>
      {#each ["lily", "root", "sage"] as const as character (character)}
        {@const seenCount = totals().s[character]}
        {@const totalCount = totals().t[character]}
        <button
          type="button"
          class="filter"
          class:active={filter === character}
          role="tab"
          aria-selected={filter === character}
          onclick={() => (filter = character)}
          style="--accent: {characterAccent(character)};"
        >
          <span>{characterEmoji(character)}</span>
          <span class="filter-count">{seenCount}/{totalCount}</span>
        </button>
      {/each}
    </nav>

    <ul class="entries">
      {#each visible as evt (evt)}
        {@const line = STORY[evt]}
        {@const seen = $seenEpisodes.has(evt)}
        {@const accent = characterAccent(line.character)}
        <li>
          <button
            type="button"
            class="entry"
            class:seen
            class:locked={!seen}
            disabled={!seen}
            style="--accent: {accent};"
            onclick={() => openEpisode(evt)}
          >
            <div class="entry-avatar">
              {#if seen}
                <img src={characterImageUrl(line.character)} alt="" draggable="false" decoding="async" />
              {:else}
                <span class="lock-emoji" aria-hidden="true">?</span>
              {/if}
            </div>
            <div class="entry-text">
              <div class="entry-title">
                {#if seen}
                  {localizeTitle(line, $locale)}
                {:else}
                  <span class="dim">{labelUnseen}</span>
                {/if}
              </div>
              <div class="entry-meta">
                {#if seen}
                  {characterEmoji(line.character)} {line.mood}
                {/if}
              </div>
            </div>
          </button>
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
  .total-chip {
    background: rgba(255, 217, 90, 0.14);
    border: 1px solid rgba(255, 217, 90, 0.32);
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    color: #ffd96b;
    font-variant-numeric: tabular-nums;
  }
  .filters {
    display: flex;
    gap: 4px;
    padding: 4px 12px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .filter {
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .filter:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  .filter.active {
    background: color-mix(in srgb, var(--accent, #E8A4F2) 18%, transparent);
    color: var(--accent, #E8A4F2);
  }
  .filter-count {
    font-size: 11px;
    opacity: 0.85;
    font-variant-numeric: tabular-nums;
  }
  .entries {
    list-style: none;
    margin: 0;
    padding: 12px 12px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .entry {
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
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.12s ease;
  }
  .entry.seen:hover {
    background: rgba(255, 255, 255, 0.07);
  }
  .entry.locked {
    cursor: not-allowed;
    opacity: 0.5;
    border-left-color: rgba(255, 255, 255, 0.18);
  }
  .entry-avatar {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--accent) 18%, #1A1424 82%);
    border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .entry-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .lock-emoji {
    font-size: 20px;
    font-weight: 700;
    opacity: 0.6;
  }
  .entry-text {
    flex: 1;
    min-width: 0;
  }
  .entry-title {
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .entry-meta {
    font-size: 11px;
    opacity: 0.55;
    margin-top: 2px;
    text-transform: lowercase;
    letter-spacing: 0.3px;
  }
  .dim {
    opacity: 0.65;
    font-style: italic;
  }
</style>
