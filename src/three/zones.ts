/**
 * three/zones.ts — zone geometry + console positions.
 * Each zone is a low-poly environment built from primitives. The scene manager
 * builds one zone at a time and provides world positions for the camera
 * to navigate to and the consoles for the user to interact with.
 *
 * Phase D ships one zone (iam-ops) and one console (IAM Console). The
 * remaining zones (hr, finance, app-center, etc.) come in Phase I.
 */
import * as THREE from 'three';

export type ZoneId = 'iam-ops' | 'sec-ops' | 'hr' | 'help-desk' | 'finance' | 'engineering' | 'app-center' | 'reception';

export interface ConsoleAnchor {
  /** Unique id used by the UI. */
  id: string;
  /** Position in zone-local coordinates. */
  position: THREE.Vector3;
  /** Title shown when the player approaches. */
  title: string;
  /** Caption shown in the interaction prompt. */
  prompt: string;
}

export interface ZoneBlueprint {
  id: ZoneId;
  displayName: string;
  /** Build the geometry and return the group plus a list of console anchors. */
  build(): { group: THREE.Group; consoles: ConsoleAnchor[] };
  /** Where the player starts when entering the zone. */
  spawnPoint: THREE.Vector3;
  /** Where the player looks when they enter. */
  spawnLookAt: THREE.Vector3;
}

/* -------------------------------------------------------------------------- */
/* IAM Operations — the first zone.                                            */
/* It contains: a briefing area, the IAM Console, the Ticket Console, the      */
/* IdP rack (servers), a whiteboard with zone label, and ambient props.       */
/* -------------------------------------------------------------------------- */
const IAM_OPS_BLUEPRINT: ZoneBlueprint = {
  id: 'iam-ops',
  displayName: 'IAM Operations',
  spawnPoint: new THREE.Vector3(0, 1.7, 8),
  spawnLookAt: new THREE.Vector3(0, 1.5, 0),

  build() {
    const group = new THREE.Group();
    group.name = 'zone:iam-ops';
    const consoles: ConsoleAnchor[] = [];

    const matFloor = new THREE.MeshStandardMaterial({ color: '#1b1f24', roughness: 0.95 });
    const matWall  = new THREE.MeshStandardMaterial({ color: '#232830', roughness: 0.9 });
    const matAccent = new THREE.MeshStandardMaterial({ color: '#4ec9b0', roughness: 0.5, emissive: '#0a3a32', emissiveIntensity: 0.4 });
    const matDesk  = new THREE.MeshStandardMaterial({ color: '#3b3f48', roughness: 0.7 });
    const matScreen = new THREE.MeshStandardMaterial({ color: '#0a3a32', emissive: '#4ec9b0', emissiveIntensity: 0.8 });
    const matRack   = new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.5, metalness: 0.4 });
    const matScreenOff = new THREE.MeshStandardMaterial({ color: '#0d1014', emissive: '#0d1014', emissiveIntensity: 0 });

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), matFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    // Grid overlay so the learner can orient themselves
    const grid = new THREE.GridHelper(20, 20, '#2d343d', '#232830');
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    (grid.material as THREE.LineBasicMaterial).opacity = 0.4;
    group.add(grid);

    // Walls (back, left, right) — open front for camera
    const back = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 0.3), matWall);
    back.position.set(0, 2, -10);
    back.receiveShadow = true;
    group.add(back);

    const left = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 20), matWall);
    left.position.set(-10, 2, 0);
    left.receiveShadow = true;
    group.add(left);

    const right = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 20), matWall);
    right.position.set(10, 2, 0);
    right.receiveShadow = true;
    group.add(right);

    // Ceiling beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 0.4), matAccent);
    beam.position.set(0, 3.9, -5);
    group.add(beam);

    /* ----- Briefing area (north wall, center) ----- */
    const briefing = new THREE.Group();
    briefing.name = 'briefing-area';
    const board = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.1), matDesk);
    board.position.set(0, 2.5, -9.85);
    briefing.add(board);
    const title = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 0.05), matAccent);
    title.position.set(0, 3.1, -9.8);
    briefing.add(title);
    group.add(briefing);

    /* ----- SecOps wall monitor (center back wall) ----- */
    const secOpsScreen = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2, 0.05), matScreen);
    secOpsScreen.position.set(0, 2.5, -9.85);
    group.add(secOpsScreen);
    const secOpsBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), matDesk);
    secOpsBase.position.set(0, 1.0, -9.5);
    group.add(secOpsBase);

    /* ----- IAM Console (left desk) ----- */
    const iamConsoleGroup = new THREE.Group();
    iamConsoleGroup.name = 'console:iam';
    const iamDesk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.2), matDesk);
    iamDesk.position.set(-4.5, 0.45, -3);
    iamDesk.castShadow = true;
    iamConsoleGroup.add(iamDesk);
    const iamLegs = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1), matAccent);
    iamLegs.position.set(-4.5, 0.9, -3);
    iamConsoleGroup.add(iamLegs);
    const iamScreen = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.05), matScreen);
    iamScreen.position.set(-4.5, 1.6, -3.4);
    iamConsoleGroup.add(iamScreen);
    const iamMonitorBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), matDesk);
    iamMonitorBase.position.set(-4.5, 0.95, -3.4);
    iamConsoleGroup.add(iamMonitorBase);
    group.add(iamConsoleGroup);

    consoles.push({
      id: 'iam-console',
      position: new THREE.Vector3(-4.5, 1.6, -2.5),
      title: 'IAM Console',
      prompt: 'Open IAM Console (E)',
    });

    consoles.push({
      id: 'secops-dashboard',
      position: new THREE.Vector3(0, 1.7, -3.5),
      title: 'SecOps Dashboard',
      prompt: 'Open SecOps Dashboard (E)',
    });

    /* ----- Ticket Console (right desk) ----- */
    const ticketGroup = new THREE.Group();
    ticketGroup.name = 'console:tickets';
    const ticketDesk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.2), matDesk);
    ticketDesk.position.set(4.5, 0.45, -3);
    ticketDesk.castShadow = true;
    ticketGroup.add(ticketDesk);
    const ticketLegs = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1), matAccent);
    ticketLegs.position.set(4.5, 0.9, -3);
    ticketGroup.add(ticketLegs);
    const ticketScreen = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.05), matScreen);
    ticketScreen.position.set(4.5, 1.6, -3.4);
    ticketGroup.add(ticketScreen);
    const ticketBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), matDesk);
    ticketBase.position.set(4.5, 0.95, -3.4);
    ticketGroup.add(ticketBase);
    group.add(ticketGroup);

    consoles.push({
      id: 'ticket-console',
      position: new THREE.Vector3(4.5, 1.6, -2.5),
      title: 'Ticket Console',
      prompt: 'Open Ticket Queue (E)',
    });

    /* ----- IdP rack (server room corner) ----- */
    const rack = new THREE.Group();
    rack.name = 'rack:idp';
    const rackBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.8), matRack);
    rackBody.position.set(-7, 1.2, 4);
    rackBody.castShadow = true;
    rack.add(rackBody);
    for (let i = 0; i < 4; i++) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.08, 0.02),
        i % 2 === 0 ? matScreen : matScreenOff,
      );
      led.position.set(-7, 0.4 + i * 0.5, 4.41);
      rack.add(led);
    }
    const rackLabel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.02), matAccent);
    rackLabel.position.set(-7, 2.6, 4.41);
    rack.add(rackLabel);
    group.add(rack);

    /* ----- Help flag / zone label (ceiling mounted) ----- */
    const flagPole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), matAccent);
    flagPole.position.set(0, 3.5, -9.5);
    group.add(flagPole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.02), matAccent);
    flag.position.set(0.4, 3.65, -9.5);
    group.add(flag);

    /* ----- Ambient props: a couple of low-poly chairs near the consoles ----- */
    const chairMat = new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.8 });
    const makeChair = (x: number, z: number) => {
      const c = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), chairMat);
      seat.position.set(x, 0.5, z);
      c.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.08), chairMat);
      back.position.set(x, 0.8, z - 0.3);
      c.add(back);
      return c;
    };
    group.add(makeChair(-4.5, -1.6));
    group.add(makeChair(4.5, -1.6));

    return { group, consoles };
  },
};

/* -------------------------------------------------------------------------- */
/* Registry                                                                   */
/* -------------------------------------------------------------------------- */
export const ZONE_BLUEPRINTS: Record<ZoneId, ZoneBlueprint> = {
  'iam-ops':    IAM_OPS_BLUEPRINT,
  // The other zones fall back to iam-ops geometry for now. Phase I will
  // replace each with a real blueprint. The fallback is the same set so
  // the camera, lighting, and consoles all keep working.
  'sec-ops':    { ...IAM_OPS_BLUEPRINT, id: 'sec-ops', displayName: 'Security Operations' },
  'hr':         { ...IAM_OPS_BLUEPRINT, id: 'hr',      displayName: 'HR' },
  'help-desk':  { ...IAM_OPS_BLUEPRINT, id: 'help-desk', displayName: 'Help Desk' },
  'finance':    { ...IAM_OPS_BLUEPRINT, id: 'finance', displayName: 'Finance' },
  'engineering':{ ...IAM_OPS_BLUEPRINT, id: 'engineering', displayName: 'Engineering' },
  'app-center': { ...IAM_OPS_BLUEPRINT, id: 'app-center', displayName: 'Application Center' },
  'reception':  { ...IAM_OPS_BLUEPRINT, id: 'reception', displayName: 'Reception' },
};

export const listZones = (): ZoneId[] => Object.keys(ZONE_BLUEPRINTS) as ZoneId[];
