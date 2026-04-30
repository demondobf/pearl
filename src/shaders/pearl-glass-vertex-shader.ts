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
    float swirl = sin(length(drift * vec2(0.8, 1.3)) * 4.6 - uTime * 0.42);
    float ribbon = sin((p.x + p.y * 0.55) * 6.8 - uTime * 0.48);
    float micro = sin(p.x * 13.0 - uTime * 0.65) * sin(p.y * 10.5 + uTime * 0.37);
    float haze = sin(dot(drift, vec2(1.25, -0.85)) * 4.2 + uTime * 0.22);

    float height =
      broadFold * 0.17 +
      crossFold * 0.115 +
      swirl * 0.05 +
      ribbon * 0.05 +
      micro * 0.012 +
      haze * 0.025;

    pos.z += height;
    pos.x += broadFold * 0.016 + swirl * 0.01;
    pos.y += crossFold * 0.014;

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorld = world.xyz;
    vUv = uv;
    vHeight = height;

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
