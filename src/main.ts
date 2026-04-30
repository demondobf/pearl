import { createPearlGlassScene } from "./scene/createPearlGlassScene";

const pearlGlass = createPearlGlassScene(document.body);

pearlGlass.start();

addEventListener("resize", pearlGlass.resize);
