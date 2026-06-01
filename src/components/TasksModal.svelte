<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { locale, tt } from "$lib/i18n";
  import { LILY_URL } from "$lib/assets/manifest";
  import { tasksStatus, claimAndApply, refreshTasks } from "$lib/store/tasks";
  import { tg } from "$lib/telegram";
  import type { TaskId, TaskStatusEntry } from "$lib/tasks";
  import type { ReferralReward } from "$lib/referral";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  // Channel link — keep this in env-style central spot so changing channel
  // username is one-line. Mirror of bot-server's CHANNEL_CHAT_ID.
  // For now hard-coded; switch to import.meta.env when channel launches.
  const CHANNEL_URL = (import.meta.env.VITE_CHANNEL_URL as string | undefined) ?? "https://t.me/MagicMergeChannel";
  const BOT_USERNAME = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? "MagicMerge1bot";

  const labelTitle = $derived(tt($locale, "Задания", "Tasks", "Misiones"));
  const labelTagline = $derived(
    tt(
      $locale,
      "Выполняй простые шаги — получай ресурсы для слияний",
      "Quick steps, real rewards for your board",
      "Pasos simples, recompensas reales"
    )
  );
  const labelClose = $derived(tt($locale, "Закрыть", "Close", "Cerrar"));
  const labelClaim = $derived(tt($locale, "Забрать", "Claim", "Reclamar"));
  const labelChecking = $derived(tt($locale, "Проверяем…", "Checking…", "Verificando…"));
  const labelDone = $derived(tt($locale, "Выполнено", "Done", "Hecho"));
  const labelNotYet = $derived(tt($locale, "Ещё не выполнено", "Not yet", "Aún no"));
  const labelUnavail = $derived(
    tt($locale, "Канал ещё не настроен", "Channel not set up yet", "Canal aún no configurado")
  );
  const labelOpenChannel = $derived(tt($locale, "Открыть канал", "Open channel", "Abrir canal"));
  const labelStartBot = $derived(tt($locale, "Открыть бота", "Open the bot", "Abrir el bot"));
  const labelInviteCta = $derived(tt($locale, "Пригласить друзей", "Invite friends", "Invitar amigos"));

  let claiming = $state<TaskId | null>(null);

  const taskMeta: Record<TaskId, { title: () => string; sub: () => string }> = {
    subscribe_channel: {
      title: () =>
        tt($locale, "Подпишись на наш канал", "Subscribe to our channel", "Suscríbete a nuestro canal"),
      sub: () =>
        tt(
          $locale,
          "Анонсы обновлений, промокоды, секреты Лили",
          "Update news, promo codes, Lily's secrets",
          "Anuncios, promocodes, secretos de Lily"
        ),
    },
    enable_notifications: {
      title: () =>
        tt(
          $locale,
          "Включи уведомления от бота",
          "Enable bot notifications",
          "Activa las notificaciones del bot"
        ),
      sub: () =>
        tt(
          $locale,
          "Чтобы знать, когда энергия восстановится",
          "So you know when your energy is back",
          "Para saber cuándo se recupera la energía"
        ),
    },
    invite_3_friends: {
      title: () =>
        tt($locale, "Пригласи 3 друзей", "Invite 3 friends", "Invita a 3 amigos"),
      sub: () =>
        tt(
          $locale,
          "Бонус сверху обычных наград за рефералов",
          "Milestone bonus on top of the regular MGM rewards",
          "Bonus extra además de las recompensas habituales"
        ),
    },
  };

  function rewardLabel(rewards: ReferralReward[]): string {
    return rewards
      .map((r) => {
        if (r.kind === "energy") return `+${r.amount} ⚡`;
        if (r.kind === "lucky_chest") return `+${r.amount} 🎁`;
        if (r.kind === "coins") return `+${r.amount} 🪙`;
        return `+${r.amount}`;
      })
      .join(" · ");
  }

  function ctaAction(task: TaskStatusEntry): { label: string; onClick: () => void } | null {
    if (task.id === "subscribe_channel" && task.state !== "claimed") {
      return {
        label: labelOpenChannel,
        onClick: () => {
          const t = tg();
          if (t) t.openTelegramLink(CHANNEL_URL);
          else window.open(CHANNEL_URL, "_blank");
        },
      };
    }
    if (task.id === "enable_notifications" && task.state !== "claimed") {
      return {
        label: labelStartBot,
        onClick: () => {
          const botLink = `https://t.me/${BOT_USERNAME}`;
          const t = tg();
          if (t) t.openTelegramLink(botLink);
          else window.open(botLink, "_blank");
        },
      };
    }
    return null;
  }

  async function onClaim(task: TaskStatusEntry) {
    if (task.state !== "ready" || claiming) return;
    claiming = task.id;
    try {
      await claimAndApply(task.id);
    } finally {
      claiming = null;
    }
  }

  // Re-check tasks on modal open — the user might have just subscribed,
  // hit a friend threshold, or started the bot.
  $effect(() => {
    if (open) void refreshTasks();
  });

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
    aria-labelledby="tasks-title"
  >
    <header>
      <img class="avatar" src={LILY_URL} alt="" decoding="async" draggable="false" />
      <div class="head-text">
        <h2 id="tasks-title">{labelTitle}</h2>
        <p class="tagline">{labelTagline}</p>
      </div>
    </header>

    {#if $tasksStatus.length === 0}
      <p class="empty">{labelChecking}</p>
    {:else}
      <ul class="tasks">
        {#each $tasksStatus as task (task.id)}
          {@const meta = taskMeta[task.id]}
          {@const cta = ctaAction(task)}
          <li class="task" class:done={task.state === "claimed"}>
            <div class="task-text">
              <div class="task-title">{meta.title()}</div>
              <div class="task-sub">{meta.sub()}</div>
              <div class="task-reward">{rewardLabel(task.reward)}</div>
            </div>
            <div class="task-actions">
              {#if task.state === "claimed"}
                <span class="state-chip done">✓ {labelDone}</span>
              {:else if task.state === "unverifiable"}
                <span class="state-chip pending">{labelUnavail}</span>
              {:else if task.state === "ready"}
                <button
                  type="button"
                  class="claim-btn"
                  disabled={claiming !== null}
                  onclick={() => onClaim(task)}
                >
                  {claiming === task.id ? "…" : labelClaim}
                </button>
              {:else if cta}
                <button type="button" class="cta-btn" onclick={cta.onClick}>
                  {cta.label}
                </button>
              {:else}
                <span class="state-chip pending">{labelNotYet}</span>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
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
    width: min(440px, calc(100% - 24px));
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
  .empty {
    text-align: center;
    margin: 28px 0;
    font-size: 13px;
    opacity: 0.6;
    font-style: italic;
  }
  .tasks {
    list-style: none;
    padding: 0;
    margin: 0 0 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .task {
    display: flex;
    gap: 10px;
    align-items: stretch;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    transition: opacity 0.2s ease;
  }
  .task.done {
    opacity: 0.55;
  }
  .task-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .task-title {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.2;
  }
  .task-sub {
    font-size: 11.5px;
    opacity: 0.65;
    line-height: 1.35;
  }
  .task-reward {
    font-size: 12.5px;
    color: #ffd96b;
    font-weight: 700;
    margin-top: 2px;
  }
  .task-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .claim-btn {
    background: linear-gradient(180deg, #ffd96b 0%, #c9941d 100%);
    color: #1a1424;
    border: none;
    padding: 8px 14px;
    border-radius: 10px;
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(255, 217, 107, 0.3);
  }
  .claim-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .cta-btn {
    background: linear-gradient(180deg, #E8A4F2 0%, #B062D6 100%);
    color: #fff;
    border: none;
    padding: 8px 14px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
  }
  .state-chip {
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11.5px;
    font-weight: 700;
    text-align: center;
    min-width: 80px;
  }
  .state-chip.done {
    background: rgba(108, 218, 124, 0.18);
    color: #6cda7c;
    border: 1px solid rgba(108, 218, 124, 0.35);
  }
  .state-chip.pending {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.1);
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
