// A small procedural brick city for the hero. Different on every load.
//
// The city is a square of blocks and roads. Around it is a ring of wheat fields, crops, pasture and
// farmsteads, and beyond that plain ground fading into the sky, so a small square reads as a whole
// world. Visitors can drag to orbit, zoom right down to the cars, and pan.
//
// Units: 1 = one stud. Y is up. Everything is drawn with a handful of instanced meshes (one box, one
// cylinder, one cone, one roof prism), so thousands of pieces cost a few draw calls.
//
//   const city = await startCity({ container, reduced, onBuilt, seed });
//   city.zoom(0.7); city.turn(0.4); city.reset(); city.finish(); city.stop();

const BLOCK = 16, ROAD = 6, N = 6, PITCH = BLOCK + ROAD;
const HALF = (N * BLOCK + (N + 1) * ROAD) / 2;          // half the city's width
const FIELD = 46, FIELD_SIZE = 38, FARM_REACH = 230;

const C = {
  sky: '#bfe3ff', grass: '#6cc24a', grassDark: '#4fa83a', lawn: '#7fd257',
  road: '#4a4d55', line: '#f4f4f4', pavement: '#cfd3d8', asphalt: '#3c3f46',
  glass: '#8fd0f2', glassDark: '#2c3e50', tyre: '#1b1b1b', trunk: '#7a4a21',
  leaf: '#2f9e44', leafLight: '#55c05a', water: '#3aa0e8',
  wheatSoil: '#dcb95a', wheat: '#f4c531', soil: '#8a5a2b', soilLight: '#a06a35', crop: '#3f9b3a', pasture: '#8ed068',
  barn: '#c8102e', roof: '#6b7078', white: '#ffffff', silo: '#d9dde2', hay: '#e9c23c', tractor: '#1f8f3a'
};
const WALLS = ['#f4f1e8', '#e9e2cf', '#d8dde3', '#ed1c24', '#3f48cc', '#fff200', '#00a8f3', '#f28c28', '#9ad0c2', '#b23a48', '#f6b7c1', '#7d8fa3'];
const CARS = ['#ed1c24', '#3f48cc', '#fff200', '#0ed145', '#ffffff', '#f28c28', '#1b1b1b', '#00a8f3'];
const ROOFS = ['#b23a48', '#6b7078', '#7a4a21', '#3f48cc'];

export async function startCity({ container, reduced = false, onBuilt = () => {}, seed } = {}) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

  /* ---------- random, different every time (or repeatable with a seed) ---------- */
  let state = (Number(seed) || (Date.now() ^ (Math.random() * 0x7fffffff))) >>> 0;
  const usedSeed = state;
  const rand = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const between = (a, b) => a + rand() * (b - a);
  const whole = (a, b) => Math.floor(between(a, b + 1));
  const pick = list => list[Math.floor(rand() * list.length)];

  /* ---------- renderer, scene, light ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(C.sky, 420, 1150);
  scene.add(new THREE.HemisphereLight(0xdff1ff, 0x8f8a63, 1.5));
  const sun = new THREE.DirectionalLight(0xfff3dc, 2.4);
  sun.position.set(130, 230, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 700 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(sun);

  /* ---------- pieces: collected first, then turned into instanced meshes ---------- */
  const solid = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
  const glass = new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.25 });
  const roofGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 3); roofGeo.rotateX(-Math.PI / 2);      // ridge along Z, apex up
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); wheelGeo.rotateZ(Math.PI / 2);   // axle along X
  const kinds = {
    box: { geo: new THREE.BoxGeometry(1, 1, 1), mat: solid, items: [] },
    glass: { geo: new THREE.BoxGeometry(1, 1, 1), mat: glass, items: [] },
    cyl: { geo: new THREE.CylinderGeometry(0.5, 0.5, 1, 14), mat: solid, items: [] },
    stud: { geo: new THREE.CylinderGeometry(0.5, 0.5, 1, 8), mat: solid, items: [] },
    cone: { geo: new THREE.ConeGeometry(0.5, 1, 8), mat: solid, items: [] },
    pyramid: { geo: new THREE.ConeGeometry(0.7071, 1, 4, 1, false, Math.PI / 4), mat: solid, items: [] },
    wheat: { geo: new THREE.ConeGeometry(0.5, 1, 5), mat: solid, items: [] },
    roof: { geo: roofGeo, mat: solid, items: [] },
    wheel: { geo: wheelGeo, mat: solid, items: [] }
  };
  const UP = new THREE.Vector3(0, 1, 0), mx = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  // Every piece is placed by the centre of its base. group ties it to a building so it can rise with it.
  function put(kind, x, y, z, sx, sy, sz, color, group = -1, turn = 0) {
    q.setFromAxisAngle(UP, turn);
    kinds[kind].items.push({ m: new THREE.Matrix4().compose(p.set(x, y + sy / 2, z), q, sc.set(sx, sy, sz)), c: color, g: group });
  }
  const box = (x, y, z, w, h, d, color, g, turn) => put('box', x, y, z, w, h, d, color, g, turn);
  const cyl = (x, y, z, r, h, color, g) => put('cyl', x, y, z, r * 2, h, r * 2, color, g);
  const stud = (x, y, z, color, g) => put('stud', x, y, z, 0.6, 0.2, 0.6, color, g);
  const cone = (x, y, z, r, h, color, g) => put('cone', x, y, z, r * 2, h, r * 2, color, g);
  // Roof prism: base w wide, h high, len long. Its geometry is centred differently, so it is placed directly.
  function ridge(x, y, z, w, h, len, color, g, turn = 0) {
    q.setFromAxisAngle(UP, turn);
    const sy = h / 0.75;
    kinds.roof.items.push({ m: new THREE.Matrix4().compose(p.set(x, y + 0.25 * sy, z), q, sc.set(w / 0.866, sy, len)), c: color, g });
  }

  const groups = [];                                     // one per building: when it starts to rise
  const newGroup = (x, z) => groups.push({ start: Math.hypot(x, z) * 0.011 + rand() * 0.3 }) - 1;

  /* ---------- trees, cars at rest ---------- */
  function tree(x, y, z, g = -1, size = 1) {
    cyl(x, y, z, 0.3 * size, 1.5 * size, C.trunk, g);
    if (rand() < 0.5) {                                  // pine
      cone(x, y + 1.3 * size, z, 1.5 * size, 2.3 * size, C.leaf, g);
      cone(x, y + 2.6 * size, z, 1.1 * size, 1.9 * size, C.leaf, g);
    } else {                                             // round
      cyl(x, y + 1.4 * size, z, 1.4 * size, 1.1 * size, C.leafLight, g);
      cyl(x, y + 2.5 * size, z, 1.0 * size, 0.9 * size, C.leafLight, g);
      stud(x, y + 3.4 * size, z, C.leafLight, g);
    }
  }
  function parkedCar(x, y, z, turn, g) {
    const color = pick(CARS), s = Math.sin(turn), c = Math.cos(turn);
    box(x, y + 0.35, z, 1.8, 0.8, 3.8, color, g, turn);
    put('glass', x - s * 0.2, y + 1.15, z - c * 0.2, 1.6, 0.7, 1.9, C.glassDark, g, turn);
    for (const a of [-1, 1]) for (const b of [-1, 1])
      put('wheel', x + c * a * 0.9 + s * b * 1.2, y, z - s * a * 0.9 + c * b * 1.2, 0.35, 0.8, 0.8, C.tyre, g, turn);
  }

  /* ---------- ground and roads ---------- */
  box(0, -1.2, 0, 2600, 1.2, 2600, C.grass);
  box(0, 0, 0, HALF * 2, 0.2, HALF * 2, C.road);                               // the city sits on its roads
  for (const s of [-1, 1]) {                                                    // two roads run on out through the farms
    box(0, 0, s * (HALF + 340), ROAD, 0.2, 680, C.road);
    box(s * (HALF + 340), 0, 0, 680, 0.2, ROAD, C.road);
  }
  const roadLines = Array.from({ length: N + 1 }, (_, i) => -HALF + ROAD / 2 + i * PITCH);
  for (const c of roadLines) {
    const far = Math.abs(c) < 0.01 ? 380 : HALF;                                // the two main roads keep their lines
    for (let t = -far + 1.5; t < far; t += 4) {
      if (roadLines.some(r => Math.abs(t + 1 - r) < ROAD / 2 + 0.6) && Math.abs(t) < HALF) continue;   // no dashes in junctions
      box(c, 0.2, t + 1, 0.25, 0.04, 2, C.line);
      box(t + 1, 0.2, c, 2, 0.04, 0.25, C.line);
    }
  }

  /* ---------- buildings ---------- */
  const TOP = 0.55;                                      // top of the pavement
  function roofTop(x, y, z, w, d, wall, g, tall) {
    const step = w * d > 70 ? 2 : 1;
    for (let a = 0.5; a < w; a += step) for (let b = 0.5; b < d; b += step) stud(x - w / 2 + a, y, z - d / 2 + b, wall, g);
    const r = rand();
    if (r < 0.25) { cyl(x + between(-1, 1), y, z + between(-1, 1), 1.0, 1.6, C.silo, g); }                    // water tank
    else if (r < 0.5) { box(x + between(-1, 1), y, z + between(-1, 1), 1.8, 0.9, 1.4, C.roof, g); }           // air conditioner
    else if (r < 0.65) { box(x, y, z, w - 1.4, 0.3, d - 1.4, C.lawn, g); tree(x, y + 0.3, z, g, 0.6); }       // roof garden
    else if (r < 0.8 && tall) { cyl(x, y, z, 0.12, between(3, 6), C.roof, g); }                               // mast
    else if (tall && w > 8) { cyl(x, y, z, w * 0.3, 0.12, C.white, g); box(x, y + 0.12, z, w * 0.36, 0.03, 0.5, C.barn, g); }   // helipad
  }
  function building(x, z, w, d, floors, g) {
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
    if (floors <= 2 && rand() < 0.6) {                   // a low building often gets a pitched roof
      put('pyramid', x, y, z, w + 0.6, between(1.6, 2.6), d + 0.6, pick(ROOFS), g);
      return;
    }
    roofTop(x, y, z, w, d, wall, g, floors > 5);
    return y;
  }
  function tower(x, z, maxFloors, g) {
    const wall = pick(WALLS), w = whole(9, 12), d = whole(9, 12);
    const lower = Math.max(3, Math.round(maxFloors * between(0.45, 0.75))), upper = Math.round(maxFloors * between(0.3, 0.6));
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
    for (let a = 0.5; a < w; a += 2) for (let b = 0.5; b < d; b += 2) if (Math.abs(a - w / 2) > w / 2 - 2 || Math.abs(b - d / 2) > d / 2 - 2) stud(x - w / 2 + a, y, z - d / 2 + b, wall, g);
    tier(w - 3, d - 3, upper);
    roofTop(x, y, z, w - 3, d - 3, wall, g, true);
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
    const maxFloors = 2 + Math.pow(1 - edge, 1.4) * 13;
    box(x, 0.2, z, BLOCK, 0.35, BLOCK, C.pavement);
    const r = rand();
    if (r < 0.12) park(x, z, newGroup(x, z));
    else if (r < 0.2) carPark(x, z, newGroup(x, z));
    else if (r < 0.42 && edge < 0.75) tower(x, z, maxFloors, newGroup(x, z));
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

  /* ---------- the farms around the city ---------- */
  function wheatField(x, z) {
    box(x, 0, z, FIELD_SIZE, 0.25, FIELD_SIZE, C.wheatSoil);
    for (let a = -17.5; a <= 17.5; a += 2.4) for (let b = -17.5; b <= 17.5; b += 2.4)
      put('wheat', x + a + between(-0.5, 0.5), 0.25, z + b + between(-0.5, 0.5), 0.7, between(1.5, 2.3), 0.7, C.wheat);
  }
  function cropField(x, z, soil, row, turn) {
    box(x, 0, z, FIELD_SIZE, 0.25, FIELD_SIZE, soil);
    for (let a = -17; a <= 17; a += 2.6) turn ? box(x, 0.25, z + a, FIELD_SIZE - 2, 0.6, 1.0, row) : box(x + a, 0.25, z, 1.0, 0.6, FIELD_SIZE - 2, row);
  }
  function pasture(x, z) {
    box(x, 0, z, FIELD_SIZE, 0.25, FIELD_SIZE, C.pasture);
    for (let i = whole(4, 8); i > 0; i--) put('wheel', x + between(-15, 15), 0.25, z + between(-15, 15), 1.7, 1.9, 1.9, C.hay, -1, between(0, 3));
    for (let i = whole(3, 6); i > 0; i--) {                // cows
      const cx = x + between(-15, 15), cz = z + between(-15, 15), turn = between(0, 6.28);
      box(cx, 0.75, cz, 0.9, 0.9, 1.7, C.white, -1, turn);
      box(cx - Math.sin(turn) * -1.05, 1.0, cz - Math.cos(turn) * -1.05, 0.7, 0.7, 0.6, C.tyre, -1, turn);
      for (const a of [-1, 1]) for (const b of [-1, 1]) box(cx + Math.cos(turn) * a * 0.3 + Math.sin(turn) * b * 0.6, 0.25, cz - Math.sin(turn) * a * 0.3 + Math.cos(turn) * b * 0.6, 0.22, 0.5, 0.22, C.white, -1, turn);
    }
  }
  function farmstead(x, z) {
    box(x, 0, z, FIELD_SIZE, 0.25, FIELD_SIZE, C.lawn);
    const turn = pick([0, Math.PI / 2]);
    box(x - 6, 0.25, z - 4, 8, 5, 11, C.barn, -1, turn);                         // barn
    ridge(x - 6, 5.25, z - 4, 8.6, 3, 11.6, C.roof, -1, turn);
    box(x - 6 + Math.sin(turn) * 5.55, 0.25, z - 4 + Math.cos(turn) * 5.55, 3, 3.4, 0.16, C.white, -1, turn);
    cyl(x + 1.5, 0.25, z - 9, 2.1, 8.5, C.silo); cone(x + 1.5, 8.75, z - 9, 2.2, 1.6, C.roof);   // silo
    box(x + 9, 0.25, z + 6, 6, 3, 5, pick(WALLS)); put('pyramid', x + 9, 3.25, z + 6, 6.8, 2.4, 5.8, pick(ROOFS));   // farmhouse
    box(x + 9, 0.25, z + 8.5, 1.1, 1.7, 0.16, C.glassDark);
    box(x - 2, 0.65, z + 9, 1.9, 1.3, 3.2, C.tractor); box(x - 2, 1.95, z + 9.6, 1.6, 1.2, 1.5, C.glassDark);   // tractor
    for (const a of [-1, 1]) { put('wheel', x - 2 + a * 1.2, 0.25, z + 10, 0.5, 1.9, 1.9, C.tyre); put('wheel', x - 2 + a * 1.1, 0.25, z + 7.7, 0.4, 1.1, 1.1, C.tyre); }
    for (let i = whole(3, 6); i > 0; i--) tree(x + between(-17, 17), 0.25, z + between(8, 17), -1, between(0.9, 1.4));
  }
  for (let x = -FARM_REACH + FIELD / 2; x < FARM_REACH; x += FIELD) for (let z = -FARM_REACH + FIELD / 2; z < FARM_REACH; z += FIELD) {
    if (Math.abs(x) < HALF + 20 && Math.abs(z) < HALF + 20) continue;            // the city's own square, with a green margin
    const r = rand();
    if (r < 0.4) wheatField(x, z);
    else if (r < 0.6) cropField(x, z, C.soil, C.crop, rand() < 0.5);
    else if (r < 0.72) cropField(x, z, C.soil, C.soilLight, rand() < 0.5);
    else if (r < 0.86) pasture(x, z);
    else farmstead(x, z);
  }
  for (let i = 0; i < 90; i++) {                           // trees in the green margin and out past the fields
    const far = rand() < 0.45, a = between(0, 6.28), dist = far ? between(250, 520) : 0;
    let x = far ? Math.cos(a) * dist : between(-HALF - 17, HALF + 17), z = far ? Math.sin(a) * dist : between(-HALF - 17, HALF + 17);
    if (!far && Math.abs(x) < HALF + 4 && Math.abs(z) < HALF + 4) { if (rand() < 0.5) x = Math.sign(x || 1) * (HALF + between(5, 17)); else z = Math.sign(z || 1) * (HALF + between(5, 17)); }
    if (Math.abs(x) < 6 || Math.abs(z) < 6) continue;      // keep the roads clear
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

  /* ---------- moving cars ---------- */
  const CAR_COUNT = 30, cars = [];
  const carBody = new THREE.InstancedMesh(kinds.box.geo, solid, CAR_COUNT);
  const carCab = new THREE.InstancedMesh(kinds.box.geo, glass, CAR_COUNT);
  const carWheel = new THREE.InstancedMesh(wheelGeo, solid, CAR_COUNT * 4);
  for (const m of [carBody, carCab, carWheel]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }
  for (let i = 0; i < CAR_COUNT; i++) {
    const line = pick(roadLines), main = Math.abs(line) < 0.01;
    cars.push({ alongX: rand() < 0.5, line, main, dir: pick([-1, 1]), at: between(-HALF, HALF), speed: between(6, 11) });
    carBody.setColorAt(i, tint.set(pick(CARS))); carCab.setColorAt(i, tint.set(C.glassDark));
    for (let k = 0; k < 4; k++) carWheel.setColorAt(i * 4 + k, tint.set(C.tyre));
  }
  const part = new THREE.Matrix4(), base = new THREE.Matrix4();
  function placeCars(dt) {
    cars.forEach((car, i) => {
      car.at += car.dir * car.speed * dt;
      const limit = car.main ? 400 : HALF - 2.5;
      if (car.main) { if (car.at > limit) car.at = -limit; else if (car.at < -limit) car.at = limit; }
      else if (Math.abs(car.at) > limit) { car.at = Math.sign(car.at) * limit; car.dir *= -1; }   // U-turn at the edge of town
      // travelling along +Z means heading 0; keep to the right-hand lane
      const heading = car.alongX ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      const side = 1.45 * car.dir;
      const x = car.alongX ? car.at : car.line - side, z = car.alongX ? car.line + side : car.at;
      q.setFromAxisAngle(UP, heading);
      base.compose(p.set(x, 0.2, z), q, sc.set(1, 1, 1));
      carBody.setMatrixAt(i, part.makeScale(1.8, 0.8, 3.8).setPosition(0, 0.75, 0).premultiply(base));
      carCab.setMatrixAt(i, part.makeScale(1.6, 0.7, 1.9).setPosition(0, 1.5, -0.2).premultiply(base));
      let k = 0;
      for (const a of [-1, 1]) for (const b of [-1, 1])
        carWheel.setMatrixAt(i * 4 + k++, part.makeScale(0.35, 0.8, 0.8).setPosition(a * 0.9, 0.4, b * 1.2).premultiply(base));
    });
    carBody.instanceMatrix.needsUpdate = carCab.instanceMatrix.needsUpdate = carWheel.instanceMatrix.needsUpdate = true;
  }
  carBody.instanceColor.needsUpdate = carCab.instanceColor.needsUpdate = carWheel.instanceColor.needsUpdate = true;
  placeCars(0);

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
  const peopleMeshes = [pLegs, pTop, pDress, pHead, pPram], people = [];
  for (const m of peopleMeshes) { m.castShadow = true; m.frustumCulled = false; m.visible = false; scene.add(m); }
  for (let i = 0; i < PEOPLE; i++) {
    const r = rand(), kind = r < 0.42 ? 'trousers' : r < 0.8 ? 'dress' : 'child';
    const [bx, bz] = pick(blocks);
    people.push({ bx, bz, kind, at: between(0, LAP), dir: pick([-1, 1]), speed: between(1.1, 2.2) * (kind === 'child' ? 1.25 : 1),
      size: kind === 'child' ? between(0.58, 0.7) : between(0.92, 1.08), pram: kind !== 'child' && rand() < 0.12, step: between(0, 6.28) });
    const top = pick(TOPS);
    pLegs.setColorAt(i, tint.set(kind === 'dress' ? '#1b1b1b' : pick(LEGS)));
    pTop.setColorAt(i, tint.set(top)); pDress.setColorAt(i, tint.set(top)); pHead.setColorAt(i, tint.set(SKIN));
    pPram.setColorAt(i * 2, tint.set(pick(['#5a6472', '#1b1b1b', '#3f48cc']))); pPram.setColorAt(i * 2 + 1, tint.set('#2c3e50'));
  }
  for (const m of peopleMeshes) m.instanceColor.needsUpdate = true;
  const nothing = new THREE.Matrix4().makeScale(0, 0, 0);
  function placePeople(dt, t) {
    people.forEach((pr, i) => {
      pr.at = ((pr.at + pr.dir * pr.speed * dt) % LAP + LAP) % LAP;
      /* round the block: four sides, each 2 * WALK long */
      const side = Math.floor(pr.at / (WALK * 2)), d = pr.at - side * WALK * 2 - WALK;
      const [lx, lz, heading] = [[d, -WALK, Math.PI / 2], [WALK, d, 0], [-d, WALK, -Math.PI / 2], [-WALK, -d, Math.PI]][side];
      q.setFromAxisAngle(UP, heading + (pr.dir < 0 ? Math.PI : 0));
      const bob = reduced ? 0 : Math.abs(Math.sin(t * 7 * pr.speed + pr.step)) * 0.07;
      base.compose(p.set(pr.bx + lx, TOP + bob, pr.bz + lz), q, sc.set(pr.size, pr.size, pr.size));
      const dress = pr.kind === 'dress', legH = dress ? 0.42 : 0.62, bodyH = dress ? 0.8 : 0.6;
      pLegs.setMatrixAt(i, part.makeScale(dress ? 0.3 : 0.42, legH, dress ? 0.24 : 0.3).setPosition(0, legH / 2, 0).premultiply(base));
      pTop.setMatrixAt(i, dress ? nothing : part.makeScale(0.5, bodyH, 0.34).setPosition(0, legH + bodyH / 2, 0).premultiply(base));
      pDress.setMatrixAt(i, dress ? part.makeScale(0.62, bodyH, 0.5).setPosition(0, legH + bodyH / 2, 0).premultiply(base) : nothing);
      pHead.setMatrixAt(i, part.makeScale(0.36, 0.36, 0.36).setPosition(0, legH + bodyH + 0.18, 0).premultiply(base));
      pPram.setMatrixAt(i * 2, pr.pram ? part.makeScale(0.46, 0.34, 0.62).setPosition(0, 0.42, 0.72).premultiply(base) : nothing);
      pPram.setMatrixAt(i * 2 + 1, pr.pram ? part.makeScale(0.46, 0.3, 0.3).setPosition(0, 0.72, 0.58).premultiply(base) : nothing);
    });
    for (const m of peopleMeshes) m.instanceMatrix.needsUpdate = true;
  }
  placePeople(0, 0);

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

  let glide = null;                                        // an eased move back to the opening view
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const real = (now - (last || now)) / 1000, dt = Math.min(0.05, real); last = now;
    clock += Math.min(0.5, real);                          // the build follows real time, so a slow frame rate cannot stall it
    if (!built) { setBuild(clock); if (clock >= total) markBuilt(); }
    if (!reduced) { placeCars(dt); placePeople(dt, clock); }
    if (glide) {
      glide.t = Math.min(1, glide.t + dt / 0.9);
      const k = 1 - Math.pow(1 - glide.t, 3);
      camera.position.lerpVectors(glide.fromPos, HOME.pos, k); controls.target.lerpVectors(glide.fromTarget, HOME.target, k);
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
    reset() { glide = { t: 0, fromPos: camera.position.clone(), fromTarget: controls.target.clone() }; },
    stop() {
      stopped = true; pause(); watcher.disconnect(); clearTimeout(buildTimer);
      document.removeEventListener('visibilitychange', onVisibility); removeEventListener('resize', resize);
      controls.dispose(); renderer.dispose(); canvas.remove();
      for (const k of Object.values(kinds)) k.geo.dispose();
      dressGeo.dispose();
      solid.dispose(); glass.dispose();
    }
  };
}
