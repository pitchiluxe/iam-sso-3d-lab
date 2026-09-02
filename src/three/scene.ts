/**
 * three/scene.ts — zone manager.
 * Owns the current zone mesh group, the list of console anchors, and
 * exposes a `enter(zoneId)` that tears down the old zone and builds the new one.
 */
import * as THREE from 'three';
import { ZONE_BLUEPRINTS, type ZoneId, type ConsoleAnchor } from './zones';

export class SceneManager {
  private scene: THREE.Scene;
  private currentGroup: THREE.Group | null = null;
  private currentConsoles: ConsoleAnchor[] = [];
  private currentZoneId: ZoneId | null = null;
  /** Notifies the player controller and HUD when a new zone is loaded. */
  public onEntered: ((zoneId: ZoneId, consoles: ConsoleAnchor[]) => void) | null = null;

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
    const { group, consoles } = bp.build();
    this.scene.add(group);
    this.currentGroup = group;
    this.currentConsoles = consoles;
    this.currentZoneId = zoneId;
    this.onEntered?.(zoneId, consoles);
  }

  getCurrentZoneId(): ZoneId | null { return this.currentZoneId; }
  getConsoles(): ConsoleAnchor[] { return [...this.currentConsoles]; }
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
