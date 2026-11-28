// Brick-figure chat helper.
// The figure is a three.js model (js/minifig.js). The chat follows the owner's "Little Ace" helper on
// acespaders.com: a scripted answer bank and engine (js/knowledge.js) loaded the first time someone asks
// something, one remembered conversation per page load, a short "typing" pause before each reply, links
// under answers, and follow-up chips. It is not an AI model, and nothing typed here leaves the browser
// (Little Ace's anonymous question log is deliberately not copied).

/* Browsers hold on to script files. Raise this number (and the two ?v= numbers in index.html) whenever
   minifig.js, knowledge.js, chatbot.js or chatbot.css changes, so visitors get the new files. */
const ASSET_VERSION = '6';
const BOT_NAME = 'Fixer';                                  // TODO: confirm the helper's name with the owner
const STARTERS = ['Repair prices', 'Book a repair', 'Lessons'];
const GREETING = `Hi, I'm ${BOT_NAME}, the shop's brick helper. I'm not a person or an AI: I answer from a short list about repairs, prices, lessons and how to reach us.`;

/* knowledge.js is only needed once someone talks to him, so it loads on the first question. */
let knowledge = null, knowledgeLoad = null, chat = null;
function loadKnowledge() {
  if (knowledge) return Promise.resolve(knowledge);
  if (!knowledgeLoad) knowledgeLoad = import('./knowledge.js?v=' + ASSET_VERSION).then(k => (knowledge = k), err => { knowledgeLoad = null; throw err; });
  return knowledgeLoad;
}

/* ------------------------------------------------------------------ */
/* Widget                                                              */
/* ------------------------------------------------------------------ */
const root = document.createElement('div');
root.className = 'fig-chat-root';
root.innerHTML = `
  <section class="fig-panel" id="fig-panel" role="dialog" aria-label="Chat with ${BOT_NAME}, the repair helper" hidden>
    <div class="fig-head">
      <h2>${BOT_NAME}</h2><p>Scripted helper</p>
      <button type="button" class="fig-close" aria-label="Close chat">&times;</button>
    </div>
    <div class="fig-log" role="log" aria-live="polite" tabindex="0" aria-label="Conversation"></div>
    <div class="fig-chips" role="group" aria-label="Quick topics"></div>
    <form class="fig-form">
      <label class="sr-only" for="fig-input">Type a question</label>
      <input id="fig-input" type="text" autocomplete="off" maxlength="400" placeholder="Ask a short, simple question">
      <button type="submit">Send</button>
    </form>
    <div class="fig-foot"><span>Scripted answers. Nothing you type is sent anywhere.</span><button type="button" class="fig-park"></button></div>
  </section>
  <span class="fig-hint" aria-hidden="true">Need a hand?</span>
  <button type="button" class="fig-launcher" aria-expanded="false" aria-controls="fig-panel" aria-label="Open chat with ${BOT_NAME}, the repair helper">
    <svg viewBox="0 0 118 164" aria-hidden="true">
      <!-- Flat drawing of Fixer, shown until (or instead of) the 3D model. Drawn to the same proportions. -->
      <g transform="translate(0 -8.6)">
      <g id="fx-arm">
        <g transform="rotate(-4 92 76)">
          <rect x="84.3" y="74.5" width="15.8" height="33" rx="4.5" fill="#00a2ea"/>
          <rect x="84.3" y="74.5" width="4" height="33" rx="2" fill="#0089c8"/>
          <rect x="83.3" y="102.5" width="17.8" height="5.6" rx="2" fill="#1d2470"/>
          <rect x="89.4" y="107.5" width="5.6" height="5" fill="#ffab1a"/>
          <!-- clip hand: fingers wrap further round than the thumb -->
          <path d="M96.8 127.3 A8.6 8.6 0 1 0 84 122.7" fill="none" stroke="#ffab1a" stroke-width="3.8" stroke-linecap="round"/>
        </g>
      </g>
      <use href="#fx-arm" transform="translate(118 0) scale(-1 1)"/>
      </g>
      <!-- boots, legs, belt -->
      <rect x="34.6" y="146.5" width="23.2" height="11.5" rx="3" fill="#1d2470"/><rect x="60.2" y="146.5" width="23.2" height="11.5" rx="3" fill="#1d2470"/>
      <rect x="36" y="111.4" width="21.6" height="36.6" fill="#2f3ab8"/><rect x="60.4" y="111.4" width="21.6" height="36.6" fill="#2f3ab8"/>
      <g transform="translate(0 -8.6)">
      <rect x="34.9" y="113.5" width="48.2" height="8.2" rx="2" fill="#1d2470"/>
      <rect x="54.3" y="114.9" width="9.4" height="5.4" rx="1" fill="#ffab1a"/>
      <!-- torso and its print -->
      <rect x="34.5" y="74.5" width="49" height="40.5" rx="4.5" fill="#00a2ea"/>
      <rect x="34.5" y="74.5" width="5" height="40.5" rx="2.5" fill="#0089c8"/>
      <g fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M50.5 76.5 L59 85.5 L67.5 76.5"/><path d="M59 85.5 V113"/>
        <path d="M63.5 91.5 H73.5 V99.5 L68.5 102 L63.5 99.5 Z"/>
      </g>
      <rect x="67" y="86" width="3" height="5.6" fill="#ffab1a"/>
      <rect x="44.6" y="91.5" width="9.6" height="6" fill="#fff"/><rect x="44.6" y="91.5" width="9.6" height="1.9" fill="#ed1c24"/>
      <!-- neck and head -->
      <rect x="49.3" y="69.5" width="19.4" height="6" fill="#ffab1a"/>
      <rect x="36.7" y="35.2" width="44.6" height="36" rx="6" fill="#ffab1a"/>
      <rect x="36.7" y="35.2" width="5" height="36" rx="2.5" fill="#e8930a"/>
      <!-- headset: ear cups and the mic boom on his left -->
      <rect x="31.8" y="44.2" width="5" height="16.6" rx="2" fill="#26262b"/><rect x="81.2" y="44.2" width="5" height="16.6" rx="2" fill="#26262b"/>
      <path d="M84 58 Q85 67.5 73 66" fill="none" stroke="#26262b" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="71.6" cy="65.8" r="2.8" fill="#26262b"/>
      <!-- face -->
      <ellipse cx="50.5" cy="52.5" rx="2.8" ry="4" fill="#1b1b1b"/><ellipse cx="67.5" cy="52.5" rx="2.8" ry="4" fill="#1b1b1b"/>
      <circle cx="51.4" cy="50.8" r="1.1" fill="#fff"/><circle cx="68.4" cy="50.8" r="1.1" fill="#fff"/>
      <g fill="none" stroke="#1b1b1b" stroke-width="1.4" stroke-linecap="round"><path d="M47 45.4 Q50.4 43.6 53.6 45.2"/><path d="M64.4 45.2 Q67.6 43.6 71 45.4"/></g>
      <path d="M50.7 60 Q59 58.8 67.3 60 Q59 70.6 50.7 60Z" fill="#1b1b1b"/>
      <ellipse cx="59" cy="64.3" rx="3.2" ry="1.6" fill="#ed1c24"/>
      <!-- cap: brim, crown, button, patch -->
      <ellipse cx="59" cy="38.6" rx="21.5" ry="4.2" fill="#c3141b"/>
      <rect x="35.4" y="22.3" width="47.2" height="16.5" rx="7" fill="#ed1c24"/>
      <ellipse cx="59" cy="22.2" rx="3.6" ry="1.9" fill="#ed1c24"/>
      <rect x="52.9" y="26" width="12.2" height="7.2" rx="2" fill="#fff"/>
      </g>
    </svg>
    <canvas aria-hidden="true"></canvas>
  </button>`;
document.body.appendChild(root);
/* The figure walks around, so he and his speech bubble live in their own element, positioned by its
   feet: (x, y) is where he stands, in viewport pixels. */
const walker = document.createElement('div');
walker.className = 'fig-walker is-home';
walker.append(root.querySelector('.fig-hint'), root.querySelector('.fig-launcher'));
document.body.appendChild(walker);

const panel = root.querySelector('.fig-panel'), launcher = walker.querySelector('.fig-launcher');
const parkButton = root.querySelector('.fig-park');
const log = root.querySelector('.fig-log'), chips = root.querySelector('.fig-chips');
const form = root.querySelector('.fig-form'), input = root.querySelector('#fig-input');
const canvas = launcher.querySelector('canvas');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let figure = null;                                        // set once the 3D figure is ready

/* Where he stands. Home is the bottom-right corner, beside the chat panel. */
const FLOOR_PAD = 6;
const homeSpot = () => ({ x: innerWidth - 12 - launcher.offsetWidth / 2, y: innerHeight - FLOOR_PAD });
const spot = { ...homeSpot() };
function placeWalker() { walker.style.transform = `translate3d(${Math.round(spot.x - launcher.offsetWidth / 2)}px,${Math.round(spot.y - launcher.offsetHeight)}px,0)`; }
placeWalker();
addEventListener('resize', () => { if (walker.classList.contains('is-home')) Object.assign(spot, homeSpot()); placeWalker(); });

/* Parked = he stays in his corner. Reduced motion parks him rather than hiding him: the chat is the point. */
let parked = reducedMotion;
try { const saved = sessionStorage.getItem('fixer-parked'); if (saved) parked = saved === 'yes' || reducedMotion; } catch {}
function updatePark() { parkButton.textContent = parked ? `Let ${BOT_NAME} roam` : `Park ${BOT_NAME}`; parkButton.hidden = reducedMotion; }
parkButton.addEventListener('click', () => { parked = !parked; try { sessionStorage.setItem('fixer-parked', parked ? 'yes' : 'no'); } catch {} updatePark(); });
updatePark();

function addMessage(text, who, links = [], suggest = []) {
  const el = document.createElement('div');
  el.className = `fig-msg ${who}`;
  const label = document.createElement('span');
  label.className = 'fig-speaker'; label.textContent = who === 'user' ? 'You' : BOT_NAME;
  const p = document.createElement('p'); p.textContent = text;               // textContent: never HTML
  el.append(label, p);
  if (links.length) {
    const list = document.createElement('div'); list.className = 'fig-links';
    for (const [title, href] of links) {
      const a = document.createElement('a'); a.href = href; a.textContent = title;
      if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; a.textContent += ' ↗'; }
      if (href.startsWith('#')) a.addEventListener('click', () => setOpen(false));
      list.append(a);
    }
    el.append(list);
  }
  /* Some answers carry their own follow-ups; each button simply asks its question. */
  if (suggest.length) {
    const row = document.createElement('div'); row.className = 'fig-suggest';
    for (const q of suggest) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = q;
      b.addEventListener('click', () => ask(q));
      row.append(b);
    }
    el.append(row);
  }
  log.querySelectorAll('.is-latest').forEach(e => e.classList.remove('is-latest'));
  if (who === 'bot') el.classList.add('is-latest');
  log.append(el);
  while (log.children.length > 50) log.firstElementChild.remove();
  log.scrollTop = log.scrollHeight;
}

/* A short "typing" pause, longer for longer answers, so replies arrive like someone wrote them.
   Skipped for reduced motion. */
let typingEl = null, typingTimer = 0;
function showTyping() {
  typingEl = document.createElement('div');
  typingEl.className = 'fig-msg bot fig-typing';
  typingEl.setAttribute('aria-label', `${BOT_NAME} is typing`);
  typingEl.innerHTML = '<p><i></i><i></i><i></i></p>';
  log.append(typingEl); log.scrollTop = log.scrollHeight;
}
function clearTyping() { clearTimeout(typingTimer); if (typingEl) { typingEl.remove(); typingEl = null; } }

function ask(q) {
  q = q.trim();
  if (!q) return;
  clearTyping();
  addMessage(q, 'user'); input.value = ''; input.focus({ preventScroll: true });
  if (!knowledge) {
    showTyping();
    loadKnowledge().then(() => { clearTyping(); answer(q); },
      () => { clearTyping(); addMessage(`${BOT_NAME} couldn't load his answers. Check your connection, then ask again.`, 'bot'); });
    return;
  }
  answer(q);
}
function answer(q) {
  if (!chat) chat = knowledge.createSession();
  const a = chat.reply(q);
  if (!a) return;
  const say = () => { addMessage(a.text, 'bot', a.links, a.suggest); figure && figure.talk(); };
  const wait = reducedMotion ? 0 : Math.min(1600, 380 + a.text.length * 6);
  if (!wait) return say();
  showTyping();
  typingTimer = setTimeout(() => { clearTyping(); say(); }, wait);
}

for (const label of STARTERS) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label;
  b.addEventListener('click', () => ask(label));
  chips.appendChild(b);
}
form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });

let greeted = false;
function setOpen(open) {
  panel.hidden = !open;
  root.classList.toggle('is-open', open);
  launcher.setAttribute('aria-expanded', String(open));
  launcher.setAttribute('aria-label', `${open ? 'Close' : 'Open'} chat with ${BOT_NAME}, the repair helper`);
  if (open) {
    if (!greeted) { greeted = true; addMessage(GREETING, 'bot'); loadKnowledge().catch(() => {}); }
    input.focus({ preventScroll: true });
    figure && figure.wave();
  } else launcher.focus({ preventScroll: true });
}
launcher.addEventListener('click', () => setOpen(panel.hidden));
walker.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });
root.querySelector('.fig-close').addEventListener('click', () => setOpen(false));
root.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });
launcher.addEventListener('pointerenter', () => figure && figure.wave());
launcher.addEventListener('focus', () => figure && figure.wave());

/* ------------------------------------------------------------------ */
/* The 3D figure                                                       */
/* ------------------------------------------------------------------ */
async function startFigure() {
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;      // the flat SVG figure stays
  const [THREE, { buildMinifig, lightFigure }] = await Promise.all([
    import('three'), import('./minifig.js?v=' + ASSET_VERSION)
  ]);
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  const still = reducedMotion || weak;                    // still = pose changes are drawn, but nothing loops

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const fig = buildMinifig(THREE);
  const stand = new THREE.Group();                        // turn the whole figure toward the page
  stand.rotation.y = -0.38;
  const hang = new THREE.Group();                         // pivot at the top of his cap: he swings from it when held
  hang.position.y = fig.height;
  fig.group.position.y = -fig.height;
  hang.add(fig.group);
  stand.add(hang);
  scene.add(stand);
  lightFigure(THREE, renderer, scene);

  const CANVAS_ROOM = 2;
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 500);
  function resize() {
    /* The canvas is CANVAS_ROOM times the size of the button (see .fig-launcher canvas in the CSS) and
       the camera's view is widened by the same factor, so he is drawn at the same size with spare room
       all round him. Without it his raised arms and hands were cut off at the canvas edge. */
    const w = launcher.clientWidth * CANVAS_ROOM, h = launcher.clientHeight * CANVAS_ROOM;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(CANVAS_ROOM * Math.tan(THREE.MathUtils.degToRad(12))));
    camera.position.set(0, fig.height * 0.66, 104); camera.lookAt(0, fig.height * 0.5, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', () => { resize(); draw(); });

  const { head, armL, armR, elbowL, elbowR, legL, legR } = fig.parts;
  const look = { yaw: 0, pitch: 0 };                      // where the head wants to face
  const clamp = THREE.MathUtils.clamp;
  let waveUntil = 0, talkUntil = 0, raf = 0, raise = 0, clock = 0, lastNow = 0;

  /* ---------------- roaming ----------------
     He stands on a surface: the floor (bottom of the window) or a perch (the top edge of a card, plate
     or heading that is on screen). Every few seconds he decides to run along his surface, hop to a
     perch within reach, drop to the floor, or wave. A perch moves when the page scrolls and he rides
     it; if it leaves the screen he drops to the floor. When the chat opens, or he is parked, he heads
     home to his corner. */
  const PERCHES = '.hero .plate, .service, .step, .quote, .manual-head, .next';
  /* Section headings are not stood on: he runs along the rule under the heading, in front of the text. */
  const STAND_ON_BASE = '.manual-head';
  const RUN_SPEED = 230, REACH_UP = 250, REACH_SIDE = 360, GRAVITY = 3600;
  const W = () => launcher.offsetWidth, H = () => launcher.offsetHeight;
  const floorY = () => innerHeight - FLOOR_PAD;
  const s = { mode: 'idle', surface: null, dir: 0, phase: 0, tx: 0, jump: null, next: 4, air: 0, held: 0, swing: 0, vx: 0, vy: 0 };

  function rectOf(el) {
    const b = el.getBoundingClientRect();
    const r = { top: el.matches(STAND_ON_BASE) ? b.bottom - 3 : b.top, left: b.left, right: b.right, width: b.width };
    return { top: r.top, left: Math.max(r.left, 0) + W() * 0.28, right: Math.min(r.right, innerWidth) - W() * 0.28, ok: el.isConnected && r.width >= 90 && r.top > H() + 6 && r.top < innerHeight - 24 };
  }
  function perches() {
    const out = [];
    for (const el of document.querySelectorAll(PERCHES)) { const r = rectOf(el); if (r.ok && r.right > r.left) out.push({ el, ...r }); }
    return out;
  }
  function range() {
    if (s.surface) { const r = rectOf(s.surface); return [r.left, r.right]; }
    return [W() / 2 + 4, innerWidth - W() / 2 - 4];
  }
  function runTo(x) { const [lo, hi] = range(); s.tx = clamp(x, lo, hi); s.dir = Math.sign(s.tx - spot.x) || 1; s.mode = 'run'; }
  /* A jump is a real throw under gravity: up to a point just above the higher of the two ends, then
     down. Going up he clears the edge; dropping, it is a small hop and then a proper fall. */
  function jumpTo(el, x1) {
    const y1 = el ? rectOf(el).top : floorY();
    const apex = Math.min(spot.y, y1) - (y1 < spot.y - 4 ? 34 : 14);
    const vy = -Math.sqrt(2 * GRAVITY * (spot.y - apex));
    const T = -vy / GRAVITY + Math.sqrt(2 * (y1 - apex) / GRAVITY);
    s.jump = { x0: spot.x, y0: spot.y, x1, y1, el, t: 0, T, vy };
    s.dir = Math.sign(x1 - spot.x) || s.dir || 1; s.mode = 'air'; s.surface = null;
  }
  const dropToFloor = () => jumpTo(null, clamp(spot.x + (s.dir || 1) * 50, W() / 2 + 4, innerWidth - W() / 2 - 4));
  const wantHome = () => parked || !panel.hidden;

  /* Mostly he runs. Runs go a decent distance, so he covers the page rather than shuffling. */
  function decide() {
    s.next = clock + 0.8 + Math.random() * 2.2;
    const r = Math.random();
    const near = perches().filter(p => p.el !== s.surface && spot.y - p.top <= REACH_UP
      && Math.abs(clamp(spot.x, p.left, p.right) - spot.x) <= REACH_SIDE);
    if (r < 0.28 && near.length) {
      const p = near[(Math.random() * near.length) | 0];
      jumpTo(p.el, clamp(spot.x + (Math.random() - 0.5) * 120, p.left, p.right));
    } else if (r < 0.88) {
      const [lo, hi] = range();
      let x = lo + Math.random() * (hi - lo);
      if (Math.abs(x - spot.x) < 180 && hi - lo > 360) x = spot.x - lo > hi - spot.x ? lo + Math.random() * (spot.x - lo - 180) : spot.x + 180 + Math.random() * (hi - spot.x - 180);
      runTo(x);
    } else if (r < 0.93 && s.surface) dropToFloor();
    else waveUntil = clock + 1.6;
  }

  function step(dt) {
    if (s.mode === 'drag') return;                        // the pointer is placing him
    if (s.mode === 'thrown') {
      /* Let go: he keeps the speed of the hand that threw him and falls under gravity. He bounces off
         the sides of the window, lands on a perch if he comes down across its top edge, and otherwise
         lands on the floor. */
      const before = spot.y, lo = W() / 2 + 4, hi = innerWidth - W() / 2 - 4;
      s.vy += GRAVITY * dt; spot.x += s.vx * dt; spot.y += s.vy * dt;
      if (spot.x < lo) { spot.x = lo; s.vx = Math.abs(s.vx) * 0.45; }
      if (spot.x > hi) { spot.x = hi; s.vx = -Math.abs(s.vx) * 0.45; }
      if (Math.abs(s.vx) > 30) s.dir = Math.sign(s.vx);
      if (s.vy > 0) for (const p of perches()) {
        if (before <= p.top + 1 && spot.y >= p.top && spot.x >= p.left && spot.x <= p.right) {
          spot.y = p.top; s.surface = p.el; s.mode = 'idle'; s.next = clock + 1.4; return;
        }
      }
      if (spot.y >= floorY()) { spot.y = floorY(); s.surface = null; s.mode = 'idle'; s.next = clock + 1.4; }
      return;
    }
    if (s.mode === 'air') {
      const j = s.jump; j.t = Math.min(j.T, j.t + dt);
      const k = j.t / j.T, y1 = j.el ? rectOf(j.el).top : floorY();
      spot.x = j.x0 + (j.x1 - j.x0) * k;
      spot.y = j.y0 + j.vy * j.t + GRAVITY * j.t * j.t / 2 + (y1 - j.y1) * k;   // last term: the landing spot may have scrolled
      if (j.t >= j.T) { s.surface = j.el && rectOf(j.el).ok ? j.el : null; s.mode = 'idle'; s.jump = null; spot.y = s.surface ? y1 : floorY(); }
      return;
    }
    /* ride the surface; leave it if it has scrolled away */
    if (s.surface) {
      const r = rectOf(s.surface);
      if (!r.ok) { spot.y = clamp(r.top, H(), floorY()); dropToFloor(); return; }
      spot.y = r.top; spot.x = clamp(spot.x, r.left, r.right);
    } else { spot.y = floorY(); spot.x = clamp(spot.x, W() / 2 + 4, innerWidth - W() / 2 - 4); }

    if (s.mode === 'run') {
      const [lo, hi] = range(); s.tx = clamp(s.tx, lo, hi);
      const d = s.tx - spot.x, move = RUN_SPEED * (wantHome() ? 2.4 : 1) * dt;   // he hurries when called home
      if (Math.abs(d) <= move) { spot.x = s.tx; s.mode = 'idle'; }
      else { s.dir = Math.sign(d); spot.x += s.dir * move; s.phase += dt * 16; }
      return;
    }
    /* idle */
    if (wantHome()) {
      const h = homeSpot();
      if (s.surface) dropToFloor();
      else if (Math.abs(spot.x - h.x) > 3) runTo(h.x);
      return;
    }
    if (clock >= s.next && clock >= waveUntil) decide();
  }

  function pose(t) {
    const waving = t < waveUntil, talking = t < talkUntil, moving = !still && s.mode !== 'idle';
    const ease = still ? 1 : 0.2;
    raise += ((waving && !moving ? 1 : 0) - raise) * (still ? 1 : 0.16);
    s.air += ((s.mode === 'air' || s.mode === 'thrown' ? 1 : 0) - s.air) * ease;
    s.held += ((s.mode === 'drag' ? 1 : 0) - s.held) * ease;
    /* Held: he hangs from the hand and swings behind it, trailing the way it moves, with his legs
       kicking. The swing eases back to straight when the hand stops. */
    const trail = s.mode === 'drag' ? clamp(-drag.vx / 900, -0.75, 0.75) : s.mode === 'thrown' ? clamp(-s.vx / 1400, -0.5, 0.5) : 0;
    s.swing += (trail - s.swing) * 0.12;
    hang.rotation.z = s.swing;
    const kick = Math.sin(t * 10) * 0.55 * s.held;
    const up = Math.min(1, s.air + s.held);               // arms go up both in the air and when held
    const stride = s.mode === 'run' ? Math.sin(s.phase) : 0;
    /* legs: a stride when running, tucked when in the air */
    legL.rotation.x += (stride * 0.85 - 0.55 * s.air + kick - legL.rotation.x) * 0.5;
    legR.rotation.x += (-stride * 0.85 + 0.35 * s.air - kick - legR.rotation.x) * 0.5;
    /* Arms. Shoulders swing against the legs when he runs; in the air both go up and a little out, so
       they clear his head; the right one lifts to wave. Elbows are bent like a runner's when he runs,
       nearly straight in the air, relaxed at rest, and the waving comes from the right forearm. */
    const sway = moving ? 0 : Math.sin(t * 1.6) * 0.04;
    armL.rotation.x += (-stride * 0.8 - 2.3 * up + sway - armL.rotation.x) * 0.5;
    armR.rotation.x += (stride * 0.8 - 2.3 * up - 2.45 * raise - sway - armR.rotation.x) * 0.5;
    armL.rotation.z += (0.38 * up - armL.rotation.z) * 0.3;
    armR.rotation.z += (-0.38 * up - 0.32 * raise - armR.rotation.z) * 0.3;
    if (elbowL && elbowR) {
      const bend = s.mode === 'run' ? -1.3 : -0.22 + 0.1 * s.air;
      const wag = waving && !moving && !still ? Math.sin(t * 11) * 0.45 * raise : 0;
      elbowL.rotation.x += (bend - elbowL.rotation.x) * 0.3;
      elbowR.rotation.x += (bend * (1 - raise) - 0.55 * raise + wag - elbowR.rotation.x) * 0.5;
    }
    /* body: face the way he is going; otherwise turn a little toward the middle of the page */
    const face = s.mode === 'drag' ? 0 : s.mode === 'thrown' ? s.dir * 0.6 : moving ? s.dir * 1.15 : clamp((innerWidth / 2 - spot.x) / innerWidth, -0.5, 0.5) * 0.9;
    stand.rotation.y += (face - stand.rotation.y) * ease;
    fig.group.rotation.x += ((s.mode === 'run' ? 0.14 : 0) - fig.group.rotation.x) * ease;
    fig.group.position.y = -fig.height + (still ? 0 : s.mode === 'run' ? Math.abs(Math.sin(s.phase)) * 0.9 : Math.sin(t * 1.6) * 0.18 * (1 - s.held));
    head.rotation.y += ((moving ? 0 : look.yaw - stand.rotation.y * 0.5) - head.rotation.y) * (still ? 1 : 0.12);
    head.rotation.x = (talking && !still ? Math.sin(t * 16) * 0.07 : 0) + (moving ? 0 : look.pitch * 0.5);
  }
  /* pose() is keyed to the roaming clock while he loops, and to real time when he is still */
  function draw() { pose(still ? performance.now() / 1000 : clock); renderer.render(scene, camera); }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - (lastNow || now)) / 1000); lastNow = now; clock += dt;
    step(dt);
    const h = homeSpot(), atHome = !s.surface && s.mode === 'idle' && Math.abs(spot.x - h.x) <= 3;
    walker.classList.toggle('is-home', atHome);
    walker.classList.toggle('is-air', s.mode === 'air' || s.mode === 'thrown' || s.mode === 'drag');
    placeWalker();
    draw();                                               // drawn every frame: skipping frames can blank a transparent canvas
  }
  const run = () => { if (!still && !raf && !document.hidden) { lastNow = 0; raf = requestAnimationFrame(loop); } };
  const pause = () => { cancelAnimationFrame(raf); raf = 0; };
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : run()));

  if (!still) addEventListener('pointermove', e => {
    const r = launcher.getBoundingClientRect();
    look.yaw = clamp((e.clientX - (r.left + r.width / 2)) / 700, -0.75, 0.75);
    look.pitch = clamp((e.clientY - (r.top + r.height * 0.3)) / 900, -0.3, 0.3);
  }, { passive: true });

  /* ---------------- click and drag ----------------
     Press and move more than a few pixels and he is picked up: he follows the pointer, hanging from it.
     Let go and he is thrown with the hand's speed. A press that does not move is still a plain click,
     which opens the chat. Not offered when he is still (reduced motion or a weak device). */
  const DRAG_SLOP = 7, THROW_MAX = 2200;
  const drag = { id: null, moved: false, sx: 0, sy: 0, ox: 0, oy: 0, vx: 0, vy: 0, lx: 0, ly: 0, lt: 0 };
  let swallowClick = false;
  if (!still) {
    launcher.addEventListener('pointerdown', e => {
      if (e.button) return;
      Object.assign(drag, { id: e.pointerId, moved: false, sx: e.clientX, sy: e.clientY, ox: spot.x - e.clientX, oy: spot.y - e.clientY,
        vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: performance.now() });
      try { launcher.setPointerCapture(e.pointerId); } catch {}   // keeps the drag alive when the pointer leaves him
    });
    launcher.addEventListener('pointermove', e => {
      if (e.pointerId !== drag.id) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_SLOP) return;
        drag.moved = true; s.mode = 'drag'; s.surface = null; s.jump = null; waveUntil = 0;
        walker.classList.add('is-held');
      }
      const now = performance.now(), dt = Math.max(8, now - drag.lt) / 1000;
      drag.vx = drag.vx * 0.55 + ((e.clientX - drag.lx) / dt) * 0.45;
      drag.vy = drag.vy * 0.55 + ((e.clientY - drag.ly) / dt) * 0.45;
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
      spot.x = clamp(e.clientX + drag.ox, W() / 2, innerWidth - W() / 2);
      spot.y = clamp(e.clientY + drag.oy, H() * 0.7, floorY());
    });
    const release = e => {
      if (e.pointerId !== drag.id) return;
      drag.id = null;
      if (!drag.moved) return;                            // never moved: let the click open the chat
      walker.classList.remove('is-held');
      swallowClick = e.type === 'pointerup';              // the click that follows a drag must not open the chat
      const stale = performance.now() - drag.lt > 90;     // held still before letting go: just drop him
      s.vx = stale ? 0 : clamp(drag.vx, -THROW_MAX, THROW_MAX);
      s.vy = stale ? 0 : clamp(drag.vy, -THROW_MAX, THROW_MAX);
      drag.vx = drag.vy = 0;
      s.mode = 'thrown';
    };
    launcher.addEventListener('pointerup', release);
    launcher.addEventListener('pointercancel', release);
    launcher.addEventListener('click', e => { if (swallowClick) { swallowClick = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    launcher.addEventListener('dragstart', e => e.preventDefault());
  }

  const nowT = () => (still ? performance.now() / 1000 : clock);
  figure = {
    wave() { waveUntil = nowT() + 1.6; s.next = Math.max(s.next, clock + 2.5); if (still) { draw(); setTimeout(draw, 1700); } },
    talk() { talkUntil = nowT() + 0.7; }
  };
  if (still) stand.rotation.y = -0.38;
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  draw();
  launcher.classList.add('is-3d');
  run();
}

// Let the hero finish its own animation first, then bring the figure in.
function whenHeroReady(fn) {
  const html = document.documentElement;
  if (html.classList.contains('built') || !document.querySelector('.hero')) return fn();
  const obs = new MutationObserver(() => { if (html.classList.contains('built')) { obs.disconnect(); clearTimeout(timer); fn(); } });
  obs.observe(html, { attributes: true, attributeFilter: ['class'] });
  const timer = setTimeout(() => { obs.disconnect(); fn(); }, 9000);
}
// Building the figure compiles shaders and can stall the page for a moment, so wait until the hero's
// entrance animation has played out.
whenHeroReady(() => setTimeout(() => {
  startFigure().catch(err => console.warn('3D figure unavailable, keeping the flat one', err));
}, reducedMotion ? 0 : 3200));
