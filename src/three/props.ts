/**
 * three/props.ts — shared low-poly geometry helpers.
 *
 * All helpers return a THREE.Group so they can be positioned and added to a
 * zone group with a single .add() call. Geometry and materials are
 * created fresh each call — the caller can share them across instances if
 * they want to batch-dispose efficiently.
 */
import * as THREE from 'three';

/** A simple box-based desk with legs and optional screen. */
export function makeDesk(
  w = 2.4, h = 0.9, d = 1.2,
  deskMat?: THREE.Material,
  legMat?: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const dm = deskMat ?? new THREE.MeshStandardMaterial({ color: '#3b3f48', roughness: 0.7 });
  const lm = legMat  ?? new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.9 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), dm);
  top.position.y = h - 0.03;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  // 4 legs
  const legH = h - 0.06;
  const lw = 0.06, ld = 0.06;
  const ox = w / 2 - 0.1, oz = d / 2 - 0.1;
  for (const [lx, lz] of [[-ox, -oz], [ox, -oz], [-ox, oz], [ox, oz]] as [number, number][]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(lw, legH, ld), lm);
    leg.position.set(lx, legH / 2, lz);
    leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

/** A monitor (screen + stand). `onMat` is the emissive (powered-on) screen material. */
export function makeMonitor(
  w = 1.4, h = 0.9,
  onMat?: THREE.MeshStandardMaterial,
): THREE.Group {
  const g = new THREE.Group();
  const smOn  = onMat  ?? new THREE.MeshStandardMaterial({ color: '#001a14', emissive: '#4ec9b0', emissiveIntensity: 0.9 });
  const bmMat = new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.8 });

  const screen = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), smOn);
  screen.position.y = h / 2 + 0.08;
  screen.castShadow = true;
  g.add(screen);

  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.3), bmMat);
  stand.position.set(0, 0.03, 0);
  g.add(stand);

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), bmMat);
  post.position.set(0, 0.08, 0);
  g.add(post);

  return g;
}

/** A server rack unit with LED status lights. */
export function makeServerRack(
  w = 1.2, h = 2.4, d = 0.8,
  rackMat?: THREE.Material,
  ledColors: string[] = ['#4ec9b0', '#0d1014', '#4ec9b0', '#0d1014'],
): THREE.Group {
  const g = new THREE.Group();
  const rm = rackMat ?? new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.5, metalness: 0.4 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rm);
  body.position.y = h / 2;
  body.castShadow = true;
  g.add(body);

  for (let i = 0; i < ledColors.length; i++) {
    const ledMat = new THREE.MeshStandardMaterial({
      color: ledColors[i],
      emissive: ledColors[i],
      emissiveIntensity: ledColors[i] === '#0d1014' ? 0 : 1.2,
    });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.02), ledMat);
    led.position.set(0, 0.5 + i * 0.45, d / 2 + 0.01);
    g.add(led);
  }

  // Ventilation grill
  const grillMat = new THREE.MeshStandardMaterial({ color: '#141720', roughness: 0.8 });
  const grill = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.4, 0.01), grillMat);
  grill.position.set(0, h * 0.3, d / 2 + 0.01);
  g.add(grill);

  return g;
}

/** A wall-mounted sign with text drawn on a CanvasTexture. */
export function makeWallSign(
  text: string,
  w = 3,
  h = 0.8,
  bgColor = '#4ec9b0',
  fgColor = '#0e1116',
): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = fgColor;
  ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  return mesh;
}

/** A low-poly plant (fern-style). */
export function makePlant(
  kind: 'fern' | 'cactus' | 'tree' = 'fern',
  potMat?: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const pm = potMat ?? new THREE.MeshStandardMaterial({ color: '#4a3728', roughness: 0.9 });

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.2, 8), pm);
  pot.position.y = 0.1;
  g.add(pot);

  if (kind === 'fern') {
    const fm = new THREE.MeshStandardMaterial({ color: '#2d6a4f', roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.02), fm);
      const angle = (i / 8) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.12, 0.4, Math.sin(angle) * 0.12);
      leaf.rotation.z = Math.cos(angle) * 0.5;
      leaf.rotation.x = Math.sin(angle) * 0.3;
      g.add(leaf);
    }
  } else if (kind === 'cactus') {
    const cm = new THREE.MeshStandardMaterial({ color: '#40916c', roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8), cm);
    trunk.position.y = 0.35;
    g.add(trunk);
    for (const side of [-0.12, 0.12]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), cm);
      arm.position.set(side, 0.35, 0);
      arm.rotation.z = side > 0 ? -0.6 : 0.6;
      g.add(arm);
    }
  } else {
    const tm = new THREE.MeshStandardMaterial({ color: '#1b4332', roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 6), tm);
    trunk.position.y = 0.25;
    g.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), tm);
    crown.position.y = 0.65;
    g.add(crown);
  }

  return g;
}

/** An office or bench chair. */
export function makeChair(
  style: 'office' | 'executive' | 'bench' = 'office',
  mat?: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const cm = mat ?? new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.8 });

  if (style === 'bench') {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.5), cm);
    seat.position.y = 0.5;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), cm);
    back.position.set(0, 0.8, -0.25);
    g.add(back);
    for (const x of [-0.6, 0.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), cm);
      leg.position.set(x, 0.25, 0);
      g.add(leg);
    }
  } else {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), cm);
    seat.position.y = 0.5;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.06), cm);
    back.position.set(0, 0.8, -0.28);
    g.add(back);
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]] as [number, number][]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), cm);
      leg.position.set(x, 0.25, z);
      g.add(leg);
    }
  }
  return g;
}

/** A ceiling light panel. */
export function makeCeilingLight(
  w = 1.2, d = 0.4, warm = false,
): { mesh: THREE.Mesh; light: THREE.PointLight } {
  const color = warm ? 0xffd9a0 : 0xffffff;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.06, d),
    new THREE.MeshStandardMaterial({
      color: '#e0e0e0',
      emissive: color,
      emissiveIntensity: 0.5,
      roughness: 0.3,
    }),
  );
  const light = new THREE.PointLight(color, 0.8, 6);
  return { mesh, light };
}

/** A whiteboard panel on a stand. */
export function makeWhiteboard(
  w = 3, h = 1.8,
  mat?: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const wm = mat ?? new THREE.MeshStandardMaterial({ color: '#f0f4f8', roughness: 0.3 });
  const fm = new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.9 });

  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), wm);
  board.position.y = h / 2 + 0.8;
  board.castShadow = true;
  g.add(board);

  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, h + 0.8, 0.06), fm);
    post.position.set(x, (h + 0.8) / 2, 0);
    post.castShadow = true;
    g.add(post);
  }
  return g;
}

/** A floor accent strip (emissive teal line). */
export function makeFloorStrip(
  length = 8, width = 0.08,
  color = '#4ec9b0',
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.01, width),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.3 }),
  );
}

/** A reception desk with a nameplate. */
export function makeReceptionDesk(
  w = 3, h = 1.1, d = 1,
  deskMat?: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const dm = deskMat ?? new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.8 });
  const bm = new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.9 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), dm);
  top.position.y = h - 0.04;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  // Counter front panel
  const front = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.08, 0.06), dm);
  front.position.set(0, (h - 0.08) / 2, d / 2);
  g.add(front);

  // Legs
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, h - 0.08, d - 0.12), bm);
    leg.position.set(x, (h - 0.08) / 2, 0);
    g.add(leg);
  }

  // Nameplate
  const np = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.15, 0.04),
    new THREE.MeshStandardMaterial({ color: '#c9a96e', roughness: 0.3, metalness: 0.5 }),
  );
  np.position.set(0, 0.9, d / 2 + 0.03);
  g.add(np);

  return g;
}

/**
 * A full computer workstation: desk with dual monitors, keyboard, and mouse.
 * The monitor group is tagged with `userData.interactable = 'workstation'` so
 * the engine raycaster can detect a click and open the desktop overlay.
 *
 * Layout (looking down at the desk from above):
 *
 *   [monitor L]   [monitor R]    <- both at the back of the desk
 *   [    keyboard + mouse    ]   <- in the middle
 *   [ desk surface (1.8 x 1.0) ]  <- at the front
 */
export function makeWorkstation(
  screenLabel = 'APEX OS — sign in to begin',
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'workstation';

  // Materials
  const mDeskTop = new THREE.MeshStandardMaterial({ color: '#2d2a26', roughness: 0.7 });
  const mEdge    = new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.5, metalness: 0.4 });
  const mBezel   = new THREE.MeshStandardMaterial({ color: '#0d1014', roughness: 0.4 });
  const mKb      = new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.5, metalness: 0.3 });
  const mKey     = new THREE.MeshStandardMaterial({ color: '#2d343d', roughness: 0.6 });
  const mMouse   = new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.4, metalness: 0.2 });

  // ---- Screen content texture (shared by both monitors) ----
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512;
  screenCanvas.height = 320;
  const sctx = screenCanvas.getContext('2d')!;
  sctx.fillStyle = '#0a3a32';
  sctx.fillRect(0, 0, 512, 320);
  // Taskbar band
  sctx.fillStyle = '#1b1f24';
  sctx.fillRect(0, 296, 512, 24);
  // Apex logo tile
  sctx.fillStyle = '#4ec9b0';
  sctx.fillRect(20, 20, 60, 60);
  sctx.fillStyle = '#0e1116';
  sctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  sctx.fillText('A', 50, 50);
  // Title text
  sctx.fillStyle = '#e6e6e6';
  sctx.textAlign = 'left';
  sctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
  sctx.fillText('APEX IDENTITY', 100, 36);
  sctx.fillStyle = '#8b95a1';
  sctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  sctx.fillText(screenLabel, 100, 62);
  // Status tiles
  for (let i = 0; i < 3; i++) {
    sctx.fillStyle = '#232830';
    sctx.fillRect(20 + i * 160, 110, 140, 80);
    sctx.strokeStyle = '#4ec9b0';
    sctx.lineWidth = 2;
    sctx.strokeRect(20 + i * 160, 110, 140, 80);
    sctx.fillStyle = '#4ec9b0';
    sctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
    sctx.fillText(['USERS', 'APPS', 'EVENTS'][i] ?? '', 30 + i * 160, 130);
    sctx.fillStyle = '#e6e6e6';
    sctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    sctx.fillText(String([42, 12, 1287][i] ?? 0), 30 + i * 160, 168);
  }
  // Login prompt
  sctx.fillStyle = '#232830';
  sctx.fillRect(20, 210, 472, 70);
  sctx.fillStyle = '#8b95a1';
  sctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  sctx.fillText('Click to open workstation', 36, 250);
  sctx.fillStyle = '#4ec9b0';
  sctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  sctx.fillText('› workstation', 36, 270);
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  const mScreenWithTex = new THREE.MeshStandardMaterial({
    map: screenTex,
    emissive: '#4ec9b0',
    emissiveIntensity: 0.5,
  });

  // ---- Desk top ----
  const deskW = 1.8, deskD = 1.0, deskH = 0.04;
  const desk = new THREE.Mesh(new THREE.BoxGeometry(deskW, deskH, deskD), mDeskTop);
  desk.position.set(0, 0.75, 0);
  desk.castShadow = true;
  desk.receiveShadow = true;
  g.add(desk);

  // Desk edge trim
  const trim = new THREE.Mesh(new THREE.BoxGeometry(deskW + 0.02, 0.01, deskD + 0.02), mEdge);
  trim.position.set(0, 0.77, 0);
  g.add(trim);

  // Desk legs
  const legH = 0.72;
  for (const [lx, lz] of [
    [-deskW / 2 + 0.08, -deskD / 2 + 0.08],
    [ deskW / 2 - 0.08, -deskD / 2 + 0.08],
    [-deskW / 2 + 0.08,  deskD / 2 - 0.08],
    [ deskW / 2 - 0.08,  deskD / 2 - 0.08],
  ] as [number, number][]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, legH, 0.06), mEdge);
    leg.position.set(lx, legH / 2, lz);
    leg.castShadow = true;
    g.add(leg);
  }

  // ---- Monitor group (the interactable) ----
  const monitorGroup = new THREE.Group();
  monitorGroup.name = 'workstation-monitor';
  monitorGroup.userData.interactable = 'workstation';

  // Two monitors side by side
  const monW = 0.55, monH = 0.35;
  for (const mx of [-0.32, 0.32]) {
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(monW + 0.04, monH + 0.04, 0.02), mBezel);
    bezel.position.set(mx, 1.20, -0.42);
    bezel.castShadow = true;
    monitorGroup.add(bezel);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(monW, monH), mScreenWithTex);
    face.position.set(mx, 1.20, -0.41);
    monitorGroup.add(face);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.08), mEdge);
    stand.position.set(mx, 1.02, -0.42);
    monitorGroup.add(stand);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), mEdge);
    post.position.set(mx, 1.10, -0.42);
    monitorGroup.add(post);
  }
  g.add(monitorGroup);

  // ---- Keyboard ----
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.16), mKb);
  kb.position.set(0, 0.78, 0.05);
  kb.castShadow = true;
  g.add(kb);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 10; c++) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 0.025), mKey);
      key.position.set(-0.21 + c * 0.046, 0.795, 0.00 + r * 0.03);
      g.add(key);
    }
  }

  // ---- Mouse ----
  const mouseBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.10), mMouse);
  mouseBody.position.set(0.30, 0.785, 0.05);
  mouseBody.castShadow = true;
  g.add(mouseBody);

  return g;
}
