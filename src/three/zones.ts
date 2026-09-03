/**
 * three/zones.ts — zone geometry + console positions.
 *
 * Each zone is a low-poly environment built from primitives. The scene manager
 * builds one zone at a time and provides world positions for the camera
 * to navigate to and the consoles for the user to interact with.
 *
 * Geometry helpers live in ./props.ts and cached materials in ./materials.ts.
 */
import * as THREE from 'three';
import * as props from './props';

export type ZoneId =
  | 'iam-ops'
  | 'sec-ops'
  | 'hr'
  | 'help-desk'
  | 'finance'
  | 'engineering'
  | 'app-center'
  | 'reception';

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
  /**
   * Build the zone geometry and return the group plus console anchors.
   * Zone-specific lights (PointLights) should be added to the group so the
   * SceneManager can dispose them with the rest of the zone.
   */
  build(): { group: THREE.Group; consoles: ConsoleAnchor[] };
  /** Where the player starts when entering the zone. */
  spawnPoint: THREE.Vector3;
  /** Where the player looks when they enter. */
  spawnLookAt: THREE.Vector3;
}

/* -------------------------------------------------------------------------- */
/* IAM Operations — SOC-style ops center.                                       */
/* Teal accent, dark floor, server rack, two workstations.                     */
/* -------------------------------------------------------------------------- */
const IAM_OPS: ZoneBlueprint = {
  id: 'iam-ops',
  displayName: 'IAM Operations',
  spawnPoint: new THREE.Vector3(0, 1.7, 8),
  spawnLookAt: new THREE.Vector3(0, 1.5, 0),

  build() {
    const g = new THREE.Group();
    g.name = 'zone:iam-ops';
    const consoles: ConsoleAnchor[] = [];

    const mFloor = new THREE.MeshStandardMaterial({ color: '#1b1f24', roughness: 0.95 });
    const mWall = new THREE.MeshStandardMaterial({ color: '#232830', roughness: 0.9 });
    const mAccent = new THREE.MeshStandardMaterial({
      color: '#4ec9b0',
      roughness: 0.5,
      emissive: '#0a3a32',
      emissiveIntensity: 0.4,
    });
    const mDesk = new THREE.MeshStandardMaterial({ color: '#3b3f48', roughness: 0.7 });
    const mRack = new THREE.MeshStandardMaterial({
      color: '#1a1d22',
      roughness: 0.5,
      metalness: 0.4,
    });

    // Floor + grid
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    const grid = new THREE.GridHelper(20, 20, '#2d343d', '#232830');
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    (grid.material as THREE.LineBasicMaterial).opacity = 0.4;
    g.add(grid);

    // Walls
    for (const [x, z, rw, rh, rd] of [
      [0, -10, 20, 4, 0.3], // back
      [-10, 0, 0.3, 4, 20], // left
      [10, 0, 0.3, 4, 20], // right
    ] as [number, number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mWall);
      wall.position.set(x, 2, z);
      wall.receiveShadow = true;
      g.add(wall);
    }

    // Ceiling beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 0.4), mAccent);
    beam.position.set(0, 3.9, -5);
    g.add(beam);

    // Briefing whiteboard (back wall)
    const wb = props.makeWhiteboard(
      6,
      1.8,
      new THREE.MeshStandardMaterial({ color: '#f0f4f8', roughness: 0.3 }),
    );
    wb.position.set(0, 0, -9.9);
    wb.children.forEach((c) => {
      c.castShadow = true;
    });
    g.add(wb);
    const sign = props.makeWallSign('IAM OPERATIONS CENTER', 5, 0.6, '#4ec9b0', '#0e1116');
    sign.position.set(0, 3.5, -9.9);
    g.add(sign);

    // IAM Console desk (left)
    const iamDesk = props.makeDesk(2.4, 0.9, 1.2, mDesk);
    iamDesk.position.set(-4.5, 0, -3);
    g.add(iamDesk);
    const iamScreen = props.makeLockScreenMonitor(1.4, 0.9);
    iamScreen.position.set(-4.5, 0.9, -3.45);
    iamScreen.userData.interactable = 'workstation'; // walk up, face the monitor, press E
    g.add(iamScreen);
    g.add(
      props.makeChair(
        'office',
        new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.8 }),
      ),
    );
    g.children[g.children.length - 1]!.position.set(-4.5, 0, -1.6);
    g.children[g.children.length - 1]!.rotation.y = Math.PI; // face the monitor, not away from it

    // Note: the 3D consoles (IAM Console, SecOps Dashboard, etc.) are no longer
    // anchored as 3D-scene interactables — they're available inside the VM Desktop
    // opened from the workstation. The E key near the workstation opens the VM.

    // (No consoles added in iam-ops — only the two desk monitors are interactable.)

    // Ticket Console desk (right)
    const ticketDesk = props.makeDesk(2.4, 0.9, 1.2, mDesk);
    ticketDesk.position.set(4.5, 0, -3);
    g.add(ticketDesk);
    const ticketScreen = props.makeLockScreenMonitor(1.4, 0.9);
    ticketScreen.position.set(4.5, 0.9, -3.45);
    ticketScreen.userData.interactable = 'workstation'; // walk up, face the monitor, press E
    g.add(ticketScreen);
    g.add(
      props.makeChair(
        'office',
        new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.8 }),
      ),
    );
    g.children[g.children.length - 1]!.position.set(4.5, 0, -1.6);
    g.children[g.children.length - 1]!.rotation.y = Math.PI; // face the monitor, not away from it

    // No 3D-scene console anchors here — all consoles (IAM, Ticket, SecOps, etc.)
    // are opened from the VM Desktop launched by either desk monitor above.

    // Server rack (corner)
    const rack = props.makeServerRack(1.2, 2.4, 0.8, mRack, [
      '#4ec9b0',
      '#0d1014',
      '#4ec9b0',
      '#0d1014',
    ]);
    rack.position.set(-7, 0, 4);
    g.add(rack);

    // Plants
    g.add(props.makePlant('fern'));
    g.children[g.children.length - 1]!.position.set(7, 0, 4);
    g.add(props.makePlant('tree'));
    g.children[g.children.length - 1]!.position.set(7, 0, -4);

    return { group: g, consoles };
  },
};

/* -------------------------------------------------------------------------- */
/* Security Operations — SOC war room.                                          */
/* Red/blue accent lighting, curved desk with 3 monitors, server rack wall.  */
/* -------------------------------------------------------------------------- */
const SEC_OPS: ZoneBlueprint = {
  id: 'sec-ops',
  displayName: 'Security Operations',
  spawnPoint: new THREE.Vector3(0, 1.7, 8),
  spawnLookAt: new THREE.Vector3(0, 1.5, 0),

  build() {
    const g = new THREE.Group();
    g.name = 'zone:sec-ops';
    const consoles: ConsoleAnchor[] = [];

    const mFloor = new THREE.MeshStandardMaterial({ color: '#141820', roughness: 0.95 });
    const mWall = new THREE.MeshStandardMaterial({ color: '#1a2030', roughness: 0.9 });
    const mAccent = new THREE.MeshStandardMaterial({
      color: '#4ec9b0',
      roughness: 0.4,
      emissive: '#003d35',
      emissiveIntensity: 0.5,
    });
    const mDesk = new THREE.MeshStandardMaterial({
      color: '#1a1d22',
      roughness: 0.7,
      metalness: 0.3,
    });
    const mRack = new THREE.MeshStandardMaterial({
      color: '#0d1014',
      roughness: 0.5,
      metalness: 0.6,
    });

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    // Floor accent strip
    const strip = props.makeFloorStrip(16, 0.1, '#f48771');
    strip.position.set(0, 0.005, -5);
    g.add(strip);

    // Walls
    for (const [x, z, rw, rh, rd] of [
      [0, -10, 20, 4, 0.3],
      [-10, 0, 0.3, 4, 20],
      [10, 0, 0.3, 4, 20],
    ] as [number, number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mWall);
      wall.position.set(x, 2, z);
      wall.receiveShadow = true;
      g.add(wall);
    }

    // Zone sign
    const sign = props.makeWallSign('SECURITY OPERATIONS', 5, 0.6, '#f48771', '#0e1116');
    sign.position.set(0, 3.5, -9.9);
    g.add(sign);

    // Large curved SOC desk
    const socDeskTop = new THREE.Mesh(new THREE.BoxGeometry(8, 0.06, 2), mDesk);
    socDeskTop.position.set(0, 0.93, -3);
    socDeskTop.castShadow = true;
    g.add(socDeskTop);
    // Legs
    for (const x of [-3.5, 0, 3.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), mAccent);
      leg.position.set(x, 0.45, -3);
      g.add(leg);
    }

    // 3 monitors on SOC desk — left and right are interactable (walk up, face it, press E)
    for (let i = 0; i < 3; i++) {
      const mon = props.makeLockScreenMonitor(1.6, 1.0);
      mon.position.set(-2.5 + i * 2.5, 0.93, -3.5);
      if (i !== 1) mon.userData.interactable = 'workstation';
      g.add(mon);
    }

    // Chair
    g.add(
      props.makeChair(
        'office',
        new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.8 }),
      ),
    );
    g.children[g.children.length - 1]!.position.set(0, 0, -1.5);
    g.children[g.children.length - 1]!.rotation.y = Math.PI; // face the monitor, not away from it

    // No 3D-scene console anchors — all consoles opened from VM Desktop via workstation.

    // Server rack wall (back wall)
    for (let i = 0; i < 3; i++) {
      const r = props.makeServerRack(1.0, 2.0, 0.7, mRack, [
        '#f48771',
        '#4ec9b0',
        '#f48771',
        '#4ec9b0',
      ]);
      r.position.set(-5 + i * 1.2, 0, -9.3);
      g.add(r);
    }

    // Warning light
    const warnLight = new THREE.PointLight(0xf48771, 0.6, 8);
    warnLight.position.set(0, 3.5, -7);
    g.add(warnLight);

    // Blue accent light
    const blueLight = new THREE.PointLight(0x4ec9b0, 0.3, 10);
    blueLight.position.set(-7, 3, 0);
    g.add(blueLight);

    g.add(props.makePlant('cactus'));
    g.children[g.children.length - 1]!.position.set(8, 0, 4);

    return { group: g, consoles };
  },
};

/* -------------------------------------------------------------------------- */
/* HR — warm, open office.                                                     */
/* Warm amber lighting, cubicle desks, laptop, coffee station.                */
/* -------------------------------------------------------------------------- */
const HR: ZoneBlueprint = {
  id: 'hr',
  displayName: 'Human Resources',
  spawnPoint: new THREE.Vector3(0, 1.7, 8),
  spawnLookAt: new THREE.Vector3(0, 1.5, 0),

  build() {
    const g = new THREE.Group();
    g.name = 'zone:hr';
    const consoles: ConsoleAnchor[] = [];

    const mFloor = new THREE.MeshStandardMaterial({ color: '#f5e6d0', roughness: 0.95 });
    const mWall = new THREE.MeshStandardMaterial({ color: '#fff5e0', roughness: 0.9 });
    const _mAccent = new THREE.MeshStandardMaterial({
      color: '#d7ba7d',
      roughness: 0.4,
      emissive: '#3d2e10',
      emissiveIntensity: 0.3,
    });
    const mDesk = new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.8 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    for (const [x, z, rw, rh, rd] of [
      [0, -10, 20, 4, 0.3],
      [-10, 0, 0.3, 4, 20],
      [10, 0, 0.3, 4, 20],
    ] as [number, number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mWall);
      wall.position.set(x, 2, z);
      wall.receiveShadow = true;
      g.add(wall);
    }

    const sign = props.makeWallSign('PEOPLE & CULTURE', 5, 0.6, '#d7ba7d', '#2d1f10');
    sign.position.set(0, 3.5, -9.9);
    g.add(sign);

    // Two cubicle desks
    for (const [cx, cz] of [
      [-3.5, -3],
      [3.5, -3],
    ] as [number, number][]) {
      const desk = props.makeDesk(1.8, 0.85, 1.0, mDesk);
      desk.position.set(cx, 0, cz);
      g.add(desk);
      const screen = props.makeLockScreenMonitor(1.0, 0.7);
      screen.position.set(cx, 0.85, cz - 0.55);
      g.add(screen);
      // Cubicle partition
      const part = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.2, 0.04),
        new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.9 }),
      );
      part.position.set(cx, 1.5, cz + 0.6);
      g.add(part);
      g.add(
        props.makeChair(
          'office',
          new THREE.MeshStandardMaterial({ color: '#8b7355', roughness: 0.9 }),
        ),
      );
      g.children[g.children.length - 1]!.position.set(cx, 0, cz - 1.1);
      g.children[g.children.length - 1]!.rotation.y = Math.PI; // face the monitor, not away from it
    }

    // Coffee station (left wall)
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.0, 0.6),
      new THREE.MeshStandardMaterial({ color: '#a08060', roughness: 0.9 }),
    );
    counter.position.set(-8, 0.5, 0);
    counter.castShadow = true;
    g.add(counter);
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.05, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.5 }),
    );
    mug.position.set(-8.2, 1.06, 0);
    g.add(mug);

    // Warm ambient light
    const warmLight = new THREE.PointLight(0xffd9a0, 0.5, 10);
    warmLight.position.set(0, 3.5, -3);
    g.add(warmLight);

    g.add(props.makePlant('tree'));
    g.children[g.children.length - 1]!.position.set(8, 0, -4);

    return { group: g, consoles };
  },
};

/* -------------------------------------------------------------------------- */
/* Help Desk — fluorescent-lit service counter.                                 */
/* Counter with service bell, monitor, headset, ergonomic chair.              */
/* -------------------------------------------------------------------------- */
const HELP_DESK: ZoneBlueprint = {
  id: 'help-desk',
  displayName: 'Help Desk',
  spawnPoint: new THREE.Vector3(0, 1.7, 8),
  spawnLookAt: new THREE.Vector3(0, 1.5, 0),

  build() {
    const g = new THREE.Group();
    g.name = 'zone:help-desk';
    const consoles: ConsoleAnchor[] = [];

    const mFloor = new THREE.MeshStandardMaterial({ color: '#e8eef4', roughness: 0.95 });
    const mWall = new THREE.MeshStandardMaterial({ color: '#f0f4f8', roughness: 0.9 });
    const mAccent = new THREE.MeshStandardMaterial({
      color: '#4ec9b0',
      roughness: 0.4,
      emissive: '#003d35',
      emissiveIntensity: 0.4,
    });
    const mDesk = new THREE.MeshStandardMaterial({ color: '#d0d8e4', roughness: 0.7 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    for (const [x, z, rw, rh, rd] of [
      [0, -10, 20, 4, 0.3],
      [-10, 0, 0.3, 4, 20],
      [10, 0, 0.3, 4, 20],
    ] as [number, number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mWall);
      wall.position.set(x, 2, z);
      wall.receiveShadow = true;
      g.add(wall);
    }

    const sign = props.makeWallSign('HELP DESK', 4, 0.6, '#4ec9b0', '#0e1116');
    sign.position.set(0, 3.5, -9.9);
    g.add(sign);

    // Service counter (L-shaped)
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4, 0.08, 1.2), mDesk);
    counterTop.position.set(0, 1.0, -3);
    counterTop.castShadow = true;
    g.add(counterTop);
    for (const [x, z] of [
      [-1.8, -3],
      [1.8, -3],
      [0, -3],
    ] as [number, number][]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), mAccent);
      leg.position.set(x, 0.5, z);
      g.add(leg);
    }

    // Monitor on counter
    const screen = props.makeLockScreenMonitor(1.4, 0.9);
    screen.position.set(0, 1.04, -3.55);
    g.add(screen);

    // Service bell
    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.06, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.3, metalness: 0.8 }),
    );
    bell.position.set(1.5, 1.09, -3.3);
    g.add(bell);

    // No 3D-scene console anchors — all consoles opened from VM Desktop via workstation.

    // Fluorescent light strip
    const fluoStrip = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.06, 0.3),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 0.6,
      }),
    );
    fluoStrip.position.set(0, 3.9, -3);
    g.add(fluoStrip);
    const fluoLight = new THREE.PointLight(0xffffff, 0.5, 8);
    fluoLight.position.set(0, 3.5, -3);
    g.add(fluoLight);

    // Ergonomic chair
    g.add(
      props.makeChair(
        'office',
        new THREE.MeshStandardMaterial({ color: '#4ec9b0', roughness: 0.8 }),
      ),
    );
    g.children[g.children.length - 1]!.position.set(0, 0, -1.5);
    g.children[g.children.length - 1]!.rotation.y = Math.PI; // face the monitor, not away from it

    // Plants
    g.add(props.makePlant('fern'));
    g.children[g.children.length - 1]!.position.set(-8, 0, 3);
    g.add(props.makePlant('fern'));
    g.children[g.children.length - 1]!.position.set(8, 0, 3);

    // Help desk workstation (clickable)
    const hdWs = props.makeWorkstation('Help Desk — service console');
    hdWs.position.set(0, 0, 3);
    hdWs.rotation.y = 0; // face the player (player spawns at +z)
    g.add(hdWs);

    return { group: g, consoles };
  },
};

/* -------------------------------------------------------------------------- */
/* Finance — executive office.                                                  */
/* Dark wood, leather chair, filing cabinet, FY report on wall.                */
/* -------------------------------------------------------------------------- */
const FINANCE: ZoneBlueprint = {
  id: 'finance',
  displayName: 'Finance',
  spawnPoint: new THREE.Vector3(0, 1.7, 8),
  spawnLookAt: new THREE.Vector3(0, 1.5, 0),

  build() {
    const g = new THREE.Group();
    g.name = 'zone:finance';
    const consoles: ConsoleAnchor[] = [];

    const mFloor = new THREE.MeshStandardMaterial({ color: '#3b2e1e', roughness: 0.9 });
    const mWall = new THREE.MeshStandardMaterial({ color: '#4a3828', roughness: 0.9 });
    const _mAccent = new THREE.MeshStandardMaterial({
      color: '#c9a96e',
      roughness: 0.3,
      emissive: '#3d2e10',
      emissiveIntensity: 0.3,
    });
    const mDesk = new THREE.MeshStandardMaterial({
      color: '#5c3d28',
      roughness: 0.8,
      metalness: 0.1,
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    for (const [x, z, rw, rh, rd] of [
      [0, -10, 20, 4, 0.3],
      [-10, 0, 0.3, 4, 20],
      [10, 0, 0.3, 4, 20],
    ] as [number, number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mWall);
      wall.position.set(x, 2, z);
      wall.receiveShadow = true;
      g.add(wall);
    }

    const sign = props.makeWallSign('FINANCE', 4, 0.6, '#c9a96e', '#2d1f10');
    sign.position.set(0, 3.5, -9.9);
    g.add(sign);

    // Large executive desk
    const execDesk = props.makeDesk(3.2, 0.9, 1.6, mDesk);
    execDesk.position.set(0, 0, -3);
    g.add(execDesk);
    const execScreen = props.makeLockScreenMonitor(1.4, 0.9);
    execScreen.position.set(0, 0.9, -3.75);
    g.add(execScreen);

    // Filing cabinet
    for (let i = 0; i < 3; i++) {
      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.7, 0.5),
        new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.8, metalness: 0.3 }),
      );
      cab.position.set(7, 0.35 + i * 0.75, -7);
      cab.castShadow = true;
      g.add(cab);
    }

    // FY report frame (back wall)
    const reportFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.5, 0.05),
      new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.3, metalness: 0.5 }),
    );
    reportFrame.position.set(-4, 2.2, -9.85);
    g.add(reportFrame);
    const reportContent = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.2, 0.02),
      new THREE.MeshStandardMaterial({ color: '#f0f0e8', roughness: 0.3 }),
    );
    reportContent.position.set(-4, 2.2, -9.83);
    g.add(reportContent);

    // Executive leather chair
    g.add(
      props.makeChair(
        'executive',
        new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.6, metalness: 0.3 }),
      ),
    );
    g.children[g.children.length - 1]!.position.set(0, 0, -1.5);
    g.children[g.children.length - 1]!.rotation.y = Math.PI; // face the monitor, not away from it

    // Low-angle lamp light
    const lampLight = new THREE.PointLight(0xffb060, 0.5, 8);
    lampLight.position.set(-4, 2.5, -3);
    g.add(lampLight);

    g.add(props.makePlant('tree'));
    g.children[g.children.length - 1]!.position.set(7, 0, -3);

    return { group: g, consoles };
  },
};

/* -------------------------------------------------------------------------- */
/* Engineering — workshop.                                                     */
/* Cool blue lighting, dual monitors, standing desks, whiteboards.             */
/* -------------------------------------------------------------------------- */
const ENGINEERING: ZoneBlueprint = {
  id: 'engineering',
  displayName: 'Engineering',
  spawnPoint: new THREE.Vector3(0, 1.7, 8),
  spawnLookAt: new THREE.Vector3(0, 1.5, 0),

  build() {
    const g = new THREE.Group();
    g.name = 'zone:engineering';
    const consoles: ConsoleAnchor[] = [];

    const mFloor = new THREE.MeshStandardMaterial({ color: '#1a2030', roughness: 0.95 });
    const mWall = new THREE.MeshStandardMaterial({ color: '#232840', roughness: 0.9 });
    const _mAccent = new THREE.MeshStandardMaterial({
      color: '#90b8ff',
      roughness: 0.4,
      emissive: '#001a40',
      emissiveIntensity: 0.5,
    });
    const mDesk = new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.7 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    // Cool blue accent strip on floor
    const strip = props.makeFloorStrip(14, 0.1, '#90b8ff');
    strip.position.set(0, 0.005, -3);
    g.add(strip);

    for (const [x, z, rw, rh, rd] of [
      [0, -10, 20, 4, 0.3],
      [-10, 0, 0.3, 4, 20],
      [10, 0, 0.3, 4, 20],
    ] as [number, number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mWall);
      wall.position.set(x, 2, z);
      wall.receiveShadow = true;
      g.add(wall);
    }

    const sign = props.makeWallSign('DEV CORNER', 4, 0.6, '#90b8ff', '#0e1116');
    sign.position.set(0, 3.5, -9.9);
    g.add(sign);

    // Dual-monitor engineering workstation
    const desk = props.makeDesk(2.6, 0.9, 1.2, mDesk);
    desk.position.set(0, 0, -3);
    g.add(desk);
    for (const mx of [-0.5, 0.5]) {
      const mon = props.makeLockScreenMonitor(0.9, 0.7);
      mon.position.set(mx, 0.9, -3.45);
      g.add(mon);
    }

    g.add(
      props.makeChair(
        'office',
        new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.8 }),
      ),
    );
    g.children[g.children.length - 1]!.position.set(0, 0, -1.6);
    g.children[g.children.length - 1]!.rotation.y = Math.PI; // face the monitor, not away from it

    // No 3D-scene console anchors — all consoles opened from VM Desktop via workstation.

    // Engineering whiteboard
    const wb = props.makeWhiteboard(
      4,
      2.0,
      new THREE.MeshStandardMaterial({ color: '#f0f4f8', roughness: 0.3 }),
    );
    wb.position.set(0, 0, -9.9);
    wb.children.forEach((c) => {
      c.castShadow = true;
    });
    g.add(wb);

    // Cool blue light
    const blueLight = new THREE.PointLight(0x90b8ff, 0.6, 10);
    blueLight.position.set(0, 3.5, -3);
    g.add(blueLight);

    // Water cooler
    const coolerBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.2, 0.4),
      new THREE.MeshStandardMaterial({ color: '#c0c8d4', roughness: 0.5, metalness: 0.3 }),
    );
    coolerBody.position.set(-7, 0.6, 0);
    coolerBody.castShadow = true;
    g.add(coolerBody);
    const coolerBottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8),
      new THREE.MeshStandardMaterial({
        color: '#a0d8ef',
        roughness: 0.3,
        transparent: true,
        opacity: 0.6,
      }),
    );
    coolerBottle.position.set(-7, 1.7, 0);
    g.add(coolerBottle);

    g.add(props.makePlant('cactus'));
    g.children[g.children.length - 1]!.position.set(8, 0, 3);

    // Engineering workstation (clickable)
    const engWs = props.makeWorkstation('Engineering — dev corner');
    engWs.position.set(0, 0, 3);
    engWs.rotation.y = 0;
    g.add(engWs);

    return { group: g, consoles };
  },
};

/* -------------------------------------------------------------------------- */
/* App Center — application showcase.                                           */
/* Dark showcase floor, accent strips, 4 kiosk monitors, pedestal.             */
/* -------------------------------------------------------------------------- */
const APP_CENTER: ZoneBlueprint = {
  id: 'app-center',
  displayName: 'Application Center',
  spawnPoint: new THREE.Vector3(0, 1.7, 8),
  spawnLookAt: new THREE.Vector3(0, 1.5, 0),

  build() {
    const g = new THREE.Group();
    g.name = 'zone:app-center';
    const consoles: ConsoleAnchor[] = [];

    const mFloor = new THREE.MeshStandardMaterial({ color: '#0e1820', roughness: 0.95 });
    const mWall = new THREE.MeshStandardMaterial({ color: '#141c24', roughness: 0.9 });
    const mAccent = new THREE.MeshStandardMaterial({
      color: '#4ec9b0',
      roughness: 0.3,
      emissive: '#003d35',
      emissiveIntensity: 0.7,
    });
    const mDesk = new THREE.MeshStandardMaterial({
      color: '#1a2030',
      roughness: 0.7,
      metalness: 0.3,
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    // Floor accent strips
    for (const x of [-4, 0, 4]) {
      const s = props.makeFloorStrip(18, 0.12, '#4ec9b0');
      s.position.set(x, 0.005, 0);
      g.add(s);
    }

    for (const [x, z, rw, rh, rd] of [
      [0, -10, 20, 4, 0.3],
      [-10, 0, 0.3, 4, 20],
      [10, 0, 0.3, 4, 20],
    ] as [number, number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mWall);
      wall.position.set(x, 2, z);
      wall.receiveShadow = true;
      g.add(wall);
    }

    const sign = props.makeWallSign('APP CENTER', 5, 0.6, '#4ec9b0', '#0e1116');
    sign.position.set(0, 3.5, -9.9);
    g.add(sign);

    // Central pedestal
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 1.0, 12), mDesk);
    pedestal.position.set(0, 0.5, -3);
    pedestal.castShadow = true;
    g.add(pedestal);
    const pedestalTop = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 12), mAccent);
    pedestalTop.position.set(0, 1.05, -3);
    g.add(pedestalTop);

    // 4 kiosk monitors in a row
    for (let i = 0; i < 4; i++) {
      const kx = -4.5 + i * 3;
      const kStand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), mAccent);
      kStand.position.set(kx, 0.4, -6);
      g.add(kStand);
      const kScreen = props.makeLockScreenMonitor(0.9, 0.7);
      kScreen.position.set(kx, 0.8, -6.35);
      g.add(kScreen);
      const kBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), mAccent);
      kBase.position.set(kx, 0.03, -6);
      g.add(kBase);
    }

    // No 3D-scene console anchors — all consoles opened from VM Desktop via workstation.

    // Showcase lighting
    const showcaseLight = new THREE.PointLight(0x4ec9b0, 0.8, 12);
    showcaseLight.position.set(0, 4, -3);
    g.add(showcaseLight);

    // Plants
    g.add(props.makePlant('fern'));
    g.children[g.children.length - 1]!.position.set(-8, 0, 4);
    g.add(props.makePlant('fern'));
    g.children[g.children.length - 1]!.position.set(8, 0, 4);

    return { group: g, consoles };
  },
};

/* -------------------------------------------------------------------------- */
/* Reception — lobby.                                                          */
/* Polished warm floor, reception desk, welcome sign, bench, polished.        */
/* -------------------------------------------------------------------------- */
const RECEPTION: ZoneBlueprint = {
  id: 'reception',
  displayName: 'Reception',
  spawnPoint: new THREE.Vector3(0, 1.7, 8),
  spawnLookAt: new THREE.Vector3(0, 1.5, 0),

  build() {
    const g = new THREE.Group();
    g.name = 'zone:reception';
    const consoles: ConsoleAnchor[] = [];

    const mFloor = new THREE.MeshStandardMaterial({ color: '#e8dcc8', roughness: 0.7 });
    const mWall = new THREE.MeshStandardMaterial({ color: '#f0e8d8', roughness: 0.9 });
    const _mAccent = new THREE.MeshStandardMaterial({
      color: '#c9a96e',
      roughness: 0.3,
      emissive: '#3d2e10',
      emissiveIntensity: 0.3,
    });
    const mDesk = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.8 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    for (const [x, z, rw, rh, rd] of [
      [0, -10, 20, 4, 0.3],
      [-10, 0, 0.3, 4, 20],
      [10, 0, 0.3, 4, 20],
    ] as [number, number, number, number, number][]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mWall);
      wall.position.set(x, 2, z);
      wall.receiveShadow = true;
      g.add(wall);
    }

    // Welcome sign
    const welcomeSign = props.makeWallSign('APEX IDENTITY SOLUTIONS', 7, 0.8, '#c9a96e', '#2d1f10');
    welcomeSign.position.set(0, 3.2, -9.85);
    g.add(welcomeSign);

    // Reception desk
    const rdesk = props.makeReceptionDesk(3.5, 1.1, 1.2, mDesk);
    rdesk.position.set(0, 0, -3);
    g.add(rdesk);

    // Nameplate
    const np = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.15, 0.04),
      new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.3, metalness: 0.5 }),
    );
    np.position.set(0, 0.95, -2.3);
    g.add(np);

    // Bench seating
    g.add(
      props.makeChair(
        'bench',
        new THREE.MeshStandardMaterial({ color: '#8b7355', roughness: 0.9 }),
      ),
    );
    g.children[g.children.length - 1]!.position.set(0, 0, 2);
    g.add(
      props.makeChair(
        'bench',
        new THREE.MeshStandardMaterial({ color: '#8b7355', roughness: 0.9 }),
      ),
    );
    g.children[g.children.length - 1]!.position.set(-5, 0, 2);
    g.add(
      props.makeChair(
        'bench',
        new THREE.MeshStandardMaterial({ color: '#8b7355', roughness: 0.9 }),
      ),
    );
    g.children[g.children.length - 1]!.position.set(5, 0, 2);

    // Warm recessed lighting
    const warmLight = new THREE.PointLight(0xffe8a0, 0.4, 10);
    warmLight.position.set(0, 3.5, -3);
    g.add(warmLight);

    // Plants flanking entrance
    g.add(props.makePlant('tree'));
    g.children[g.children.length - 1]!.position.set(-8, 0, 6);
    g.add(props.makePlant('tree'));
    g.children[g.children.length - 1]!.position.set(8, 0, 6);
    g.add(props.makePlant('fern'));
    g.children[g.children.length - 1]!.position.set(-8, 0, -6);
    g.add(props.makePlant('fern'));
    g.children[g.children.length - 1]!.position.set(8, 0, -6);

    return { group: g, consoles };
  },
};

/* -------------------------------------------------------------------------- */
/* Registry                                                                   */
/* -------------------------------------------------------------------------- */
export const ZONE_BLUEPRINTS: Record<ZoneId, ZoneBlueprint> = {
  'iam-ops': IAM_OPS,
  'sec-ops': SEC_OPS,
  hr: HR,
  'help-desk': HELP_DESK,
  finance: FINANCE,
  engineering: ENGINEERING,
  'app-center': APP_CENTER,
  reception: RECEPTION,
};

export const listZones = (): ZoneId[] => Object.keys(ZONE_BLUEPRINTS) as ZoneId[];
