// A pile of euro coins that splits into what is yours and what goes to taxes.
// Loaded on demand; the page works the same without it.
import {
  ACESFilmicToneMapping, Color, DirectionalLight, Group, HemisphereLight, InstancedMesh, LatheGeometry,
  Mesh, MeshStandardMaterial, Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry,
  PMREMGenerator, Scene, ShadowMaterial, SRGBColorSpace, Vector2, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const COUNT = 28;
const THICK = 0.2;
const COLORS = [new Color('#d8a23a'), new Color('#34342f'), new Color('#c4c7cc')]; // yours, tax, social security
// Pile positions: what is yours in front, the rest set back
const PILES = [
  [-0.4, 0, 0.8],
  [0.9, 0, -1.7],
  [2.2, 0, -0.3],
];

function coinGeometry() {
  // Raised rim on both faces, slightly recessed centre
  const p = [
    [0, 0.085], [0.8, 0.085], [0.86, 0.1], [0.97, 0.1], [1, 0.07],
    [1, -0.07], [0.97, -0.1], [0.86, -0.1], [0.8, -0.085], [0, -0.085],
  ].map(([x, y]) => new Vector2(x, y));
  const g = new LatheGeometry(p.reverse(), 72);
  g.computeVertexNormals();
  return g;
}

// Largest-remainder split of COUNT coins by value
function split(values) {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  if (!(total > 0)) return values.map((_, i) => (i === 0 ? COUNT : 0));
  const raw = values.map((v) => (Math.max(0, v) / total) * COUNT);
  const out = raw.map(Math.floor);
  let left = COUNT - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) out[i]++; });
  // Anything above zero gets at least one coin, so small taxes stay visible
  values.forEach((v, i) => {
    if (v > 0 && out[i] === 0) { const big = out.indexOf(Math.max(...out)); out[big]--; out[i]++; }
  });
  return out;
}

export function mountCoins(canvas, { reduced = false } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(max-width: 767px)').matches ? 1.5 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new PerspectiveCamera(26, 1, 0.1, 100);
  const base = { x: 8.4, y: 9.6, z: 16 };
  const target = { x: 0.6, y: 2.1, z: -0.4 };

  scene.add(new HemisphereLight(0xffffff, 0x223322, 0.35));
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
  ground.position.y = -THICK / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const group = new Group();
  scene.add(group);
  const geometry = coinGeometry();
  const material = new MeshStandardMaterial({ color: 0xffffff, metalness: 0.92, roughness: 0.3, envMapIntensity: 1.1 });
  const mesh = new InstancedMesh(geometry, material, COUNT);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Coin state: spring position, pile, hop
  const coins = Array.from({ length: COUNT }, (_, i) => ({
    pile: 0,
    p: { x: 0, y: 14 + i * 0.9, z: 0 },
    v: { x: 0, y: 0, z: 0 },
    t: { x: 0, y: 0, z: 0 },
    jitter: { x: (Math.random() - 0.5) * 0.07, z: (Math.random() - 0.5) * 0.07, r: Math.random() * Math.PI * 2, tilt: (Math.random() - 0.5) * 0.04 },
    hop: null,
    color: COLORS[0].clone(),
    nextColor: null,
    delay: i * 0.035,
  }));
  coins.forEach((c, i) => mesh.setColorAt(i, c.color));

  let counts = [COUNT, 0, 0];
  let stiffness = 120;
  let damping = 14; // a little bounce for the first drop

  function layout() {
    const level = [0, 0, 0];
    // Keep each coin's order inside its pile stable: sort by current height
    const order = coins.map((c, i) => i).sort((a, b) => coins[a].p.y - coins[b].p.y);
    for (const i of order) {
      const c = coins[i];
      const [px, , pz] = PILES[c.pile];
      c.t.x = px + c.jitter.x;
      c.t.z = pz + c.jitter.z;
      c.t.y = level[c.pile] * THICK;
      level[c.pile]++;
    }
  }

  // Move coins between piles: shrinking piles give up their top coins to growing ones
  function setValues(values, { instant = false } = {}) {
    const next = split(values);
    const surplus = [];
    for (let g = 0; g < 3; g++) {
      const mine = coins.filter((c) => c.pile === g).sort((a, b) => b.p.y - a.p.y);
      for (let k = 0; k < mine.length - next[g]; k++) surplus.push(mine[k]);
    }
    let s = 0;
    const now = performance.now();
    for (let g = 0; g < 3; g++) {
      const have = coins.filter((c) => c.pile === g).length - surplus.filter((c) => c.pile === g).length;
      for (let k = have; k < next[g]; k++) {
        const c = surplus[s++];
        if (!c) break;
        c.pile = g;
        c.nextColor = COLORS[g];
        if (!instant && !reduced) c.hop = { start: now + s * 32, dur: 560, h: 1.6 + Math.random() * 0.6 };
        else { c.color.copy(COLORS[g]); c.nextColor = null; }
      }
    }
    counts = next;
    layout();
    if (instant || reduced) coins.forEach((c) => { c.p = { ...c.t }; c.v = { x: 0, y: 0, z: 0 }; });
    wake();
  }

  const o = new Object3D();
  let raf = 0;
  let last = 0;
  let calmSince = 0;
  let visible = true;
  let pointer = { x: 0, y: 0 };
  let cam = { x: 0, y: 0 };
  let scroll = 0;
  const start = performance.now();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.033, (now - (last || now)) / 1000) || 0.016;
    last = now;
    let moving = false;

    coins.forEach((c, i) => {
      if (now - start < c.delay * 1000 && !reduced) { moving = true; return; }
      for (const ax of ['x', 'y', 'z']) {
        const f = -stiffness * (c.p[ax] - c.t[ax]) - damping * c.v[ax];
        c.v[ax] += f * dt;
        c.p[ax] += c.v[ax] * dt;
        if (Math.abs(c.v[ax]) > 0.002 || Math.abs(c.p[ax] - c.t[ax]) > 0.002) moving = true;
      }
      let hopY = 0;
      if (c.hop) {
        const k = (now - c.hop.start) / c.hop.dur;
        if (k >= 1) { c.hop = null; }
        else if (k > 0) {
          hopY = Math.sin(k * Math.PI) * c.hop.h;
          if (k > 0.5 && c.nextColor) { c.color.copy(c.nextColor); c.nextColor = null; mesh.setColorAt(i, c.color); mesh.instanceColor.needsUpdate = true; }
          moving = true;
        } else moving = true;
      } else if (c.nextColor) { c.color.copy(c.nextColor); c.nextColor = null; mesh.setColorAt(i, c.color); mesh.instanceColor.needsUpdate = true; }
      o.position.set(c.p.x, c.p.y + hopY, c.p.z);
      o.rotation.set(c.jitter.tilt + (c.hop ? Math.sin(((now - c.hop.start) / c.hop.dur) * Math.PI) * 0.9 : 0), c.jitter.r, 0);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;

    // Camera: pointer parallax (spring-smoothed) and a dolly as the hero scrolls away
    cam.x += (pointer.x - cam.x) * 0.06;
    cam.y += (pointer.y - cam.y) * 0.06;
    const sway = reduced ? 0 : Math.sin(now / 2600) * 0.25;
    camera.position.set(base.x + cam.x * 2.2 + sway, base.y - cam.y * 1.4 - scroll * 2.5, base.z - scroll * 4);
    camera.lookAt(target.x, target.y + scroll * 0.6, target.z);
    if (Math.abs(pointer.x - cam.x) > 0.001 || Math.abs(pointer.y - cam.y) > 0.001) moving = true;

    renderer.render(scene, camera);

    if (moving) calmSince = now;
    // Keep a gentle idle sway for a few seconds after the last movement, then rest
    if (visible && !reduced && (moving || now - calmSince < 6000)) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); }
  }

  const ro = new ResizeObserver(() => { resize(); wake(); });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => { visible = !document.hidden; if (visible) wake(); };
  document.addEventListener('visibilitychange', onVis);

  resize();
  layout();
  // Settle the first drop with a light bounce, then switch to a calmer spring for edits
  setTimeout(() => { stiffness = 140; damping = 2 * Math.sqrt(140); }, 1800);
  if (reduced) { coins.forEach((c) => { c.p = { ...c.t }; }); }
  wake();

  return {
    setValues,
    setPointer(x, y) { pointer = { x, y }; wake(); },
    setScroll(p) { scroll = p; wake(); },
    get counts() { return counts; },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      geometry.dispose();
      material.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
