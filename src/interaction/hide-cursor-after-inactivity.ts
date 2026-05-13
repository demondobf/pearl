export function hideCursorAfterInactivity(timeoutMs = 5000): void {
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
