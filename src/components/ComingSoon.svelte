<script lang="ts">
  import { locale, tt, setLocale, type Locale } from "$lib/i18n";
  import { setView } from "$lib/store/ui";

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

  const previewCta = $derived(
    tt(
      $locale,
      "Попробовать прототип",
      "Try the prototype",
      "Probar el prototipo"
    )
  );
  const previewNote = $derived(
    tt(
      $locale,
      "ранняя сборка · только доска и слияния",
      "early build · board + merges only",
      "versión temprana · solo tablero y fusiones"
    )
  );

  function pick(next: Locale) {
    setLocale(next);
  }

  function openPreview() {
    setView("game");
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

  <div class="preview">
    <button type="button" class="preview-cta" onclick={openPreview}>
      {previewCta}
    </button>
    <p class="preview-note">{previewNote}</p>
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
  .preview {
    margin-top: 32px;
  }
  .preview-cta {
    background: linear-gradient(135deg, #E8A4F2 0%, #B47AD9 100%);
    color: #1A1424;
    border: none;
    padding: 14px 28px;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.3px;
    box-shadow: 0 8px 24px rgba(180, 122, 217, 0.32);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .preview-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 28px rgba(180, 122, 217, 0.4);
  }
  .preview-cta:active {
    transform: translateY(0);
  }
  .preview-note {
    margin: 10px 0 0;
    font-size: 12px;
    opacity: 0.5;
    font-style: italic;
  }
  .dev-note {
    margin-top: 24px;
    font-size: 11px;
    opacity: 0.4;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
</style>
