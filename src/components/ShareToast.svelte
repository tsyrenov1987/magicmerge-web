<script lang="ts">
  import { fly } from "svelte/transition";
  import { locale, tt } from "$lib/i18n";
  import { shareInvite, tgUser } from "$lib/telegram";
  import { LINES, type LineId } from "$lib/game/lines";

  let {
    open = $bindable(false),
    tier = 0,
    line = undefined,
  }: { open?: boolean; tier?: number; line?: LineId } = $props();

  const AUTO_DISMISS_MS = 6500;
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (open) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        open = false;
      }, AUTO_DISMISS_MS);
    }
    return () => clearTimeout(timer);
  });

  const lineNameLocalized = $derived.by(() => {
    if (!line) return tt($locale, "предмет", "item", "objeto");
    const [ru, en, es] = LINES[line].displayName;
    return tt($locale, ru, en, es);
  });

  const headline = $derived(
    tt(
      $locale,
      `🎉 Слил ${lineNameLocalized} ${tier}-го уровня!`,
      `🎉 Merged a Tier ${tier} ${lineNameLocalized}!`,
      `🎉 ¡Fusioné un ${lineNameLocalized} de nivel ${tier}!`
    )
  );

  const subline = $derived(
    tt(
      $locale,
      "Покажи друзьям — пусть попробуют побить твой рекорд",
      "Show your friends — let them try to beat your record",
      "Muéstrales a tus amigos — que intenten superar tu récord"
    )
  );

  const labelShare = $derived(tt($locale, "Поделиться", "Share", "Compartir"));
  const labelDismiss = $derived(tt($locale, "Не сейчас", "Dismiss", "Ahora no"));

  async function onShare() {
    const u = tgUser();
    const shareText = tt(
      $locale,
      `🧚 Я слил ${lineNameLocalized} ${tier}-го уровня в Magic Merge! Залетай — посмотрим, кто круче 👇`,
      `🧚 I just merged a Tier ${tier} ${lineNameLocalized} in Magic Merge! Hop in — let's see who's better 👇`,
      `🧚 ¡Fusioné un ${lineNameLocalized} de nivel ${tier} en Magic Merge! Ven — a ver quién es mejor 👇`
    );
    await shareInvite(shareText, u ? `ref_${u.id}` : undefined);
    open = false;
  }

  function onDismiss() {
    open = false;
  }
</script>

{#if open}
  <div
    class="toast"
    transition:fly={{ y: -40, duration: 240 }}
    role="status"
    aria-live="polite"
  >
    <div class="text">
      <div class="head">{headline}</div>
      <div class="sub">{subline}</div>
    </div>
    <div class="actions">
      <button type="button" class="share" onclick={onShare}>{labelShare}</button>
      <button type="button" class="dismiss" onclick={onDismiss} aria-label={labelDismiss}>
        ✕
      </button>
    </div>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 12px);
    left: 12px;
    right: 12px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: linear-gradient(180deg, #2B1B3D 0%, #1A1424 100%);
    border: 1px solid rgba(232, 164, 242, 0.4);
    border-radius: 14px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    color: #fff;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .head {
    font-size: 14px;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 4px;
    color: #ffd96b;
  }
  .sub {
    font-size: 12px;
    opacity: 0.78;
    line-height: 1.35;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .share {
    background: linear-gradient(180deg, #E8A4F2 0%, #B062D6 100%);
    color: #fff;
    border: none;
    padding: 8px 14px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(232, 164, 242, 0.4);
  }
  .dismiss {
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    border: none;
    padding: 6px 8px;
    font-size: 14px;
    cursor: pointer;
  }
  .dismiss:hover {
    color: #fff;
  }
</style>
