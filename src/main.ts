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

function hideCursorAfterInactivity(timeoutMs = 5000): void {
  let timeout: number | undefined;

  const showCursor = (): void => {
    document.documentElement.classList.remove("cursor-hidden");

    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    timeout = window.setTimeout(() => {
      document.documentElement.classList.add("cursor-hidden");
    }, timeoutMs);
  };

  for (const eventName of ["mousemove", "mousedown", "keydown", "touchstart", "pointermove"]) {
    addEventListener(eventName, showCursor, { passive: true });
  }

  showCursor();
}

const pearlGlass = createPearlGlassScene(document.body, {
  lightColor: getLightColorFromQuery(),
});

pearlGlass.start();
hideCursorAfterInactivity();

addEventListener("resize", pearlGlass.resize);
