import * as THREE from "three";

import { pearlGlassFragmentShader } from "../shaders/pearlGlassFragmentShader.js";
import { pearlGlassVertexShader } from "../shaders/pearlGlassVertexShader.js";

const getRenderScale = () => Math.min(devicePixelRatio || 1, 4);

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });

  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(getRenderScale());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);

  return renderer;
}

function createMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
    },
    vertexShader: pearlGlassVertexShader,
    fragmentShader: pearlGlassFragmentShader,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}

function createPearlMesh(material) {
  const geometry = new THREE.PlaneGeometry(5.4, 3.9, 1280, 1280);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(-0.22, 0.24, 0);
  mesh.rotation.z = -0.12;
  mesh.rotation.x = -0.08;

  return mesh;
}

export function createPearlGlassScene(container) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.22);

  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 2.35);

  const renderer = createRenderer();
  const material = createMaterial();
  const mesh = createPearlMesh(material);

  scene.add(mesh);
  container.appendChild(renderer.domElement);

  function animate(t = 0) {
    material.uniforms.uTime.value = t * 0.001;

    camera.position.x = Math.sin(t * 0.00012) * 0.05;
    camera.position.y = Math.cos(t * 0.00016) * 0.035;
    camera.position.z = 2.3 + Math.sin(t * 0.00017) * 0.02;
    camera.lookAt(0, 0, 0);
    material.uniforms.uCamPos.value.copy(camera.position);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(getRenderScale());
  }

  return {
    start: animate,
    resize,
  };
}
