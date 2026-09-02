/**
 * engine.ts — Three.js renderer, scene, camera, and render loop.
 * Phase D adds the SceneManager + PlayerController so the camera responds
 * to WASD/mouse and the player can approach consoles.
 */
import * as THREE from 'three';
import { SceneManager } from './scene';
import { PlayerController } from './player';
import { ZONE_BLUEPRINTS, type ZoneId, type ConsoleAnchor } from './zones';

export interface Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sceneMgr: SceneManager;
  player: PlayerController;
  enterZone(zoneId: ZoneId): void;
  onConsolePrompt: ((c: ConsoleAnchor | null) => void) | null;
  onConsoleActivate: ((c: ConsoleAnchor) => void) | null;
  onWorkstationActivate: (() => void) | null;
}

export function initEngine(container: HTMLElement): Engine {
  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0e1116');
  scene.fog = new THREE.Fog('#0e1116', 12, 36);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );
  camera.position.set(0, 1.7, 8);

  // Lighting
  const hemi = new THREE.HemisphereLight(0x4ec9b0, 0x1b1f24, 0.5);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  scene.add(dirLight);

  // Ambient fill so dark side of objects is still readable
  const fill = new THREE.AmbientLight(0x4ec9b0, 0.15);
  scene.add(fill);

  // Zone manager
  const sceneMgr = new SceneManager(scene);
  sceneMgr.enter('iam-ops'); // default starting zone

  // Player
  const player = new PlayerController(camera, renderer.domElement);
  player.setConsoles(sceneMgr.getConsoles());

  // Sync: when SceneManager loads a new zone, re-sync consoles
  sceneMgr.onEntered = (_zoneId, consoles) => {
    player.setConsoles(consoles);
  };

  // Engine interface
  const engine: Engine = {
    renderer, scene, camera, sceneMgr, player,
    enterZone(zoneId: ZoneId) {
      const bp = ZONE_BLUEPRINTS[zoneId];
      sceneMgr.enter(zoneId);
      void player.tweenTo(bp.spawnPoint, bp.spawnLookAt, 600);
    },
    onConsolePrompt: null,
    onConsoleActivate: null,
    onWorkstationActivate: null,
  };

  player.onPrompt = (c) => engine.onConsolePrompt?.(c);
  player.onActivate = (c) => engine.onConsoleActivate?.(c);

  // Raycasting — detect clicks on workstation meshes regardless of proximity
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // left click only
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        if (o.userData?.interactable === 'workstation') {
          engine.onWorkstationActivate?.();
          return;
        }
        o = o.parent;
      }
    }
  });

  // Initial teleport
  player.teleport(ZONE_BLUEPRINTS['iam-ops'].spawnPoint, ZONE_BLUEPRINTS['iam-ops'].spawnLookAt);

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return engine;
}

/* -------------------------------------------------------------------------- */
/* FPS counter                                                                */
/* -------------------------------------------------------------------------- */
function makeFPSCounter() {
  const fpsEl = document.getElementById('fps');
  if (!fpsEl) return (_now: number) => {};
  const times: number[] = [];
  let last = performance.now();
  return function tick(now: number) {
    times.push(now - last);
    last = now;
    if (times.length > 60) times.shift();
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    fpsEl.textContent = `${Math.round(1000 / avg)} FPS`;
  };
}

export function startLoop(engine: Engine): () => void {
  const fpsTick = makeFPSCounter();
  let prev = performance.now();
  let rafId = 0;

  function animate(now = 0) {
    rafId = requestAnimationFrame(animate);
    const delta = Math.min(0.1, (now - prev) / 1000); // clamp to 100ms
    prev = now;
    engine.player.update(delta);
    fpsTick(now);
    engine.renderer.render(engine.scene, engine.camera);
  }
  rafId = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(rafId);
}
