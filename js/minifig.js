// "Fixer": an original brick-built character, modelled procedurally. Units are millimetres, Y is up,
// the figure faces +Z, and its feet stand on y = 0.
//
// It is deliberately its own design rather than a copy of any toy maker's figure: a square 2x2-brick head
// under a cap, a headset with a mic, a straight block torso, block arms and legs, boots, and clip hands
// whose thumb side is shorter than the finger side.
//
//   const fig = buildMinifig(THREE);
//   scene.add(fig.group);
//   fig.parts.armR.rotation.x = -1.2;   // raise the right arm forward
//
// parts: head, armL, armR (shoulders), elbowL, elbowR, handL, handR, legL, legR (each a pivot at its joint).

const DEFAULT_COLORS = {
  skin: '#ffab1a',
  torso: '#00a2ea',
  arms: '#00a2ea',
  belt: '#1d2470',
  legs: '#2f3ab8',
  boots: '#1d2470',
  headset: '#26262b',
  cap: '#ed1c24',
  print: '#ffffff'
};

// Key dimensions (mm)
const D = {
  bootW: 6.3, bootH: 3.2, bootBack: -3.6, bootFront: 5.6,
  legW: 6.0, legD: 7.0, legGap: 0.8, hipY: 12.6,
  beltH: 2.0, torsoW: 13.6, torsoH: 11.0, torsoD: 7.6,
  neckH: 0.9, neckR: 2.7,
  headW: 12.4, headH: 10.0, headD: 11.0, headR: 1.7, studR: 2.1, studH: 1.5,
  armW: 4.4, armLen: 9.8, armD: 4.8, shoulderDrop: 1.8,
  handOuter: 2.9, handInner: 1.85, handThick: 4.0, wristR: 1.5, wristLen: 0.9
};

export function buildMinifig(THREE, options = {}) {
  const C = { ...DEFAULT_COLORS, ...(options.colors || {}) };
  const seg = options.segments || 40;
  const geometries = [], materials = [], textures = [];
  const keep = (list, item) => { list.push(item); return item; };

  // Glossy moulded plastic
  const plastic = color => keep(materials, new THREE.MeshStandardMaterial({
    color, roughness: 0.34, metalness: 0
  }));
  const M = {};
  for (const k of ['skin', 'torso', 'arms', 'belt', 'legs', 'boots', 'headset', 'cap']) M[k] = plastic(C[k]);
  const mesh = (geo, mat) => new THREE.Mesh(keep(geometries, geo), mat);

  const extrudeCentred = (shape, depth, size) => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: depth - 2 * size, bevelEnabled: true, bevelThickness: size, bevelSize: size, bevelOffset: -size,
      bevelSegments: 4, curveSegments: 12
    });
    g.translate(0, 0, -(depth - 2 * size) / 2);
    return g;
  };
  // A block with rounded corners and softened edges, centred on the origin.
  const block = (w, h, d, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2, P = Math.PI;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -P / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, P / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, P / 2, P, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, P, 1.5 * P, false);
    return extrudeCentred(s, d, Math.min(r * 0.6, d / 4));
  };
  // A stud with a softened top edge, sitting on y = 0.
  const stud = (r, h) => {
    const b = 0.2;
    return new THREE.LatheGeometry([
      new THREE.Vector2(r, 0), new THREE.Vector2(r, h - b), new THREE.Vector2(r - b * 0.3, h - b * 0.3),
      new THREE.Vector2(r - b, h), new THREE.Vector2(0, h)
    ], seg);
  };

  const group = new THREE.Group();
  const parts = {};

  /* ---------------- legs + boots ---------------- */
  const legGeo = keep(geometries, block(D.legW, D.hipY - D.bootH + 0.4, D.legD, 0.8));
  const bootDepth = D.bootFront - D.bootBack;
  const bootGeo = keep(geometries, block(D.bootW, D.bootH, bootDepth, 0.8));
  const legX = D.legGap / 2 + D.legW / 2;
  for (const [name, side] of [['legR', -1], ['legL', 1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * legX, D.hipY, 0);
    const leg = new THREE.Mesh(legGeo, M.legs);
    leg.position.y = -(D.hipY - D.bootH) / 2 + 0.1;
    const boot = new THREE.Mesh(bootGeo, M.boots);
    boot.position.set(0, -D.hipY + D.bootH / 2, (D.bootFront + D.bootBack) / 2);
    pivot.add(leg, boot);
    group.add(pivot);
    parts[name] = pivot;
  }

  /* ---------------- belt + torso ---------------- */
  const belt = mesh(block(D.torsoW - 0.2, D.beltH + 0.4, D.torsoD - 0.1, 0.5), M.belt);
  belt.position.y = D.hipY + D.beltH / 2;
  group.add(belt);
  const buckle = mesh(block(2.6, 1.5, 0.6, 0.3), M.skin);
  buckle.position.set(0, D.hipY + D.beltH / 2, D.torsoD / 2);
  group.add(buckle);

  const torsoY = D.hipY + D.beltH;
  const torso = mesh(block(D.torsoW, D.torsoH, D.torsoD, 1.3), M.torso);
  torso.position.y = torsoY + D.torsoH / 2;
  group.add(torso);
  const torsoTop = torsoY + D.torsoH;

  const print = makeTorsoPrint(THREE, C);
  keep(textures, print);
  const decal = mesh(new THREE.PlaneGeometry(10.2, 10.2), keep(materials, new THREE.MeshStandardMaterial({
    map: print, transparent: true, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
  })));
  decal.position.set(0, torsoY + D.torsoH / 2, D.torsoD / 2 + 0.02);
  group.add(decal);

  /* ---------------- neck + head ---------------- */
  const neck = mesh(new THREE.CylinderGeometry(D.neckR, D.neckR, D.neckH + 0.8, seg), M.skin);
  neck.position.y = torsoTop + D.neckH / 2;
  group.add(neck);

  const head = new THREE.Group();
  head.position.y = torsoTop + D.neckH;
  const skull = mesh(block(D.headW, D.headH, D.headD, D.headR), M.skin);
  skull.position.y = D.headH / 2;
  head.add(skull);
  // the head is a 2x2 brick: four studs on top
  const studGeo = keep(geometries, stud(D.studR, D.studH));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const s = new THREE.Mesh(studGeo, M.skin);
    s.position.set(sx * 3.1, D.headH - 0.05, sz * 2.75);
    head.add(s);
  }
  // printed face
  const face = makeFace(THREE);
  keep(textures, face);
  const faceDecal = mesh(new THREE.PlaneGeometry(10.4, 8.4), keep(materials, new THREE.MeshStandardMaterial({
    map: face, transparent: true, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
  })));
  faceDecal.position.set(0, D.headH / 2 - 0.75, D.headD / 2 + 0.02);
  head.add(faceDecal);
  // Headset: ear cups, a band that runs up under the cap, and a mic boom on the figure's left
  const earY = D.headH / 2 + 0.2, earX = D.headW / 2 + 0.45;
  const cupGeo = keep(geometries, new THREE.CylinderGeometry(2.3, 2.3, 1.3, seg));
  for (const side of [-1, 1]) {
    const cup = new THREE.Mesh(cupGeo, M.headset);
    cup.rotation.z = Math.PI / 2; cup.position.set(side * earX, earY, 0);
    head.add(cup);
  }
  const band = mesh(new THREE.TorusGeometry(earX + 0.25, 0.45, 10, seg, Math.PI), M.headset);
  band.position.y = earY;
  head.add(band);
  const boom = new THREE.CatmullRomCurve3([
    new THREE.Vector3(earX, earY - 0.6, 0.6), new THREE.Vector3(earX + 0.1, 2.6, 4.2),
    new THREE.Vector3(5.2, 1.5, 6.5), new THREE.Vector3(3.2, 1.5, 6.7)
  ]);
  head.add(mesh(new THREE.TubeGeometry(boom, 24, 0.3, 8, false), M.headset));
  const mic = mesh(new THREE.SphereGeometry(0.75, 16, 12), M.headset);
  mic.position.copy(boom.getPoint(1));
  head.add(mic);
  // Cap: a blocky crown that sits over the studs, with a rounded brim
  const capBase = D.headH - 0.9, capH = 4.5;
  const crown = mesh(block(D.headW + 0.7, capH, D.headD + 0.7, 2.0), M.cap);
  crown.position.y = capBase + capH / 2;
  head.add(crown);
  const brim = mesh(new THREE.CylinderGeometry(5.7, 5.7, 0.9, seg), M.cap);
  brim.scale.z = 0.9;
  brim.position.set(0, capBase + 0.45, D.headD / 2 + 0.2);
  head.add(brim);
  const button = mesh(new THREE.SphereGeometry(1.0, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.cap);
  button.scale.y = 0.55; button.position.y = capBase + capH - 0.05;
  head.add(button);
  // a small white patch on the front of the cap
  const patch = mesh(block(3.4, 2.0, 0.5, 0.5), keep(materials, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 })));
  patch.position.set(0, capBase + capH / 2 + 0.35, (D.headD + 0.7) / 2);
  head.add(patch);
  group.add(head);
  parts.head = head;

  /* ---------------- arms + hands ---------------- */
  // Each arm is two blocks joined by real hinges: a shoulder (parts.armL / armR) and an elbow
  // (parts.elbowL / elbowR). Turning a hinge about X swings what hangs from it forward (negative)
  // or back. A round barrel sits at each hinge so the joint reads as a joint, and no part of a block
  // sticks out past its pivot. Built for the figure's left side (+X); the right arm is mirrored.
  const upperLen = 4.9, foreLen = 4.4, jointR = D.armD / 2;
  const upperGeo = keep(geometries, block(D.armW, upperLen + 0.6, D.armD, 1.0));
  const foreGeo = keep(geometries, block(D.armW, foreLen + 0.6, D.armD, 1.0));
  const hingeGeo = keep(geometries, new THREE.CylinderGeometry(jointR, jointR, D.armW, seg));
  hingeGeo.rotateZ(Math.PI / 2);                       // barrel lies along the hinge axis (X)
  const cuffGeo = keep(geometries, block(D.armW + 0.5, 1.4, D.armD + 0.5, 0.5));
  const wristGeo = keep(geometries, new THREE.CylinderGeometry(D.wristR, D.wristR, D.wristLen + 0.6, 24));
  // Clip hand: an open ring. The fingers wrap further round than the thumb, which is the shorter side.
  const deg = THREE.MathUtils.degToRad;
  const fingersEnd = deg(-58), thumbEnd = deg(198);
  const clip = new THREE.Shape();
  clip.absarc(0, 0, D.handOuter, fingersEnd, thumbEnd, false);
  clip.absarc(0, 0, D.handInner, thumbEnd, fingersEnd, true);
  clip.closePath();
  const clipGeo = keep(geometries, extrudeCentred(clip, D.handThick, 0.28));
  const shoulderX = D.torsoW / 2 + D.armW / 2 + 0.15, shoulderY = torsoTop - jointR;

  for (const [name, elbowName, handName, side] of [['armL', 'elbowL', 'handL', 1], ['armR', 'elbowR', 'handR', -1]]) {
    const pivot = new THREE.Group();                   // shoulder hinge
    pivot.position.set(side * shoulderX, shoulderY, 0);
    const inner = new THREE.Group();
    inner.scale.x = side;                              // mirror for the right arm
    inner.rotation.z = side * 0.07;                    // arms hang very slightly outward
    const upper = new THREE.Mesh(upperGeo, M.arms);
    upper.position.y = -upperLen / 2;
    const elbow = new THREE.Group();                   // elbow hinge
    elbow.position.y = -upperLen;
    elbow.rotation.x = -0.22;                          // a relaxed bend at rest
    const fore = new THREE.Mesh(foreGeo, M.arms);
    fore.position.y = -foreLen / 2;
    const cuff = new THREE.Mesh(cuffGeo, M.belt);
    cuff.position.y = -foreLen + 0.5;
    const hand = new THREE.Group();
    hand.position.y = -foreLen - 0.2;
    const wrist = new THREE.Mesh(wristGeo, M.skin);
    wrist.position.y = -(D.wristLen - 0.6) / 2;
    const grip = new THREE.Mesh(clipGeo, M.skin);
    grip.position.y = -(D.wristLen + D.handOuter - 0.35);
    hand.add(wrist, grip);
    elbow.add(new THREE.Mesh(hingeGeo, M.arms), fore, cuff, hand);
    inner.add(new THREE.Mesh(hingeGeo, M.arms), upper, elbow);
    pivot.add(inner);
    group.add(pivot);
    parts[name] = pivot;
    parts[elbowName] = elbow;
    parts[handName] = hand;
  }

  return {
    group, parts,
    height: torsoTop + D.neckH + D.headH + 4.2,
    dispose() {
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      textures.forEach(t => t.dispose());
    }
  };
}

// The face: tall oval eyes with a glint, eyebrows and an open smile.
function makeFace(THREE) {
  const w = 10.4, h = 8.4, px = 72, canvas = document.createElement('canvas');
  canvas.width = Math.round(w * px); canvas.height = Math.round(h * px);
  const g = canvas.getContext('2d');
  g.translate(canvas.width / 2, canvas.height / 2); g.scale(px, -px);     // mm, y up, origin at the centre
  g.lineCap = 'round';
  const ink = '#1b1b1b';
  for (const s of [-1, 1]) {
    g.fillStyle = ink; g.beginPath(); g.ellipse(s * 2.35, 0.95, 0.78, 1.12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(s * 2.35 + 0.26, 1.42, 0.3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ink; g.lineWidth = 0.36;
    g.beginPath(); g.moveTo(s * 1.5, 2.95); g.quadraticCurveTo(s * 2.4, 3.45, s * 3.3, 2.85); g.stroke();
  }
  // open smile
  g.fillStyle = ink;
  g.beginPath(); g.moveTo(-2.3, -1.3); g.quadraticCurveTo(0, -1.0, 2.3, -1.3); g.quadraticCurveTo(0, -4.3, -2.3, -1.3); g.fill();
  g.fillStyle = '#ed1c24';
  g.beginPath(); g.ellipse(0, -2.55, 0.95, 0.5, 0, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// A plain work top: collar, front seam, a chest pocket with a screwdriver, and a name badge.
function makeTorsoPrint(THREE, C) {
  const s = 512, canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const g = canvas.getContext('2d');
  const u = s / 11.2;                                   // px per unit; origin at the decal centre
  g.translate(s / 2, s / 2); g.scale(u, -u);            // y up
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = C.print; g.fillStyle = C.print;
  g.lineWidth = 0.42;
  g.beginPath(); g.moveTo(-2.6, 5.3); g.lineTo(0, 2.6); g.lineTo(2.6, 5.3); g.stroke();
  g.lineWidth = 0.3;
  g.beginPath(); g.moveTo(0, 2.6); g.lineTo(0, -5.3); g.stroke();
  g.lineWidth = 0.34;
  g.beginPath(); g.moveTo(1.3, 0.9); g.lineTo(4.3, 0.9); g.lineTo(4.3, -1.5); g.lineTo(2.8, -2.2); g.lineTo(1.3, -1.5); g.closePath(); g.stroke();
  g.fillStyle = '#ffab1a'; g.fillRect(2.35, 0.9, 0.9, 1.7);
  g.fillStyle = C.print; g.fillRect(2.62, 2.6, 0.36, 0.9);
  g.fillStyle = C.print; g.fillRect(-4.3, -0.9, 2.9, 1.8);
  g.fillStyle = '#ed1c24'; g.fillRect(-4.3, 0.35, 2.9, 0.55);
  g.fillStyle = '#1b1b1b'; g.fillRect(-3.9, -0.15, 2.1, 0.22); g.fillRect(-3.9, -0.6, 1.4, 0.22);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// Shared studio lighting, so the figure looks the same wherever it is shown. Plain lights only: building
// a reflection map here used to stall the page for about a sixth of a second when Fixer appeared.
export function lightFigure(THREE, renderer, scene) {
  renderer.toneMapping = THREE.NoToneMapping;          // keep the toy colours saturated
  const sky = new THREE.HemisphereLight(0xeaf2ff, 0x6b6258, 1.15);
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(-40, 70, 90);
  const fill = new THREE.DirectionalLight(0xffffff, 0.65); fill.position.set(60, 20, 60);
  const rim = new THREE.DirectionalLight(0xffffff, 0.45); rim.position.set(0, 40, -80);
  scene.add(sky, key, fill, rim);
  return { sky, key, fill, rim };
}
