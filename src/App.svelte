<script lang="ts">
  import GameCanvas from "$components/GameCanvas.svelte";
  import ComingSoon from "$components/ComingSoon.svelte";
  import { initFirebase } from "$lib/firebase";
  import { tgUser, isInTelegram } from "$lib/telegram";
  import { uiView } from "$lib/store/ui";

  initFirebase();

  const user = tgUser();
  const inTg = isInTelegram();
</script>

{#if $uiView === "game"}
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
