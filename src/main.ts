import "./register-service-worker";
import { createPearlGlassScene } from "./scene/create-pearl-glass-scene";

function getLightColorFromQuery(): string | undefined {
  const params = new URLSearchParams(location.search);
  const lightColor = params.get("light");

  if (!lightColor) {
    return undefined;
  }

  const color = lightColor.trim();

  if (/^#|^rgb\(|^rgba\(|^hsl\(|^hsla\(/i.test(color)) {
    return color;
  }

  if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) {
    return `#${color}`;
  }

  return color;
}

const pearlGlass = createPearlGlassScene(document.body, {
  lightColor: getLightColorFromQuery(),
});

pearlGlass.start();

addEventListener("resize", pearlGlass.resize);
