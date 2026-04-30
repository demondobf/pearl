import { createPearlGlassScene } from "./scene/createPearlGlassScene.js";

const pearlGlass = createPearlGlassScene(document.body);

pearlGlass.start();

addEventListener("resize", pearlGlass.resize);
