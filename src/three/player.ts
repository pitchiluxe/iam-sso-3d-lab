/**
 * three/player.ts — first-person controller.
 * Walks the camera with WASD, looks with the mouse (pointer lock), and
 * detects proximity to consoles. Calls `onPrompt` when within range of one,
 * and `onActivate` when the user presses E.
 */
import * as THREE from 'three';
import type { ConsoleAnchor } from './zones';

const WALK_SPEED   = 3.0;   // units per second
const SPRINT_SPEED = 5.0;
const EYE_HEIGHT   = 1.7;
const PROXIMITY    = 2.5;   // distance at which a console prompts

export class PlayerController {
  private camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private yaw = 0;
  private pitch = 0;
  private keys = new Set<string>();
  private pointerLocked = false;
  private consoles: ConsoleAnchor[] = [];
  private nearConsole: ConsoleAnchor | null = null;

  public onPrompt: ((console: ConsoleAnchor | null) => void) | null = null;
  public onActivate: ((console: ConsoleAnchor) => void) | null = null;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.dom = dom;
    this.bindEvents();
  }

  /** Set the consoles in the current zone and reset the prompt state. */
  setConsoles(consoles: ConsoleAnchor[]): void {
    this.consoles = consoles;
    this.nearConsole = null;
    this.onPrompt?.(null);
  }

  /** Teleport the player to a specific point in the world. */
  teleport(pos: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.camera.position.copy(pos);
    this.camera.lookAt(lookAt);
    const dir = new THREE.Vector3().subVectors(lookAt, pos).normalize();
    this.yaw   = Math.atan2(-dir.x, -dir.z);
    this.pitch = Math.asin(dir.y);
  }

  /** Smoothly tween the camera from its current position to a new one over `ms` ms. */
  tweenTo(target: THREE.Vector3, lookAt: THREE.Vector3, ms = 700): Promise<void> {
    return new Promise((resolve) => {
      const startPos = this.camera.position.clone();
      const startDir = new THREE.Vector3();
      this.camera.getWorldDirection(startDir);
      const startYaw = this.yaw;
      const startPitch = this.pitch;
      const targetDir = new THREE.Vector3().subVectors(lookAt, target).normalize();
      const targetYaw   = Math.atan2(-targetDir.x, -targetDir.z);
      const targetPitch = Math.asin(targetDir.y);
      const t0 = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - t0) / ms);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
        this.camera.position.lerpVectors(startPos, target, ease);
        this.yaw   = startYaw   + (targetYaw   - startYaw)   * ease;
        this.pitch = startPitch + (targetPitch - startPitch) * ease;
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      tick();
    });
  }

  /** Per-frame update. `delta` in seconds. */
  update(delta: number): void {
    this.moveCamera(delta);
    this.updateProximity();
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                          */
  /* ------------------------------------------------------------------ */

  private moveCamera(delta: number): void {
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
      ? SPRINT_SPEED
      : WALK_SPEED;
    const fwd = this.keys.has('KeyW') || this.keys.has('ArrowUp')   ? 1 : 0;
    const bwd = this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0;
    const lft = this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0;
    const rgt = this.keys.has('KeyD') || this.keys.has('ArrowRight')? 1 : 0;

    // Forward direction projected to XZ plane
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right   = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const move = new THREE.Vector3();
    move.addScaledVector(forward, fwd - bwd);
    move.addScaledVector(right,   rgt - lft);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * delta);
      this.camera.position.add(move);
    }

    // Keep inside the 18x18 box, just outside the walls
    const limit = 9;
    this.camera.position.x = Math.max(-limit, Math.min(limit, this.camera.position.x));
    this.camera.position.z = Math.max(-limit, Math.min(limit, this.camera.position.z));
    this.camera.position.y = EYE_HEIGHT;

    // Apply look
    const lookDir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
       Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.camera.lookAt(this.camera.position.clone().add(lookDir));
  }

  private updateProximity(): void {
    if (this.consoles.length === 0) {
      if (this.nearConsole) { this.nearConsole = null; this.onPrompt?.(null); }
      return;
    }
    let best: ConsoleAnchor | null = null;
    let bestDist = PROXIMITY;
    for (const c of this.consoles) {
      const d = this.camera.position.distanceTo(c.position);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    if (best?.id !== this.nearConsole?.id) {
      this.nearConsole = best;
      this.onPrompt?.(best);
    }
  }

  private bindEvents(): void {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE' && this.nearConsole) {
        this.onActivate?.(this.nearConsole);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Pointer lock
    this.dom.addEventListener('click', () => {
      if (!this.pointerLocked) this.dom.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = (document.pointerLockElement === this.dom);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      const sens = 0.0025;
      this.yaw   -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    });
  }
}
