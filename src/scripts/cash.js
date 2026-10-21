// Three piles of real money: each figure laid out in euro banknotes and coins, counted to the cent.
// The notes are Quant's own drawings with the colours, sizes and values of the Europa series, not the
// official artwork, so they stay within the ECB rules on reproducing banknotes. Loaded on demand.
import {
  BoxGeometry, CanvasTexture, CylinderGeometry, DirectionalLight, HemisphereLight,
  InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, NeutralToneMapping, Object3D, PCFSoftShadowMap, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, Scene, ShadowMaterial, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const MM = 0.01; // world units per millimetre
const T = 0.0045; // drawn thickness of one note (thicker than paper, so a stack reads as a stack)
const HAND = 100; // notes in a bank bundle
const MAX_BUNDLES = 6; // per pile; beyond this the label still carries the exact figure
const COIN_SCALE = 1.35;
const FONT = '"Jost Variable", Jost, system-ui, sans-serif';

// Europa series: value, size in mm and colour family
const NOTES = [
  { v: 200, w: 153, h: 77, paper: '#f3e2ad', base: '#d7b257', deep: '#6b4e10', ink: '#3f2e07' },
  { v: 100, w: 147, h: 77, paper: '#d6eacf', base: '#7fbb85', deep: '#2a663a', ink: '#173d22' },
  { v: 50, w: 140, h: 77, paper: '#f9dbb6', base: '#e9964a', deep: '#8f440c', ink: '#5a2a06' },
  { v: 20, w: 133, h: 72, paper: '#d2def2', base: '#6b95cf', deep: '#22468a', ink: '#132b56' },
  { v: 10, w: 127, h: 67, paper: '#f6d3c9', base: '#d5705c', deep: '#882820', ink: '#561813' },
  { v: 5, w: 120, h: 62, paper: '#e0e5df', base: '#98a69e', deep: '#44524b', ink: '#29332e' },
];
// Coins: value in cents, diameter and thickness in mm, metals for the ring and the core
const COINS = [
  { c: 200, d: 25.75, t: 2.2, ring: 'silver', core: 'gold', label: '2', unit: 'EURO' },
  { c: 100, d: 23.25, t: 2.33, ring: 'gold', core: 'silver', label: '1', unit: 'EURO' },
  { c: 50, d: 24.25, t: 2.38, ring: 'gold', core: 'gold', label: '50', unit: 'CENT' },
  { c: 20, d: 22.25, t: 2.14, ring: 'gold', core: 'gold', label: '20', unit: 'CENT' },
  { c: 10, d: 19.75, t: 1.93, ring: 'gold', core: 'gold', label: '10', unit: 'CENT' },
  { c: 5, d: 21.25, t: 1.67, ring: 'copper', core: 'copper', label: '5', unit: 'CENT' },
  { c: 2, d: 18.75, t: 1.67, ring: 'copper', core: 'copper', label: '2', unit: 'CENT' },
  { c: 1, d: 16.25, t: 1.67, ring: 'copper', core: 'copper', label: '1', unit: 'CENT' },
];
const METAL = { gold: ['#ecd27e', '#b48a35'], silver: ['#eceef0', '#9ea3a9'], copper: ['#e0956a', '#93522c'] };

// ---------- Counting ----------

export function breakdown(amount) {
  let cents = Math.round(Math.min(Math.max(0, +amount || 0), 1e8) * 100);
  const notes = NOTES.map((d) => { const n = Math.floor(cents / (d.v * 100)); cents -= n * d.v * 100; return n; });
  const coins = COINS.map((k) => { const n = Math.floor(cents / k.c); cents -= n * k.c; return n; });
  const hands = Math.floor(notes[0] / HAND);
  notes[0] -= hands * HAND;
  return { bundles: Math.min(MAX_BUNDLES, hands), notes, coins };
}

// Seeded random, so a pile keeps the same little disorder every time it is laid out
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One pile in its own coordinates: bundles at the bottom, loose notes from the largest value up, each value
// shifted back and to the right so the top edge of every note (value and "EURO") stays in sight, coins in front.
function pileLayout(amount, pile) {
  const b = breakdown(amount);
  const r = rng(pile * 9973 + 17);
  const slots = [];
  const big = NOTES[0];
  const bt = HAND * T;
  for (let k = 0; k < b.bundles; k++) {
    const col = Math.floor(k / 3);
    slots.push({ key: 'bundle', x: col * (big.w * MM + 0.06) + (big.w * MM) / 2, y: (k % 3) * bt + bt / 2, z: (big.h * MM) / 2, ry: (r() - 0.5) * 0.04, hw: (big.w * MM) / 2, hd: (big.h * MM) / 2 });
  }
  let y = Math.min(3, b.bundles) * bt;
  let group = 0;
  NOTES.forEach((d, di) => {
    const n = b.notes[di];
    if (!n) return;
    const w = d.w * MM;
    const h = d.h * MM;
    // On top of a bundle, loose notes sit forward and to the right, so its band stays readable
    const ax = group * 0.1 + (b.bundles ? 0.55 : 0);
    const az = group * 0.21 + (b.bundles ? 0.3 : 0);
    const step = Math.min(0.012, 0.18 / n);
    for (let j = 0; j < n; j++) {
      slots.push({
        key: `note${di}`,
        x: ax + w / 2 + j * step + (r() - 0.5) * 0.02,
        y: y + (j + 0.5) * T,
        z: az + h / 2 + j * step * 0.5 + (r() - 0.5) * 0.02,
        ry: (r() - 0.5) * 0.07,
        hw: w / 2, hd: h / 2,
      });
    }
    y += n * T;
    group++;
  });
  const front = slots.reduce((m, s) => Math.max(m, s.z + s.hd), 0);
  let cx = 0.04;
  COINS.forEach((k, ci) => {
    const n = b.coins[ci];
    if (!n) return;
    const rad = (k.d * MM * COIN_SCALE) / 2;
    const th = k.t * MM * 1.6;
    for (let j = 0; j < n; j++) {
      slots.push({ key: `coin${ci}`, x: cx + rad + (r() - 0.5) * 0.015, y: (j + 0.5) * th, z: front + 0.1 + rad + (r() - 0.5) * 0.015, ry: r() * Math.PI * 2, hw: rad, hd: rad });
    }
    cx += rad * 2 + 0.05;
  });
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, top = 0;
  for (const s of slots) {
    minX = Math.min(minX, s.x - s.hw); maxX = Math.max(maxX, s.x + s.hw);
    minZ = Math.min(minZ, s.z - s.hd); maxZ = Math.max(maxZ, s.z + s.hd);
    top = Math.max(top, s.y);
  }
  if (!slots.length) { minX = 0; maxX = 1; minZ = 0; maxZ = 0.6; }
  return { slots, minX, maxX, minZ, maxZ, top };
}

// ---------- Drawing (our own artwork, never the ECB's) ----------

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function guilloche(g, W, H, color, rows, amp, seed) {
  g.strokeStyle = color;
  g.lineWidth = 1.1;
  for (let k = 0; k < rows; k++) {
    g.beginPath();
    for (let x = 0; x <= W; x += 5) {
      const y = (k / (rows - 1)) * H + Math.sin(x / 34 + k * 0.62 + seed) * amp + Math.sin(x / 97 + k * 1.3) * amp * 0.6;
      if (x) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
  }
}

function rosette(g, cx, cy, R, color) {
  g.strokeStyle = color;
  g.lineWidth = 1.3;
  for (let ring = 0; ring < 3; ring++) {
    const rr = R * (1 - ring * 0.2);
    const k = 9 + ring * 3;
    for (let s = 0; s < 5; s++) {
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.001; a += 0.01) {
        const rad = rr * (0.84 + 0.16 * Math.cos(k * a + s * 0.55));
        const x = cx + rad * Math.cos(a);
        const y = cy + rad * Math.sin(a);
        if (a) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
      g.stroke();
    }
  }
}

function drawNote(d, { back = false, band = null } = {}) {
  const W = back ? 384 : 768;
  const H = Math.round((W * d.h) / d.w);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  // Paper: a light watermark side on the left, the note's colour on the right
  const bg = g.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, d.paper);
  bg.addColorStop(back ? 0.5 : 0.28, d.paper);
  bg.addColorStop(back ? 0.75 : 0.44, d.base);
  bg.addColorStop(1, d.base);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.68, H * 0.5, H * 0.05, W * 0.68, H * 0.5, H);
  glow.addColorStop(0, 'rgba(255,255,255,0.3)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  guilloche(g, W, H, hexA(d.deep, 0.14), 30, 8, d.v);
  rosette(g, W * (back ? 0.5 : 0.66), H * 0.55, H * 0.31, hexA(d.deep, 0.4));
  g.fillStyle = hexA(d.deep, 0.5);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(H * 0.3)}px ${FONT}`;
  g.fillText('€', W * (back ? 0.5 : 0.66), H * 0.57);

  if (!back) {
    // Watermark window
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.beginPath();
    g.ellipse(W * 0.16, H * 0.56, W * 0.1, H * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hexA(d.deep, 0.1);
    g.font = `700 ${Math.round(H * 0.3)}px ${FONT}`;
    g.fillText(String(d.v), W * 0.16, H * 0.57);
    // Foil stripe with small values, the way a hologram band carries them
    const sx = W * 0.315;
    const sw = W * 0.05;
    const foil = g.createLinearGradient(0, 0, 0, H);
    ['#e6e9ee', '#cfdcec', '#efe2cf', '#d6eadf', '#e3d7ee', '#e6e9ee'].forEach((col, i, a) => foil.addColorStop(i / (a.length - 1), col));
    g.fillStyle = foil;
    g.fillRect(sx, 0, sw, H);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = `700 ${Math.round(H * 0.06)}px ${FONT}`;
    for (let y = H * 0.12; y < H; y += H * 0.16) g.fillText(String(d.v), sx + sw / 2, y);
  }

  // Top band: value on the left and EURO on the right. It stays visible when notes overlap.
  g.fillStyle = d.ink;
  g.textBaseline = 'top';
  g.textAlign = 'left';
  g.font = `700 ${Math.round(H * 0.23)}px ${FONT}`;
  g.fillText(String(d.v), W * 0.035, H * 0.035);
  g.textAlign = 'right';
  g.font = `600 ${Math.round(H * 0.095)}px ${FONT}`;
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(H * 0.012)}px`;
  g.fillText('EURO', W * 0.965, H * 0.07);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  // Big value bottom right
  g.textBaseline = 'alphabetic';
  g.fillStyle = d.deep;
  g.font = `700 ${Math.round(H * 0.4)}px ${FONT}`;
  g.fillText(String(d.v), W * 0.965, H * 0.93);
  // Microtext and frame: printed by Quant, plainly not a real note
  g.textAlign = 'left';
  g.fillStyle = hexA(d.ink, 0.45);
  g.font = `500 ${Math.round(H * 0.03)}px ${FONT}`;
  g.fillText('QUANT · '.repeat(48), W * 0.03, H * 0.975);
  g.strokeStyle = hexA(d.deep, 0.32);
  g.lineWidth = 2;
  g.strokeRect(W * 0.012, H * 0.02, W * 0.976, H * 0.96);

  if (band) {
    // Paper band of a bank bundle, kept on the left third so the loose notes on top never hide it
    const bx = W * 0.24;
    const bw = W * 0.12;
    g.fillStyle = '#f5f2ea';
    g.fillRect(bx, 0, bw, H);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.strokeRect(bx + 3, -2, bw - 6, H + 4);
    g.save();
    g.translate(bx + bw / 2, H * 0.34);
    g.rotate(-Math.PI / 2);
    g.fillStyle = '#2a2a26';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${Math.round(bw * 0.34)}px ${FONT}`;
    g.fillText(band, 0, 0);
    g.restore();
  }
  return c;
}

// Roughness in green, metalness in blue: paper everywhere, foil on the stripe
function drawNoteSurface(d) {
  const W = 256;
  const H = Math.round((W * d.h) / d.w);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(0,205,0)';
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgb(0,70,255)';
  g.fillRect(W * 0.315, 0, W * 0.05, H);
  return c;
}

function drawEdges(d, withBand) {
  const c = canvas(512, 64);
  const g = c.getContext('2d');
  g.fillStyle = d.paper;
  g.fillRect(0, 0, 512, 64);
  for (let y = 0; y < 64; y += 2) {
    g.fillStyle = hexA(d.deep, 0.08 + ((y / 2) % 3) * 0.04);
    g.fillRect(0, y, 512, 1);
  }
  if (withBand) {
    g.fillStyle = '#f5f2ea';
    g.fillRect(512 * 0.24, 0, 512 * 0.12, 64);
  }
  return c;
}

function drawCoin(k) {
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const disc = (r, [hi, lo]) => {
    const grad = g.createRadialGradient(S * 0.4, S * 0.38, r * 0.1, S / 2, S / 2, r);
    grad.addColorStop(0, hi);
    grad.addColorStop(1, lo);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    g.fill();
  };
  disc(S / 2, METAL[k.ring]);
  if (k.ring !== k.core) disc(S * 0.31, METAL[k.core]);
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(40,30,10,0.55)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(S * (k.label.length > 1 ? 0.3 : 0.38))}px ${FONT}`;
  g.fillText(k.label, S / 2, S * 0.46);
  g.font = `600 ${Math.round(S * 0.085)}px ${FONT}`;
  g.fillText(k.unit, S / 2, S * 0.7);
  return c;
}

// A note lies a little bowed, like paper does
function noteGeometry(w, h, t, bow) {
  const geo = new BoxGeometry(w, t, h, 12, 1, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2);
    pos.setY(i, pos.getY(i) + bow * (1 - x * x));
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- Scene ----------

export function mountCash(canvasEl, { reduced = false, labels = [] } = {}) {
  const renderer = new WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(max-width: 767px)').matches ? 1.5 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping; // keeps the notes' colours true
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.add(new HemisphereLight(0xffffff, 0x2a2a20, 0.45));
  const sun = new DirectionalLight(0xffffff, 2.1);
  sun.position.set(-4, 10, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  const ground = new Mesh(new PlaneGeometry(60, 60), new ShadowMaterial({ opacity: 0.3 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new PerspectiveCamera(30, 1, 0.1, 200);
  const disposables = [];
  const textures = [];
  const tex = (c, srgb = true) => {
    const t = new CanvasTexture(c);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = aniso;
    textures.push({ t, c });
    return t;
  };

  // One instanced mesh per kind of piece
  const kinds = {};
  const addKind = (key, geo, mats, capacity) => {
    const mesh = new InstancedMesh(geo, mats, capacity);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const zero = new Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, zero);
    scene.add(mesh);
    disposables.push(geo, ...[].concat(mats));
    kinds[key] = { mesh, free: Array.from({ length: capacity }, (_, i) => capacity - 1 - i), items: [] };
  };

  const redraws = [];
  NOTES.forEach((d, di) => {
    const surface = tex(drawNoteSurface(d), false);
    const front = tex(drawNote(d));
    const back = tex(drawNote(d, { back: true }));
    const edge = new MeshStandardMaterial({ color: d.paper, roughness: 0.9 });
    const top = new MeshStandardMaterial({ map: front, roughnessMap: surface, metalnessMap: surface, roughness: 1, metalness: 1, envMapIntensity: 0.9 });
    const bottom = new MeshStandardMaterial({ map: back, roughness: 0.8 });
    addKind(`note${di}`, noteGeometry(d.w * MM, d.h * MM, T, 0.012), [edge, edge, top, bottom, edge, edge], di === 0 ? 360 : 16);
    redraws.push(() => { front.image = drawNote(d); front.needsUpdate = true; back.image = drawNote(d, { back: true }); back.needsUpdate = true; });
  });
  {
    const d = NOTES[0];
    const label = `${HAND} × ${d.v} €`;
    const top = tex(drawNote(d, { band: label }));
    const long = tex(drawEdges(d, true));
    const short = tex(drawEdges(d, false));
    const longMat = new MeshStandardMaterial({ map: long, roughness: 0.92 });
    const shortMat = new MeshStandardMaterial({ map: short, roughness: 0.92 });
    const topMat = new MeshStandardMaterial({ map: top, roughness: 0.8 });
    addKind('bundle', noteGeometry(d.w * MM, d.h * MM, HAND * T, 0.004), [shortMat, shortMat, topMat, topMat, longMat, longMat], 3 * MAX_BUNDLES + 6);
    redraws.push(() => { top.image = drawNote(d, { band: label }); top.needsUpdate = true; });
  }
  COINS.forEach((k, ci) => {
    const face = tex(drawCoin(k));
    const r = (k.d * MM * COIN_SCALE) / 2;
    const side = new MeshStandardMaterial({ color: METAL[k.ring][0], metalness: 1, roughness: 0.38 });
    const faces = new MeshStandardMaterial({ map: face, metalness: 1, roughness: 0.32 });
    addKind(`coin${ci}`, new CylinderGeometry(r, r, k.t * MM * 1.6, 48, 1), [side, faces, faces], 12);
    redraws.push(() => { face.image = drawCoin(k); face.needsUpdate = true; });
  });
  // Draw again once the brand typeface is ready
  if (document.fonts && !document.fonts.check(`700 40px ${FONT}`)) {
    document.fonts.load(`700 40px ${FONT}`).then(() => { if (alive) { redraws.forEach((f) => f()); wake(); } }).catch(() => {});
  }

  // ---------- Pieces and their springs ----------
  const o = new Object3D();
  let stiffness = 120;
  let damping = 16;
  let mode = 'row';
  let anchors = [];
  let fitDist = 12;
  let fitCenter = new Vector3();
  let dist = 12;
  const center = new Vector3();
  let firstLayout = true;

  function makeItem(kind, slot, now, delay) {
    const k = kinds[kind];
    const idx = k.free.pop();
    if (idx === undefined) return null;
    const drop = reduced ? 0 : 2.6 + Math.random() * 1.6;
    const item = {
      kind, idx, pile: slot.pile, slotIndex: slot.index,
      p: { x: slot.x + (Math.random() - 0.5) * 0.6, y: slot.y + drop, z: slot.z + (Math.random() - 0.5) * 0.6 },
      v: { x: 0, y: 0, z: 0 },
      t: { x: slot.x, y: slot.y, z: slot.z },
      ry: slot.ry + (reduced ? 0 : (Math.random() - 0.5) * 1.2), tRy: slot.ry,
      rx: reduced ? 0 : (Math.random() - 0.5) * 0.8,
      s: 1, tS: 1,
      wait: now + delay,
      hop: null, leaving: false,
    };
    k.items.push(item);
    return item;
  }

  function placePiles(layouts) {
    const placed = layouts.map((l) => ({ ...l, ox: 0, oz: 0 }));
    if (mode === 'row') {
      // Wide box: side by side, yours on the left
      const gap = 0.55;
      let x = 0;
      for (const p of placed) { p.ox = x - p.minX; p.oz = -(p.minZ + p.maxZ) / 2; x += p.maxX - p.minX + gap; }
      placed.forEach((p) => { p.ox -= (x - gap) / 2; });
    } else {
      // Tall box: one pile per row, yours at the top, each label in the gap below its pile
      const gap = 1.05;
      let z = 0;
      for (const p of placed) { p.ox = -(p.minX + p.maxX) / 2; p.oz = z - p.minZ; z += p.maxZ - p.minZ + gap; }
      placed.forEach((p) => { p.oz -= (z - gap) / 2; });
    }
    return placed;
  }

  function setValues(values, { instant = false } = {}) {
    const now = performance.now();
    const layouts = placePiles([0, 1, 2].map((i) => pileLayout(Math.max(0, values[i] || 0), i)));
    // World slots per kind, in pile order
    const wanted = {};
    layouts.forEach((l, pile) => l.slots.forEach((s, index) => {
      (wanted[s.key] ||= []).push({ ...s, pile, index, x: s.x + l.ox, z: s.z + l.oz });
    }));
    anchors = layouts.map((l) => new Vector3(l.ox + (l.minX + l.maxX) / 2, 0, l.oz + l.maxZ + 0.08));

    let spawned = 0;
    for (const key of Object.keys(kinds)) {
      const k = kinds[key];
      const slots = wanted[key] || [];
      const current = k.items.filter((it) => !it.leaving);
      const byPile = [0, 1, 2].map((p) => current.filter((it) => it.pile === p).sort((a, b) => a.slotIndex - b.slotIndex));
      const pool = [];
      const assign = [];
      for (let p = 0; p < 3; p++) {
        const need = slots.filter((s) => s.pile === p);
        const have = byPile[p];
        need.forEach((slot, j) => { if (have[j]) assign.push([have[j], slot]); else assign.push([null, slot]); });
        pool.push(...have.slice(need.length));
      }
      for (const [item, slot] of assign) {
        let it = item;
        if (!it && pool.length) {
          // Money moves from one pile to another in an arc
          it = pool.shift();
          if (!instant && !reduced) it.hop = { start: now + spawned * 14, dur: 620, h: 1.1 + Math.random() * 0.5 };
          spawned++;
        }
        if (!it) {
          it = makeItem(key, slot, now, instant ? 0 : (firstLayout ? 260 : 0) + spawned * (firstLayout ? 22 : 12));
          spawned++;
          if (!it) continue;
        }
        it.pile = slot.pile;
        it.slotIndex = slot.index;
        it.t = { x: slot.x, y: slot.y, z: slot.z };
        it.tRy = slot.ry;
      }
      // What is left over flies off
      for (const it of pool) {
        it.leaving = true;
        it.tS = 0;
        it.t = { ...it.t, y: it.t.y + 1.4 };
      }
    }
    firstLayout = false;

    // Frame everything, labels included
    const min = new Vector3(Infinity, 0, Infinity);
    const max = new Vector3(-Infinity, 0.05, -Infinity);
    layouts.forEach((l) => {
      min.x = Math.min(min.x, l.ox + l.minX); max.x = Math.max(max.x, l.ox + l.maxX);
      min.z = Math.min(min.z, l.oz + l.minZ); max.z = Math.max(max.z, l.oz + l.maxZ + 0.5);
      max.y = Math.max(max.y, l.top);
    });
    fitView(min, max);
    if (instant || reduced) {
      dist = fitDist;
      center.copy(fitCenter);
      for (const k of Object.values(kinds)) for (const it of k.items) { it.p = { ...it.t }; it.v = { x: 0, y: 0, z: 0 }; it.s = it.tS; it.ry = it.tRy; it.rx = 0; it.hop = null; }
    }
    wake();
  }

  // ---------- Camera ----------
  let pointer = { x: 0, y: 0 };
  let cam = { x: 0, y: 0 };
  let scroll = 0;
  const EL = 0.9; // about 52° above the table, so the faces of the notes read
  const azimuth = () => (mode === 'column' ? -0.04 : -0.22); // straight on in a narrow column, so the piles line up
  const dir = (az, el) => new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));

  function fitView(min, max) {
    fitCenter = new Vector3((min.x + max.x) / 2, 0, (min.z + max.z) / 2);
    const corners = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push(new Vector3(x, y, z));
    const d = dir(azimuth(), EL);
    const v = new Vector3();
    let lo = 1;
    let hi = 120;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      camera.position.copy(fitCenter).addScaledVector(d, mid);
      camera.lookAt(fitCenter);
      camera.updateMatrixWorld();
      const ok = corners.every((c) => { v.copy(c).project(camera); return Math.abs(v.x) < 0.9 && v.y < 0.86 && v.y > -0.9; });
      if (ok) hi = mid; else lo = mid;
    }
    fitDist = hi;
  }

  function resize() {
    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;
    if (!w || !h) return false;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const next = w / h >= 0.9 ? 'row' : 'column';
    const changed = next !== mode;
    mode = next;
    return changed;
  }

  // ---------- Frame loop ----------
  let raf = 0;
  let last = 0;
  let calmSince = 0;
  let visible = true;
  let alive = true;
  const lp = new Vector3();

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.033, (now - (last || now)) / 1000) || 0.016;
    last = now;
    let moving = false;

    for (const k of Object.values(kinds)) {
      let dirty = false;
      for (let n = k.items.length - 1; n >= 0; n--) {
        const it = k.items[n];
        if (now < it.wait) { moving = true; continue; }
        for (const ax of ['x', 'y', 'z']) {
          const f = -stiffness * (it.p[ax] - it.t[ax]) - damping * it.v[ax];
          it.v[ax] += f * dt;
          it.p[ax] += it.v[ax] * dt;
          if (Math.abs(it.v[ax]) > 0.002 || Math.abs(it.p[ax] - it.t[ax]) > 0.001) moving = true;
        }
        const ease = 1 - Math.exp(-dt * 9);
        it.ry += (it.tRy - it.ry) * ease;
        it.rx += (0 - it.rx) * ease;
        it.s += (it.tS - it.s) * (1 - Math.exp(-dt * 7));
        if (Math.abs(it.tRy - it.ry) > 0.001 || Math.abs(it.rx) > 0.001 || Math.abs(it.tS - it.s) > 0.002) moving = true;
        let lift = 0;
        let flip = 0;
        if (it.hop) {
          const q = (now - it.hop.start) / it.hop.dur;
          if (q >= 1) it.hop = null;
          else if (q > 0) { lift = Math.sin(q * Math.PI) * it.hop.h; flip = Math.sin(q * Math.PI) * 0.5; }
          moving = true;
        }
        if (it.leaving && it.s < 0.02) {
          o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.setScalar(0); o.updateMatrix();
          k.mesh.setMatrixAt(it.idx, o.matrix);
          k.free.push(it.idx);
          k.items.splice(n, 1);
          dirty = true;
          continue;
        }
        o.position.set(it.p.x, it.p.y + lift, it.p.z);
        o.rotation.set(it.rx + flip, it.ry, 0);
        o.scale.setScalar(Math.max(0.0001, it.s));
        o.updateMatrix();
        k.mesh.setMatrixAt(it.idx, o.matrix);
        dirty = true;
      }
      if (dirty) k.mesh.instanceMatrix.needsUpdate = true;
    }

    // Camera: follows the framing, the pointer and the scroll
    dist += (fitDist - dist) * (1 - Math.exp(-dt * 5));
    center.lerp(fitCenter, 1 - Math.exp(-dt * 5));
    if (Math.abs(fitDist - dist) > 0.005) moving = true;
    cam.x += (pointer.x - cam.x) * 0.06;
    cam.y += (pointer.y - cam.y) * 0.06;
    if (Math.abs(pointer.x - cam.x) > 0.001 || Math.abs(pointer.y - cam.y) > 0.001) moving = true;
    const sway = reduced ? 0 : Math.sin(now / 2800) * 0.03;
    const d = dir(azimuth() + cam.x * 0.16 + sway, EL - cam.y * 0.07 + scroll * 0.15);
    camera.position.copy(center).addScaledVector(d, dist * (1 - scroll * 0.18));
    camera.lookAt(center);
    camera.updateMatrixWorld();
    sun.position.set(center.x - 4, 10, center.z + 5);
    sun.target.position.copy(center);

    renderer.render(scene, camera);

    // Labels follow their piles
    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;
    labels.forEach((el, i) => {
      const a = anchors[i];
      if (!a) return;
      lp.copy(a).project(camera);
      el.style.transform = `translate(${((lp.x + 1) / 2) * w}px, ${((1 - lp.y) / 2) * h}px) translateX(-50%)`;
      el.classList.add('is-placed');
    });

    if (moving) calmSince = now;
    if (visible && !reduced && (moving || now - calmSince < 5000)) raf = requestAnimationFrame(frame);
    else if (reduced && moving) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!raf && visible && alive) { last = 0; raf = requestAnimationFrame(frame); }
  }

  let lastValues = [0, 0, 0];
  const ro = new ResizeObserver(() => { if (resize()) setValues(lastValues, { instant: true }); wake(); });
  ro.observe(canvasEl);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }, { threshold: 0 });
  io.observe(canvasEl);
  const onVis = () => { visible = !document.hidden; if (visible) wake(); };
  document.addEventListener('visibilitychange', onVis);

  resize();
  // A lively first drop, then a calmer spring for edits
  setTimeout(() => { stiffness = 150; damping = 2 * Math.sqrt(150); }, 1800);

  return {
    setValues(values, opts) { lastValues = values.slice(); setValues(values, opts); },
    setPointer(x, y) { pointer = { x, y }; wake(); },
    setScroll(p) { scroll = p; wake(); },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      disposables.forEach((x) => x.dispose?.());
      textures.forEach(({ t }) => t.dispose());
      ground.geometry.dispose();
      ground.material.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
