/**
 * three/scene.ts — zone manager.
 * Owns the current zone mesh group, the list of console anchors, and
 * exposes a `enter(zoneId)` that tears down the old zone and builds the new one.
 *
 * Zone build errors are caught and render an in-place fallback room so the
 * learner is never left in a blank screen.
 */
import * as THREE from 'three';
import { ZONE_BLUEPRINTS, type ZoneId, type ConsoleAnchor } from './zones';
import { report } from '@/util/errors';

export class SceneManager {
  private scene: THREE.Scene;
  private currentGroup: THREE.Group | null = null;
  private currentConsoles: ConsoleAnchor[] = [];
  private currentWorkstations: THREE.Object3D[] = [];
  private currentZoneId: ZoneId | null = null;
  /** Notifies the player controller and HUD when a new zone is loaded. */
  public onEntered:
    ((zoneId: ZoneId, consoles: ConsoleAnchor[], workstations: THREE.Object3D[]) => void) | null =
    null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Tear down the current zone and load a new one. */
  enter(zoneId: ZoneId): void {
    if (this.currentGroup) {
      this.scene.remove(this.currentGroup);
      disposeGroup(this.currentGroup);
    }
    const bp = ZONE_BLUEPRINTS[zoneId];
    let group: THREE.Group;
    let consoles: ConsoleAnchor[];
    let workstations: THREE.Object3D[] = [];

    try {
      ({ group, consoles } = bp.build());
      // Find workstation meshes (tagged with userData.interactable = 'workstation')
      group.traverse((o) => {
        if ((o as THREE.Object3D).userData?.interactable === 'workstation') {
          workstations.push(o);
        }
      });
    } catch (err) {
      report('zone-build-failed', `Zone "${zoneId}" failed to build`, {
        context: { zoneId },
        cause: err,
      });
      // Render a neutral fallback room so the learner is never stuck on a blank screen.
      group = buildFallbackRoom(zoneId);
      consoles = [];
      workstations = [];
    }

    this.scene.add(group);
    this.currentGroup = group;
    this.currentConsoles = consoles;
    this.currentWorkstations = workstations;
    this.currentZoneId = zoneId;
    this.onEntered?.(zoneId, consoles, workstations);
  }

  getCurrentZoneId(): ZoneId | null {
    return this.currentZoneId;
  }
  getConsoles(): ConsoleAnchor[] {
    return [...this.currentConsoles];
  }
  getWorkstations(): THREE.Object3D[] {
    return [...this.currentWorkstations];
  }
}

/* Recursively dispose geometry and materials. */
function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) mat.dispose();
    }
  });
}

/**
 * A neutral, room-shaped fallback used when a zone blueprint throws.
 * Includes a "Zone failed to load" sign so the learner knows what happened.
 */
function buildFallbackRoom(zoneId: ZoneId): THREE.Group {
  const g = new THREE.Group();
  g.name = `fallback-${zoneId}`;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2d343d, roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 0.3), wallMat);
    wall.position.y = 2;
    wall.position.z = i === 0 ? 10 : i === 2 ? -10 : 0;
    wall.position.x = i === 1 ? 10 : i === 3 ? -10 : 0;
    wall.rotation.y = i === 0 || i === 2 ? 0 : Math.PI / 2;
    g.add(wall);
  }

  // Sign on the front wall
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 1.2),
    new THREE.MeshBasicMaterial({ color: 0xf48771 }),
  );
  sign.position.set(0, 2.2, -9.85);
  g.add(sign);

  return g;
}
