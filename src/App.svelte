<script lang="ts">
  import GameCanvas from "$components/GameCanvas.svelte";
  import ComingSoon from "$components/ComingSoon.svelte";
  import { initFirebase } from "$lib/firebase";
  import { tgUser, isInTelegram } from "$lib/telegram";

  initFirebase();

  const user = tgUser();
  const inTg = isInTelegram();

  // Phase 1.B: toggle between Coming Soon landing and the dev game canvas.
  // URL param `?game=1` or hash `#game` shows the canvas. Default = landing
  // so the Mini App still has a stable public face while we build.
  const showGame = (() => {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    if (url.searchParams.get("game") === "1") return true;
    if (window.location.hash === "#game") return true;
    return false;
  })();
</script>

{#if showGame}
  <GameCanvas />
{:else}
  <main>
    <ComingSoon {user} {inTg} />
  </main>
{/if}

<style>
  main {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: linear-gradient(180deg, #1A1424 0%, #2B1B3D 100%);
    color: #fff;
  }
</style>
