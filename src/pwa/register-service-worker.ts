export function registerServiceWorker(): void {
  if (!import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });

    return;
  }

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    const controlledReloadKey = "pearl-service-worker-controlled-reload";

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem(controlledReloadKey) === "done") {
        return;
      }

      sessionStorage.setItem(controlledReloadKey, "done");
      location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch((error: unknown) => {
        console.error("Pearl service worker registration failed", error);
      });
  }
}
