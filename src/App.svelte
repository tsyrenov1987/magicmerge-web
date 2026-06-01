<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import GameCanvas from "$components/GameCanvas.svelte";
  import ComingSoon from "$components/ComingSoon.svelte";
  import GardenView from "$components/GardenView.svelte";
  import SpinView from "$components/SpinView.svelte";
  import StoryPanel from "$components/StoryPanel.svelte";
  import { initFirebase } from "$lib/firebase";
  import { tgUser, isInTelegram, bindBackButton } from "$lib/telegram";
  import { uiView, setView } from "$lib/store/ui";

  initFirebase();

  const user = tgUser();
  const inTg = isInTelegram();

  // TG native BackButton: when not on landing, show it; tapping returns
  // to landing. Outside TG this is a no-op (the in-app back chip handles it).
  let unbindBack: (() => void) | null = null;

  $effect(() => {
    unbindBack?.();
    unbindBack = null;
    if ($uiView !== "landing") {
      unbindBack = bindBackButton(() => setView("landing"));
    }
  });

  onDestroy(() => {
    unbindBack?.();
  });
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
