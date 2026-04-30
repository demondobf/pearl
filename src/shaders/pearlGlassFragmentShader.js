export const pearlGlassFragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform vec3 uCamPos;
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vHeight;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  vec2 hash22(vec2 p) {
    float n = hash21(p);
    return vec2(n, hash21(p + n + 17.17));
  }

  float glitterLayer(vec2 uv, float scale, float threshold, float radius, float twinkleSpeed) {
    vec2 cell = uv * scale;
    vec2 id = floor(cell);
    vec2 local = fract(cell) - 0.5;
    vec2 offset = hash22(id) - 0.5;
    float seed = hash21(id + 9.73);
    vec2 p = local - offset * 0.58;
    float core = smoothstep(radius, 0.0, length(p));
    float cross =
      smoothstep(radius * 1.85, 0.0, abs(p.x)) *
      smoothstep(radius * 0.22, 0.0, abs(p.y));
    cross +=
      smoothstep(radius * 1.85, 0.0, abs(p.y)) *
      smoothstep(radius * 0.22, 0.0, abs(p.x));
    float twinkle = 0.58 + 0.42 * sin(uTime * twinkleSpeed + seed * 6.2831);
    return step(threshold, seed) * (core + cross * 0.32) * twinkle;
  }

  float dustLayer(vec2 uv, float scale, float power, float minRadius, float maxRadius) {
    vec2 cell = uv * scale;
    vec2 id = floor(cell);
    vec2 local = fract(cell) - 0.5;
    vec2 offset = hash22(id + 31.4) - 0.5;
    float seed = hash21(id + 4.91);
    float radius = mix(minRadius, maxRadius, hash21(id + 12.6));
    vec2 p = local - offset * 0.42;
    float circle = smoothstep(radius, radius * 0.28, length(p));
    float presence = smoothstep(1.0 - 4.0 / (power + 4.0), 1.0, seed);
    return presence * circle * (0.45 + seed * 0.55);
  }

  void main() {
    vec3 dx = dFdx(vWorld);
    vec3 dy = dFdy(vWorld);
    vec3 normal = normalize(cross(dx, dy));
    vec3 viewDir = normalize(uCamPos - vWorld);

    vec3 lightA = normalize(vec3(-0.52, 0.7, 1.0));
    vec3 lightB = normalize(vec3(0.86, -0.22, 0.72));
    vec3 lightC = normalize(vec3(0.12, 0.04, 1.0));

    float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - ndv, 1.72);

    float diffuseA = max(dot(normal, lightA), 0.0);
    float diffuseB = max(dot(normal, lightB), 0.0);
    float diffuseC = max(dot(normal, lightC), 0.0);

    vec3 halfA = normalize(lightA + viewDir);
    vec3 halfB = normalize(lightB + viewDir);
    vec3 halfC = normalize(lightC + viewDir);
    float specA = pow(max(dot(normal, halfA), 0.0), 72.0);
    float specB = pow(max(dot(normal, halfB), 0.0), 38.0);
    float specC = pow(max(dot(normal, halfC), 0.0), 132.0);

    float flow = vUv.x * 0.95 + vUv.y * 0.7 + vHeight * 1.8;
    float band = sin(flow * 13.0 - uTime * 0.24) * 0.5 + 0.5;
    float veil = sin((vUv.x - vUv.y) * 10.0 + uTime * 0.16) * 0.5 + 0.5;
    float caustic = pow(clamp(0.58 * band + 0.42 * veil, 0.0, 1.0), 3.0);
    float thinEdge = smoothstep(0.42, 1.0, fresnel);
    float brightVein = pow(smoothstep(0.64, 1.0, band) * smoothstep(0.46, 1.0, veil), 3.6);
    float hairline = pow(sin((vUv.x * 1.8 + vUv.y * 4.8 + vHeight * 2.2) * 28.0 - uTime * 0.48) * 0.5 + 0.5, 18.0);

    vec3 smokedGlass = vec3(0.004, 0.005, 0.006);
    vec3 graphite = vec3(0.035, 0.04, 0.046);
    vec3 silver = vec3(0.78, 0.84, 0.88);
    vec3 whiteHot = vec3(1.0, 0.98, 0.93);
    vec3 coolPrism = vec3(0.72, 0.86, 1.0);

    vec3 base = mix(smokedGlass, graphite, smoothstep(-0.18, 0.34, vHeight));
    base += diffuseA * vec3(0.055, 0.06, 0.066);
    base += diffuseB * vec3(0.028, 0.034, 0.042);
    base += diffuseC * vec3(0.012, 0.014, 0.016);

    vec2 edge = min(vUv, 1.0 - vUv);
    float borderFade = smoothstep(0.0, 0.2, edge.x) * smoothstep(0.0, 0.2, edge.y);
    float diagonalFlow = vUv.x - vUv.y + 0.08 + sin(vUv.y * 3.2 + uTime * 0.08) * 0.035;
    float diagonalVoid = smoothstep(-0.78, 0.58, diagonalFlow);
    float topLeftStart = smoothstep(0.46, 0.82, vUv.y) * smoothstep(0.24, 0.02, vUv.x);
    float leftSoftness = max(smoothstep(0.14, 0.42, vUv.x), topLeftStart * 0.82);
    diagonalVoid *= leftSoftness;
    float surfaceMask = smoothstep(0.08, 0.72, borderFade * diagonalVoid);

    vec3 liquidReflection = silver * (0.035 + diffuseA * 0.18 + caustic * 0.2);
    vec3 rim = mix(silver, coolPrism, caustic) * thinEdge * 1.08 * surfaceMask;
    vec3 glint = (whiteHot * (specA * 0.82 + specC * 1.45) + coolPrism * specB * 0.26) * surfaceMask;

    vec2 glitterUv = vUv + normal.xy * 0.075 + vec2(vHeight * 0.08, -vHeight * 0.05);
    float glitterFlow = smoothstep(0.26, 1.0, caustic + fresnel * 0.82 + brightVein * 0.55);
    float fineGlitter =
      glitterLayer(glitterUv + vec2(uTime * 0.006, -uTime * 0.004), 280.0, 0.93, 0.035, 5.7) * 0.52 +
      glitterLayer(glitterUv * vec2(0.82, 1.18) - vec2(uTime * 0.004, uTime * 0.005), 430.0, 0.958, 0.028, 7.8) * 0.34 +
      glitterLayer(glitterUv + vec2(sin(uTime * 0.11) * 0.012, cos(uTime * 0.09) * 0.01), 165.0, 0.975, 0.045, 3.9) * 0.68;
    float dust = dustLayer(glitterUv, 620.0, 24.0, 0.1, 0.22) * 0.46;
    float sparkle = (fineGlitter + dust) * glitterFlow * surfaceMask;
    vec3 prismGlitter = mix(vec3(0.78, 0.92, 1.0), vec3(1.0, 0.9, 0.66), hash21(floor(glitterUv * 165.0) + 4.2));

    float shadowFold = smoothstep(-0.12, 0.28, vHeight);
    vec3 color = mix(base * 0.32, base + liquidReflection, shadowFold);
    color += rim + glint;
    color += silver * brightVein * 0.18;
    color += whiteHot * hairline * caustic * 0.16;
    color += whiteHot * sparkle * 0.62;
    color += prismGlitter * sparkle * 0.22;
    color += vec3(0.52, 0.62, 0.72) * pow(caustic, 6.5) * 0.1;
    color *= 0.72 + fresnel * 0.55;
    color = min(color, vec3(1.32));

    float alpha = clamp(borderFade * (0.42 + shadowFold * 0.5 + fresnel * 0.42) * diagonalVoid, 0.0, 0.96);

    gl_FragColor = vec4(color, alpha);
  }
`;
