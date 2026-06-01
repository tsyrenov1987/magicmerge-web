<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { locale, tt } from "$lib/i18n";
  import { LILY_URL } from "$lib/assets/manifest";
  import { referralStatus, claimAll, refreshStatus } from "$lib/store/referral";
  import { myInviteLink } from "$lib/referral";
  import { shareInvite, tgUser } from "$lib/telegram";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const labelTitle = $derived(tt($locale, "Пригласи друзей", "Invite friends", "Invita amigos"));
  const labelTagline = $derived(
    tt(
      $locale,
      "За каждого друга — +30 энергии и Lucky Chest. Жёстко дефицитные ресурсы.",
      "Each friend gets you +30 energy and a Lucky Chest. Hard-scarce stuff.",
      "Cada amigo te da +30 energía y un Lucky Chest. Recursos escasos."
    )
  );
  const labelTotal = $derived(tt($locale, "Друзей приведено", "Friends invited", "Amigos invitados"));
  const labelToday = $derived(tt($locale, "Сегодня", "Today", "Hoy"));
  const labelDailyCap = $derived(
    tt($locale, "из {cap} вознаграждённых в сутки", "of {cap} rewarded per day", "de {cap} recompensados por día")
  );
  const labelPending = $derived(tt($locale, "Ждёт получения", "Ready to claim", "Esperando reclamar"));
  const labelClaim = $derived(tt($locale, "Забрать всё", "Claim all", "Reclamar todo"));
  const labelNothing = $derived(
    tt($locale, "Пока пусто. Поделись ссылкой ниже!", "Nothing yet. Share the link below!", "Aún nada. ¡Comparte el enlace!")
  );
  const labelShareCta = $derived(
    tt($locale, "🧚 Поделиться приглашением", "🧚 Share invite", "🧚 Compartir invitación")
  );
  const labelCopy = $derived(tt($locale, "Скопировать ссылку", "Copy link", "Copiar enlace"));
  const labelCopied = $derived(tt($locale, "Скопировано!", "Copied!", "¡Copiado!"));
  const labelClose = $derived(tt($locale, "Закрыть", "Close", "Cerrar"));
  const labelNoTg = $derived(
    tt(
      $locale,
      "Откройте игру в Telegram, чтобы получить вашу ссылку.",
      "Open the game inside Telegram to get your invite link.",
      "Abre el juego en Telegram para conseguir tu enlace."
    )
  );
  const labelEnergy = $derived(tt($locale, "энергии", "energy", "energía"));
  const labelLuckyChest = $derived(tt($locale, "Lucky Chest", "Lucky Chest", "Lucky Chest"));

  const inviteLink = $derived(myInviteLink());
  const hasUser = $derived(Boolean(tgUser()));
  let copyConfirm = $state(false);
  let claiming = $state(false);

  const shareText = $derived(
    tt(
      $locale,
      "🧚 Залетай ко мне в Magic Merge — уютная игра-слияние с феей Лили!",
      "🧚 Come play Magic Merge with me — a cozy merge puzzle with Lily the fairy!",
      "🧚 Ven a jugar Magic Merge conmigo — un puzzle de fusiones con Lily."
    )
  );

  async function onShare() {
    const u = tgUser();
    await shareInvite(shareText, u ? `ref_${u.id}` : undefined);
  }

  async function onCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      copyConfirm = true;
      setTimeout(() => (copyConfirm = false), 1400);
    } catch (e) {
      console.warn("[referral] copy failed", e);
    }
  }

  async function onClaim() {
    if (claiming) return;
    claiming = true;
    try {
      await claimAll();
    } finally {
      claiming = false;
    }
  }

  function rewardLabel(r: { kind: string; amount: number }): string {
    if (r.kind === "energy") return `+${r.amount} ⚡ ${labelEnergy}`;
    if (r.kind === "lucky_chest") return `+${r.amount} 🎁 ${labelLuckyChest}`;
    return `+${r.amount}`;
  }

  // Re-poll status when the modal opens — picks up rewards earned while
  // the player was away.
  $effect(() => {
    if (open) void refreshStatus();
  });

  function close() {
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") close();
  }

  function fmtCap(text: string, cap: number): string {
    return text.replace("{cap}", String(cap));
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
    aria-labelledby="referral-title"
  >
    <header>
      <img class="avatar" src={LILY_URL} alt="" decoding="async" draggable="false" />
      <div class="head-text">
        <h2 id="referral-title">{labelTitle}</h2>
        <p class="tagline">{labelTagline}</p>
      </div>
    </header>

    <div class="stats">
      <div class="stat-block">
        <span class="stat-num">{$referralStatus.totalReferrals}</span>
        <span class="stat-label">{labelTotal}</span>
      </div>
      <div class="stat-block">
        <span class="stat-num">{$referralStatus.todayRewarded}</span>
        <span class="stat-label">
          {labelToday} · {fmtCap(labelDailyCap, $referralStatus.dailyCap)}
        </span>
      </div>
    </div>

    <h3>{labelPending}</h3>
    {#if $referralStatus.pendingRewards.length === 0}
      <p class="empty">{labelNothing}</p>
    {:else}
      <ul class="rewards">
        {#each $referralStatus.pendingRewards as r}
          <li>{rewardLabel(r)}</li>
        {/each}
      </ul>
      <button
        type="button"
        class="claim-btn"
        onclick={onClaim}
        disabled={claiming}
      >
        {claiming ? "…" : labelClaim}
      </button>
    {/if}

    {#if hasUser && inviteLink}
      <button type="button" class="share-btn" onclick={onShare}>
        {labelShareCta}
      </button>
      <button type="button" class="copy-btn" onclick={onCopy}>
        {copyConfirm ? labelCopied : labelCopy}
      </button>
      <p class="link-preview">{inviteLink}</p>
    {:else}
      <p class="no-tg">{labelNoTg}</p>
    {/if}

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
    opacity: 0.78;
    line-height: 1.4;
  }
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 14px;
  }
  .stat-block {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-num {
    font-size: 22px;
    font-weight: 800;
    color: #E8A4F2;
  }
  .stat-label {
    font-size: 11px;
    opacity: 0.6;
    line-height: 1.2;
  }
  h3 {
    margin: 12px 0 8px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    opacity: 0.55;
  }
  .empty {
    margin: 4px 0 18px;
    font-size: 13px;
    opacity: 0.7;
    font-style: italic;
  }
  .rewards {
    list-style: none;
    padding: 0;
    margin: 0 0 14px;
    background: rgba(255, 217, 107, 0.08);
    border: 1px solid rgba(255, 217, 107, 0.25);
    border-radius: 12px;
    overflow: hidden;
  }
  .rewards li {
    padding: 10px 14px;
    font-size: 14px;
    font-weight: 600;
    color: #ffd96b;
    border-bottom: 1px solid rgba(255, 217, 107, 0.12);
  }
  .rewards li:last-child {
    border-bottom: none;
  }
  .claim-btn {
    width: 100%;
    margin-bottom: 14px;
    padding: 12px;
    background: linear-gradient(180deg, #ffd96b 0%, #c9941d 100%);
    color: #1a1424;
    border: none;
    border-radius: 12px;
    font-weight: 800;
    font-size: 15px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(255, 217, 107, 0.35);
  }
  .claim-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .share-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(180deg, #E8A4F2 0%, #B062D6 100%);
    color: #fff;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    margin-bottom: 8px;
  }
  .copy-btn {
    width: 100%;
    padding: 10px;
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    margin-bottom: 6px;
  }
  .link-preview {
    margin: 4px 0 14px;
    font-size: 11px;
    opacity: 0.5;
    word-break: break-all;
    font-family: ui-monospace, monospace;
  }
  .no-tg {
    margin: 8px 0 14px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    font-size: 12px;
    opacity: 0.7;
  }
  .close-btn {
    width: 100%;
    padding: 10px;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
</style>
