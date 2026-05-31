<script lang="ts">
  import ComingSoon from "$components/ComingSoon.svelte";
  import { initFirebase } from "$lib/firebase";
  import { tgUser, isInTelegram } from "$lib/telegram";

  // Initialize Firebase (no-op if env vars missing)
  initFirebase();

  const user = tgUser();
  const inTg = isInTelegram();
</script>

<main>
  <ComingSoon {user} {inTg} />
</main>

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
