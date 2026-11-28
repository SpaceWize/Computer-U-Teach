// A small procedural brick city for the hero. Different on every load.
//
// The city is a square of blocks and roads on open green ground with trees, fading into the sky. Visitors can drag to orbit, zoom right down to the cars, and pan.
//
// Units: 1 = one stud. Y is up. Everything is drawn with a handful of instanced meshes (one box, one
// cylinder, one cone, one roof prism), so thousands of pieces cost a few draw calls.
//
//   const city = await startCity({ container, reduced, onBuilt, seed });
//   city.zoom(0.7); city.turn(0.4); city.reset(); city.finish(); city.stop();

const BLOCK = 16, ROAD = 6, N = 6, PITCH = BLOCK + ROAD;
const HALF = (N * BLOCK + (N + 1) * ROAD) / 2;          // half the city's width

const C = {
  sky: '#bfe3ff', grass: '#6cc24a', grassDark: '#4fa83a', lawn: '#7fd257',
  road: '#4a4d55', line: '#f4f4f4', pavement: '#cfd3d8', asphalt: '#3c3f46',
  glass: '#8fd0f2', glassDark: '#2c3e50', tyre: '#1b1b1b', trunk: '#7a4a21',
  leaf: '#2f9e44', leafLight: '#55c05a', water: '#3aa0e8',
  barn: '#c8102e', roof: '#6b7078', white: '#ffffff', silo: '#d9dde2'
};
const WALLS = ['#f4f1e8', '#e9e2cf', '#d8dde3', '#ed1c24', '#3f48cc', '#fff200', '#00a8f3', '#f28c28', '#9ad0c2', '#b23a48', '#f6b7c1', '#7d8fa3'];
const CARS = ['#ed1c24', '#3f48cc', '#fff200', '#0ed145', '#ffffff', '#f28c28', '#1b1b1b', '#00a8f3'];
const ROOFS = ['#b23a48', '#6b7078', '#7a4a21', '#3f48cc'];

/* ---------- weather ----------
   Each look changes the sky, the light and some colours, and may add falling rain or snow.
   map: colours to swap, by name from C. kinds: every piece of that shape takes one colour. */
const SNOW = '#f4f7fa';
const LOOKS = {
  clear: { sky: '#bfe3ff', fog: [420, 1150], hemi: ['#dff1ff', '#8f8a63', 1.5], sun: ['#fff3dc', 2.4], map: {} },
  /* Sunny: a deep blue sky fading to a pale horizon, hard warm light with darker shadows, saturated
     colours, and the shadows of high clouds sweeping across the city. */
  sun: { sky: '#cdeeff', skyTop: '#2f8fff', fog: [600, 1500], hemi: ['#d8efff', '#7d8f4a', 1.05], sun: ['#ffe0a0', 3.7], cloudShadows: true,
    map: { grass: '#6fd23e', grassDark: '#55b832', lawn: '#82e04c', water: '#1fb2ff', leafLight: '#4fd04f', leaf: '#21a83a', pavement: '#dde1e6' } },
  rain: { sky: '#8e9aa8', fog: [200, 820], hemi: ['#c9d3de', '#5f6b5a', 1.25], sun: ['#dfe8f2', 0.95], particles: 'rain', puddles: true,
    map: { grass: '#57a03c', grassDark: '#46883a', lawn: '#62ad46', road: '#2f3239', asphalt: '#292c32',
      pavement: '#a3a9b1' } },
  snow: { sky: '#d3dce6', fog: [280, 950], hemi: ['#eef4ff', '#b3bdc8', 1.6], sun: ['#f3f6ff', 1.7], particles: 'snow', snowCaps: true,
    map: { grass: SNOW, grassDark: '#e8eef3', lawn: SNOW, leafLight: '#dfe8ec', pavement: '#e6ebf0', water: '#c7e3f3', road: '#5d616a' },
    kinds: { pyramid: SNOW } },
  /* The easter egg: the same city at night, built from dark tech parts with glowing windows and lines. */
  tech: { sky: '#060a18', fog: [380, 1100], hemi: ['#4a6cff', '#05070f', 0.55], sun: ['#9fb6ff', 0.7], stars: true, grid: true, neonRims: true, headlights: true,
    glow: ['line'], litGlass: true,
    map: { grass: '#0b1224', grassDark: '#0b1224', lawn: '#0f1a30', road: '#090d1a', asphalt: '#090d1a', pavement: '#18203a', line: '#29f0ff', glassDark: '#04060d', tyre: '#04060d', trunk: '#2a3350',
      leaf: '#1df2a0', leafLight: '#14c98a', water: '#29f0ff', barn: '#ff3df2', roof: '#2a3350',
      white: '#cfe8ff', silo: '#2a3350' },
    walls: ['#141a2b', '#1c2438', '#232c44', '#0f1422', '#2a3350'],
    neon: ['#29f0ff', '#ff3df2', '#ffb020', '#1df2a0', '#7a5cff'],
    windows: ['#29f0ff', '#ff3df2', '#ffb020', '#29f0ff', '#1b2440', '#1b2440'] }
};
export const WEATHERS = Object.keys(LOOKS);

/* ---------- seasons, by date ----------
   Autumn: 22 September to 30 November. Leafy trees turn orange and start to lose their leaves.
   Christmas: Advent Sunday (the fourth Sunday before Christmas) to 25 December. String lights on
   buildings, sparkles in the trees, and some people in Santa hats or carrying shopping bags.
   In the snow, leafy trees are bare whatever the date. */
const AUTUMN = ['#e8731c', '#d94f1a', '#f2a51e', '#c9361b', '#e0b23a', '#b8541c'];
const XMAS_BULBS = ['#ff3b3b', '#ffd23b', '#3bff6b', '#3bb5ff', '#ff5bd8', '#ffffff'];
const WARM_BULB = '#fff1b8', SPARKLES = ['#fff6c8', '#ffffff', '#ffe27a'];
const BAGS = ['#c8102e', '#0e8f3a', '#ffffff', '#d4a017', '#3f48cc'];
export function seasonsFor(date = new Date()) {
  const y = date.getFullYear(), day = new Date(y, date.getMonth(), date.getDate());
  const xmas = new Date(y, 11, 25), advent = new Date(y, 11, 25 - (xmas.getDay() || 7) - 21);
  return { autumn: day >= new Date(y, 8, 22) && day <= new Date(y, 10, 30), christmas: day >= advent && day <= xmas };
}
/* Seasonal skies, laid over the weather's own look.
   Autumn: a greyer, softer sky (rain is already grey, snow and tech keep their own).
   Christmas: late afternoon just before dusk. The sun is low and orange, the sky fades from deep
   blue overhead through violet to a peach horizon, shadows are long, and windows glow faintly warm,
   so the string lights read well. Applies in every weather except the tech city. */
const AUTUMN_SKY = {
  clear: { sky: '#b9c3cc', fog: [380, 1100], hemi: ['#d4dbe2', '#7a7466', 1.35], sun: ['#f0e4cc', 1.8] },
  sun: { sky: '#d3dae0', skyTop: '#6f9bcb', sun: ['#ffe2b0', 2.9] }
};
/* Christmas: just past dusk, around half past four in the afternoon in Vancouver. The sun has set: there
   is no direct sunlight, only a fading afterglow low in the sky. Windows are lit, street lamps are on,
   vehicles have their lights on, and the string lights and tree sparkles carry the scene. */
const DUSK = {
  all: { sky: '#a45f55', skyMid: '#3a3566', skyTop: '#0b1030', fogColor: '#4b3d55', fog: [260, 900], hemi: ['#5d6aa8', '#2a2430', 0.5],
    sun: ['#ff8a50', 0.22], sunPos: [200, 25, 120], warmWindows: true, headlights: true, streetLamps: true },
  /* Clear at Christmas is overcast, not sunny. */
  clear: { sky: '#8a6a70', skyMid: '#363a62', skyTop: '#0e1434', fogColor: '#4a4458', hemi: ['#6a74a8', '#34303a', 0.55], sun: ['#ff9d6a', 0.12],
    map: { grass: '#668f4c', grassDark: '#557a40', lawn: '#729b56', leafLight: '#5d8f4c' } },
  snow: { sky: '#a87882', skyMid: '#463e78', skyTop: '#0e163e', fogColor: '#5b5470', hemi: ['#7480c0', '#4d4860', 0.6], sun: ['#ffa070', 0.2] },
  rain: { sky: '#4e4652', skyMid: '#2a2c40', skyTop: '#0c1020', fogColor: '#353342', fog: [200, 760], hemi: ['#56607e', '#25252c', 0.42], sun: ['#d08060', 0.1] }
};
function seasonalLook(name, seasons) {
  const base = LOOKS[name];
  if (name === 'tech') return base;
  if (seasons.christmas) { const d = DUSK[name] || {}; return { ...base, ...DUSK.all, ...d, map: { ...base.map, ...(d.map || {}) } }; }
  if (seasons.autumn && AUTUMN_SKY[name]) return { ...base, ...AUTUMN_SKY[name] };
  return base;
}
/* "2026-12-10" is read as a local date (new Date() would read it as UTC midnight, the day before here). */
function parseDate(v) {
  if (v instanceof Date) return v;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(v || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date();
}

/* Plain weather most of the time. When there is weather, the one that suits the season (Vancouver,
   northern hemisphere) comes up three times as often as each of the others. The tech city is a rare
   easter egg. */
const TECH_CHANCE = 1 / 40, CLEAR_CHANCE = 0.55;
const seasonWeather = month => ([11, 0, 1].includes(month) ? 'snow' : [5, 6, 7].includes(month) ? 'sun' : 'rain');
export function pickWeather(date = new Date(), r = Math.random) {
  /* The Christmas season has its own odds, so snow leads: snow 60%, overcast clear 30%, rain 7.5%,
     tech 2.5%. No sun. */
  if (seasonsFor(date).christmas) { const x = r(); return x < 0.025 ? 'tech' : x < 0.625 ? 'snow' : x < 0.925 ? 'clear' : 'rain'; }
  if (r() < TECH_CHANCE) return 'tech';
  if (r() < CLEAR_CHANCE) return 'clear';
  const inSeason = seasonWeather(date.getMonth()), others = ['rain', 'snow', 'sun'].filter(w => w !== inSeason);
  const x = r();
  return x < 0.6 ? inSeason : x < 0.8 ? others[0] : others[1];
}

export async function startCity({ container, reduced = false, onBuilt = () => {}, seed, weather, date } = {}) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

  /* ---------- random, different every time (or repeatable with a seed) ---------- */
  let state = (Number(seed) || (Date.now() ^ (Math.random() * 0x7fffffff))) >>> 0;
  const usedSeed = state;
  const rand = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const between = (a, b) => a + rand() * (b - a);
  const whole = (a, b) => Math.floor(between(a, b + 1));
  const pick = list => list[Math.floor(rand() * list.length)];

  /* The weather's own random picks use Math.random, so a given seed builds the same streets in any weather. */
  const today = parseDate(date), seasons = seasonsFor(today);
  const picked = LOOKS[weather] ? weather : pickWeather(today);
  const weatherName = seasons.christmas && picked === 'sun' ? 'clear' : picked;   // even when asked for, no sun at Christmas
  const look = seasonalLook(weatherName, seasons), anyPick = list => list[Math.floor(Math.random() * list.length)];
  const colourMap = {};
  for (const [name, to] of Object.entries(look.map)) colourMap[C[name]] = to;
  const glowSet = new Set((look.glow || []).map(n => C[n]));
  /* Seasonal touches also use Math.random, for the same reason. */
  const bareTrees = !!look.snowCaps, autumnTrees = seasons.autumn && !bareTrees && weatherName !== 'tech', xmas = seasons.christmas;
  const chance = k => Math.random() < k, near = r => (Math.random() - 0.5) * 2 * r;
  /* kind 'paint' is cars and people; everything else is scenery */
  function recolor(c, kind) {
    if (kind === 'bulb' || kind === 'lamp') return c;                          // lights keep their own colours in any weather
    if (look.kinds && look.kinds[kind]) return look.kinds[kind];
    if (look.litGlass && c === C.glass) return anyPick(look.windows);
    if (colourMap[c]) return colourMap[c];
    if (weatherName === 'tech') return anyPick(kind === 'paint' ? look.neon : look.walls);
    return c;
  }

  /* ---------- renderer, scene, light ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look.sky);
  let skyTexture = null;
  if (look.skyTop) {                                     // a sky that is deep blue overhead and pale at the horizon
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, look.skyTop); if (look.skyMid) grad.addColorStop(0.5, look.skyMid);
    grad.addColorStop(0.78, look.sky); grad.addColorStop(1, look.sky);
    g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
    skyTexture = new THREE.CanvasTexture(c); skyTexture.colorSpace = THREE.SRGBColorSpace;
    scene.background = skyTexture;
  }
  scene.fog = new THREE.Fog(look.fogColor || look.sky, look.fog[0], look.fog[1]);
  scene.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]));
  const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1]);
  sun.position.set(...(look.sunPos || [130, 230, 90]));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 700 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(sun);

  /* ---------- pieces: collected first, then turned into instanced meshes ---------- */
  const solid = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
  const glass = look.litGlass ? new THREE.MeshBasicMaterial() : new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.25 });
  if (look.warmWindows && glass.emissive) { glass.emissive.set('#ffb347'); glass.emissiveIntensity = 0.62; }   // lamps on inside
  const glowMat = new THREE.MeshBasicMaterial();         // unlit: shows its colour at full strength
  const bulbMat = new THREE.MeshBasicMaterial(), lampMat = new THREE.MeshBasicMaterial();
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); wheelGeo.rotateZ(Math.PI / 2);   // axle along X
  const kinds = {
    box: { geo: new THREE.BoxGeometry(1, 1, 1), mat: solid, items: [] },
    glass: { geo: new THREE.BoxGeometry(1, 1, 1), mat: glass, items: [] },
    cyl: { geo: new THREE.CylinderGeometry(0.5, 0.5, 1, 14), mat: solid, items: [] },
    stud: { geo: new THREE.CylinderGeometry(0.5, 0.5, 1, 8), mat: solid, items: [] },
    cone: { geo: new THREE.ConeGeometry(0.5, 1, 8), mat: solid, items: [] },
    pyramid: { geo: new THREE.ConeGeometry(0.7071, 1, 4, 1, false, Math.PI / 4), mat: solid, items: [] },
    wheel: { geo: wheelGeo, mat: solid, items: [] },
    glow: { geo: new THREE.BoxGeometry(1, 1, 1), mat: glowMat, items: [] },
    bulb: { geo: new THREE.BoxGeometry(1, 1, 1), mat: bulbMat, items: [] },
    lamp: { geo: new THREE.BoxGeometry(1, 1, 1), mat: lampMat, items: [] }
  };
  const UP = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  // Every piece is placed by the centre of its base. group ties it to a building so it can rise with it.
  const eul = new THREE.Euler();
  function put(kind, x, y, z, sx, sy, sz, color, group = -1, turn = 0, tilt = 0) {
    if (kind === 'box' && glowSet.has(color)) kind = 'glow';
    color = recolor(color, kind);
    q.setFromEuler(eul.set(tilt, turn, 0, 'YXZ'));
    kinds[kind].items.push({ m: new THREE.Matrix4().compose(p.set(x, y + sy / 2, z), q, sc.set(sx, sy, sz)), c: color, g: group });
  }
  const box = (x, y, z, w, h, d, color, g, turn) => put('box', x, y, z, w, h, d, color, g, turn);
  const cyl = (x, y, z, r, h, color, g) => put('cyl', x, y, z, r * 2, h, r * 2, color, g);
  const stud = (x, y, z, color, g) => put('stud', x, y, z, 0.6, 0.2, 0.6, color, g);
  const cone = (x, y, z, r, h, color, g) => put('cone', x, y, z, r * 2, h, r * 2, color, g);

  const groups = [];                                     // one per building: when it starts to rise
  const newGroup = (x, z) => groups.push({ start: Math.hypot(x, z) * 0.011 + rand() * 0.3 }) - 1;

  /* ---------- trees, cars at rest ---------- */
  const bulb = (x, y, z, c, g, sz = 0.26) => put('bulb', x, y - sz / 2, z, sz, sz, sz, c, g);
  /* A leafless crown: a thinner upper trunk with branches crossing it at a few heights.
     In the snow each branch carries a thin line of snow. */
  function bareCrown(x, y, z, size, g) {
    cyl(x, y + 1.4 * size, z, 0.17 * size, 1.7 * size, C.trunk, g);
    for (let k = 0; k < 4; k++) {
      const h = y + (1.75 + k * 0.42) * size, len = (2.0 - k * 0.32) * size, turn = Math.random() * Math.PI;
      box(x, h, z, len, 0.14 * size, 0.14 * size, C.trunk, g, turn);
      if (bareTrees) box(x, h + 0.14 * size, z, len * 0.8, 0.07 * size, 0.15 * size, SNOW, g, turn);
    }
  }
  function sparkle(x, y, z, size, g, count, height, radius) {
    for (let k = 0; k < count; k++) {
      const t = Math.random(), a = Math.random() * Math.PI * 2, [h0, h1] = height, [r0, r1] = radius;
      const r = (r0 + (r1 - r0) * t) * size;
      bulb(x + Math.cos(a) * r, y + (h0 + (h1 - h0) * t) * size, z + Math.sin(a) * r, SPARKLES[k % SPARKLES.length], g, 0.18 * size);
    }
  }
  function tree(x, y, z, g = -1, size = 1) {
    cyl(x, y, z, 0.3 * size, 1.5 * size, C.trunk, g);
    if (rand() < 0.5) {                                  // pine: evergreen in every season
      cone(x, y + 1.3 * size, z, 1.5 * size, 2.3 * size, C.leaf, g);
      cone(x, y + 2.6 * size, z, 1.1 * size, 1.9 * size, C.leaf, g);
      if (look.snowCaps) cone(x, y + 3.55 * size, z, 0.72 * size, 0.95 * size, SNOW, g);
      if (xmas) sparkle(x, y, z, size, g, 7, [1.55, 3.9], [1.42, 0.45]);
      return;
    }
    if (bareTrees) {                                     // snow: no leaves at all
      bareCrown(x, y, z, size, g);
      if (xmas) sparkle(x, y, z, size, g, 5, [1.9, 3.1], [0.9, 0.5]);
      return;
    }
    if (autumnTrees) {
      const r = Math.random();
      if (r < 0.5) {                                     // full, turned orange
        cyl(x, y + 1.4 * size, z, 1.4 * size, 1.1 * size, anyPick(AUTUMN), g);
        cyl(x, y + 2.5 * size, z, 1.0 * size, 0.9 * size, anyPick(AUTUMN), g);
        stud(x, y + 3.4 * size, z, anyPick(AUTUMN), g);
      } else if (r < 0.82) {                             // half bare
        bareCrown(x, y, z, size, g);
        cyl(x + near(0.4 * size), y + 2.2 * size, z + near(0.4 * size), 0.9 * size, 0.75 * size, anyPick(AUTUMN), g);
      } else {                                           // nearly bare, a few leaves left
        bareCrown(x, y, z, size, g);
        for (let k = 0; k < 4; k++) stud(x + near(0.8 * size), y + (2.0 + Math.random() * 1.2) * size, z + near(0.8 * size), anyPick(AUTUMN), g);
      }
      for (let k = 0; k < 4; k++) stud(x + near(1.6 * size), y, z + near(1.6 * size), anyPick(AUTUMN), g);   // fallen leaves
      if (xmas) sparkle(x, y, z, size, g, 5, [1.6, 3.0], [1.1, 0.6]);
      return;
    }
    cyl(x, y + 1.4 * size, z, 1.4 * size, 1.1 * size, C.leafLight, g);
    cyl(x, y + 2.5 * size, z, 1.0 * size, 0.9 * size, C.leafLight, g);
    stud(x, y + 3.4 * size, z, C.leafLight, g);
    if (xmas) sparkle(x, y, z, size, g, 6, [1.55, 2.95], [1.42, 1.02]);
  }
  function parkedCar(x, y, z, turn, g) {
    const color = pick(CARS), s = Math.sin(turn), c = Math.cos(turn);
    box(x, y + 0.35, z, 1.8, 0.8, 3.8, color, g, turn);
    put('glass', x - s * 0.2, y + 1.15, z - c * 0.2, 1.6, 0.7, 1.9, C.glassDark, g, turn);
    for (const a of [-1, 1]) for (const b of [-1, 1])
      put('wheel', x + c * a * 0.9 + s * b * 1.2, y, z - s * a * 0.9 + c * b * 1.2, 0.35, 0.8, 0.8, C.tyre, g, turn);
  }

  /* ---------- ground and roads ---------- */
  /* The railway loop (see "railway" below) dips under each main road: an open cutting slopes down on
     each side, and the middle, under the road, is a covered tunnel. The ground is laid in pieces that
     leave those cuttings open. */
  const RING = 80, RC = 14, RS = RING - RC, BR = 16, FAR_RAIL = 400;
  const COVER = 9, RAMP_END = 22, DEPTH = 5, CUT_W = 3;     // tunnel where |d| < 9, ramps from 9 to 22, 5 deep
  const cuts = [];
  for (const sd of [-1, 1]) for (const [a0, a1] of [[COVER, RAMP_END], [-RAMP_END, -COVER]]) {
    cuts.push([a0, a1, sd * RING - CUT_W, sd * RING + CUT_W]);      // [x0, x1, z0, z1]: top and bottom of the loop
    cuts.push([sd * RING - CUT_W, sd * RING + CUT_W, a0, a1]);      // left and right
  }
  {
    const xs = [...new Set([-1300, 1300, ...cuts.flatMap(c => [c[0], c[1]])])].sort((a, b) => a - b);
    const zs = [...new Set([-1300, 1300, ...cuts.flatMap(c => [c[2], c[3]])])].sort((a, b) => a - b);
    for (let a = 1; a < xs.length; a++) for (let b = 1; b < zs.length; b++) {
      const mx = (xs[a - 1] + xs[a]) / 2, mz = (zs[b - 1] + zs[b]) / 2;
      if (cuts.some(c => mx > c[0] && mx < c[1] && mz > c[2] && mz < c[3])) continue;
      box(mx, -1.2, mz, xs[a] - xs[a - 1], 1.2, zs[b] - zs[b - 1], C.grass);
    }
  }
  box(0, 0, 0, HALF * 2, 0.2, HALF * 2, C.road);                               // the city sits on its roads
  for (const s of [-1, 1]) {                                                    // two roads run on out to the horizon
    box(0, 0, s * (HALF + 340), ROAD, 0.2, 680, C.road);
    box(s * (HALF + 340), 0, 0, 680, 0.2, ROAD, C.road);
  }
  const roadLines = Array.from({ length: N + 1 }, (_, i) => -HALF + ROAD / 2 + i * PITCH);
  for (const c of roadLines) {
    const far = Math.abs(c) < 0.01 ? 380 : HALF;                                // the two main roads keep their lines
    for (let t = -far + 1.5; t < far; t += 4) {
      if (roadLines.some(r => Math.abs(t + 1 - r) < ROAD / 2 + 1.8) && Math.abs(t) < HALF) continue;   // no dashes in junctions or crossings
      box(c, 0.2, t + 1, 0.25, 0.04, 2, C.line);
      box(t + 1, 0.2, c, 2, 0.04, 0.25, C.line);
    }
  }

  if (look.puddles) for (let i = 0; i < 70; i++) {
    const line = roadLines[Math.floor(Math.random() * roadLines.length)], along = (Math.random() - 0.5) * HALF * 2;
    const r = 0.7 + Math.random() * 1.2, across = (Math.random() - 0.5) * 3;
    Math.random() < 0.5 ? cyl(line + across, 0.2, along, r, 0.03, '#8ea3b6') : cyl(along, 0.2, line + across, r, 0.03, '#8ea3b6');
  }

  /* ---------- railway ----------
     A loop of track round the town in the green margin, with three branch lines running off the map:
     north, east and south. Where the loop meets a main road it slopes down into an open cutting, runs
     through a covered tunnel under the road, and climbs back up the other side. Straight track is laid
     as long brick pieces; curves are separate, lighter curved pieces set end to end along it. The
     stations and the cargo yard are on the town side of the track, each joined to the town by a sidewalk
     and a zebra crossing over the outer road. All trains run the same way round the loop. */
  const TUNNEL = COVER;
  const arcPts = (cx, cz, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / n; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
  const inTunnel = (x, z) => (Math.abs(x) < TUNNEL && Math.abs(Math.abs(z) - RING) < 12) || (Math.abs(z) < TUNNEL && Math.abs(Math.abs(x) - RING) < 12);
  const smooth = t => t * t * (3 - 2 * t);
  /* Height of the rails: 0 at ground level, sloping down to -DEPTH through the cuttings and tunnel. */
  function railY(x, z) {
    let d = Infinity;
    if (Math.abs(Math.abs(z) - RING) < 2.5 && Math.abs(x) < RAMP_END) d = Math.abs(x);
    else if (Math.abs(Math.abs(x) - RING) < 2.5 && Math.abs(z) < RAMP_END) d = Math.abs(z);
    if (d === Infinity) return 0;
    return d <= COVER ? -DEPTH : -DEPTH * smooth((RAMP_END - d) / (RAMP_END - COVER));
  }
  const ringPts = [];
  const addRing = pts => { for (const q2 of pts) { const l = ringPts[ringPts.length - 1]; if (!l || Math.hypot(l[0] - q2[0], l[1] - q2[1]) > 0.01) ringPts.push(q2); } };
  addRing([[-RS, -RING], [RS, -RING]]); addRing(arcPts(RS, -RS, RC, -Math.PI / 2, 0, 12));
  addRing([[RING, -RS], [RING, RS]]); addRing(arcPts(RS, RS, RC, 0, Math.PI / 2, 12));
  addRing([[RS, RING], [-RS, RING]]); addRing(arcPts(-RS, RS, RC, Math.PI / 2, Math.PI, 12));
  addRing([[-RING, RS], [-RING, -RS]]); addRing(arcPts(-RS, -RS, RC, Math.PI, 1.5 * Math.PI, 12)); addRing([[-RS, -RING]]);
  const ringPath = makePath(ringPts), RL = ringPath.len;
  const wrap = v => ((v % RL) + RL) % RL;
  function ringS(x, z) {                                  // distance round the loop to the point nearest (x, z)
    let best = Infinity, at = 0;
    for (let k = 1; k < ringPts.length; k++) {
      const [ax, az] = ringPts[k - 1], [bx, bz] = ringPts[k], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best) { best = d; at = ringPath.cum[k - 1] + t * Math.sqrt(l2); }
    }
    return at;
  }
  /* Branch lines: the straight part out to the edge of the map, then the curve that joins the loop. */
  const northIn = [[-46, -FAR_RAIL], [-46, -RING - BR], ...arcPts(-30, -RING - BR, BR, Math.PI, Math.PI / 2, 8).slice(1)];
  const eastIn = [[FAR_RAIL, -40], [RING + BR, -40], ...arcPts(RING + BR, -40 + BR, BR, -Math.PI / 2, -Math.PI, 8).slice(1)];
  const southOut = [...arcPts(36, RING + BR, BR, -Math.PI / 2, -Math.PI, 8), [20, FAR_RAIL]];
  /* Stations (yellow on the plan) and the cargo yard (pink): [x, z, and the direction toward town]. */
  const stations = [[-RING, -58, 1, 0], [55, -RING, 0, 1], [-RING, 40, 1, 0], [46, RING, 0, -1]];
  const cargoYard = [60, RING, 0, -1];

  /* Things trees and pillars must keep clear of. */
  const keepClear = [];
  for (const line of [ringPts, northIn, eastIn, southOut]) for (let k = 1; k < line.length; k++) {
    const [ax, az] = line[k - 1], [bx, bz] = line[k], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 2);
    for (let m = 0; m <= n; m++) keepClear.push([ax + (bx - ax) * m / n, az + (bz - az) * m / n, 0]);
  }
  for (const [x, z, nx, nz] of [...stations, cargoYard]) keepClear.push([x + nx * 5, z + nz * 5, 8]);
  const nearTrack = (x, z, m) => keepClear.some(([kx, kz, r]) => Math.hypot(kx - x, kz - z) < m + r);

  const TRACK = '#858b94', CURVE = '#a3aab3', CUT_FILL = '#7a6a55';
  function trackPiece(ax, az, bx, bz, curve) {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (L < 0.05 || inTunnel(mx, mz)) return;
    const yaw = Math.atan2(dx, dz), ux = dx / L, uz = dz / L, rx = -uz, rz = ux, len = L - 0.14, plate = curve ? CURVE : TRACK;
    const y0 = railY(ax, az), y1 = railY(bx, bz);
    if (y0 === 0 && y1 === 0) {
      box(mx, 0, mz, 3.4, 0.3, len, plate, -1, yaw);
      for (let t = -len / 2 + 0.6; t < len / 2; t += 1.25) box(mx + ux * t, 0.3, mz + uz * t, 2.7, 0.12, 0.45, '#6b4a2b', -1, yaw);
      for (const sd of [-1, 1]) box(mx + rx * 0.72 * sd, 0.42, mz + rz * 0.72 * sd, 0.18, 0.2, len, '#c9ced6', -1, yaw);
      for (const e of [-1, 1]) for (const sd of [-1, 1]) stud(mx + ux * e * (len / 2 - 0.5) + rx * 1.4 * sd, 0.3, mz + uz * e * (len / 2 - 0.5) + rz * 1.4 * sd, plate);
      return;
    }
    /* On a ramp: a short tilted piece, with earth filled in below it down to the floor of the cutting. */
    const y = (y0 + y1) / 2, tilt = -Math.atan2(y1 - y0, L);
    put('box', mx, y, mz, 3.4, 0.3, L + 0.05, plate, -1, yaw, tilt);
    put('box', mx, y + 0.3, mz, 2.7, 0.12, 0.45, '#6b4a2b', -1, yaw, tilt);
    for (const sd of [-1, 1]) put('box', mx + rx * 0.72 * sd, y + 0.42, mz + rz * 0.72 * sd, 0.18, 0.2, L + 0.05, '#c9ced6', -1, yaw, tilt);
    const floor = -DEPTH - 0.4, top = Math.min(y0, y1);
    if (top > floor) box(mx, floor, mz, CUT_W * 2 - 0.6, top - floor, L + 0.05, CUT_FILL, -1, yaw);
  }
  /* Straight track in long pieces, except near the cuttings, where it is cut short so it can slope. */
  function straightRun(a, b) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 1.6));
    const pts = Array.from({ length: n + 1 }, (_, k) => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    let start = 0;
    for (let k = 1; k <= n; k++) {
      const flat = railY(pts[k - 1][0], pts[k - 1][1]) === 0 && railY(pts[k][0], pts[k][1]) === 0;
      if (!flat) {
        if (k - 1 > start) trackPiece(pts[start][0], pts[start][1], pts[k - 1][0], pts[k - 1][1], false);
        trackPiece(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], false);
        start = k;
      } else if (k === n || Math.hypot(pts[k][0] - pts[start][0], pts[k][1] - pts[start][1]) >= 8) {
        trackPiece(pts[start][0], pts[start][1], pts[k][0], pts[k][1], false); start = k;
      }
    }
  }
  const curveRun = pts => { for (let k = 1; k < pts.length; k++) trackPiece(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], true); };
  straightRun([-RS, -RING], [RS, -RING]); curveRun(arcPts(RS, -RS, RC, -Math.PI / 2, 0, 4));
  straightRun([RING, -RS], [RING, RS]); curveRun(arcPts(RS, RS, RC, 0, Math.PI / 2, 4));
  straightRun([RS, RING], [-RS, RING]); curveRun(arcPts(-RS, RS, RC, Math.PI / 2, Math.PI, 4));
  straightRun([-RING, RS], [-RING, -RS]); curveRun(arcPts(-RS, -RS, RC, Math.PI, 1.5 * Math.PI, 4));
  straightRun(northIn[0], northIn[1]); curveRun(arcPts(-30, -RING - BR, BR, Math.PI, Math.PI / 2, 4));
  straightRun(eastIn[0], eastIn[1]); curveRun(arcPts(RING + BR, -40 + BR, BR, -Math.PI / 2, -Math.PI, 4));
  curveRun(arcPts(36, RING + BR, BR, -Math.PI / 2, -Math.PI, 4)); straightRun([20, RING + BR], [20, FAR_RAIL]);

  /* The cuttings: a gravel floor and concrete retaining walls with a coping along the top. */
  for (const [x0, x1, z0, z1] of cuts) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = x1 - x0 > z1 - z0, len = alongX ? x1 - x0 : z1 - z0;
    box(cx, -DEPTH - 0.8, cz, x1 - x0, 0.4, z1 - z0, '#5a5048');
    for (const sd of [-1, 1]) {
      const wx = alongX ? cx : cx + sd * (CUT_W - 0.25), wz = alongX ? cz + sd * (CUT_W - 0.25) : cz;
      box(wx, -DEPTH - 0.4, wz, alongX ? len : 0.5, DEPTH + 0.4, alongX ? 0.5 : len, '#9aa0a8');
      box(wx, 0, wz, alongX ? len : 0.8, 0.25, alongX ? 0.8 : len, '#6c737d');
    }
  }
  /* Tunnel mouths down in the cuttings, where the track goes under the covered part beneath the road. */
  for (const [cx, cz, ax] of [[0, -RING, 'x'], [0, RING, 'x'], [-RING, 0, 'z'], [RING, 0, 'z']]) for (const sd of [-1, 1]) {
    const nx = ax === 'x' ? sd : 0, nz = ax === 'z' ? sd : 0, px = cx + nx * COVER, pz = cz + nz * COVER, yaw = Math.atan2(nx, nz);
    const acx = Math.abs(nz), acz = Math.abs(nx);
    for (const e of [-1, 1]) box(px - nx * 0.4 + acx * e * 2.4, -DEPTH - 0.4, pz - nz * 0.4 + acz * e * 2.4, 1.2, DEPTH + 0.4, 0.8, '#7d8590', -1, yaw);
    box(px - nx * 0.4, -1.5, pz - nz * 0.4, 6.0, 1.5, 0.8, '#7d8590', -1, yaw);
    box(px - nx * 0.9, -DEPTH - 0.4, pz - nz * 0.9, 3.6, DEPTH - 1.1, 0.2, '#15171c', -1, yaw);
    box(px - nx * 0.4, 0, pz - nz * 0.4, 6.6, 0.35, 1.2, '#6c737d', -1, yaw);
  }

  /* A sidewalk from a stop to the outer road, and a zebra crossing over the road into town. */
  function walkway(x, z, nx, nz, from) {
    const yawN = Math.atan2(nx, nz), toRoad = RING - (HALF);       // the outer road's edge, measured from the track
    box(x + nx * (from + toRoad) / 2, 0, z + nz * (from + toRoad) / 2, 2.0, 0.32, toRoad - from, '#cfd3d8', -1, yawN);
    for (let o = toRoad + 0.4; o <= toRoad + ROAD - 0.3; o += 0.85) box(x + nx * o, 0.2, z + nz * o, 1.6, 0.04, 0.45, C.line, -1, yawN);
  }
  /* Stations: a platform with a yellow edge line on the track side, a shelter, a sign, and people waiting. */
  const WAITING = ['#0ed145', '#b23ac4', '#00a8f3', '#ed1c24', '#f28c28', '#ffffff', '#3f48cc'];
  for (const [x, z, nx, nz] of stations) {
    const ax = nz !== 0 ? 1 : 0, az = nx !== 0 ? 1 : 0, yaw = Math.atan2(ax, az), cx = x + nx * 3.3, cz = z + nz * 3.3;
    box(cx, 0, cz, 3.0, 0.7, 12, '#cfd3d8', -1, yaw);
    box(x + nx * 1.95, 0.7, z + nz * 1.95, 0.22, 0.03, 12, '#fff200', -1, yaw);
    for (const e of [-2.2, 2.2]) cyl(cx + nx * 0.9 + ax * e, 0.7, cz + nz * 0.9 + az * e, 0.1, 2.3, '#3a3f48');
    box(cx + nx * 0.5, 3.0, cz + nz * 0.5, 2.6, 0.25, 5.4, '#3f48cc', -1, yaw);
    cyl(cx + nx * 1.0 + ax * 5, 0.7, cz + nz * 1.0 + az * 5, 0.08, 2.2, '#3a3f48');
    box(cx + nx * 1.0 + ax * 5, 2.6, cz + nz * 1.0 + az * 5, 0.12, 0.7, 1.4, '#fff200', -1, yaw);
    for (const t of [-3.4, -1.4, 0.4, 3.6]) {
      if (Math.random() < 0.25) continue;
      const px = cx + ax * t + nx * 0.2, pz = cz + az * t + nz * 0.2;
      box(px, 0.7, pz, 0.42, 0.62, 0.3, '#2a318f'); box(px, 1.32, pz, 0.5, 0.6, 0.34, anyPick(WAITING)); box(px, 1.92, pz, 0.36, 0.36, 0.36, '#ffe6a3');
    }
    walkway(x, z, nx, nz, 4.8);
  }
  /* The cargo yard: a concrete pad with stacked containers, a lorry waiting to be loaded, and its own walkway. */
  {
    const [x, z, nx, nz] = cargoYard, ax = nz !== 0 ? 1 : 0, az = nx !== 0 ? 1 : 0, yaw = Math.atan2(ax, az), cx = x + nx * 4.9, cz = z + nz * 4.9;
    box(cx, 0, cz, 6.4, 0.4, 14, '#b8bdc4', -1, yaw);
    box(x + nx * 1.95, 0.4, z + nz * 1.95, 0.25, 0.03, 14, '#ff3df2', -1, yaw);
    const BOXES = ['#ed1c24', '#3f48cc', '#0ed145', '#f28c28', '#00a8f3', '#ffffff'];
    for (const t of [-4.6, 0, 4.6]) {
      const bx = cx + ax * t + nx * 1.4, bz = cz + az * t + nz * 1.4;
      box(bx, 0.4, bz, 2.3, 2.3, 4.3, anyPick(BOXES), -1, yaw);
      if (Math.random() < 0.6) box(bx, 2.7, bz, 2.3, 2.3, 4.3, anyPick(BOXES), -1, yaw);
    }
    const lx = cx + ax * 9.5, lz = cz + az * 9.5;                       // a lorry parked at the end of the pad
    box(lx + ax * 2.3, 0.5, lz + az * 2.3, 2.1, 1.8, 1.9, '#f28c28', -1, yaw);
    box(lx - ax * 1.0, 0.5, lz - az * 1.0, 2.3, 2.4, 4.6, '#d8dde3', -1, yaw);
    for (const e of [2.4, -0.6, -2.4]) for (const sd of [-1, 1]) put('wheel', lx + ax * e + nx * sd, 0, lz + az * e + nz * sd, 0.4, 1.0, 1.0, C.tyre, -1, yaw);
    walkway(x - ax * 3, z - az * 3, nx, nz, 8.1);
  }

  /* ---------- tech city: skyways ----------
     Three raised road loops weave across the town and out past its edge, each at its own height so
     they pass over one another. Buildings under a skyway are kept low enough to clear it. */
  const tech = weatherName === 'tech';
  const skyways = [];
  if (tech) for (let k = 0; k < 3; k++) {
    const ctrl = [], n = 6, a0 = Math.random() * Math.PI * 2, base = 23 + k * 8;
    for (let m = 0; m < n; m++) {
      const a = a0 + (m / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const r = m % 2 ? 22 + Math.random() * 38 : 92 + Math.random() * 35;     // in and out across the town
      ctrl.push(new THREE.Vector3(Math.cos(a) * r, base + Math.random() * 3, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
    const len = curve.getLength(), count = Math.ceil(len / 1.5);
    skyways.push({ curve, len, count, pts: curve.getSpacedPoints(count) });
  }
  /* The lowest skyway deck above a spot, or Infinity. */
  function skyAbove(x, z, r) {
    let y = Infinity;
    for (const sw of skyways) for (const q2 of sw.pts) if (Math.abs(q2.x - x) < r + 3 && Math.abs(q2.z - z) < r + 3) y = Math.min(y, q2.y);
    return y;
  }
  /* How many floors fit under the skyway above, leaving room for roof details. */
  const floorsUnder = (x, z, r) => { const y = skyAbove(x, z, r); return y === Infinity ? Infinity : Math.max(1, Math.floor((y - 7 - 0.55 - 2.2) / 2) + 1); };

  /* ---------- buildings ---------- */
  const TOP = 0.55;                                      // top of the pavement
  function roofTop(x, y, z, w, d, wall, g, tall) {
    const step = w * d > 70 ? 2 : 1;
    if (look.snowCaps) { box(x, y, z, w, 0.4, d, SNOW, g); y += 0.4; }                 // snow covers the studs
    else for (let a = 0.5; a < w; a += step) for (let b = 0.5; b < d; b += step) stud(x - w / 2 + a, y, z - d / 2 + b, wall, g);
    if (look.neonRims) {
      for (const s of [-1, 1]) { box(x, y, z + s * (d / 2 - 0.08), w, 0.16, 0.16, C.line, g); box(x + s * (w / 2 - 0.08), y, z, 0.16, 0.16, d, C.line, g); }
    }
    const r = rand();
    if (r < 0.25) { cyl(x + between(-1, 1), y, z + between(-1, 1), 1.0, 1.6, C.silo, g); }                    // water tank
    else if (r < 0.5) { box(x + between(-1, 1), y, z + between(-1, 1), 1.8, 0.9, 1.4, C.roof, g); }           // air conditioner
    else if (r < 0.65) { box(x, y, z, w - 1.4, 0.3, d - 1.4, C.lawn, g); tree(x, y + 0.3, z, g, 0.6); }       // roof garden
    else if (r < 0.8 && tall) { cyl(x, y, z, 0.12, between(3, 6), C.roof, g); }                               // mast
    else if (tall && w > 8) { cyl(x, y, z, w * 0.3, 0.12, C.white, g); box(x, y + 0.12, z, w * 0.36, 0.03, 0.5, C.barn, g); }   // helipad
  }
  /* A string of little lights round the top edge of a building, at Christmas. Some buildings get
     coloured bulbs, some warm white, some none. */
  function lightsAround(x, y, z, w, d, g) {
    if (!xmas || chance(0.25)) return;
    const colours = chance(0.55) ? XMAS_BULBS : [WARM_BULB], STEP = 0.75;
    let n = 0;
    for (let t = -w / 2 + 0.3; t <= w / 2 - 0.3; t += STEP) for (const sd of [-1, 1]) bulb(x + t, y - 0.18, z + sd * (d / 2 + 0.07), colours[n++ % colours.length], g);
    for (let t = -d / 2 + 0.3; t <= d / 2 - 0.3; t += STEP) for (const sd of [-1, 1]) bulb(x + sd * (w / 2 + 0.07), y - 0.18, z + t, colours[n++ % colours.length], g);
  }
  function building(x, z, w, d, floors, g) {
    if (tech) floors = Math.min(floors, floorsUnder(x, z, Math.max(w, d) / 2));
    const wall = pick(WALLS);
    let y = TOP;
    box(x, y, z, w, 2.2, d, wall, g);
    box(x, y, z + d / 2, Math.min(1.6, w * 0.3), 1.6, 0.16, C.glassDark, g);       // door
    box(x, y + 1.7, z + d / 2 + 0.35, Math.min(2.6, w * 0.5), 0.2, 0.8, pick(CARS), g);   // awning
    y += 2.2;
    for (let f = 1; f < floors; f++) {
      put('glass', x, y, z, w - 0.5, 1.5, d - 0.5, C.glass, g);
      for (const a of [-1, 1]) for (const b of [-1, 1]) box(x + a * (w / 2 - 0.3), y, z + b * (d / 2 - 0.3), 0.6, 1.5, 0.6, wall, g);
      y += 1.5;
      box(x, y, z, w, 0.5, d, wall, g);
      y += 0.5;
    }
    lightsAround(x, y, z, w, d, g);
    if (floors <= 2 && rand() < 0.6) {                   // a low building often gets a pitched roof
      put('pyramid', x, y, z, w + 0.6, between(1.6, 2.6), d + 0.6, pick(ROOFS), g);
      return;
    }
    roofTop(x, y, z, w, d, wall, g, floors > 5);
    return y;
  }
  function tower(x, z, maxFloors, g) {
    const wall = pick(WALLS), w = whole(9, 12), d = whole(9, 12);
    let lower = Math.max(3, Math.round(maxFloors * between(0.45, 0.75))), upper = Math.round(maxFloors * between(0.3, 0.6));
    const fits = tech ? floorsUnder(x, z, 6.5) : Infinity;
    if (lower + upper > fits) { const f = fits / (lower + upper); lower = Math.max(1, Math.floor(lower * f)); upper = Math.max(0, Math.floor(upper * f)); }
    let y = TOP;
    box(x, y, z, w, 2.4, d, wall, g);
    box(x, y, z + d / 2, 2.4, 1.8, 0.16, C.glassDark, g);
    y += 2.4;
    const tier = (tw, td, count) => {
      for (let f = 0; f < count; f++) {
        put('glass', x, y, z, tw - 0.5, 1.5, td - 0.5, C.glass, g);
        for (const a of [-1, 1]) for (const b of [-1, 1]) box(x + a * (tw / 2 - 0.35), y, z + b * (td / 2 - 0.35), 0.7, 1.5, 0.7, wall, g);
        y += 1.5; box(x, y, z, tw, 0.5, td, wall, g); y += 0.5;
      }
    };
    tier(w, d, lower);
    lightsAround(x, y, z, w, d, g);
    for (let a = 0.5; a < w; a += 2) for (let b = 0.5; b < d; b += 2) if (Math.abs(a - w / 2) > w / 2 - 2 || Math.abs(b - d / 2) > d / 2 - 2) stud(x - w / 2 + a, y, z - d / 2 + b, wall, g);
    tier(w - 3, d - 3, upper);
    lightsAround(x, y, z, w - 3, d - 3, g);
    roofTop(x, y, z, w - 3, d - 3, wall, g, true);
    if (tech && fits === Infinity) box(x, y, z, 0.35, 6 + rand() * 8, 0.35, C.line, g);   // a glowing spire
  }
  function park(x, z, g) {
    box(x, TOP, z, BLOCK - 1, 0.25, BLOCK - 1, C.lawn, g);
    if (rand() < 0.6) { cyl(x + between(-3, 3), TOP + 0.25, z + between(-3, 3), between(2, 3.2), 0.08, C.water, g); }
    for (let i = whole(5, 9); i > 0; i--) tree(x + between(-6.5, 6.5), TOP + 0.25, z + between(-6.5, 6.5), g, between(0.8, 1.15));
    for (let i = 0; i < 26; i++) stud(x + whole(-7, 7), TOP + 0.25, z + whole(-7, 7), C.lawn, g);
  }
  function carPark(x, z, g) {
    box(x, TOP, z, BLOCK - 1, 0.1, BLOCK - 1, C.asphalt, g);
    for (let i = -2; i <= 2; i++) {
      for (const s of [-1, 1]) {
        box(x + i * 2.8 - 1.4, TOP + 0.1, z + s * 4.4, 0.15, 0.03, 4.4, C.line, g);
        if (rand() < 0.6) parkedCar(x + i * 2.8, TOP + 0.1, z + s * 4.4, s > 0 ? 0 : Math.PI, g);
      }
    }
  }

  const blocks = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = -HALF + ROAD + i * PITCH + BLOCK / 2, z = -HALF + ROAD + j * PITCH + BLOCK / 2;
    blocks.push([x, z]);
    const mid = (N - 1) / 2, edge = Math.hypot(i - mid, j - mid) / Math.hypot(mid, mid);   // 0 in the centre, 1 at a corner
    const maxFloors = (2 + Math.pow(1 - edge, 1.4) * 13) * (tech ? 2.6 : 1);   // the tech city builds much taller
    box(x, 0.2, z, BLOCK, 0.35, BLOCK, C.pavement);
    const r = rand();
    if (r < 0.12) park(x, z, newGroup(x, z));
    else if (r < 0.2) carPark(x, z, newGroup(x, z));
    else if (r < (tech ? 0.62 : 0.42) && edge < (tech ? 0.95 : 0.75)) tower(x, z, maxFloors, newGroup(x, z));
    else for (const a of [-4, 4]) for (const b of [-4, 4]) {
      if (rand() < 0.08) { const g = newGroup(x + a, z + b); tree(x + a, TOP, z + b, g); continue; }   // an empty lot with a tree
      const bx = x + a + between(-0.4, 0.4), bz = z + b + between(-0.4, 0.4);
      building(bx, bz, whole(4, 6), whole(4, 6), 1 + Math.floor(rand() * maxFloors), newGroup(bx, bz));
    }
    for (let t = whole(1, 3); t > 0; t--) {              // street trees on the pavement edge
      const side = pick([-1, 1]), along = between(-6.5, 6.5), g = newGroup(x, z);
      if (rand() < 0.5) tree(x + side * 6.9, TOP, z + along, g, 0.7); else tree(x + along, TOP, z + side * 6.9, g, 0.7);
    }
  }

  /* ---------- zebra crossings ----------
     On every arm of every junction inside town, where people cross from one block's corner to the next. */
  const CROSS_AT = ROAD / 2 + (BLOCK / 2 - (BLOCK / 2 - 0.45));     // the line people walk on, measured from the junction centre
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const cx = roadLines[i], cz = roadLines[j];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + dx, nj = j + dz;
      if (ni < 0 || ni > N || nj < 0 || nj > N) continue;
      for (let a = -2.55; a <= 2.56; a += 0.85) {
        if (dx) box(cx + dx * CROSS_AT, 0.2, cz + a, 1.2, 0.04, 0.45, C.line);
        else box(cx + a, 0.2, cz + dz * CROSS_AT, 0.45, 0.04, 1.2, C.line);
      }
    }
  }
  /* Street lamps at the corners of every block, all year. They are lit after dusk and in the tech city,
     and show a plain unlit glass head in daytime. */
  const lampsLit = !!look.streetLamps || weatherName === 'tech';
  for (const [x, z] of blocks) for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const lx = x + a * 7.35, lz = z + b * 7.35;
    cyl(lx, TOP, lz, 0.12, 3.3, '#3a3f48');
    box(lx - a * 0.3, TOP + 3.2, lz - b * 0.3, 0.7, 0.12, 0.7, '#3a3f48');
    if (lampsLit) put('lamp', lx - a * 0.3, TOP + 3.02, lz - b * 0.3, 0.5, 0.2, 0.5, weatherName === 'tech' ? '#29f0ff' : '#ffd98a');
    else box(lx - a * 0.3, TOP + 3.02, lz - b * 0.3, 0.5, 0.2, 0.5, '#d9dee4');
  }

  /* Skyway decks: a dark road with pale glowing edges, laid in short flat pieces along each loop.
     Pillars stand on the centre line of a street (between the two lanes, away from junctions and
     crossings) or out on the grass, so nothing on the ground drives or flies into them. */
  for (const sw of skyways) {
    let lastPillar = -99;
    for (let m = 0; m < sw.count; m++) {
      const a = sw.pts[m], b = sw.pts[m + 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2, yaw = Math.atan2(dx, dz), rx = -dz / L, rz = dx / L;
      box(mx, my - 0.5, mz, 3.4, 0.5, L + 0.3, '#141a2b', -1, yaw);
      for (const sd of [-1, 1]) put('lamp', mx + rx * 1.65 * sd, my - 0.06, mz + rz * 1.65 * sd, 0.16, 0.16, L + 0.3, '#ffeec8', -1, yaw);
      if (m - lastPillar < 4) continue;
      const inside = Math.abs(a.x) < HALF && Math.abs(a.z) < HALF;
      if (inside) {
        for (const R of roadLines) {
          if (Math.abs(a.x - R) < 0.75 && !roadLines.some(R2 => Math.abs(a.z - R2) < 4.6)) { cyl(R, 0, a.z, 0.25, a.y - 0.5, '#2a3350'); lastPillar = m; break; }
          if (Math.abs(a.z - R) < 0.75 && !roadLines.some(R2 => Math.abs(a.x - R2) < 4.6)) { cyl(a.x, 0, R, 0.25, a.y - 0.5, '#2a3350'); lastPillar = m; break; }
        }
      } else if (m - lastPillar > 14 && Math.abs(a.x) > 6 && Math.abs(a.z) > 6 && !nearTrack(a.x, a.z, 3)) { cyl(a.x, 0, a.z, 0.55, a.y - 0.5, '#2a3350'); lastPillar = m; }
    }
  }

  /* ---------- the open ground around the city ----------
     Plain green with trees: a ring of them close to town, and more spread thinly out to the horizon. */
  for (let i = 0; i < 150; i++) {
    const far = rand() < 0.6, a = between(0, 6.28), dist = far ? between(HALF + 30, 520) : 0;
    let x = far ? Math.cos(a) * dist : between(-HALF - 17, HALF + 17), z = far ? Math.sin(a) * dist : between(-HALF - 17, HALF + 17);
    if (!far && Math.abs(x) < HALF + 4 && Math.abs(z) < HALF + 4) { if (rand() < 0.5) x = Math.sign(x || 1) * (HALF + between(5, 17)); else z = Math.sign(z || 1) * (HALF + between(5, 17)); }
    if (Math.abs(x) < 6 || Math.abs(z) < 6 || nearTrack(x, z, 3.5)) continue;      // keep the roads and the railway clear
    tree(x, 0, z, -1, between(1, far ? 2.2 : 1.5));
  }

  /* ---------- turn the collected pieces into instanced meshes ---------- */
  const tint = new THREE.Color(), rising = [];
  for (const kind of Object.values(kinds)) {
    if (!kind.items.length) continue;
    const mesh = new THREE.InstancedMesh(kind.geo, kind.mat, kind.items.length);
    mesh.castShadow = true; mesh.receiveShadow = true;
    kind.items.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, tint.set(it.c)); if (it.g >= 0) rising.push({ mesh, i, m: it.m, g: it.g }); });
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    kind.mesh = mesh;
  }
  const meshesRising = [...new Set(rising.map(r => r.mesh))];
  /* The lights twinkle: every so often a few of them dim or come back on. */
  const bulbs = kinds.bulb.mesh, bulbBase = bulbs ? bulbs.instanceColor.array.slice() : null;
  let twinkleAt = 0;
  function twinkle(t) {
    if (!bulbs || t < twinkleAt) return;
    twinkleAt = t + 0.14;
    const a = bulbs.instanceColor.array, n = bulbs.count;
    for (let k = 0; k < n * 0.05; k++) {
      const i = (Math.random() * n) | 0, f = Math.random() < 0.45 ? 0.2 : 1;
      a[i * 3] = bulbBase[i * 3] * f; a[i * 3 + 1] = bulbBase[i * 3 + 1] * f; a[i * 3 + 2] = bulbBase[i * 3 + 2] * f;
    }
    bulbs.instanceColor.needsUpdate = true;
  }

  /* ---------- traffic ----------
     Cars, trucks and buses drive on the right. At every junction a vehicle goes straight on, turns left
     or turns right, following a curve through the junction, and it keeps its distance from the vehicle
     in front in its lane. The two main roads run out of town; a vehicle that reaches the far end of one
     turns round out of sight. After dusk (and in the tech city) their lights are on. */
  const paint = c => tint.set(weatherName === 'tech' ? recolor(c, 'paint') : c);
  const J = ROAD / 2, LANE = 1.45, FAR = 400, MID = N / 2;
  const coord = k => (k < 0 ? -FAR : k > N ? FAR : roadLines[k]);
  const inGrid = k => k >= 0 && k <= N;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const rightOf = d => [-d[1], d[0]];
  function canGo(i, j, d) {
    if (!inGrid(i) || !inGrid(j)) return false;
    const ni = i + d[0], nj = j + d[1];
    if (inGrid(ni) && inGrid(nj)) return true;
    return d[1] === 0 ? j === MID && (ni === -1 || ni === N + 1) : i === MID && (nj === -1 || nj === N + 1);
  }
  function makePath(pts) {
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  function along(path, s) {                               // position and heading at distance s
    const { pts, cum } = path;
    s = Math.max(0, Math.min(path.len, s));
    let k = 1; while (k < pts.length - 1 && cum[k] < s) k++;
    const a = pts[k - 1], b = pts[k], f = (s - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[0] - a[0], b[1] - a[1])];
  }
  function segPath(i, j, d) {                             // from junction (i, j) to the next one, in the right-hand lane
    const r = rightOf(d), ni = i + d[0], nj = j + d[1];
    const ja = inGrid(i) && inGrid(j) ? J : 0, jb = inGrid(ni) && inGrid(nj) ? J : 0;
    return makePath([[coord(i) + d[0] * ja + r[0] * LANE, coord(j) + d[1] * ja + r[1] * LANE],
                     [coord(ni) - d[0] * jb + r[0] * LANE, coord(nj) - d[1] * jb + r[1] * LANE]]);
  }
  function turnPath(i, j, d1, d2) {                       // a curve through junction (i, j), from heading d1 to heading d2
    const cx = coord(i), cz = coord(j), r1 = rightOf(d1), r2 = rightOf(d2);
    const p0 = [cx - d1[0] * J + r1[0] * LANE, cz - d1[1] * J + r1[1] * LANE];
    const p2 = [cx + d2[0] * J + r2[0] * LANE, cz + d2[1] * J + r2[1] * LANE];
    let p1;
    if (d1[0] === d2[0] && d1[1] === d2[1]) p1 = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2];
    else if (d1[0] === -d2[0] && d1[1] === -d2[1]) p1 = [cx + d1[0] * J, cz + d1[1] * J];
    else { const t = ((r2[0] - r1[0]) * d1[0] + (r2[1] - r1[1]) * d1[1]) * LANE; p1 = [cx + r1[0] * LANE + d1[0] * t, cz + r1[1] * LANE + d1[1] * t]; }
    const pts = [];
    for (let k = 0; k <= 8; k++) { const u = k / 8, v = 1 - u; pts.push([v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]]); }
    return makePath(pts);
  }

  /* What each kind of vehicle is made of: [part, size, centre], relative to its middle with the front at +z. */
  const TYPES = {
    car: { len: 3.8, speed: [7, 11], lightsY: 0.8, w: 1.8, parts: {
      body: [[1.8, 0.8, 3.8], [0, 0.75, 0]], glass: [[1.6, 0.7, 1.9], [0, 1.5, -0.2]],
      wheels: [[0.35, 0.8, 0.8], [[-0.9, 0.4, 1.2], [0.9, 0.4, 1.2], [-0.9, 0.4, -1.2], [0.9, 0.4, -1.2]]] } },
    truck: { len: 6.6, speed: [6, 8], lightsY: 1.0, w: 2.2, parts: {
      body: [[2.1, 1.8, 1.9], [0, 1.3, 2.35]], glass: [[2.14, 0.6, 1.0], [0, 1.75, 2.6]], cargo: [[2.3, 2.4, 4.6], [0, 1.65, -1.0]],
      wheels: [[0.4, 1.0, 1.0], [[-1.0, 0.5, 2.4], [1.0, 0.5, 2.4], [-1.0, 0.5, -0.6], [1.0, 0.5, -0.6], [-1.0, 0.5, -2.4], [1.0, 0.5, -2.4]]] } },
    bus: { len: 9, speed: [5, 7], lightsY: 1.0, w: 2.3, parts: {
      body: [[2.3, 2.2, 9], [0, 1.55, 0]], glass: [[2.34, 0.75, 8.4], [0, 1.9, 0.1]],
      wheels: [[0.4, 1.0, 1.0], [[-1.05, 0.5, 3.2], [1.05, 0.5, 3.2], [-1.05, 0.5, -3.2], [1.05, 0.5, -3.2]]] } }
  };
  const STOP_BACK = 1.4;                                  // a vehicle's front stops this far before the junction edge, behind the zebra crossing
  const BUS_COLOURS = ['#fff200', '#ed1c24', '#00a8f3', '#0ed145'], CARGO_COLOURS = ['#ffffff', '#d8dde3', '#f28c28', '#3f48cc', '#ed1c24'];
  const fleet = [...Array(24).fill('car'), ...Array(9).fill('truck'), ...Array(4).fill('bus')];
  const V = fleet.length, cars = [];
  const vBody = new THREE.InstancedMesh(kinds.box.geo, solid, V), vGlass = new THREE.InstancedMesh(kinds.box.geo, glass, V);
  const vCargo = new THREE.InstancedMesh(kinds.box.geo, solid, V), vWheel = new THREE.InstancedMesh(wheelGeo, solid, V * 6);
  const lightMat = new THREE.MeshBasicMaterial(), vLight = new THREE.InstancedMesh(kinds.box.geo, lightMat, V * 4);
  const vehicleMeshes = [vBody, vGlass, vCargo, vWheel, vLight];
  for (const m of vehicleMeshes) { m.castShadow = m !== vLight; m.frustumCulled = false; scene.add(m); }
  vLight.visible = !!look.headlights;
  fleet.forEach((type, n) => {
    const T = TYPES[type];
    let i, j, d;
    do { i = Math.floor(rand() * (N + 1)); j = Math.floor(rand() * (N + 1)); d = DIRS[Math.floor(rand() * 4)]; } while (!canGo(i, j, d));
    const path = segPath(i, j, d);
    const v = { type, T, i, j, d, path, mode: 'seg', s: rand() * path.len, speed: between(T.speed[0], T.speed[1]), wait: 0 };
    v.plan = pickTurn(v); v.committed = v.s > path.len - STOP_BACK - T.len / 2 - 0.5;
    cars.push(v);
    vBody.setColorAt(n, paint(type === 'bus' ? pick(BUS_COLOURS) : pick(CARS)));
    vGlass.setColorAt(n, paint(C.glassDark));
    vCargo.setColorAt(n, paint(pick(CARGO_COLOURS)));
    for (let k = 0; k < 6; k++) vWheel.setColorAt(n * 6 + k, paint(C.tyre));
    for (let k = 0; k < 4; k++) vLight.setColorAt(n * 4 + k, tint.set(k < 2 ? '#fff4c8' : '#ff2a2a'));
  });
  for (const m of vehicleMeshes) m.instanceColor.needsUpdate = true;

  /* Where a vehicle is in its lane, for keeping distance: the lane it is in and how far along it. */
  function laneSpot(v) {
    if (v.mode === 'seg') return [v.i + ',' + v.j + ',' + v.d, v.s];
    return [v.pi + ',' + v.pj + ',' + v.pd, v.segLen + v.s];   // still counts as the lane it came from while turning
  }
  /* The way a vehicle will go at the junction ahead: straight on about half the time, otherwise left or
     right. Chosen when it starts down a street, so it can signal its intent and give way properly. */
  function pickTurn(v) {
    const ni = v.i + v.d[0], nj = v.j + v.d[1];
    if (!inGrid(ni) || !inGrid(nj)) return null;
    const straight = v.d, left = [v.d[1], -v.d[0]], right = rightOf(v.d);
    const options = [[straight, 0.5], [left, 0.25], [right, 0.25]].filter(([d]) => canGo(ni, nj, d));
    if (!options.length) return [-v.d[0], -v.d[1]];
    let x = Math.random() * options.reduce((t, o) => t + o[1], 0);
    for (const [d, w] of options) if ((x -= w) <= 0) return d;
    return options[options.length - 1][0];
  }
  function startStreet(v) { v.path = segPath(v.i, v.j, v.d); v.mode = 'seg'; v.s = 0; v.committed = false; v.wait = 0; v.plan = pickTurn(v); }
  function nextLeg(v) {
    const ni = v.i + v.d[0], nj = v.j + v.d[1];
    if (v.mode === 'turn') { v.i = v.ti; v.j = v.tj; v.d = v.nd; startStreet(v); return; }
    if (!inGrid(ni) || !inGrid(nj)) {                     // the far end of a main road: turn round out of sight
      v.i = ni; v.j = nj; v.d = [-v.d[0], -v.d[1]]; startStreet(v); return;
    }
    const nd = v.plan || pickTurn(v);
    Object.assign(v, { pi: v.i, pj: v.j, pd: v.d, segLen: v.path.len, ti: ni, tj: nj, nd, mode: 'turn', s: 0, path: turnPath(ni, nj, v.d, nd) });
  }
  const part = new THREE.Matrix4(), base = new THREE.Matrix4();
  function setPart(mesh, index, size, at) { mesh.setMatrixAt(index, part.makeScale(size[0], size[1], size[2]).setPosition(at[0], at[1], at[2]).premultiply(base)); }

  /* ---------- traffic lights ----------
     Every junction with three or more roads has lights: one head on the near right-hand corner of each
     approach, facing the oncoming traffic. East-west traffic gets green, then amber, then a moment of
     all-red, then north-south does the same. Each junction starts at a different point in the cycle. */
  const CYCLE = 20, axisOf = d => (d[0] !== 0 ? 0 : 1);
  const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
  const isLeftTurn = (d, nd) => !!nd && nd[0] === d[1] && nd[1] === -d[0];
  const leftOf = d => [d[1], -d[0]];
  const signals = new Map(), heads = [];
  let trafficTime = 0;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const arms = DIRS.filter(d => canGo(i, j, d));
    if (arms.length < 3) continue;
    const key = i + ',' + j;
    signals.set(key, Math.random() * CYCLE);
    for (const a of arms) {                               // traffic arriving down arm a is heading d = -a
      const d = [-a[0], -a[1]], r = rightOf(d), o = J + 0.75;
      heads.push({ key, axis: axisOf(d), x: coord(i) - d[0] * o + r[0] * o, z: coord(j) - d[1] * o + r[1] * o, d });
    }
  }
  function signalAt(key, axis) {
    if (!signals.has(key)) return 'none';
    const u = (trafficTime + signals.get(key)) % CYCLE;
    if (axis === 0) return u < 7 ? 'green' : u < 9 ? 'amber' : 'red';
    return u < 10 ? 'red' : u < 17 ? 'green' : u < 19 ? 'amber' : 'red';
  }
  const H = heads.length, sigMat = new THREE.MeshBasicMaterial();
  const sigPole = new THREE.InstancedMesh(kinds.cyl.geo, solid, H), sigHead = new THREE.InstancedMesh(kinds.box.geo, solid, H);
  const sigLamp = new THREE.InstancedMesh(kinds.box.geo, sigMat, H * 3);
  for (const m of [sigPole, sigHead]) { m.castShadow = true; scene.add(m); }
  scene.add(sigLamp);
  heads.forEach((h, n) => {
    q.setFromAxisAngle(UP, Math.atan2(-h.d[0], -h.d[1]));   // the face of the head points at the oncoming traffic
    base.compose(p.set(h.x, TOP, h.z), q, sc.set(1, 1, 1));
    setPart(sigPole, n, [0.24, 3.3, 0.24], [0, 1.65, 0]); sigPole.setColorAt(n, paint('#3a3f48'));
    setPart(sigHead, n, [0.55, 1.4, 0.45], [0, 3.75, 0]); sigHead.setColorAt(n, paint('#1f2328'));
    for (let k = 0; k < 3; k++) setPart(sigLamp, n * 3 + k, [0.32, 0.32, 0.06], [0, 4.2 - k * 0.43, 0.25]);
  });
  sigPole.instanceColor.needsUpdate = sigHead.instanceColor.needsUpdate = true;
  const LIT = ['#ff2a2a', '#ffb020', '#22ff66'], DARK = ['#3a1414', '#3a2a0c', '#0f3a1c'];
  let signalKey = '';
  function paintSignals() {
    const now = heads.map(h => signalAt(h.key, h.axis)[0]).join('');
    if (now === signalKey) return;                        // nothing changed since the last frame
    signalKey = now;
    heads.forEach((h, n) => {
      const st = signalAt(h.key, h.axis), on = st === 'red' ? 0 : st === 'amber' ? 1 : 2;
      for (let k = 0; k < 3; k++) sigLamp.setColorAt(n * 3 + k, tint.set(k === on ? LIT[k] : DARK[k]));
    });
    sigLamp.instanceColor.needsUpdate = true;
  }

  /* Someone on the zebra crossing on arm a of the junction at (cx, cz)? */
  const CROSS_LINE = ROAD / 2 + 0.45;
  function personOnCrossing(cx, cz, a) {
    for (const pr of people) {
      if (!pr.cross) continue;
      const c = pr.cross, px = c.x0 + (c.x1 - c.x0) * c.t - cx, pz = c.z0 + (c.z1 - c.z0) * c.t - cz;
      const alongArm = px * a[0] + pz * a[1], acrossArm = px * a[1] - pz * a[0];
      if (Math.abs(alongArm - CROSS_LINE) < 1.2 && Math.abs(acrossArm) < 3.6) return true;
    }
    return false;
  }
  /* May this vehicle drive past its stop line into the junction ahead? */
  function mayEnter(v, stopS) {
    const xi = v.i + v.d[0], xj = v.j + v.d[1], key = xi + ',' + xj, ax = axisOf(v.d), plan = v.plan;
    const light = signalAt(key, ax);
    if (light === 'red') return false;
    if (light === 'amber' && v.s < stopS - 1.0) return false;           // amber: stop unless it is too late to
    const left = isLeftTurn(v.d, plan), opp = [-v.d[0], -v.d[1]], patient = v.wait > 5;
    const cx = coord(xi), cz = coord(xj);
    if (personOnCrossing(cx, cz, opp) || (plan && personOnCrossing(cx, cz, plan))) return false;   // people on the crossings
    for (const o of cars) {
      if (o === v) continue;
      if (o.mode === 'turn' && o.ti === xi && o.tj === xj) {
        if (axisOf(o.pd) !== ax) return false;                            // cross traffic still in the junction
        if (same(o.pd, opp) && (left || isLeftTurn(o.pd, o.nd)) && !patient) return false;   // oncoming traffic and a left turn would cross
        if (plan && same(o.nd, plan)) return false;                       // one at a time into the same exit
      }
      if (o.mode === 'seg' && o.i + o.d[0] === xi && o.j + o.d[1] === xj) {
        const front = o.s + o.T.len / 2;
        if (left && !patient && same(o.d, opp) && front > o.path.len - 9 && !isLeftTurn(o.d, o.plan)) return false;   // turning left: give way to oncoming
        if (light === 'none' && same(o.d, leftOf(v.d)) && front > o.path.len - STOP_BACK - 0.8) return false;        // no lights: give way to the right
      }
      if (plan && o.mode === 'seg' && o.i === xi && o.j === xj && same(o.d, plan) && o.s - o.T.len / 2 < v.T.len + 1.5) return false;   // no room on the far side
    }
    return true;
  }
  function placeCars(dt) {
    trafficTime += dt;
    paintSignals();
    const spots = cars.map(laneSpot);
    cars.forEach((v, n) => {
      const [lane, pos] = spots[n];
      let gap = Infinity;
      cars.forEach((o, m) => { if (m !== n && spots[m][0] === lane && spots[m][1] > pos) gap = Math.min(gap, spots[m][1] - pos - (o.T.len + v.T.len) / 2); });
      const pace = v.speed * (v.mode === 'turn' ? 0.55 : 1);
      let move = gap < 1.2 ? 0 : Math.min(pace * dt, gap - 1.2);
      if (v.mode === 'seg' && !v.committed && inGrid(v.i + v.d[0]) && inGrid(v.j + v.d[1])) {
        const stopS = v.path.len - STOP_BACK - v.T.len / 2;
        if (v.s + move >= stopS) {
          if (mayEnter(v, stopS)) v.committed = true;
          else { move = Math.max(0, stopS - v.s); if (move < 0.001) v.wait += dt; }
        }
      }
      while (move > 0) { const left = v.path.len - v.s; if (move < left) { v.s += move; move = 0; } else { move -= left; v.s = v.path.len; nextLeg(v); } }
      const [x, z, yaw] = along(v.path, v.s), T = v.T, P = T.parts;
      q.setFromAxisAngle(UP, yaw);
      base.compose(p.set(x, 0.2, z), q, sc.set(1, 1, 1));
      setPart(vBody, n, P.body[0], P.body[1]);
      setPart(vGlass, n, P.glass[0], P.glass[1]);
      if (P.cargo) setPart(vCargo, n, P.cargo[0], P.cargo[1]); else vCargo.setMatrixAt(n, nothing);
      for (let k = 0; k < 6; k++) { const w = P.wheels[1][k]; if (w) setPart(vWheel, n * 6 + k, P.wheels[0], w); else vWheel.setMatrixAt(n * 6 + k, nothing); }
      if (look.headlights) {
        const hx = T.w / 2 - 0.3, fz = T.len / 2 + 0.03;
        setPart(vLight, n * 4, [0.4, 0.26, 0.08], [-hx, T.lightsY, fz]); setPart(vLight, n * 4 + 1, [0.4, 0.26, 0.08], [hx, T.lightsY, fz]);
        setPart(vLight, n * 4 + 2, [0.36, 0.22, 0.08], [-hx, T.lightsY, -fz]); setPart(vLight, n * 4 + 3, [0.36, 0.22, 0.08], [hx, T.lightsY, -fz]);
      }
    });
    for (const m of vehicleMeshes) m.instanceMatrix.needsUpdate = true;
  }
  const nothing = new THREE.Matrix4().makeScale(0, 0, 0);

  /* ---------- people on the pavements ----------
     Very plain little figures, no faces: a head, a top and legs. Three shapes: an adult in a top and
     trousers, an adult in a dress, and a child. A few push a pram. Each walks round and round the
     edge of one block. */
  const PEOPLE = 90, SKIN = '#ffe6a3', WALK = BLOCK / 2 - 0.45, LAP = WALK * 8;
  const TOPS = ['#0ed145', '#b23ac4', '#00a8f3', '#ed1c24', '#fff200', '#f28c28', '#ffffff', '#3f48cc', '#f6b7c1', '#2f9e44'];
  const LEGS = ['#3f48cc', '#1b1b1b', '#7a4a21', '#5a6472', '#2a318f'];
  const dressGeo = new THREE.CylinderGeometry(0.42, 0.7071, 1, 4, 1, false, Math.PI / 4);   // a box that widens toward the hem
  const pLegs = new THREE.InstancedMesh(kinds.box.geo, solid, PEOPLE), pTop = new THREE.InstancedMesh(kinds.box.geo, solid, PEOPLE);
  const pDress = new THREE.InstancedMesh(dressGeo, solid, PEOPLE), pHead = new THREE.InstancedMesh(kinds.box.geo, solid, PEOPLE);
  const pPram = new THREE.InstancedMesh(kinds.box.geo, solid, PEOPLE * 2);
  const pHat = new THREE.InstancedMesh(kinds.box.geo, solid, PEOPLE), pTrim = new THREE.InstancedMesh(kinds.box.geo, solid, PEOPLE * 2);
  const pBag = new THREE.InstancedMesh(kinds.box.geo, solid, PEOPLE);
  const peopleMeshes = [pLegs, pTop, pDress, pHead, pPram, pHat, pTrim, pBag], people = [];
  for (const m of peopleMeshes) { m.castShadow = true; m.frustumCulled = false; m.visible = false; scene.add(m); }
  for (let i = 0; i < PEOPLE; i++) {
    const r = rand(), kind = r < 0.42 ? 'trousers' : r < 0.8 ? 'dress' : 'child';
    const [bx, bz] = pick(blocks);
    people.push({ bx, bz, kind, at: between(0, LAP), dir: pick([-1, 1]), speed: between(1.1, 2.2) * (kind === 'child' ? 1.25 : 1),
      size: kind === 'child' ? between(0.58, 0.7) : between(0.92, 1.08), pram: kind !== 'child' && rand() < 0.12, step: between(0, 6.28) });
    const top = pick(TOPS);
    { const pr = people[people.length - 1], first = -HALF + ROAD + BLOCK / 2; pr.bi = Math.round((bx - first) / PITCH); pr.bj = Math.round((bz - first) / PITCH); }
    const coat = paint(top).clone();
    pLegs.setColorAt(i, paint(kind === 'dress' ? '#1b1b1b' : pick(LEGS)));
    pTop.setColorAt(i, coat); pDress.setColorAt(i, coat); pHead.setColorAt(i, tint.set(SKIN));
    const me = people[people.length - 1];
    me.hat = xmas && chance(0.3); me.bag = xmas && chance(0.35);
    pHat.setColorAt(i, tint.set('#d4141c')); pTrim.setColorAt(i * 2, tint.set('#ffffff')); pTrim.setColorAt(i * 2 + 1, tint.set('#ffffff'));
    pBag.setColorAt(i, tint.set(anyPick(BAGS)));
    pPram.setColorAt(i * 2, paint(pick(['#5a6472', '#1b1b1b', '#3f48cc']))); pPram.setColorAt(i * 2 + 1, paint('#2c3e50'));
  }
  for (const m of peopleMeshes) m.instanceColor.needsUpdate = true;
  /* Walking. Each person goes round the edge of a block. At a corner, now and then, they cross the road
     straight ahead on the zebra crossing to the next block and carry on round that one. */
  const W2 = WALK * 2, GAP = 2 * (BLOCK / 2 - WALK) + ROAD, HEADS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const CORNERS = [[-WALK, -WALK], [WALK, -WALK], [WALK, WALK], [-WALK, WALK]];
  function walk(pr, dt) {
    if (pr.cross) {
      const c = pr.cross;
      c.t = Math.min(1, c.t + pr.speed * dt / GAP);
      const x = c.x0 + (c.x1 - c.x0) * c.t, z = c.z0 + (c.z1 - c.z0) * c.t;
      if (c.t >= 1) { pr.bi += c.h[0]; pr.bj += c.h[1]; pr.bx += c.h[0] * PITCH; pr.bz += c.h[1] * PITCH; pr.at = c.at; pr.cross = null; }
      return [x, z, Math.atan2(c.h[0], c.h[1]), 0.2];
    }
    const k = Math.min(3, Math.floor(pr.at / W2)), next = pr.at + pr.dir * pr.speed * dt;
    const ended = pr.dir > 0 ? next >= (k + 1) * W2 : next < k * W2;
    if (ended && Math.random() < 0.35) {
      const h = HEADS[k].map(v => v * pr.dir), ni = pr.bi + h[0], nj = pr.bj + h[1];
      const cn = CORNERS[pr.dir > 0 ? (k + 1) % 4 : k];
      /* The junction this crossing belongs to, and the traffic on the road being crossed. */
      const ji = pr.bi + (cn[0] > 0 ? 1 : 0), jj = pr.bj + (cn[1] > 0 ? 1 : 0), carsAxis = h[0] !== 0 ? 1 : 0;
      const walkSign = signalAt(ji + ',' + jj, carsAxis);
      if (ni >= 0 && ni < N && nj >= 0 && nj < N && (walkSign === 'red' || walkSign === 'none')) {
        const x0 = pr.bx + cn[0], z0 = pr.bz + cn[1];
        pr.cross = { x0, z0, x1: x0 + h[0] * GAP, z1: z0 + h[1] * GAP, t: 0, h, at: pr.dir > 0 ? k * W2 + 0.001 : (k + 1) * W2 - 0.001 };
        return [x0, z0, Math.atan2(h[0], h[1]), TOP];
      }
    }
    pr.at = ((next % LAP) + LAP) % LAP;
    const side = Math.min(3, Math.floor(pr.at / W2)), d = pr.at - side * W2 - WALK;
    const [lx, lz, heading] = [[d, -WALK, Math.PI / 2], [WALK, d, 0], [-d, WALK, -Math.PI / 2], [-WALK, -d, Math.PI]][side];
    return [pr.bx + lx, pr.bz + lz, heading + (pr.dir < 0 ? Math.PI : 0), TOP];
  }
  function placePeople(dt, t) {
    people.forEach((pr, i) => {
      const [wx, wz, yaw, ground] = walk(pr, dt);
      q.setFromAxisAngle(UP, yaw);
      const bob = reduced ? 0 : Math.abs(Math.sin(t * 7 * pr.speed + pr.step)) * 0.07;
      base.compose(p.set(wx, ground + bob, wz), q, sc.set(pr.size, pr.size, pr.size));
      const dress = pr.kind === 'dress', legH = dress ? 0.42 : 0.62, bodyH = dress ? 0.8 : 0.6;
      pLegs.setMatrixAt(i, part.makeScale(dress ? 0.3 : 0.42, legH, dress ? 0.24 : 0.3).setPosition(0, legH / 2, 0).premultiply(base));
      pTop.setMatrixAt(i, dress ? nothing : part.makeScale(0.5, bodyH, 0.34).setPosition(0, legH + bodyH / 2, 0).premultiply(base));
      pDress.setMatrixAt(i, dress ? part.makeScale(0.62, bodyH, 0.5).setPosition(0, legH + bodyH / 2, 0).premultiply(base) : nothing);
      pHead.setMatrixAt(i, part.makeScale(0.36, 0.36, 0.36).setPosition(0, legH + bodyH + 0.18, 0).premultiply(base));
      pPram.setMatrixAt(i * 2, pr.pram ? part.makeScale(0.46, 0.34, 0.62).setPosition(0, 0.42, 0.72).premultiply(base) : nothing);
      pPram.setMatrixAt(i * 2 + 1, pr.pram ? part.makeScale(0.46, 0.3, 0.3).setPosition(0, 0.72, 0.58).premultiply(base) : nothing);
      const crown = legH + bodyH + 0.36;
      pHat.setMatrixAt(i, pr.hat ? part.makeScale(0.32, 0.22, 0.32).setPosition(0, crown + 0.13, -0.03).premultiply(base) : nothing);
      pTrim.setMatrixAt(i * 2, pr.hat ? part.makeScale(0.42, 0.08, 0.42).setPosition(0, crown + 0.03, 0).premultiply(base) : nothing);
      pTrim.setMatrixAt(i * 2 + 1, pr.hat ? part.makeScale(0.12, 0.12, 0.12).setPosition(0.1, crown + 0.27, -0.13).premultiply(base) : nothing);
      pBag.setMatrixAt(i, pr.bag ? part.makeScale(0.12, 0.3, 0.26).setPosition(dress ? 0.42 : 0.33, legH * 0.55, 0).premultiply(base) : nothing);
    });
    for (const m of peopleMeshes) m.instanceMatrix.needsUpdate = true;
  }
  placePeople(0, 0);
  placeCars(0);

  /* ---------- tech city: flying cars ----------
     Some hover along the streets well above the traffic and below the lowest skyway, turning at
     junctions; the streets are always clear of buildings. Others run both ways along each skyway.
     They glow underneath, with headlights in front and thrusters behind. */
  const fliers = [];
  if (tech) {
    for (let k = 0; k < 12; k++) {
      let i, j, d;
      do { i = Math.floor(Math.random() * (N + 1)); j = Math.floor(Math.random() * (N + 1)); d = DIRS[Math.floor(Math.random() * 4)]; } while (!canGo(i, j, d));
      const path = segPath(i, j, d);
      fliers.push({ sky: null, i, j, d, path, mode: 'seg', s: Math.random() * path.len, alt: 11 + Math.random() * 6, speed: 12 + Math.random() * 6, bob: Math.random() * 6 });
    }
    for (const sw of skyways) for (let m = 0; m < 4; m++) fliers.push({ sky: sw, dir: m % 2 ? 1 : -1, s: Math.random() * sw.len, speed: 13 + Math.random() * 5, bob: 0 });
  }
  function flyNext(f) {
    const ni = f.i + f.d[0], nj = f.j + f.d[1];
    if (f.mode === 'turn') { f.i = ni; f.j = nj; f.d = f.nd; f.mode = 'seg'; f.path = segPath(f.i, f.j, f.d); return; }
    if (!inGrid(ni) || !inGrid(nj)) { f.i = ni; f.j = nj; f.d = [-f.d[0], -f.d[1]]; f.path = segPath(f.i, f.j, f.d); return; }
    const opts = [f.d, [f.d[1], -f.d[0]], rightOf(f.d)].filter(d => canGo(ni, nj, d));
    f.nd = opts.length ? opts[Math.floor(Math.random() * opts.length)] : [-f.d[0], -f.d[1]];
    f.path = turnPath(ni, nj, f.d, f.nd); f.mode = 'turn';      // f.i, f.j, f.d stay as they were until the turn is done
  }
  const F = fliers.length;
  const flyGlowMat = new THREE.MeshBasicMaterial();
  const fBody = new THREE.InstancedMesh(kinds.box.geo, solid, Math.max(F, 1)), fGlass = new THREE.InstancedMesh(kinds.box.geo, glass, Math.max(F, 1));
  const fGlow = new THREE.InstancedMesh(kinds.box.geo, flyGlowMat, Math.max(F, 1) * 5);
  const flyMeshes = [fBody, fGlass, fGlow];
  for (const m of flyMeshes) { m.frustumCulled = false; m.visible = F > 0; scene.add(m); }
  fBody.castShadow = true;
  fliers.forEach((f, n) => {
    fBody.setColorAt(n, paint(pick(CARS))); fGlass.setColorAt(n, tint.set('#1b2440'));
    const under = anyPick(['#29f0ff', '#ff3df2', '#7a5cff']);
    [under, '#ff3df2', '#ff3df2', '#fff4c8', '#fff4c8'].forEach((c, k) => fGlow.setColorAt(n * 5 + k, tint.set(c)));
  });
  if (F) for (const m of flyMeshes) m.instanceColor.needsUpdate = true;
  const flyPoint = new THREE.Vector3(), flyTangent = new THREE.Vector3();
  function placeFliers(dt, t) {
    fliers.forEach((f, n) => {
      let x, y, z, yaw;
      if (f.sky) {
        f.s = (f.s + f.dir * f.speed * dt + f.sky.len) % f.sky.len;
        const u = f.s / f.sky.len;
        f.sky.curve.getPointAt(u, flyPoint); f.sky.curve.getTangentAt(u, flyTangent);
        const tx = flyTangent.x * f.dir, tz = flyTangent.z * f.dir, L = Math.hypot(tx, tz) || 1;
        x = flyPoint.x + (-tz / L) * 0.85; z = flyPoint.z + (tx / L) * 0.85; y = flyPoint.y + 0.05; yaw = Math.atan2(tx, tz);   // keep right on the deck
      } else {
        let move = f.speed * (f.mode === 'turn' ? 0.6 : 1) * dt;
        while (move > 0) { const left = f.path.len - f.s; if (move < left) { f.s += move; move = 0; } else { move -= left; f.s = 0; flyNext(f); } }
        [x, z, yaw] = along(f.path, f.s);
        y = f.alt + Math.sin(t * 1.8 + f.bob) * 0.35;
      }
      q.setFromAxisAngle(UP, yaw);
      base.compose(p.set(x, y, z), q, sc.set(1, 1, 1));
      setPart(fBody, n, [1.6, 0.55, 3.4], [0, 0.55, 0]);
      setPart(fGlass, n, [1.2, 0.45, 1.4], [0, 1.0, -0.2]);
      setPart(fGlow, n * 5, [1.3, 0.08, 2.8], [0, 0.24, 0]);
      setPart(fGlow, n * 5 + 1, [0.5, 0.3, 0.12], [-0.45, 0.55, -1.74]); setPart(fGlow, n * 5 + 2, [0.5, 0.3, 0.12], [0.45, 0.55, -1.74]);
      setPart(fGlow, n * 5 + 3, [0.36, 0.2, 0.08], [-0.5, 0.6, 1.74]); setPart(fGlow, n * 5 + 4, [0.36, 0.2, 0.08], [0.5, 0.6, 1.74]);
    });
    if (F) for (const m of flyMeshes) m.instanceMatrix.needsUpdate = true;
  }
  placeFliers(0, 0);

  /* ---------- trains ----------
     Two passenger trains go round the loop, stopping at each station. One cargo train at a time comes
     in on the north or east branch, waits for a gap in the loop traffic before joining, stops at the
     cargo yard, then leaves on the south branch; a little later the next one arrives. Every train keeps
     its distance from the one in front. Cars disappear while they are in a tunnel. */
  const CAR_LEN = 6, WAGON_LEN = 6.4, COUPLING = 0.6, RAIL_Y = 0.62;
  const CONTAINERS = ['#ed1c24', '#3f48cc', '#0ed145', '#f28c28', '#00a8f3', '#ffffff'];
  const paxStops = stations.map(([x, z]) => ringS(x, z)).sort((a, b) => a - b);
  const trains = [];
  function newTrain(kind, loco, coach) {
    const cars = kind === 'pax'
      ? [{ part: 'loco', len: CAR_LEN, colour: loco }, ...[0, 1, 2].map(() => ({ part: 'coach', len: CAR_LEN, colour: coach }))]
      : [{ part: 'loco', len: WAGON_LEN, colour: loco }, ...[0, 1, 2, 3].map(() => ({ part: 'wagon', len: WAGON_LEN, colour: '#4a4f58', cont: anyPick(CONTAINERS) }))];
    let off = 0;
    for (const c of cars) { c.off = off; off += c.len + COUPLING; }
    return { kind, cars, len: off - COUPLING, front: 0, speed: kind === 'pax' ? 9 : 7, dwell: 0 };
  }
  const paxA = newTrain('pax', '#ed1c24', '#f4f1e8'), paxB = newTrain('pax', '#3f48cc', '#fff200');
  paxA.front = 20; paxB.front = RL / 2 + 20;
  for (const tr of [paxA, paxB]) { tr.stop = paxStops.findIndex(st => st + tr.len / 2 > tr.front); if (tr.stop < 0) tr.stop = 0; trains.push(tr); }
  /* A cargo route: in on a branch, round part of the loop, out on the south branch. */
  function cargoRoute(spurIn) {
    const inPath = makePath(spurIn), [ex, ez] = spurIn[spurIn.length - 1];
    const sIn = ringS(ex, ez), sOut0 = ringS(southOut[0][0], southOut[0][1]), sOut = sOut0 > sIn ? sOut0 : sOut0 + RL;
    const pts = [...spurIn];
    for (let sv = sIn + 1.5; sv < sOut; sv += 1.5) { const [x, z] = along(ringPath, wrap(sv)); pts.push([x, z]); }
    pts.push(...southOut);
    const path = makePath(pts), sYard = ringS(cargoYard[0], cargoYard[1]);
    return { path, sIn, dIn: inPath.len, dOut: inPath.len + (sOut - sIn), dYard: inPath.len + (sYard >= sIn ? sYard - sIn : sYard + RL - sIn) };
  }
  const ROUTES = [cargoRoute(northIn), cargoRoute(eastIn)];
  const cargo = newTrain('cargo', '#f28c28');
  cargo.route = ROUTES[Math.floor(Math.random() * 2)]; cargo.front = cargo.route.dIn - 50; cargo.active = true;
  trains.push(cargo);

  /* Where a train is on the loop, as [front, rear] distances round it, or null if it is off the loop. */
  function onLoop(tr) {
    if (tr.kind === 'pax') return [tr.front, tr.front - tr.len];
    if (!tr.active) return null;
    const r = tr.route;
    if (tr.front < r.dIn || tr.front - tr.len > r.dOut) return null;
    return [r.sIn + Math.min(tr.front, r.dOut) - r.dIn, r.sIn + Math.max(tr.front - tr.len, r.dIn) - r.dIn];
  }
  function roomAhead(tr, front) {
    let gap = Infinity;
    for (const o of trains) { if (o === tr) continue; const at = onLoop(o); if (at) gap = Math.min(gap, wrap(at[1] - front)); }
    return gap;
  }
  function stepTrain(tr, dt) {
    if (tr.kind === 'cargo' && !tr.active) {
      tr.wait -= dt;
      if (tr.wait <= 0) { tr.route = ROUTES[Math.floor(Math.random() * 2)]; tr.front = 0; tr.active = true; tr.yardDone = false; for (const c of tr.cars) if (c.part === 'wagon') c.cont = anyPick(CONTAINERS); paintTrains(); }
      return;
    }
    let move = tr.speed * dt;
    if (tr.dwell > 0) { tr.dwell -= dt; move = 0; }
    if (tr.kind === 'pax') {
      const stopAt = paxStops[tr.stop] + tr.len / 2, toStop = wrap(stopAt - tr.front);
      if (toStop <= move) { move = toStop; tr.dwell = 3.5; tr.stop = (tr.stop + 1) % paxStops.length; }
      move = Math.min(move, Math.max(0, roomAhead(tr, wrap(tr.front)) - 5));
      tr.front = wrap(tr.front + move);
      return;
    }
    const r = tr.route;
    if (tr.front < r.dIn - 0.5 && tr.front + move >= r.dIn - 0.5) {              // wait for a gap before joining the loop
      const blocked = trains.some(o => o !== tr && o.kind === 'pax' && (wrap(r.sIn - o.front) < 40 || wrap(o.front - r.sIn) < o.len + 4));
      if (blocked) move = Math.max(0, r.dIn - 0.5 - tr.front);
    }
    if (!tr.yardDone && tr.front < r.dYard + tr.len / 2 && tr.front + move >= r.dYard + tr.len / 2) { move = r.dYard + tr.len / 2 - tr.front; tr.dwell = 6; tr.yardDone = true; }
    if (tr.front >= r.dIn - 0.5 && tr.front <= r.dOut) move = Math.min(move, Math.max(0, roomAhead(tr, wrap(r.sIn + tr.front - r.dIn)) - 5));
    tr.front += move;
    if (tr.front - tr.len > r.path.len) { tr.active = false; tr.wait = 8 + Math.random() * 12; }
  }

  const TC = trains.reduce((n, tr) => n + tr.cars.length, 0), trLightMat = new THREE.MeshBasicMaterial();
  const trBody = new THREE.InstancedMesh(kinds.box.geo, solid, TC), trGlass = new THREE.InstancedMesh(kinds.box.geo, glass, TC);
  const trRoof = new THREE.InstancedMesh(kinds.box.geo, solid, TC), trBogie = new THREE.InstancedMesh(kinds.box.geo, solid, TC * 2);
  const trCont = new THREE.InstancedMesh(kinds.box.geo, solid, TC), trLight = new THREE.InstancedMesh(kinds.box.geo, trLightMat, TC * 2);
  const trainMeshes = [trBody, trGlass, trRoof, trBogie, trCont, trLight];
  for (const m of trainMeshes) { m.castShadow = m !== trLight; m.frustumCulled = false; scene.add(m); }
  trLight.visible = !!look.headlights;
  function paintTrains() {
    let n = 0;
    for (const tr of trains) tr.cars.forEach((c, k) => {
      trBody.setColorAt(n, paint(c.colour)); trGlass.setColorAt(n, paint(C.glassDark)); trRoof.setColorAt(n, paint('#9aa0a8'));
      trBogie.setColorAt(n * 2, paint('#26262b')); trBogie.setColorAt(n * 2 + 1, paint('#26262b'));
      trCont.setColorAt(n, paint(c.cont || '#000000'));
      trLight.setColorAt(n * 2, tint.set(k === 0 ? '#fff4c8' : '#ff2a2a')); trLight.setColorAt(n * 2 + 1, tint.set(k === 0 ? '#fff4c8' : '#ff2a2a'));
      n++;
    });
    for (const m of trainMeshes) m.instanceColor.needsUpdate = true;
  }
  paintTrains();
  /* A car sits between two points on its track (its bogies), so on a curve it lies along the chord. */
  function trackPoint(tr, dist) {
    if (tr.kind === 'pax') return along(ringPath, wrap(dist));
    if (dist < 0 || dist > tr.route.path.len) return null;
    return along(tr.route.path, dist);
  }
  function placeTrains(dt) {
    for (const tr of trains) stepTrain(tr, dt);
    let n = 0;
    for (const tr of trains) tr.cars.forEach((c, k) => {
      const mid = tr.front - c.off - c.len / 2, a = trackPoint(tr, mid + c.len / 2 - 1.2), b = trackPoint(tr, mid - c.len / 2 + 1.2);
      const hidden = !a || !b || (tr.kind === 'cargo' && !tr.active);
      const x = hidden ? 0 : (a[0] + b[0]) / 2, z = hidden ? 0 : (a[1] + b[1]) / 2;
      if (hidden || inTunnel(x, z) || Math.abs(x) > 380 || Math.abs(z) > 380) {
        for (const m of [trBody, trGlass, trRoof, trCont]) m.setMatrixAt(n, nothing);
        for (const e of [0, 1]) { trBogie.setMatrixAt(n * 2 + e, nothing); trLight.setMatrixAt(n * 2 + e, nothing); }
        n++; return;
      }
      const ya = railY(a[0], a[1]), yb = railY(b[0], b[1]), chord = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      q.setFromEuler(eul.set(-Math.atan2(ya - yb, chord), Math.atan2(a[0] - b[0], a[1] - b[1]), 0, 'YXZ'));
      base.compose(p.set(x, RAIL_Y + (ya + yb) / 2, z), q, sc.set(1, 1, 1));
      const L = c.len;
      for (const e of [0, 1]) setPart(trBogie, n * 2 + e, [1.9, 0.5, 1.4], [0, 0.25, (e ? -1 : 1) * (L / 2 - 1.2)]);
      if (c.part === 'wagon') {
        setPart(trBody, n, [2.2, 0.45, L], [0, 0.68, 0]);
        setPart(trCont, n, [2.2, 2.2, L - 0.8], [0, 2.0, 0]);
        trGlass.setMatrixAt(n, nothing); trRoof.setMatrixAt(n, nothing);
      } else {
        const loco = c.part === 'loco', hgt = loco ? 2.2 : 2.1;
        setPart(trBody, n, [2.3, hgt, L], [0, 0.45 + hgt / 2, 0]);
        setPart(trGlass, n, loco ? [2.34, 0.7, 1.6] : [2.34, 0.7, L - 1], [0, loco ? 1.95 : 1.75, loco ? L / 2 - 1.0 : 0]);
        setPart(trRoof, n, [2.1, 0.35, L - 0.6], [0, 0.45 + hgt + 0.17, 0]);
        trCont.setMatrixAt(n, nothing);
      }
      const last = k === tr.cars.length - 1;
      if (k === 0 || last) for (const e of [0, 1]) setPart(trLight, n * 2 + e, [0.4, 0.3, 0.08], [(e ? 0.7 : -0.7), 1.1, (k === 0 ? 1 : -1) * (L / 2 + 0.03)]);
      else for (const e of [0, 1]) trLight.setMatrixAt(n * 2 + e, nothing);
      n++;
    });
    for (const m of trainMeshes) m.instanceMatrix.needsUpdate = true;
  }
  placeTrains(0);

  /* ---------- sky extras ---------- */
  const extras = [];
  if (look.sunDisc) {
    const disc = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff3b0', fog: false }));
    disc.position.copy(sun.position).setLength(1500);
    extras.push(disc);
  }
  if (look.stars) {
    const n = 1600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, up = 0.08 + Math.random() * 0.92, r = 1400;
      pos.set([Math.cos(a) * Math.sqrt(1 - up * up) * r, up * r, Math.sin(a) * Math.sqrt(1 - up * up) * r], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    extras.push(new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfe0ff', size: 1.6, sizeAttenuation: false, fog: false })));
  }
  if (look.grid) {
    const grid = new THREE.GridHelper(1400, 140, '#29f0ff', '#13325a');
    grid.position.y = 0.03; grid.material.transparent = true; grid.material.opacity = 0.45;
    extras.push(grid);
  }
  for (const e of extras) scene.add(e);

  /* High clouds for a sunny day. They sit above the camera's opening view, so from there you see
     only their shadows drifting across the streets; look up from street level and you see them. */
  const clouds = [];
  let cloudGeo = null, cloudMat = null;
  if (look.cloudShadows) {
    cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group(), w = 26 + Math.random() * 34, d = 16 + Math.random() * 20;
      for (let k = 0; k < 5; k++) {                   // a few stacked slabs, like a brick-built cloud
        const part = new THREE.Mesh(cloudGeo, cloudMat);
        part.scale.set(w * (0.45 + Math.random() * 0.55), 5 + Math.random() * 4, d * (0.5 + Math.random() * 0.5));
        part.position.set((Math.random() - 0.5) * w * 0.6, Math.random() * 5, (Math.random() - 0.5) * d * 0.6);
        part.castShadow = true;
        cloud.add(part);
      }
      cloud.position.set(-380 + i * 90 + Math.random() * 40, 175 + Math.random() * 20, (Math.random() - 0.5) * 260);
      cloud.userData.speed = 5 + Math.random() * 4;
      clouds.push(cloud); scene.add(cloud);
    }
  }
  function driftClouds(dt) {
    for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 420) c.position.x -= 840; }
  }

  /* ---------- camera and controls ---------- */
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 3000);
  const HOME = { pos: new THREE.Vector3(158, 131, 197), target: new THREE.Vector3(0, 6, 0) };
  camera.position.copy(HOME.pos);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME.target);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.08, zoomToCursor: true, screenSpacePanning: false,
    minDistance: 5, maxDistance: 520, maxPolarAngle: 1.5, rotateSpeed: 0.6, zoomSpeed: 1.1,
    autoRotate: !reduced, autoRotateSpeed: 0.35, enableZoom: false
  });
  /* Touch: one finger still scrolls the page; two fingers turn, zoom and pan the city. */
  /* Mouse: drag slides the city like a map; right-drag (or Shift-drag) turns it; the wheel zooms. */
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: -1, TWO: THREE.TOUCH.DOLLY_PAN };
  canvas.style.touchAction = 'pan-y';
  /* Mouse wheel: it scrolls the page as usual until the visitor has clicked on the city, and goes back
     to scrolling the page when the pointer leaves it. Otherwise the hero would trap the scroll wheel. */
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') controls.enableZoom = true; });
  canvas.addEventListener('pointerleave', () => { controls.enableZoom = false; });
  canvas.addEventListener('touchstart', e => { if (e.touches.length >= 2) controls.enableZoom = true; }, { passive: true });
  controls.addEventListener('start', () => { controls.autoRotate = false; container.classList.add('is-explored'); });
  controls.addEventListener('change', () => {              // stay over the map and above the ground
    controls.target.x = Math.max(-260, Math.min(260, controls.target.x));
    controls.target.z = Math.max(-260, Math.min(260, controls.target.z));
    controls.target.y = Math.max(0, Math.min(40, controls.target.y));
    if (camera.position.y < 1.2) camera.position.y = 1.2;
  });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    /* On a wide screen the sign hangs on the left, so the view is shifted to put the city right of centre. */
    if (w >= 900) camera.setViewOffset(w, h, -w * 0.2, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  /* ---------- falling rain or snow ----------
     The drops fill a box that follows the view: big when the camera is far out, small when it is
     close in, so there is always rain or snow near the camera. Positions are stored from 0 to 1 and
     the box is scaled to size. Not shown with reduced motion. */
  let fx = null;
  if (look.particles && !reduced) {
    const snow = look.particles === 'snow', n = snow ? 5000 : 4200;
    const norm = new Float32Array(n * 3), drift = new Float32Array(n);
    for (let i = 0; i < n; i++) { norm.set([Math.random() - 0.5, Math.random(), Math.random() - 0.5], i * 3); drift[i] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * (snow ? 3 : 6)), 3));
    let mat, obj;
    if (snow) {
      const dot = document.createElement('canvas'); dot.width = dot.height = 32;
      const g2 = dot.getContext('2d'), grad = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.55, 'rgba(255,255,255,.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g2.fillStyle = grad; g2.fillRect(0, 0, 32, 32);
      mat = new THREE.PointsMaterial({ color: '#ffffff', size: 1, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false });
      obj = new THREE.Points(geo, mat);
    } else {
      mat = new THREE.LineBasicMaterial({ color: '#e3ecf5', transparent: true, opacity: 0.5 });
      obj = new THREE.LineSegments(geo, mat);
    }
    obj.frustumCulled = false;
    scene.add(obj);
    fx = { snow, n, norm, drift, geo, mat, obj };
  }
  function stepFx(dt, t) {
    if (!fx) return;
    const S = Math.max(50, Math.min(380, camera.position.distanceTo(controls.target) * 1.5)), H = S * 0.6;
    fx.obj.position.set(controls.target.x, 0, controls.target.z);
    fx.obj.scale.set(S, H, S);
    if (fx.snow) fx.mat.size = S * 0.0045;
    const a = fx.norm, out = fx.geo.attributes.position.array;
    for (let i = 0; i < fx.n; i++) {
      const k = i * 3, d = fx.drift[i];
      a[k + 1] -= (fx.snow ? 0.045 + d * 0.04 : 0.62 + d * 0.25) * dt;
      if (fx.snow) a[k] += Math.sin(t * 0.8 + d * 40) * 0.006 * dt;
      if (a[k + 1] < 0) { a[k + 1] += 1; a[k] = Math.random() - 0.5; a[k + 2] = Math.random() - 0.5; }
      if (fx.snow) { out[k] = a[k]; out[k + 1] = a[k + 1]; out[k + 2] = a[k + 2]; }
      else { const o = i * 6; out[o] = a[k]; out[o + 1] = a[k + 1]; out[o + 2] = a[k + 2]; out[o + 3] = a[k] + 0.0035; out[o + 4] = a[k + 1] - 0.022; out[o + 5] = a[k + 2]; }
    }
    fx.geo.attributes.position.needsUpdate = true;
  }

  /* ---------- the build: each building rises out of the ground, the centre first ---------- */
  const DUR = 0.75, total = reduced ? 0 : Math.max(...groups.map(g => g.start), 0) + DUR;
  const grow = new THREE.Matrix4(), out = new THREE.Matrix4();
  const settle = k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };   // overshoots a little, then settles
  function setBuild(t) {
    for (const r of rising) {
      const k = t >= total ? 1 : Math.min(1, Math.max(0, (t - groups[r.g].start) / DUR));
      r.mesh.setMatrixAt(r.i, out.multiplyMatrices(grow.makeScale(1, k <= 0 ? 0.0001 : settle(k), 1), r.m));
    }
    for (const m of meshesRising) m.instanceMatrix.needsUpdate = true;
  }
  let built = total === 0, clock = 0, last = 0, raf = 0, stopped = false, visible = true;
  if (!built) setBuild(0);
  const showPeople = () => { for (const m of peopleMeshes) m.visible = true; };
  function markBuilt() { if (built) return; built = true; setBuild(total); showPeople(); onBuilt(); }
  /* Safety net: if the browser is not giving us animation frames (a background tab, say), finish the
     build on a timer anyway, so the hero sign is never left waiting. */
  const buildTimer = built ? 0 : setTimeout(markBuilt, (total + 1.2) * 1000);

  let glide = null;                                        // an eased camera move: back to the opening view, or a pan
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const real = (now - (last || now)) / 1000, dt = Math.min(0.05, real); last = now;
    clock += Math.min(0.5, real);                          // the build follows real time, so a slow frame rate cannot stall it
    if (!built) { setBuild(clock); if (clock >= total) markBuilt(); }
    if (!reduced) { placeCars(dt); placePeople(dt, clock); stepFx(dt, clock); driftClouds(dt); twinkle(clock); placeFliers(dt, clock); placeTrains(dt); }
    if (glide) {
      glide.t = Math.min(1, glide.t + dt / glide.dur);
      const k = 1 - Math.pow(1 - glide.t, 3);
      camera.position.lerpVectors(glide.fromPos, glide.toPos, k); controls.target.lerpVectors(glide.fromTarget, glide.toTarget, k);
      if (glide.t >= 1) glide = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  const play = () => { if (!raf && !stopped && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
  const pause = () => { cancelAnimationFrame(raf); raf = 0; };
  const onVisibility = () => (document.hidden ? pause() : play());
  document.addEventListener('visibilitychange', onVisibility);
  const watcher = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? play() : pause(); });
  watcher.observe(container);
  if (built) { showPeople(); controls.update(); renderer.render(scene, camera); queueMicrotask(onBuilt); }
  play();

  const offset = new THREE.Vector3();
  return {
    seed: usedSeed,
    weather: weatherName,
    /* For testing: where every vehicle and person is right now. */
    snapshot: () => ({ vehicles: cars.map(v => ({ type: v.type, mode: v.mode, d: v.d.join(','), at: along(v.path, v.s).map(n => +n.toFixed(2)) })),
      crossing: people.filter(pr => pr.cross).length, waiting: cars.filter(v => v.wait > 0 && v.mode === 'seg' && !v.committed).length,
      fliers: fliers.map(f => ({ onSkyway: !!f.sky, s: +f.s.toFixed(1) })), skyways: skyways.length,
      trains: trains.map(tr => ({ kind: tr.kind, front: +tr.front.toFixed(1), dwell: +tr.dwell.toFixed(1), active: tr.kind === 'pax' || tr.active })) }),
    seasons: { autumn: autumnTrees, christmas: xmas },
    finish: markBuilt,
    /* factor below 1 moves in, above 1 moves out */
    zoom(factor) {
      controls.autoRotate = false; glide = null;
      offset.subVectors(camera.position, controls.target);
      const len = Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() * factor));
      camera.position.copy(controls.target).add(offset.setLength(len));
    },
    turn(angle) {
      controls.autoRotate = false; glide = null;
      offset.subVectors(camera.position, controls.target).applyAxisAngle(UP, angle);
      camera.position.copy(controls.target).add(offset);
    },
    reset() { glide = { t: 0, dur: 0.9, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: HOME.pos.clone(), toTarget: HOME.target.clone() }; },
    /* Slide the view across the ground: right and forward are in steps, relative to the way the camera
       faces, and a step is a fraction of how far away the camera is, so it feels the same at any zoom. */
    pan(right, forward) {
      controls.autoRotate = false;
      const fromPos = glide ? glide.toPos.clone() : camera.position.clone(), fromTarget = glide ? glide.toTarget.clone() : controls.target.clone();
      const fwd = new THREE.Vector3().subVectors(fromTarget, fromPos).setY(0).normalize();
      const side = new THREE.Vector3().crossVectors(fwd, UP).normalize();
      const step = fromPos.distanceTo(fromTarget) * 0.22;
      const toTarget = fromTarget.clone().addScaledVector(side, right * step).addScaledVector(fwd, forward * step);
      toTarget.x = Math.max(-260, Math.min(260, toTarget.x)); toTarget.z = Math.max(-260, Math.min(260, toTarget.z));
      const toPos = fromPos.clone().add(toTarget.clone().sub(fromTarget));
      glide = { t: 0, dur: 0.35, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos, toTarget };
    },
    stop() {
      stopped = true; pause(); watcher.disconnect(); clearTimeout(buildTimer);
      document.removeEventListener('visibilitychange', onVisibility); removeEventListener('resize', resize);
      controls.dispose(); renderer.dispose(); canvas.remove();
      for (const k of Object.values(kinds)) k.geo.dispose();
      dressGeo.dispose();
      solid.dispose(); glass.dispose(); glowMat.dispose(); bulbMat.dispose(); lampMat.dispose(); lightMat.dispose(); sigMat.dispose(); flyGlowMat.dispose(); trLightMat.dispose();
      for (const e of extras) { e.geometry.dispose(); e.material.dispose(); }
      if (cloudGeo) { cloudGeo.dispose(); cloudMat.dispose(); }
      if (skyTexture) skyTexture.dispose();
      if (fx) { fx.geo.dispose(); fx.mat.dispose(); if (fx.mat.map) fx.mat.map.dispose(); }
    }
  };
}
