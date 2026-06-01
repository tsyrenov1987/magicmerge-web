<script lang="ts">
  import { activeEpisode, dismissEpisode, STORY, characterEmoji, localizeTitle, localizeBody, localizeName } from "$lib/lily/story";
  import { locale, tt } from "$lib/i18n";
  import { fly, fade } from "svelte/transition";

  const continueLabel = $derived(tt($locale, "Дальше", "Continue", "Continuar"));

  const line = $derived($activeEpisode ? STORY[$activeEpisode] : null);
  const characterAccent = $derived.by(() => {
    if (!line) return "#E8A4F2";
    switch (line.character) {
      case "lily": return "#E8A4F2";
      case "root": return "#B98E68";
      case "sage": return "#8B7FD9";
    }
  });

  function close() {
    dismissEpisode();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!$activeEpisode) return;
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      close();
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if line}
  <div
    class="backdrop"
    transition:fade={{ duration: 180 }}
    onclick={close}
    onkeydown={onKeydown}
    role="button"
    tabindex="-1"
    aria-label="Close episode"
  ></div>
  <article
    class="panel"
    transition:fly={{ y: 30, duration: 280 }}
    style="--accent: {characterAccent};"
    role="dialog"
    aria-modal="true"
    aria-labelledby="story-title"
  >
    <header>
      <div class="avatar" aria-hidden="true">{characterEmoji(line.character)}</div>
      <div class="who">
        <div class="name">{localizeName(line.character, $locale)}</div>
      </div>
    </header>
    <h2 id="story-title">{localizeTitle(line, $locale)}</h2>
    <p class="body">{localizeBody(line, $locale)}</p>
    <button type="button" class="continue" onclick={close}>
      {continueLabel}
    </button>
  </article>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 4, 20, 0.66);
    backdrop-filter: blur(3px);
    z-index: 10;
    cursor: pointer;
  }
  .panel {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(440px, calc(100% - 32px));
    max-height: min(80vh, 80dvh);
    overflow-y: auto;
    padding: 24px 24px 20px;
    background: linear-gradient(180deg, #2B1B3D 0%, #1A1424 100%);
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.6),
      0 0 0 1px var(--accent) inset;
    color: #fff;
    z-index: 11;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .avatar {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    border-radius: 12px;
    font-size: 26px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  .who {
    flex: 1;
  }
  .name {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--accent);
    opacity: 0.9;
  }
  h2 {
    margin: 0 0 12px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }
  .body {
    margin: 0 0 24px;
    font-size: 15px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.86);
  }
  .continue {
    width: 100%;
    background: var(--accent);
    color: #1A1424;
    border: none;
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.3px;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s ease;
  }
  .continue:hover {
    transform: translateY(-1px);
  }
  .continue:active {
    transform: translateY(0);
  }
</style>
