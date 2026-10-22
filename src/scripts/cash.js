// Three piles of euro banknotes that split into what is yours and what goes elsewhere, the way the coins
// did. Each pile holds its exact amount: notes of one value give it its height, so the piles compare at a
// glance, and smaller notes and coins on top complete the figure to the cent. Notes fall like paper does,
// swaying and fluttering, and flip over when they jump from one pile to another.
// The notes are Quant's own drawings with the colours, sizes and values of the Europa series, not the
// official artwork, so they stay within the ECB rules on reproducing banknotes. Loaded on demand; the page
// works the same without it.
import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, HemisphereLight, InstancedBufferAttribute,
  InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, NeutralToneMapping, Object3D, PCFSoftShadowMap,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, ShadowMaterial, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const MM = 0.0128; // a 200 € note is about two units long: a pile as wide as the old coin piles
const T0 = 0.05; // modelled thickness of a note; each one is scaled to the thickness of the stack
const MAX_STACK = 4.6; // height of all the notes put together
const MAX_NOTES = 250; // per pile; beyond this the legend still carries the exact figure
const COIN_SCALE = 1.35;
const COIN_THICK = 3.2;
const FONT = '"Jost Variable", Jost, system-ui, sans-serif';
// Where the piles stand, as the coins did: yours in front, the rest set back. Each turns its long side
// to the camera, so the notes show their face.
const PILES = [
  { x: -0.4, z: 0.85, yaw: 0.36 },
  { x: -0.45, z: -2.5, yaw: 0.5 },
  { x: 2.0, z: 0.7, yaw: 0.3 },
];
// Where the coins rest on the top note, in its own coordinates
const COIN_SPOTS = [[-0.5, -0.16], [0.02, -0.18], [0.52, -0.14], [-0.46, 0.2], [0.06, 0.19], [0.54, 0.21], [-0.22, 0.02], [0.28, 0.03]];

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

function drawNote(d, { back = false } = {}) {
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
  const geo = new BoxGeometry(w, t, h, 12, 1, 3); // enough vertices to bend along and across
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2);
    pos.setY(i, pos.getY(i) + bow * (1 - x * x));
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- What each pile holds ----------

// The value that builds the height of the piles, chosen from the whole amount so the piles compare at a glance
function baseValue(total) {
  if (total <= 5000) return 50;
  if (total <= 12000) return 100;
  return 200;
}

// Bottom to top: notes of the base value, then smaller notes and coins to the cent
function pileContent(amount, base) {
  let cents = Math.round(Math.min(Math.max(0, +amount || 0), 1e8) * 100);
  const notes = [];
  NOTES.forEach((d, di) => {
    if (d.v > base) return;
    const n = Math.floor(cents / (d.v * 100));
    cents -= n * d.v * 100;
    for (let k = 0; k < Math.min(n, MAX_NOTES); k++) notes.push(di);
  });
  const coins = [];
  COINS.forEach((k, ci) => {
    const n = Math.floor(cents / k.c);
    cents -= n * k.c;
    for (let j = 0; j < n; j++) coins.push(ci);
  });
  return { notes, coins };
}

// ---------- Paper that bends ----------

// Every face of a note gets the same change to its vertices: a slow wave along the note with a faster,
// smaller one on top (two octaves read as paper, one reads as rubber) and a curl across it. aBend scales
// it per note, so a note lying still is flat. The stack's thickness scale is undone so all notes bend alike.
function bendable(material, uTime) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aBend;
attribute float aPhase;
uniform float uTime;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float stackScale = max(length(instanceMatrix[1].xyz), 0.0001);
float wave = sin(position.x * 2.3 + uTime * 6.5 + aPhase) * 0.7 + sin(position.x * 5.2 - uTime * 12.0 + aPhase * 1.7) * 0.3;
float curl = position.z * position.z * 2.6 - 0.12;
transformed.y += aBend * (wave + curl) / stackScale;`);
  };
  material.customProgramCacheKey = () => 'quant-paper';
  return material;
}

// ---------- Scene ----------

export function mountCash(canvasEl, { reduced = false, pins = [], legend = null } = {}) {
  const renderer = new WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(max-width: 767px)').matches ? 1.5 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping; // keeps the notes' colours true
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new PerspectiveCamera(26, 1, 0.1, 100);
  const base = { x: 8.4, y: 9.6, z: 16 };
  const target = { x: 0.6, y: 1.9, z: -0.4 };

  scene.add(new HemisphereLight(0xffffff, 0x223322, 0.4));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(-5, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const ground = new Mesh(new PlaneGeometry(40, 40), new ShadowMaterial({ opacity: 0.28 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const disposables = [ground.geometry, ground.material];
  const tex = (c, srgb = true) => {
    const t = new CanvasTexture(c);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = aniso;
    disposables.push(t);
    return t;
  };
  const uTime = { value: 0 };
  const rand = Math.random;

  // One instanced mesh per note value and per coin
  const kinds = {};
  const zero = new Matrix4().makeScale(0, 0, 0);
  const addKind = (key, geo, mats, capacity, paper = false) => {
    let bendAttr = null;
    if (paper) {
      bendAttr = new InstancedBufferAttribute(new Float32Array(capacity), 1);
      const phase = new InstancedBufferAttribute(new Float32Array(capacity).map(() => Math.random() * 6.283), 1);
      geo.setAttribute('aBend', bendAttr);
      geo.setAttribute('aPhase', phase);
    }
    const mesh = new InstancedMesh(geo, mats, capacity);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const shade = new Color();
    for (let i = 0; i < capacity; i++) {
      mesh.setMatrixAt(i, zero);
      // Each sheet a shade apart, so the side of a stack shows its layers
      if (paper) mesh.setColorAt(i, shade.setScalar(i % 2 ? 0.86 + rand() * 0.06 : 0.95 + rand() * 0.05));
    }
    scene.add(mesh);
    disposables.push(geo, ...mats);
    kinds[key] = { mesh, free: Array.from({ length: capacity }, (_, i) => capacity - 1 - i), items: [], bendAttr, paper };
  };

  const redraws = [];
  NOTES.forEach((d, di) => {
    const surface = tex(drawNoteSurface(d), false);
    const front = tex(drawNote(d));
    const back = tex(drawNote(d, { back: true }));
    const edge = bendable(new MeshStandardMaterial({ color: d.paper, roughness: 0.9 }), uTime);
    const top = bendable(new MeshStandardMaterial({ map: front, roughnessMap: surface, metalnessMap: surface, roughness: 1, metalness: 1, envMapIntensity: 0.9 }), uTime);
    const bottom = bendable(new MeshStandardMaterial({ map: back, roughness: 0.8 }), uTime);
    addKind(`note${di}`, noteGeometry(d.w * MM, d.h * MM, T0, 0.006), [edge, edge, top, bottom, edge, edge], 3 * MAX_NOTES + 60, true);
    redraws.push(() => { front.image = drawNote(d); front.needsUpdate = true; back.image = drawNote(d, { back: true }); back.needsUpdate = true; });
  });
  COINS.forEach((k, ci) => {
    const face = tex(drawCoin(k));
    const r = (k.d * MM * COIN_SCALE) / 2;
    const side = new MeshStandardMaterial({ color: METAL[k.ring][0], metalness: 1, roughness: 0.38 });
    const faces = new MeshStandardMaterial({ map: face, metalness: 1, roughness: 0.32 });
    addKind(`coin${ci}`, new CylinderGeometry(r, r, k.t * MM * COIN_THICK, 40, 1), [side, faces, faces], 24);
    redraws.push(() => { face.image = drawCoin(k); face.needsUpdate = true; });
  });

  // Draw again once the brand typeface is ready
  let alive = true;
  if (document.fonts && !document.fonts.check(`700 40px ${FONT}`)) {
    document.fonts.load(`700 40px ${FONT}`).then(() => { if (alive) { redraws.forEach((f) => f()); wake(); } }).catch(() => {});
  }

  // ---------- Pieces ----------
  let stiffness = 140;
  let damping = 2 * Math.sqrt(140);
  let thick = 0.09;

  // Paper does not drop: it glides down swaying from side to side, rocking with the sway, and slows
  // just before it settles. Coins fall straighter and spin.
  function startFall(it, delay, now, coin) {
    it.fall = {
      start: now + delay,
      dur: coin ? 620 + rand() * 200 : 950 + rand() * 550,
      h: 5 + rand() * 3,
      ax: coin ? 0.08 : 0.5 + rand() * 0.6,
      az: coin ? 0.06 : 0.35 + rand() * 0.45,
      f1: 1.1 + rand() * 0.6,
      f2: 2.7 + rand() * 1.3,
      ph: rand() * 6.283,
      spin: (rand() - 0.5) * (coin ? 6 : 1.8),
      sign: rand() < 0.5 ? -1 : 1,
    };
    it.p = { x: it.t.x, y: it.t.y + it.fall.h, z: it.t.z };
  }

  function makeItem(key, slot, now, delay) {
    const k = kinds[key];
    const idx = k.free.pop();
    if (idx === undefined) return null;
    const it = {
      idx, pile: slot.pile, slotIndex: slot.index,
      p: { x: slot.x, y: slot.y, z: slot.z }, v: { x: 0, y: 0, z: 0 }, t: { x: slot.x, y: slot.y, z: slot.z },
      ry: slot.ry, tRy: slot.ry, s: 1, tS: 1,
      fall: null, hop: null, leaving: false, top: false, bend: 0,
    };
    if (!reduced) startFall(it, delay, now, !k.paper);
    k.items.push(it);
    return it;
  }

  // Every note and coin a pile needs, in world coordinates
  function pileSlots(content, pile) {
    const P = PILES[pile];
    const r = rng(pile * 7919 + 3);
    const cos = Math.cos(P.yaw);
    const sin = Math.sin(P.yaw);
    const place = (lx, lz) => ({ x: P.x + lx * cos + lz * sin, z: P.z - lx * sin + lz * cos });
    const slots = [];
    const seen = {};
    content.notes.forEach((di, j) => {
      const key = `note${di}`;
      const at = place((r() - 0.5) * 0.1, (r() - 0.5) * 0.1);
      slots.push({ key, pile, index: (seen[key] = (seen[key] ?? -1) + 1), x: at.x, y: (j + 0.5) * thick, z: at.z, ry: P.yaw + (r() - 0.5) * 0.14, top: j === content.notes.length - 1 });
    });
    // Loose change on top of the notes, one short stack per coin, all within the top note
    const top = content.notes.length * thick;
    let spot = -1;
    let last = -1;
    let level = 0;
    content.coins.forEach((ci) => {
      const key = `coin${ci}`;
      const th = COINS[ci].t * MM * COIN_THICK;
      if (ci !== last) { spot++; level = 0; last = ci; }
      const [lx, lz] = COIN_SPOTS[spot % COIN_SPOTS.length];
      const at = place(lx, lz);
      slots.push({ key, pile, index: (seen[key] = (seen[key] ?? -1) + 1), x: at.x, y: top + (level + 0.5) * th, z: at.z, ry: r() * Math.PI * 2 });
      level++;
    });
    return { slots, height: top + (content.coins.length ? 0.12 : 0), empty: !content.notes.length && !content.coins.length };
  }

  let piles = [{ height: 0, empty: true }, { height: 0, empty: true }, { height: 0, empty: true }];

  // Money moves between piles the way the coins did: what one pile gives up jumps to another
  function setValues(values, { instant = false } = {}) {
    const now = performance.now();
    const vals = [0, 1, 2].map((i) => Math.max(0, values[i] || 0));
    const total = vals.reduce((a, b) => a + b, 0);
    const b = baseValue(total);
    const contents = vals.map((v) => pileContent(v, b));
    const count = contents.reduce((a, c) => a + c.notes.length, 0);
    thick = Math.min(0.09, Math.max(0.016, MAX_STACK / Math.max(1, count)));
    const laid = contents.map((c, p) => pileSlots(c, p));
    piles = laid.map((l) => ({ height: l.height, empty: l.empty }));
    const wanted = {};
    laid.forEach((l) => l.slots.forEach((s) => (wanted[s.key] ||= []).push(s)));

    let moved = 0;
    for (const key of Object.keys(kinds)) {
      const k = kinds[key];
      const slots = wanted[key] || [];
      const current = k.items.filter((it) => !it.leaving);
      const byPile = [0, 1, 2].map((p) => current.filter((it) => it.pile === p).sort((a, c) => a.slotIndex - c.slotIndex));
      const pool = [];
      const assign = [];
      for (let p = 0; p < 3; p++) {
        const need = slots.filter((s) => s.pile === p);
        const have = byPile[p];
        need.forEach((slot, j) => assign.push([have[j] ?? null, slot]));
        pool.push(...have.slice(need.length));
      }
      for (const [item, slot] of assign) {
        let it = item;
        if (!it && pool.length) {
          // Taken from the top of a shrinking pile, it flips over in an arc to the growing one
          it = pool.pop();
          if (!instant && !reduced) {
            it.fall = null;
            it.hop = { start: now + moved * 26, dur: 640 + rand() * 160, h: 1.6 + rand() * 0.8, flip: rand() < 0.5 ? -1 : 1 };
          }
          moved++;
        }
        if (!it) {
          it = makeItem(key, slot, now, instant ? 0 : moved * 34);
          moved++;
          if (!it) continue;
        }
        it.pile = slot.pile;
        it.slotIndex = slot.index;
        it.t = { x: slot.x, y: slot.y, z: slot.z };
        it.tRy = slot.ry;
        it.top = !!slot.top;
      }
      // What is left over flutters up and away
      for (const it of pool) {
        it.leaving = true;
        it.fall = null;
        it.tS = 0;
        it.t = { x: it.t.x + (rand() - 0.5) * 1.2, y: it.t.y + 2.2, z: it.t.z + (rand() - 0.5) * 1.2 };
      }
    }
    if (instant || reduced) {
      for (const k of Object.values(kinds)) for (const it of k.items) { it.p = { ...it.t }; it.v = { x: 0, y: 0, z: 0 }; it.s = it.tS; it.ry = it.tRy; it.hop = null; it.fall = null; }
    }
    wake();
  }

  // ---------- Frame loop ----------
  const o = new Object3D();
  o.rotation.order = 'YXZ'; // yaw last, so the roll turns a note about its own length
  const pin = new Vector3();
  let raf = 0;
  let last = 0;
  let calmSince = 0;
  let visible = true;
  let pointer = { x: 0, y: 0 };
  let cam = { x: 0, y: 0 };
  let scroll = 0;
  let framing = 1; // how far the camera sits: closer in a wide, short box so the piles keep their size
  let pan = 0; // sideways shift that keeps the piles clear of a legend beside them
  const right = new Vector3();
  const TAU = Math.PI * 2;
  const smooth = (q) => q * q * (3 - 2 * q);

  function resize() {
    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    framing = w / h >= 1 ? 0.7 : 1;
    const side = legend && w / h >= 1 && getComputedStyle(legend).display !== 'none' ? legend.offsetWidth + 16 : 0;
    const dist = Math.hypot(base.x - target.x, base.y - target.y, base.z - target.z) * framing;
    pan = (side / 2 / w) * 2 * Math.tan((camera.fov * Math.PI) / 360) * dist * camera.aspect;
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.033, (now - (last || now)) / 1000) || 0.016;
    last = now;
    uTime.value = now / 1000;
    let moving = false;
    const landed = [0, 0, 0];
    // A breath of air over the top notes while the scene is awake, fading out before it rests
    const breeze = reduced ? 0 : 0.016 * Math.max(0, 1 - (now - calmSince) / 5000);

    for (const k of Object.values(kinds)) {
      if (!k.items.length) continue;
      let bendDirty = false;
      for (let n = k.items.length - 1; n >= 0; n--) {
        const it = k.items[n];
        let x;
        let y;
        let z;
        let roll = 0;
        let pitch = 0;
        let yaw = it.ry;
        let bendGoal = 0;
        if (it.fall && now < it.fall.start) {
          // Not dropped yet: kept out of sight
          k.mesh.setMatrixAt(it.idx, zero);
          moving = true;
          continue;
        }
        if (it.fall) {
          const f = it.fall;
          const q = Math.min(1, Math.max(0, (now - f.start) / f.dur));
          const fade = 1 - q;
          const w1 = Math.sin(q * f.f1 * TAU + f.ph);
          const w2 = Math.sin(q * f.f2 * TAU + f.ph * 1.3);
          x = it.t.x + (f.ax * w1 + f.ax * 0.25 * w2) * fade * f.sign;
          z = it.t.z + f.az * Math.cos(q * f.f1 * TAU + f.ph) * fade;
          y = it.t.y + f.h * (1 - Math.sin((q * Math.PI) / 2));
          roll = 0.6 * w1 * fade * f.sign; // rocks with the sway, as a leaf does
          pitch = 0.28 * w2 * fade;
          yaw = it.tRy + f.spin * fade;
          bendGoal = k.paper ? 0.08 * (0.35 + 0.65 * fade) : 0;
          moving = true;
          if (q >= 1) { it.fall = null; it.p = { x: it.t.x, y: it.t.y, z: it.t.z }; it.v = { x: 0, y: -0.5, z: 0 }; it.ry = it.tRy; }
        } else {
          for (const ax of ['x', 'y', 'z']) {
            const f = -stiffness * (it.p[ax] - it.t[ax]) - damping * it.v[ax];
            it.v[ax] += f * dt;
            it.p[ax] += it.v[ax] * dt;
            if (Math.abs(it.v[ax]) > 0.002 || Math.abs(it.p[ax] - it.t[ax]) > 0.002) moving = true;
          }
          it.ry += (it.tRy - it.ry) * (1 - Math.exp(-dt * 8));
          if (Math.abs(it.tRy - it.ry) > 0.001) moving = true;
          ({ x, y, z } = it.p);
          yaw = it.ry;
          if (it.hop) {
            const q = (now - it.hop.start) / it.hop.dur;
            if (q >= 1) it.hop = null;
            else if (q > 0) {
              const arc = Math.sin(q * Math.PI);
              y += arc * it.hop.h;
              roll = it.hop.flip * smooth(q) * TAU; // one full turn over its length
              bendGoal = k.paper ? 0.1 * arc : 0;
            }
            moving = true;
          } else if (it.leaving) {
            roll = (1 - it.s) * 2.4;
            bendGoal = k.paper ? 0.09 : 0;
          } else if (it.top && k.paper) {
            bendGoal = breeze;
          }
        }
        it.s += (it.tS - it.s) * (1 - Math.exp(-dt * 6));
        if (Math.abs(it.tS - it.s) > 0.002) moving = true;
        if (it.leaving && it.s < 0.02) {
          k.mesh.setMatrixAt(it.idx, zero);
          if (k.bendAttr) { k.bendAttr.setX(it.idx, 0); bendDirty = true; }
          k.free.push(it.idx);
          k.items.splice(n, 1);
          continue;
        }
        if (!it.fall && !it.hop && !it.leaving) {
          landed[it.pile] = Math.max(landed[it.pile], it.p.y + (k.paper ? thick / 2 : 0.05));
        }
        if (k.bendAttr) {
          const before = it.bend;
          it.bend += (bendGoal - it.bend) * (1 - Math.exp(-dt * 9));
          if (Math.abs(it.bend - before) > 1e-5) { k.bendAttr.setX(it.idx, it.bend); bendDirty = true; }
        }
        o.position.set(x, y, z);
        o.rotation.set(roll, yaw, pitch);
        o.scale.set(it.s, it.s * (k.paper ? thick / T0 : 1), it.s);
        o.updateMatrix();
        k.mesh.setMatrixAt(it.idx, o.matrix);
      }
      k.mesh.instanceMatrix.needsUpdate = true;
      if (bendDirty) k.bendAttr.needsUpdate = true;
    }

    // Camera: pointer parallax (spring-smoothed) and a dolly as the hero scrolls away
    cam.x += (pointer.x - cam.x) * 0.06;
    cam.y += (pointer.y - cam.y) * 0.06;
    const sway = reduced ? 0 : Math.sin(now / 2600) * 0.25;
    const ty = target.y + scroll * 0.6;
    camera.position.set(
      target.x + (base.x + cam.x * 2.2 + sway - target.x) * framing,
      ty + (base.y - cam.y * 1.4 - scroll * 2.5 - ty) * framing,
      target.z + (base.z - scroll * 4 - target.z) * framing,
    );
    camera.lookAt(target.x, ty, target.z);
    camera.updateMatrixWorld();
    if (pan) {
      camera.position.addScaledVector(right.setFromMatrixColumn(camera.matrixWorld, 0), -pan);
      camera.updateMatrixWorld();
    }
    if (Math.abs(pointer.x - cam.x) > 0.001 || Math.abs(pointer.y - cam.y) > 0.001) moving = true;

    renderer.render(scene, camera);

    // A dot in the legend's colour floats over each pile, so the legend reads without wrapping the money
    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;
    pins.forEach((el, i) => {
      const P = PILES[i];
      if (!P) return;
      pin.set(P.x, Math.max(landed[i], 0.05) + 0.5, P.z).project(camera);
      el.style.transform = `translate(${((pin.x + 1) / 2) * w}px, ${((1 - pin.y) / 2) * h}px) translate(-50%, -50%)`;
      el.classList.toggle('is-on', !piles[i].empty && landed[i] > 0);
    });

    if (moving) calmSince = now;
    // Keep a gentle idle sway for a few seconds after the last movement, then rest
    if (visible && !reduced && (moving || now - calmSince < 6000)) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!raf && visible && alive) { last = 0; raf = requestAnimationFrame(frame); }
  }

  const ro = new ResizeObserver(() => { resize(); wake(); });
  ro.observe(canvasEl);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }, { threshold: 0 });
  io.observe(canvasEl);
  const onVis = () => { visible = !document.hidden; if (visible) wake(); };
  document.addEventListener('visibilitychange', onVis);

  resize();
  // A touch of bounce while the first notes land, then a calmer spring for edits
  stiffness = 120;
  damping = 14;
  setTimeout(() => { stiffness = 140; damping = 2 * Math.sqrt(140); }, 2600);

  return {
    setValues,
    setPointer(x, y) { pointer = { x, y }; wake(); },
    setScroll(p) { scroll = p; wake(); },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      disposables.forEach((x) => x.dispose?.());
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
