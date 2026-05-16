function normalizeCssColor(color: string): string | undefined {
  if (!CSS.supports("color", color)) {
    return undefined;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return color;
  }

  context.fillStyle = "#000000";
  context.fillStyle = color;

  return context.fillStyle;
}

function createFaviconSvg(lightColor: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <radialGradient id="sphereCore" cx="32%" cy="24%" r="70%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="16%" stop-color="${lightColor}" stop-opacity=".8"/>
          <stop offset="36%" stop-color="#6d8090"/>
          <stop offset="62%" stop-color="#111820"/>
          <stop offset="100%" stop-color="#020304"/>
        </radialGradient>
        <radialGradient id="rimLight" cx="72%" cy="30%" r="78%">
          <stop offset="0%" stop-color="#f7fbff" stop-opacity=".96"/>
          <stop offset="24%" stop-color="${lightColor}" stop-opacity=".42"/>
          <stop offset="55%" stop-color="#ffffff" stop-opacity=".08"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="shaderBand" x1="14" y1="15" x2="50" y2="49" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff" stop-opacity=".88"/>
          <stop offset="23%" stop-color="${lightColor}" stop-opacity=".44"/>
          <stop offset="48%" stop-color="#0b0f14" stop-opacity=".18"/>
          <stop offset="74%" stop-color="#f3f7ff" stop-opacity=".4"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity=".08"/>
        </linearGradient>
        <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.35" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <clipPath id="sphereClip">
          <circle cx="32" cy="32" r="19"/>
        </clipPath>
      </defs>

      <rect width="64" height="64" rx="15" fill="#020202"/>
      <circle cx="32" cy="32" r="21" fill="#06080b"/>
      <circle cx="32" cy="32" r="19" fill="url(#sphereCore)"/>
      <g clip-path="url(#sphereClip)">
        <path d="M11 42 C22 31 31 28 53 20" fill="none" stroke="url(#shaderBand)" stroke-width="9" stroke-linecap="round" opacity=".72"/>
        <path d="M17 49 C26 39 39 36 55 33" fill="none" stroke="#edf8ff" stroke-width="2.6" stroke-linecap="round" opacity=".26"/>
        <path d="M12 28 C25 19 39 19 52 25" fill="none" stroke="#020203" stroke-width="7" stroke-linecap="round" opacity=".34"/>
        <circle cx="23" cy="20" r="5.8" fill="#ffffff" opacity=".86" filter="url(#softGlow)"/>
        <circle cx="42" cy="43" r="2.2" fill="#ffffff" opacity=".44"/>
        <circle cx="49" cy="28" r="1.4" fill="${lightColor}" opacity=".7"/>
      </g>
      <circle cx="32" cy="32" r="19" fill="url(#rimLight)"/>
      <circle cx="32" cy="32" r="19.5" fill="none" stroke="#f6fbff" stroke-opacity=".42" stroke-width="1.4"/>
    </svg>
  `;
}

export function applyFaviconLightColor(lightColor: string | undefined): void {
  if (!lightColor) {
    return;
  }

  const normalizedColor = normalizeCssColor(lightColor);

  if (!normalizedColor) {
    return;
  }

  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (!icon) {
    return;
  }

  icon.href = `data:image/svg+xml,${encodeURIComponent(createFaviconSvg(normalizedColor))}`;
}
