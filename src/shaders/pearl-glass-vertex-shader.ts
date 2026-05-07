export const pearlGlassVertexShader: string = `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vHeight;

  float waveBand(vec2 p, vec2 dir, float freq, float speed, float phase) {
    float travel = dot(p, normalize(dir)) * freq;
    return sin(travel + uTime * speed + phase);
  }

  void main() {
    vec3 pos = position;
    vec2 p = pos.xy;
    vec2 drift = p + vec2(0.42, -0.18);

    float broadFold = waveBand(p, vec2(1.0, 0.26), 2.35, 0.34, 0.2);
    float crossFold = waveBand(p, vec2(-0.38, 1.0), 2.9, 0.28, 1.1);
    vec2 swirlP = drift * vec2(0.8, 1.3);
    float swirlRadius = sqrt(dot(swirlP, swirlP) + 0.09);
    vec2 swirlDir = swirlP / swirlRadius;
    float swirl =
      sin(swirlRadius * 4.35 + dot(swirlDir, vec2(0.86, -0.5)) * 0.86 - uTime * 0.44) * 0.72 +
      sin(swirlRadius * 7.2 + dot(swirlDir, vec2(-0.32, 0.95)) * 0.64 + uTime * 0.18) * 0.28;
    float ribbon = sin((p.x + p.y * 0.55 + broadFold * 0.08) * 6.8 - uTime * 0.52);
    float micro = sin(p.x * 13.0 + swirl * 0.55 - uTime * 0.72) * sin(p.y * 10.5 + uTime * 0.41);
    float haze = sin(dot(drift, vec2(1.25, -0.85)) * 4.2 + uTime * 0.22);

    float height =
      broadFold * 0.165 +
      crossFold * 0.108 +
      swirl * 0.052 +
      ribbon * 0.046 +
      micro * 0.01 +
      haze * 0.022;

    pos.z += height * 0.96;
    pos.x += broadFold * 0.014 + swirl * 0.009 + ribbon * 0.004;
    pos.y += crossFold * 0.012 - haze * 0.004;

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorld = world.xyz;
    vUv = uv;
    vHeight = height;

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
