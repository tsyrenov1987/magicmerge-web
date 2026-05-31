/**
 * PixiJS application instance.
 *
 * Single Application managed at module level. Mounted by GameCanvas.svelte
 * once the canvas element is in the DOM. Detached when game tab loses focus
 * so we don't burn battery during meta loops.
 */

import { Application, type ApplicationOptions } from "pixi.js";

let app: Application | undefined;

export async function getPixiApp(target: HTMLDivElement): Promise<Application> {
  if (app) return app;

  const opts: Partial<ApplicationOptions> = {
    background: "#1A1424",
    backgroundAlpha: 1,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio, 2), // cap at 2x for bundle/perf
    resizeTo: target,
  };

  app = new Application();
  await app.init(opts);
  target.appendChild(app.canvas);

  console.log("[pixi] Application initialized", {
    renderer: app.renderer.type,
    width: app.renderer.width,
    height: app.renderer.height,
  });

  return app;
}

export function destroyPixiApp(): void {
  if (!app) return;
  app.destroy(true, { children: true, texture: true });
  app = undefined;
  console.log("[pixi] Application destroyed");
}
