<script lang="ts">
  import GameCanvas from "$components/GameCanvas.svelte";
  import ComingSoon from "$components/ComingSoon.svelte";
  import GardenView from "$components/GardenView.svelte";
  import SpinView from "$components/SpinView.svelte";
  import StoryPanel from "$components/StoryPanel.svelte";
  import { initFirebase } from "$lib/firebase";
  import { tgUser, isInTelegram } from "$lib/telegram";
  import { uiView } from "$lib/store/ui";

  initFirebase();

  const user = tgUser();
  const inTg = isInTelegram();
</script>

{#if $uiView === "game"}
  <GameCanvas />
{:else if $uiView === "garden"}
  <GardenView />
{:else if $uiView === "spin"}
  <SpinView />
{:else}
  <main>
    <ComingSoon {user} {inTg} />
  </main>
{/if}

<!-- Story episodes float above any view; safe to mount at root. -->
<StoryPanel />

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
