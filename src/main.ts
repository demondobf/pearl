import { hideCursorAfterInactivity } from "./interaction/hide-cursor-after-inactivity";
import { getLightColorFromQuery } from "./lighting/get-light-color-from-query";
import { registerServiceWorker } from "./pwa/register-service-worker";
import { createPearlGlassScene } from "./scene/create-pearl-glass-scene";

registerServiceWorker();

const pearlGlass = createPearlGlassScene(document.body, {
  lightColor: getLightColorFromQuery(),
});

pearlGlass.start();
hideCursorAfterInactivity();

addEventListener("resize", pearlGlass.resize);
