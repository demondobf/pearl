import { createPearlGlassScene } from "./scene/create-pearl-glass-scene";

const pearlGlass = createPearlGlassScene(document.body);

pearlGlass.start();

addEventListener("resize", pearlGlass.resize);
