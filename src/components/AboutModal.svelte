<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { locale, tt } from "$lib/i18n";
  import { LILY_URL } from "$lib/assets/manifest";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const labelTitle = $derived(tt($locale, "О игре", "About", "Acerca de"));
  const labelDev = $derived(tt($locale, "Разработчик", "Developer", "Desarrollador"));
  const labelVersion = $derived(tt($locale, "Версия", "Version", "Versión"));
  const labelTagline = $derived(
    tt(
      $locale,
      "Уютная игра-слияние с феей Лили — Telegram бета",
      "A cozy merge puzzle with Lily — Telegram beta",
      "Un puzzle de fusiones acogedor con Lily — beta de Telegram"
    )
  );
  const labelStory = $derived(
    tt(
      $locale,
      "Magic Merge — мой первый iOS-проект, перенесённый в Telegram. Если ты здесь — спасибо, что играешь и помогаешь сделать игру лучше.",
      "Magic Merge is my first iOS app, ported to Telegram. If you're here you're helping me make this better — thank you.",
      "Magic Merge es mi primer app de iOS, portada a Telegram. Si estás aquí, me ayudas a mejorarla — gracias."
    )
  );
  const labelLinks = $derived(tt($locale, "Ссылки", "Links", "Enlaces"));
  const labelIosVersion = $derived(
    tt($locale, "iOS-версия в App Store", "iOS version on the App Store", "Versión iOS en la App Store")
  );
  const labelClose = $derived(tt($locale, "Закрыть", "Close", "Cerrar"));

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
    aria-label={labelClose}
  ></div>
  <article
    class="panel"
    transition:fly={{ y: 30, duration: 280 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="about-title"
  >
    <header>
      <img class="avatar" src={LILY_URL} alt="" decoding="async" draggable="false" />
      <div class="head-text">
        <h2 id="about-title">Magic Merge</h2>
        <p class="tagline">{labelTagline}</p>
      </div>
    </header>

    <div class="row">
      <span class="row-label">{labelDev}</span>
      <span class="row-value">Nikolai Tsyrenov</span>
    </div>
    <div class="row">
      <span class="row-label">{labelVersion}</span>
      <span class="row-value">0.8 · beta</span>
    </div>

    <p class="story">{labelStory}</p>

    <h3>{labelLinks}</h3>
    <ul class="links">
      <li>
        <a href="https://apps.apple.com/us/app/magic-merge/id6772005772" target="_blank" rel="noopener noreferrer">
          🍎 {labelIosVersion}
        </a>
      </li>
      <li>
        <a href="https://telegra.ph/Privacy-Policy--Magic-Merge-05-22" target="_blank" rel="noopener noreferrer">
          🔒 Privacy Policy
        </a>
      </li>
    </ul>

    <button type="button" class="close-btn" onclick={close}>{labelClose}</button>
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
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
    color: #fff;
    z-index: 15;
  }
  header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 18px;
  }
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: rgba(232, 164, 242, 0.16);
    border: 1px solid rgba(232, 164, 242, 0.4);
    object-fit: cover;
  }
  .head-text {
    min-width: 0;
  }
  h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 700;
  }
  .tagline {
    margin: 0;
    font-size: 12px;
    opacity: 0.7;
    line-height: 1.4;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    margin-bottom: 6px;
    font-size: 13px;
  }
  .row-label {
    opacity: 0.6;
  }
  .row-value {
    font-weight: 600;
  }
  .story {
    margin: 16px 0;
    font-size: 13px;
    line-height: 1.55;
    opacity: 0.85;
    font-style: italic;
  }
  h3 {
    margin: 16px 0 8px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    opacity: 0.55;
  }
  .links {
    list-style: none;
    padding: 0;
    margin: 0 0 18px;
  }
  .links li {
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .links li:last-child {
    border-bottom: none;
  }
  .links a {
    color: #E8A4F2;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
  }
  .links a:hover {
    text-decoration: underline;
  }
  .close-btn {
    width: 100%;
    padding: 12px;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.14);
  }
</style>
