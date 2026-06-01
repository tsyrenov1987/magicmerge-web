<script lang="ts">
  import { activeMessage } from "$lib/lily/dialogue";
  import { fly, fade } from "svelte/transition";
</script>

{#if $activeMessage}
  {#key $activeMessage.id}
    <div
      class="bubble"
      class:sleepy={$activeMessage.category === "sleepy"}
      class:no-energy={$activeMessage.category === "no-energy"}
      in:fly={{ y: 10, duration: 220 }}
      out:fade={{ duration: 180 }}
      role="status"
      aria-live="polite"
    >
      <span class="text">{$activeMessage.text}</span>
    </div>
  {/key}
{/if}

<style>
  .bubble {
    position: absolute;
    top: 72px;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100% - 32px);
    padding: 10px 18px;
    background: linear-gradient(135deg, rgba(245, 217, 247, 0.96), rgba(232, 164, 242, 0.96));
    color: #1A1424;
    border-radius: 18px;
    box-shadow:
      0 8px 24px rgba(74, 35, 105, 0.28),
      0 0 0 1px rgba(255, 255, 255, 0.35) inset;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.1px;
    text-align: center;
    pointer-events: none;
    z-index: 5;
    backdrop-filter: blur(4px);
    /* Small tail at the bottom — gives it a speech-bubble feel without
       needing a separate tail element */
  }
  .bubble::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -7px;
    transform: translateX(-50%) rotate(45deg);
    width: 12px;
    height: 12px;
    background: rgba(232, 164, 242, 0.96);
    box-shadow: -1px 1px 0 rgba(255, 255, 255, 0.35) inset;
    border-radius: 0 0 3px 0;
  }
  .bubble.sleepy {
    background: linear-gradient(135deg, rgba(180, 170, 200, 0.92), rgba(140, 130, 180, 0.92));
    color: #2c2240;
    opacity: 0.85;
  }
  .bubble.sleepy::after {
    background: rgba(140, 130, 180, 0.92);
  }
  .bubble.no-energy {
    background: linear-gradient(135deg, rgba(255, 220, 170, 0.96), rgba(240, 180, 90, 0.96));
    color: #2c1a08;
  }
  .bubble.no-energy::after {
    background: rgba(240, 180, 90, 0.96);
  }
  .text {
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
