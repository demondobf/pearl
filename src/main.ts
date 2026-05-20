import { hideCursorAfterInactivity } from "./interaction/hide-cursor-after-inactivity";
import { getLightColorFromQuery } from "./lighting/get-light-color-from-query";
import { registerServiceWorker } from "./pwa/register-service-worker";
import { createPearlGlassScene } from "./scene/create-pearl-glass-scene";

const lightColor = getLightColorFromQuery();
const pearlGlass = createPearlGlassScene(document.body, { lightColor });

pearlGlass.start();
hideCursorAfterInactivity();
registerServiceWorker();

addEventListener("resize", pearlGlass.resize);
