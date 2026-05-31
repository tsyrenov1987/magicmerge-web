<script lang="ts">
  import { locale, tt, setLocale, type Locale } from "$lib/i18n";

  let { user, inTg }: { user: { first_name: string; username?: string } | undefined; inTg: boolean } = $props();

  // Reactive: derives re-evaluate when $locale changes
  const greeting = $derived(
    user
      ? tt($locale, `Привет, ${user.first_name}!`, `Hi, ${user.first_name}!`, `¡Hola, ${user.first_name}!`)
      : tt($locale, "Привет!", "Hi there!", "¡Hola!")
  );

  const tagline = $derived(
    tt(
      $locale,
      "Уютная игра-слияние с Лили",
      "A cozy merge puzzle with Lily",
      "Un puzzle de fusiones acogedor con Lily"
    )
  );

  const status = $derived(
    tt($locale, "Скоро запуск.", "Coming soon.", "Próximamente.")
  );

  const tryNow = $derived(
    tt(
      $locale,
      "Уже доступно в App Store для iPhone и iPad",
      "Already on the App Store for iPhone and iPad",
      "Ya disponible en la App Store para iPhone y iPad"
    )
  );

  function pick(next: Locale) {
    setLocale(next);
  }
</script>

<div class="card">
  <div class="fairy" aria-hidden="true">🧚‍♀️</div>

  <h1>{greeting}</h1>
  <p class="tagline">{tagline}</p>
  <p class="status">{status}</p>

  <p class="ios-link">
    {tryNow}
    <br />
    <a
      href="https://apps.apple.com/us/app/magic-merge/id6772005772"
      target="_blank"
      rel="noopener noreferrer"
    >
      apps.apple.com/magic-merge
    </a>
  </p>

  <div class="lang-picker" role="group" aria-label="Language">
    {#each ["ru", "en", "es"] as const as code}
      <button
        type="button"
        class:active={$locale === code}
        onclick={() => pick(code)}
      >
        {code.toUpperCase()}
      </button>
    {/each}
  </div>

  {#if !inTg}
    <p class="dev-note">Running outside Telegram (dev mode)</p>
  {/if}
</div>

<style>
  .card {
    max-width: 440px;
    width: 100%;
    text-align: center;
    padding: 32px 24px;
  }
  .fairy {
    font-size: 80px;
    margin-bottom: 16px;
    filter: drop-shadow(0 8px 24px rgba(232, 164, 242, 0.4));
  }
  h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 12px;
    letter-spacing: -0.4px;
  }
  .tagline {
    font-size: 17px;
    opacity: 0.85;
    margin: 0 0 24px;
  }
  .status {
    font-size: 15px;
    opacity: 0.6;
    margin: 0 0 32px;
    font-style: italic;
  }
  .ios-link {
    font-size: 14px;
    opacity: 0.75;
    margin: 0 0 32px;
    line-height: 1.6;
  }
  .ios-link a {
    color: #E8A4F2;
    text-decoration: none;
    border-bottom: 1px dashed rgba(232, 164, 242, 0.4);
  }
  .lang-picker {
    display: inline-flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.06);
    padding: 4px;
    border-radius: 12px;
  }
  .lang-picker button {
    background: transparent;
    border: none;
    color: inherit;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
    transition: background 0.15s ease;
  }
  .lang-picker button:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .lang-picker button.active {
    background: rgba(232, 164, 242, 0.2);
    color: #E8A4F2;
  }
  .dev-note {
    margin-top: 24px;
    font-size: 11px;
    opacity: 0.4;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
</style>
