<script lang="ts">
  import { locale, tt, setLocale, type Locale } from "$lib/i18n";
  import { setView } from "$lib/store/ui";
  import { BG_NIGHT } from "$lib/assets/manifest";
  import AboutModal from "$components/AboutModal.svelte";
  import ReferralModal from "$components/ReferralModal.svelte";
  import TasksModal from "$components/TasksModal.svelte";
  import { referralStatus } from "$lib/store/referral";
  import { tasksStatus } from "$lib/store/tasks";

  let { user, inTg }: { user: { first_name: string; username?: string } | undefined; inTg: boolean } = $props();
  let aboutOpen = $state(false);
  let referralOpen = $state(false);
  let tasksOpen = $state(false);

  const readyTasksCount = $derived(
    $tasksStatus.filter((t) => t.state === "ready").length
  );

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
      "Играть",
      "Play",
      "Jugar"
    )
  );
  const labelBeta = $derived(
    tt(
      $locale,
      "Открытая бета",
      "Open beta",
      "Beta abierta"
    )
  );
  const labelAbout = $derived(tt($locale, "О игре", "About", "Acerca de"));
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

  const labelInvite = $derived(
    tt(
      $locale,
      "Пригласить друзей",
      "Invite friends",
      "Invitar amigos"
    )
  );
  const labelTasks = $derived(tt($locale, "Задания", "Tasks", "Misiones"));
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

  {#if inTg}
    <div class="cta-row">
      <button type="button" class="share-btn" onclick={() => (referralOpen = true)}>
        🎁 {labelInvite}
        {#if $referralStatus.pendingRewards.length > 0}
          <span class="badge">{$referralStatus.pendingRewards.length}</span>
        {/if}
      </button>
      <button type="button" class="share-btn tasks-btn" onclick={() => (tasksOpen = true)}>
        📋 {labelTasks}
        {#if readyTasksCount > 0}
          <span class="badge">{readyTasksCount}</span>
        {/if}
      </button>
    </div>
  {/if}

  {#if !inTg}
    <p class="dev-note">Running outside Telegram (dev mode)</p>
  {/if}

  <button type="button" class="about-btn" onclick={() => (aboutOpen = true)}>
    ℹ {labelAbout}
  </button>

  <div class="beta-chip" aria-label={labelBeta}>{labelBeta}</div>
</div>

<AboutModal bind:open={aboutOpen} />
<ReferralModal bind:open={referralOpen} />
<TasksModal bind:open={tasksOpen} />

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
  .share-btn {
    position: relative;
    margin-top: 16px;
    background: linear-gradient(180deg, rgba(232, 164, 242, 0.18) 0%, rgba(176, 98, 214, 0.18) 100%);
    color: #fff;
    border: 1px solid rgba(232, 164, 242, 0.4);
    padding: 12px 26px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.3px;
    transition: background 0.15s ease;
  }
  .share-btn:hover {
    background: linear-gradient(180deg, rgba(232, 164, 242, 0.28) 0%, rgba(176, 98, 214, 0.28) 100%);
  }
  .cta-row {
    display: flex;
    gap: 10px;
    margin-top: 16px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .cta-row .share-btn {
    margin-top: 0;
    flex: 1 1 0;
    min-width: 140px;
  }
  .tasks-btn {
    background: linear-gradient(180deg, rgba(108, 218, 124, 0.18) 0%, rgba(63, 142, 78, 0.22) 100%);
    border-color: rgba(108, 218, 124, 0.4);
  }
  .tasks-btn:hover {
    background: linear-gradient(180deg, rgba(108, 218, 124, 0.28) 0%, rgba(63, 142, 78, 0.32) 100%);
  }
  .share-btn .badge {
    position: absolute;
    top: -6px;
    right: -6px;
    background: #ffd96b;
    color: #1a1424;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    min-width: 20px;
    height: 20px;
    line-height: 20px;
    padding: 0 6px;
    box-shadow: 0 2px 8px rgba(255, 217, 107, 0.5);
  }
  .about-btn {
    margin-top: 16px;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.3px;
  }
  .about-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.9);
  }
  .beta-chip {
    display: inline-block;
    margin-top: 16px;
    padding: 4px 12px;
    background: rgba(176, 104, 223, 0.18);
    border: 1px solid rgba(176, 104, 223, 0.4);
    color: #d8a8f5;
    border-radius: 16px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }
  .dev-note {
    margin-top: 24px;
    font-size: 11px;
    opacity: 0.4;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
</style>
