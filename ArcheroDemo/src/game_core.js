/* =============================================================================
 * ArcheroDemo — game_core.js  (TOÀN BỘ logic game)
 * Nguồn spec: Docs/MECHANIC_ORIGINAL.txt + Docs/MECHANIC_CHANGES.txt
 * three.js r136 GLOBAL, không ES module, chạy offline bằng double-click.
 *
 * QUY ƯỚC ĐƠN VỊ:
 *   Chiều rộng phòng = ROOM_W = 10 world-unit  <=>  100% chiều rộng phòng.
 *   Vậy 1% chiều rộng phòng = 0.1 world-unit. Mọi tham số mục G của
 *   MECHANIC_CHANGES ghi dưới dạng %/giây đều đã quy đổi bằng hằng PCT.
 *   Mặt sàn nằm trên mặt phẳng XZ (y = 0); x = ngang, z = dọc (z âm = "lên").
 * ========================================================================== */
'use strict';

(function () {

// ---------------------------------------------------------------------------
// 0. CFG — MỌI SỐ TỪ MECHANIC_CHANGES MỤC G (không tự ý đổi; Agent D sẽ tune)
// ---------------------------------------------------------------------------
var ROOM_W = 10;                 // 100% chiều rộng phòng = 10 world-unit
var PCT    = ROOM_W / 100;       // 1% chiều rộng phòng

var CFG = {
  // --- Phòng (MOD-5: đúng 1 màn hình, tỉ lệ dọc 9:16, camera cố định) ---
  room: {
    w: ROOM_W,                   // chiều rộng phòng
    h: ROOM_W * 16 / 9,          // chiều cao phòng (9:16)
    wallH: 0.9,                  // chiều cao tường trang trí
    margin: 0.55                 // biên trong: tâm entity không vượt quá
  },

  // --- Camera top-down nghiêng nhẹ, CỐ ĐỊNH (MOD-5) ---
  camera: {
    tiltDeg: 30,                 // độ nghiêng khỏi phương thẳng đứng
    dist: 40,                    // khoảng cách (ortho: chỉ ảnh hưởng near/far)
    fitMargin: 1.06              // hệ số nới khung ngắm
  },

  // --- Hero (mục G) ---
  hero: {
    speed: 35 * PCT,             // 35% chiều rộng phòng / giây
    hpMax: 1000,
    radius: 0.34,
    height: 0.95,
    hitFlash: 0.12
  },

  // --- Đạn hero (mục G) ---
  arrow: {
    speed: 250 * PCT,            // 250% chiều rộng phòng / giây
    damage: 100,                 // damage/phát
    fireRate: 2.5,               // 2.5 phát / giây (auto-fire khi đứng yên)
    radius: 0.13,
    len: 0.5,
    life: 3.0
  },

  // --- 3 loại quái (MOD-4 + mục G) ---
  slime: {                       // Slime xanh: chậm, trâu, damage khi chạm
    hp: 400, speed: 12 * PCT, touchDamage: 80, touchCd: 1.0,
    radius: 0.42, xp: 1
  },
  bug: {                         // Bọ đỏ: đuổi -> telegraph vòng đỏ -> lao/đánh
    hp: 250, speed: 30 * PCT, damage: 120,
    telegraph: 0.6,              // 0.6s vòng đỏ dưới chân
    attackRange: 1.05,           // tầm bắt đầu telegraph
    hitRadius: 1.25,             // bán kính vòng đỏ gây damage lúc kết thúc
    dashSpeed: 90 * PCT, dashTime: 0.18,
    cooldown: 1.5, radius: 0.32, xp: 1
  },
  flower: {                      // Hoa quái: đứng yên, bắn đạn theo chu kỳ
    hp: 300, fireInterval: 1.5, bulletSpeed: 60 * PCT, bulletDamage: 100,
    bulletRadius: 0.17, radius: 0.38, xp: 1
  },

  // --- Wave (MOD-6, ADD-1: 5 wave) ---
  wave: {
    count: 5,
    nextDelay: 1.5,              // 1.5s giữa 2 wave
    spawnMinDistPct: 25,         // spawn cách hero >= 25% chiều rộng phòng
    list: [
      ['slime','slime','slime'],                                   // w1
      ['bug','bug','flower','flower'],                             // w2
      ['bug','bug','bug','slime','slime'],                         // w3
      ['flower','flower','bug','bug','bug'],                       // w4
      ['flower','flower','bug','bug','bug','slime','slime']        // w5
    ]
  },

  // --- Tim hồi máu (mục G) ---
  heart: {
    dropChance: 0.15,            // 15% khi 1 quái chết
    heal: 200,                   // hồi 200 HP
    radius: 0.34, pickRadius: 0.55, life: 12
  },

  // --- XP / Level (mục G) + card lên cấp (MOD-3) ---
  level: {
    xpPerKill: 1,
    thresholds: [5, 8, 12, 16],  // Lv1->2, 2->3, 3->4, 4->5
    cardCount: 3,
    atkBonus: 0.25,              // +25% Tấn Công
    fireRateBonus: 0.20,         // +20% Tốc độ bắn
    hpBonus: 300                 // +300 HP tối đa (và hồi đầy máu)
  },

  // --- Màu primitive fallback (khi chưa có FBX) ---
  color: {
    floorA: 0x3d4a5c, floorB: 0x34404f, wall: 0x5c6b80, wallEdge: 0x8fa3bd,
    hero: 0x9fd8ff, heroHat: 0x1b1f27,
    slime: 0x56d962, bug: 0xe0453a, flowerStem: 0x3f8f4a, flowerHead: 0xff77c2,
    arrow: 0xfff4d0, enemyBullet: 0xff9a4d, heart: 0xff4d63, ring: 0xff2f2f
  }
};

// ---------------------------------------------------------------------------
// 1. Tiện ích
// ---------------------------------------------------------------------------
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function ri(n) { return Math.floor(Math.random() * n); }
function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
function $(id) { return document.getElementById(id); }

// ---------------------------------------------------------------------------
// 2. AssetLoader — FBX nếu có, primitive nếu không.
//    Game logic KHÔNG biết mesh đến từ đâu: chỉ gọi Assets.make(key).
//    ASSET_MAP khớp .claude/pipeline/scripts/embed_fbx.js
// ---------------------------------------------------------------------------
var ASSET_KEYS = ['hero', 'monster_flower', 'monster_bug', 'monster_slime', 'arrow', 'floor', 'wall'];

// Kích thước chuẩn hoá (đường kính XZ, chiều cao Y) để scale FBX về đúng cỡ.
var ASSET_SIZE = {
  hero:           { d: CFG.hero.radius * 2,   h: CFG.hero.height },
  monster_slime:  { d: CFG.slime.radius * 2,  h: CFG.slime.radius * 1.4 },
  monster_bug:    { d: CFG.bug.radius * 2,    h: CFG.bug.radius * 1.3 },
  monster_flower: { d: CFG.flower.radius * 2, h: CFG.flower.radius * 3.0 },
  arrow:          { d: CFG.arrow.radius * 2,  h: CFG.arrow.len },
  floor:          { d: CFG.room.w,            h: 0.1 },
  wall:           { d: 1,                     h: CFG.room.wallH }
};

var Assets = {
  raw: {},        // key -> { root: Object3D, clips: {idle,run,attack} }
  ready: false,

  load: function () {
    var FBX = (typeof window !== 'undefined' && window.FBX) ? window.FBX : {};
    for (var i = 0; i < ASSET_KEYS.length; i++) {
      var k = ASSET_KEYS[i];
      if (!FBX[k]) continue;                       // chưa có FBX -> primitive
      try {
        var buf = b64ToArrayBuffer(FBX[k]);
        var root = new THREE.FBXLoader().parse(buf, '');
        normalizeToSize(root, ASSET_SIZE[k]);
        this.raw[k] = { root: root, clips: pickClips(root.animations) };
      } catch (e) {
        console.warn('[AssetLoader] Parse FBX lỗi cho "' + k + '":', e);
      }
    }
    this.ready = true;
  },

  has: function (k) { return !!this.raw[k]; },

  /* Trả về Object3D dùng được ngay (clone FBX hoặc primitive cùng kích thước). */
  make: function (k) {
    if (this.raw[k]) {
      var o = this.raw[k].root.clone(true);
      o.traverse(function (n) { if (n.isMesh) { n.castShadow = !NOSHADOW; n.receiveShadow = false; } });
      // Bọc vào Group: game logic set position trên Group, offset canh tâm của
      // FBX nằm ở object con nên không bị ghi đè.
      var g = new THREE.Group(); g.add(o); return g;
    }
    return Prim[k]();
  },

  clips: function (k) { return this.raw[k] ? this.raw[k].clips : null; }
};

function b64ToArrayBuffer(b64) {
  var bin = atob(b64), n = bin.length, buf = new ArrayBuffer(n), v = new Uint8Array(buf);
  for (var i = 0; i < n; i++) v[i] = bin.charCodeAt(i) & 0xff;
  return buf;
}

/* Scale FBX về kích thước CFG bằng Box3, đặt gốc toạ độ ở đáy-tâm. */
function normalizeToSize(root, size) {
  if (!size) return;
  var box = new THREE.Box3().setFromObject(root);
  var s = new THREE.Vector3(); box.getSize(s);
  if (!isFinite(s.x) || s.x <= 0 || s.y <= 0 || s.z <= 0) return;
  var sc = Math.min(size.d / Math.max(s.x, s.z), size.h / s.y);
  if (!isFinite(sc) || sc <= 0) return;
  root.scale.setScalar(sc);
  box.setFromObject(root);
  var c = new THREE.Vector3(); box.getCenter(c);
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y;
}

/* Lấy AnimationClip theo tên chứa idle/run/attack (không phân biệt hoa thường). */
function pickClips(anims) {
  var out = { idle: null, run: null, attack: null };
  if (!anims) return out;
  for (var i = 0; i < anims.length; i++) {
    var nm = (anims[i].name || '').toLowerCase();
    if (!out.idle && nm.indexOf('idle') >= 0) out.idle = anims[i];
    if (!out.run && (nm.indexOf('run') >= 0 || nm.indexOf('walk') >= 0)) out.run = anims[i];
    if (!out.attack && nm.indexOf('attack') >= 0) out.attack = anims[i];
  }
  return out;
}

// --- Primitive fallback (màu thuần, cùng kích thước với ASSET_SIZE) ---
var MAT = {};
function mat(color, opts) {
  var key = color + '|' + JSON.stringify(opts || {});
  if (!MAT[key]) {
    var o = Object.assign({ color: color, roughness: 0.75, metalness: 0.0 }, opts || {});
    MAT[key] = new THREE.MeshStandardMaterial(o);
  }
  return MAT[key];
}
function meshOf(geo, m) {
  var s = new THREE.Mesh(geo, m);
  s.castShadow = !NOSHADOW; s.receiveShadow = false;
  return s;
}
/* three r136 chưa có CapsuleGeometry -> tự ghép trụ + 2 chỏm cầu (trục Y). */
function capsuleGroup(r, mid, m) {
  var g = new THREE.Group();
  g.add(meshOf(new THREE.CylinderGeometry(r, r, mid, 14), m));
  var a = meshOf(new THREE.SphereGeometry(r, 14, 10), m); a.position.y = mid / 2; g.add(a);
  var b = meshOf(new THREE.SphereGeometry(r, 14, 10), m); b.position.y = -mid / 2; g.add(b);
  return g;
}

var Prim = {
  // Hero: capsule xanh nhạt + "mũ" hình trụ đen
  hero: function () {
    var g = new THREE.Group(), r = CFG.hero.radius, h = CFG.hero.height;
    var body = capsuleGroup(r, Math.max(0.05, h - 2 * r), mat(CFG.color.hero));
    body.position.y = h / 2; g.add(body);
    var hat = meshOf(new THREE.CylinderGeometry(r * 0.8, r * 0.8, r * 0.45, 14), mat(CFG.color.heroHat, { roughness: 0.5 }));
    hat.position.y = h + r * 0.18; g.add(hat);
    // mỏ/hướng nhìn: nón nhỏ phía trước (+Z = hướng forward) để thấy hero xoay mặt
    var nose = meshOf(new THREE.ConeGeometry(r * 0.35, r * 0.7, 10), mat(CFG.color.heroHat));
    nose.rotation.x = Math.PI / 2; nose.position.set(0, h * 0.62, r * 1.05); g.add(nose);
    return g;
  },
  // Slime: sphere dẹt xanh lá
  monster_slime: function () {
    var g = new THREE.Group(), r = CFG.slime.radius;
    var b = meshOf(new THREE.SphereGeometry(r, 16, 12), mat(CFG.color.slime, { roughness: 0.35 }));
    b.scale.y = 0.68; b.position.y = r * 0.68; g.add(b);
    return g;
  },
  // Bọ đỏ: box đỏ thấp
  monster_bug: function () {
    var g = new THREE.Group(), r = CFG.bug.radius;
    var b = meshOf(new THREE.BoxGeometry(r * 2, r * 1.3, r * 2.3), mat(CFG.color.bug));
    b.position.y = r * 0.65; g.add(b);
    return g;
  },
  // Hoa quái: cylinder thân + sphere hồng
  monster_flower: function () {
    var g = new THREE.Group(), r = CFG.flower.radius;
    var stem = meshOf(new THREE.CylinderGeometry(r * 0.28, r * 0.36, r * 2.0, 10), mat(CFG.color.flowerStem));
    stem.position.y = r * 1.0; g.add(stem);
    var head = meshOf(new THREE.SphereGeometry(r * 0.75, 14, 10), mat(CFG.color.flowerHead));
    head.position.y = r * 2.3; g.add(head);
    return g;
  },
  // Đạn hero: capsule nhỏ trắng
  arrow: function () {
    var g = new THREE.Group();
    var m = mat(CFG.color.arrow, { emissive: 0x6b5a20, roughness: 0.4 });
    var b = capsuleGroup(CFG.arrow.radius * 0.7, CFG.arrow.len, m);
    b.rotation.x = Math.PI / 2;      // nằm dọc theo trục Z (forward = +Z)
    g.add(b);
    var tip = meshOf(new THREE.ConeGeometry(CFG.arrow.radius, CFG.arrow.len * 0.5, 10), m);
    tip.rotation.x = Math.PI / 2; tip.position.z = CFG.arrow.len * 0.72; g.add(tip);
    return g;
  },
  // Sàn: plane xám-xanh lát ô (texture canvas 2D)
  floor: function () {
    var geo = new THREE.PlaneGeometry(CFG.room.w, CFG.room.h);
    var m = new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.95 });
    var p = new THREE.Mesh(geo, m);
    p.rotation.x = -Math.PI / 2; p.receiveShadow = !NOSHADOW;
    return p;
  },
  // Tường: box viền (dựng riêng ở buildRoom)
  wall: function () { return new THREE.Group(); }
};

/* Lưới ô màu runtime bằng canvas 2D (nhẹ, không cần file ảnh). */
var _checker = null;
function checkerTexture() {
  if (_checker) return _checker;
  var N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  var x = c.getContext('2d');
  x.fillStyle = '#3d4a5c'; x.fillRect(0, 0, N, N);
  x.fillStyle = '#34404f'; x.fillRect(0, 0, N / 2, N / 2); x.fillRect(N / 2, N / 2, N / 2, N / 2);
  x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 2; x.strokeRect(1, 1, N - 2, N - 2);
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, Math.round(6 * CFG.room.h / CFG.room.w));
  t.magFilter = THREE.NearestFilter;
  _checker = t; return t;
}

// ---------------------------------------------------------------------------
// 3. Scene / Camera / Ánh sáng
// ---------------------------------------------------------------------------
var NOSHADOW = (typeof window !== 'undefined' && window.__NOSHADOW === true);
var renderer, scene, camera, stageEl, canvasEl;
var groupEntities, groupFx;

function initThree() {
  canvasEl = $('cv'); stageEl = $('stage');
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !NOSHADOW;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0e1119, 1);

  scene = new THREE.Scene();
  // Không dùng fog: camera ortho đặt xa (CFG.camera.dist) nên fog theo khoảng
  // cách sẽ nhuộm đen toàn phòng.

  // [MOD-5] Camera top-down nghiêng nhẹ CỐ ĐỊNH — thấy trọn phòng, không follow.
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  var t = CFG.camera.tiltDeg * Math.PI / 180;
  camera.position.set(0, CFG.camera.dist * Math.cos(t), CFG.camera.dist * Math.sin(t));
  camera.lookAt(0, 0, 0);

  var hemi = new THREE.HemisphereLight(0xbcd6ff, 0x2a3040, 0.95);
  scene.add(hemi);
  var dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(CFG.room.w * 0.6, CFG.room.h * 0.9, CFG.room.h * 0.35);
  if (!NOSHADOW) {
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    var cam = dir.shadow.camera;
    cam.left = -CFG.room.w; cam.right = CFG.room.w;
    cam.top = CFG.room.h * 0.7; cam.bottom = -CFG.room.h * 0.7;
    cam.near = 1; cam.far = CFG.room.h * 3;
    cam.updateProjectionMatrix();
  }
  scene.add(dir);

  groupEntities = new THREE.Group(); scene.add(groupEntities);
  groupFx = new THREE.Group(); scene.add(groupFx);

  buildRoom();
  resize();
  window.addEventListener('resize', resize);
}

function buildRoom() {
  scene.add(Assets.make('floor'));

  // Tường viền quanh phòng (box + gờ sáng)
  var W = CFG.room.w, H = CFG.room.h, th = 0.35, hh = CFG.room.wallH;
  var wm = mat(CFG.color.wall, { roughness: 0.9 });
  var em = mat(CFG.color.wallEdge, { roughness: 0.6 });
  function slab(w, d, x, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), wm);
    m.position.set(x, hh / 2, z); m.receiveShadow = !NOSHADOW; m.castShadow = !NOSHADOW; scene.add(m);
    var e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, d), em);
    e.position.set(x, hh + 0.045, z); scene.add(e);
  }
  slab(W + th * 2, th, 0, -H / 2 - th / 2);
  slab(W + th * 2, th, 0,  H / 2 + th / 2);
  slab(th, H, -W / 2 - th / 2, 0);
  slab(th, H,  W / 2 + th / 2, 0);
}

/* Khung 9:16 letterbox + ortho frustum ôm trọn phòng (MOD-5). */
function resize() {
  var ww = window.innerWidth, wh = window.innerHeight, aspect = 9 / 16;
  var w = Math.min(ww, wh * aspect), h = w / aspect;
  stageEl.style.width = Math.round(w) + 'px';
  stageEl.style.height = Math.round(h) + 'px';
  renderer.setSize(Math.round(w), Math.round(h), false);

  var t = CFG.camera.tiltDeg * Math.PI / 180;
  // Phòng chiếu lên mặt phẳng camera: rộng = room.w, cao = room.h*cos(tilt)
  var needW = CFG.room.w, needH = CFG.room.h * Math.cos(t) + CFG.room.wallH * Math.sin(t) * 2;
  var halfW = Math.max(needW / 2, (needH / 2) * aspect) * CFG.camera.fitMargin;
  var halfH = halfW / aspect;
  camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// 4. STATE
// ---------------------------------------------------------------------------
var state = null;

function freshState() {
  return {
    phase: 'playing',        // 'playing' | 'levelup' | 'won' | 'lost'
    time: 0,
    wave: 0,                 // wave hiện tại (0 = chưa spawn)
    waveTimer: 0,            // đếm ngược tới wave kế
    waitingNextWave: false,
    hero: null,
    enemies: [],
    arrows: [],              // đạn hero
    ebullets: [],            // đạn quái
    hearts: [],
    rings: [],               // vòng đỏ telegraph
    texts: [],               // số damage nổi
    level: 1, xp: 0,
    cards: [],
    stat: { atkMul: 1, fireMul: 1, hpBonus: 0 },
    kills: 0
  };
}

function makeHero() {
  var mesh = Assets.make('hero');
  groupEntities.add(mesh);
  return {
    mesh: mesh, x: 0, z: CFG.room.h * 0.32, r: CFG.hero.radius,
    hp: CFG.hero.hpMax, hpMax: CFG.hero.hpMax,
    fireCd: 0, moving: false, facing: 0, flash: 0
  };
}

// ---------------------------------------------------------------------------
// 5. INPUT — [MOD-1] bàn phím: WASD + phím mũi tên (hỗ trợ ĐỒNG THỜI cả hai)
// ---------------------------------------------------------------------------
var input = { up: false, down: false, left: false, right: false };

function keyDir(code) {
  switch (code) {
    case 'KeyW': case 'ArrowUp':    return 'up';
    case 'KeyS': case 'ArrowDown':  return 'down';
    case 'KeyA': case 'ArrowLeft':  return 'left';
    case 'KeyD': case 'ArrowRight': return 'right';
  }
  return null;
}
function initInput() {
  window.addEventListener('keydown', function (e) {
    var d = keyDir(e.code); if (d) { input[d] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) {
    var d = keyDir(e.code); if (d) { input[d] = false; e.preventDefault(); }
  });
  window.addEventListener('blur', function () {
    input.up = input.down = input.left = input.right = false;
  });
}

// ---------------------------------------------------------------------------
// 6. WAVE — [MOD-6] 5 wave định nghĩa trong CFG.wave.list; [MOD-2] 1 phòng duy nhất
// ---------------------------------------------------------------------------
function spawnWave(k) {
  var list = CFG.wave.list[k - 1];
  if (!list) return;
  state.wave = k;
  state.waitingNextWave = false;
  for (var i = 0; i < list.length; i++) spawnEnemy(list[i]);
  syncHUD();
}

/* Vị trí spawn: trong phòng, cách hero >= 25% chiều rộng phòng. */
function spawnPos() {
  var m = CFG.room.margin, hw = CFG.room.w / 2 - m, hh = CFG.room.h / 2 - m;
  var minD2 = Math.pow(CFG.wave.spawnMinDistPct * PCT, 2);
  var hx = state.hero ? state.hero.x : 0, hz = state.hero ? state.hero.z : 0;
  for (var i = 0; i < 60; i++) {
    var x = rnd(-hw, hw), z = rnd(-hh, hh);
    if (dist2(x, z, hx, hz) >= minD2) return { x: x, z: z };
  }
  return { x: rnd(-hw, hw), z: -hh };   // fallback: xa nhất phía trên
}

function spawnEnemy(type) {
  var p = spawnPos(), e;
  if (type === 'slime') {
    e = { type: 'slime', hp: CFG.slime.hp, hpMax: CFG.slime.hp, r: CFG.slime.radius,
          speed: CFG.slime.speed, touchCd: 0, mesh: Assets.make('monster_slime') };
  } else if (type === 'bug') {
    // [MOD-4] bọ đỏ: chase -> telegraph -> dash -> cooldown
    e = { type: 'bug', hp: CFG.bug.hp, hpMax: CFG.bug.hp, r: CFG.bug.radius,
          speed: CFG.bug.speed, st: 'chase', t: 0, dx: 0, dz: 0, ring: null,
          mesh: Assets.make('monster_bug') };
  } else {
    e = { type: 'flower', hp: CFG.flower.hp, hpMax: CFG.flower.hp, r: CFG.flower.radius,
          speed: 0, fireCd: rnd(0.3, CFG.flower.fireInterval), mesh: Assets.make('monster_flower') };
  }
  e.x = p.x; e.z = p.z; e.flash = 0;
  e.mesh.position.set(e.x, 0, e.z);
  groupEntities.add(e.mesh);
  state.enemies.push(e);
  return e;
}

// ---------------------------------------------------------------------------
// 7. VÒNG LẶP LOGIC — tick(dt)
// ---------------------------------------------------------------------------
function tick(dt) {
  if (!state) return;
  if (state.phase !== 'playing') { updateTexts(dt); return; }   // pause khi levelup/kết thúc
  dt = Math.min(dt, 0.05);        // chống nhảy dt lớn
  state.time += dt;

  updateHero(dt);
  updateEnemies(dt);
  updateArrows(dt);
  updateEnemyBullets(dt);
  updateHearts(dt);
  updateRings(dt);
  updateTexts(dt);
  updateWaveFlow(dt);
  syncHUD();
}

/* [MOD-1] Di chuyển bằng phím; [E] giữ rule gốc: di chuyển -> ngừng bắn,
   đứng yên -> auto-fire quái gần nhất. */
function updateHero(dt) {
  var h = state.hero; if (!h) return;
  var mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  var mz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  var len = Math.hypot(mx, mz);
  h.moving = len > 0.001;

  if (h.moving) {
    mx /= len; mz /= len;
    h.x += mx * CFG.hero.speed * dt;
    h.z += mz * CFG.hero.speed * dt;
    clampToRoom(h);
    h.facing = Math.atan2(mx, mz);        // xoay mặt theo hướng đi
  }

  // Auto-fire chỉ khi ĐỨNG YÊN
  h.fireCd -= dt;
  if (!h.moving) {
    var tg = nearestEnemy(h.x, h.z);
    if (tg) {
      h.facing = Math.atan2(tg.x - h.x, tg.z - h.z);   // xoay mặt về hướng bắn
      if (h.fireCd <= 0) {
        shootArrow(h, tg);
        h.fireCd = 1 / (CFG.arrow.fireRate * state.stat.fireMul);
      }
    }
  } else if (h.fireCd < 0) h.fireCd = 0;

  h.flash = Math.max(0, h.flash - dt);
  h.mesh.position.set(h.x, 0, h.z);
  h.mesh.rotation.y = h.facing;
}

function clampToRoom(o) {
  var m = CFG.room.margin;
  o.x = clamp(o.x, -CFG.room.w / 2 + m, CFG.room.w / 2 - m);
  o.z = clamp(o.z, -CFG.room.h / 2 + m, CFG.room.h / 2 - m);
}

function nearestEnemy(x, z) {
  var best = null, bd = Infinity;
  for (var i = 0; i < state.enemies.length; i++) {
    var e = state.enemies[i], d = dist2(x, z, e.x, e.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function shootArrow(h, tg) {
  var a = Math.atan2(tg.x - h.x, tg.z - h.z);
  var mesh = Assets.make('arrow');
  mesh.position.set(h.x, CFG.hero.height * 0.55, h.z);
  mesh.rotation.y = a;
  groupEntities.add(mesh);
  state.arrows.push({
    x: h.x, z: h.z, vx: Math.sin(a) * CFG.arrow.speed, vz: Math.cos(a) * CFG.arrow.speed,
    r: CFG.arrow.radius, life: CFG.arrow.life,
    dmg: Math.round(CFG.arrow.damage * state.stat.atkMul), mesh: mesh
  });
}

function updateArrows(dt) {
  for (var i = state.arrows.length - 1; i >= 0; i--) {
    var a = state.arrows[i];
    a.x += a.vx * dt; a.z += a.vz * dt; a.life -= dt;
    a.mesh.position.x = a.x; a.mesh.position.z = a.z;
    var hit = null;
    for (var j = 0; j < state.enemies.length; j++) {
      var e = state.enemies[j], rr = a.r + e.r;
      if (dist2(a.x, a.z, e.x, e.z) <= rr * rr) { hit = e; break; }
    }
    if (hit) { damageEnemy(hit, a.dmg); removeArrow(i); continue; }
    if (a.life <= 0 || outOfRoom(a.x, a.z)) removeArrow(i);
  }
}
function removeArrow(i) { groupEntities.remove(state.arrows[i].mesh); state.arrows.splice(i, 1); }
function outOfRoom(x, z) {
  return x < -CFG.room.w / 2 || x > CFG.room.w / 2 || z < -CFG.room.h / 2 || z > CFG.room.h / 2;
}

/* [MOD-4] Hành vi 3 loại quái. */
function updateEnemies(dt) {
  var h = state.hero;
  for (var i = 0; i < state.enemies.length; i++) {
    var e = state.enemies[i];
    e.flash = Math.max(0, e.flash - dt);

    if (e.type === 'slime') {
      // Slime: đi chậm về hero, gây damage khi chạm (có cooldown)
      moveToward(e, h.x, h.z, e.speed * dt);
      e.touchCd -= dt;
      var rr = e.r + h.r;
      if (dist2(e.x, e.z, h.x, h.z) <= rr * rr && e.touchCd <= 0) {
        e.touchCd = CFG.slime.touchCd;
        damageHero(CFG.slime.touchDamage);
      }
    } else if (e.type === 'bug') {
      updateBug(e, dt, h);
    } else {
      // Hoa quái: đứng yên, bắn đạn về hero theo chu kỳ
      e.fireCd -= dt;
      if (e.fireCd <= 0) {
        e.fireCd = CFG.flower.fireInterval;
        shootEnemyBullet(e, h);
      }
      e.mesh.rotation.y = Math.atan2(h.x - e.x, h.z - e.z);
    }

    clampToRoom(e);
    e.mesh.position.x = e.x; e.mesh.position.z = e.z;
  }
  separateEnemies();
}

function updateBug(e, dt, h) {
  e.t -= dt;
  if (e.st === 'chase') {
    moveToward(e, h.x, h.z, e.speed * dt);
    e.mesh.rotation.y = Math.atan2(h.x - e.x, h.z - e.z);
    var rr = CFG.bug.attackRange;
    if (dist2(e.x, e.z, h.x, h.z) <= rr * rr) {
      e.st = 'telegraph'; e.t = CFG.bug.telegraph;
      e.ring = addRing(e.x, e.z, CFG.bug.hitRadius, CFG.bug.telegraph);
      var a = Math.atan2(h.x - e.x, h.z - e.z);
      e.dx = Math.sin(a); e.dz = Math.cos(a);
    }
  } else if (e.st === 'telegraph') {
    // Vòng đỏ 0.6s trên sàn — hero rời khỏi vòng là né được
    if (e.ring) { e.ring.x = e.x; e.ring.z = e.z; }
    if (e.t <= 0) {
      var cx = e.ring ? e.ring.x : e.x, cz = e.ring ? e.ring.z : e.z;
      if (dist2(h.x, h.z, cx, cz) <= Math.pow(CFG.bug.hitRadius, 2)) damageHero(CFG.bug.damage);
      e.st = 'dash'; e.t = CFG.bug.dashTime; e.ring = null;
    }
  } else if (e.st === 'dash') {
    e.x += e.dx * CFG.bug.dashSpeed * dt;
    e.z += e.dz * CFG.bug.dashSpeed * dt;
    if (e.t <= 0) { e.st = 'cool'; e.t = CFG.bug.cooldown; }
  } else {
    if (e.t <= 0) e.st = 'chase';
  }
}

function moveToward(e, tx, tz, step) {
  var dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
  if (d < 1e-4) return;
  e.x += dx / d * step; e.z += dz / d * step;
}

/* Đẩy nhẹ quái ra khỏi nhau cho khỏi chồng mesh (circle-circle). */
function separateEnemies() {
  var L = state.enemies;
  for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
    var a = L[i], b = L[j];
    if (a.type === 'flower' && b.type === 'flower') continue;
    var dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), rr = a.r + b.r;
    if (d > 1e-4 && d < rr) {
      var push = (rr - d) * 0.5;
      if (a.type !== 'flower') { a.x -= dx / d * push; a.z -= dz / d * push; }
      if (b.type !== 'flower') { b.x += dx / d * push; b.z += dz / d * push; }
    }
  }
}

function shootEnemyBullet(e, h) {
  var a = Math.atan2(h.x - e.x, h.z - e.z);
  var geo = new THREE.SphereGeometry(CFG.flower.bulletRadius, 10, 8);
  var mesh = new THREE.Mesh(geo, mat(CFG.color.enemyBullet, { emissive: 0x552200, roughness: 0.4 }));
  mesh.position.set(e.x, CFG.flower.radius * 2.3, e.z);
  mesh.castShadow = !NOSHADOW;
  groupEntities.add(mesh);
  state.ebullets.push({
    x: e.x, z: e.z, vx: Math.sin(a) * CFG.flower.bulletSpeed, vz: Math.cos(a) * CFG.flower.bulletSpeed,
    r: CFG.flower.bulletRadius, dmg: CFG.flower.bulletDamage, life: 6, mesh: mesh
  });
}

/* Đạn quái chỉ va chạm với hero (không va với quái). */
function updateEnemyBullets(dt) {
  var h = state.hero;
  for (var i = state.ebullets.length - 1; i >= 0; i--) {
    var b = state.ebullets[i];
    b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
    b.mesh.position.x = b.x; b.mesh.position.z = b.z;
    var rr = b.r + h.r;
    if (dist2(b.x, b.z, h.x, h.z) <= rr * rr) { damageHero(b.dmg); removeEB(i); continue; }
    if (b.life <= 0 || outOfRoom(b.x, b.z)) removeEB(i);
  }
}
function removeEB(i) { groupEntities.remove(state.ebullets[i].mesh); state.ebullets.splice(i, 1); }

// --- Vòng đỏ telegraph trên sàn ---
function addRing(x, z, r, life) {
  var geo = new THREE.RingGeometry(r * 0.82, r, 28);
  var m = new THREE.MeshBasicMaterial({ color: CFG.color.ring, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  var mesh = new THREE.Mesh(geo, m);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.03, z);
  groupFx.add(mesh);
  var o = { x: x, z: z, life: life, max: life, mesh: mesh, matr: m };
  state.rings.push(o); return o;
}
function updateRings(dt) {
  for (var i = state.rings.length - 1; i >= 0; i--) {
    var r = state.rings[i]; r.life -= dt;
    r.mesh.position.x = r.x; r.mesh.position.z = r.z;
    r.matr.opacity = 0.35 + 0.5 * (1 - r.life / r.max);
    if (r.life <= 0) { groupFx.remove(r.mesh); state.rings.splice(i, 1); }
  }
}

// ---------------------------------------------------------------------------
// 8. Damage / chết / XP / tim hồi máu
// ---------------------------------------------------------------------------
function damageEnemy(e, dmg) {
  e.hp -= dmg; e.flash = 0.1;
  addText(e.x, CFG.hero.height, e.z, '-' + dmg, '');
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  var i = state.enemies.indexOf(e); if (i < 0) return;
  state.enemies.splice(i, 1);
  groupEntities.remove(e.mesh);
  if (e.ring) { var ri2 = state.rings.indexOf(e.ring); if (ri2 >= 0) { groupFx.remove(e.ring.mesh); state.rings.splice(ri2, 1); } }
  state.kills++;
  // Tim hồi máu: 15% rơi (mục G)
  if (Math.random() < CFG.heart.dropChance) spawnHeart(e.x, e.z);
  gainXP(CFG.level.xpPerKill);
}

function damageHero(dmg) {
  var h = state.hero;
  if (state.phase !== 'playing' || h.hp <= 0) return;
  h.hp -= dmg; h.flash = CFG.hero.hitFlash;
  addText(h.x, CFG.hero.height * 1.2, h.z, '-' + dmg, 'hero');
  if (h.hp <= 0) { h.hp = 0; endGame(false); }   // [ADD-2] Game Over
}

function spawnHeart(x, z) {
  var g = new THREE.Group();
  var m = mat(CFG.color.heart, { emissive: 0x551122, roughness: 0.35 });
  var a = new THREE.Mesh(new THREE.SphereGeometry(CFG.heart.radius * 0.6, 10, 8), m);
  a.position.set(-CFG.heart.radius * 0.32, 0, 0); g.add(a);
  var b = new THREE.Mesh(new THREE.SphereGeometry(CFG.heart.radius * 0.6, 10, 8), m);
  b.position.set(CFG.heart.radius * 0.32, 0, 0); g.add(b);
  var c = new THREE.Mesh(new THREE.ConeGeometry(CFG.heart.radius * 0.72, CFG.heart.radius * 1.2, 10), m);
  c.rotation.x = Math.PI; c.position.set(0, -CFG.heart.radius * 0.62, 0); g.add(c);
  g.position.set(x, CFG.heart.radius * 1.1, z);
  groupEntities.add(g);
  state.hearts.push({ x: x, z: z, life: CFG.heart.life, mesh: g });
}

function updateHearts(dt) {
  var h = state.hero;
  for (var i = state.hearts.length - 1; i >= 0; i--) {
    var t = state.hearts[i]; t.life -= dt;
    t.mesh.rotation.y += dt * 2.2;
    t.mesh.position.y = CFG.heart.radius * 1.1 + Math.sin(state.time * 3 + i) * 0.08;
    if (dist2(t.x, t.z, h.x, h.z) <= Math.pow(CFG.heart.pickRadius + h.r, 2)) {
      h.hp = Math.min(h.hpMax, h.hp + CFG.heart.heal);
      addText(h.x, CFG.hero.height * 1.3, h.z, '+' + CFG.heart.heal, 'heal');
      groupEntities.remove(t.mesh); state.hearts.splice(i, 1); continue;
    }
    if (t.life <= 0) { groupEntities.remove(t.mesh); state.hearts.splice(i, 1); }
  }
}

function xpNeed() {
  var th = CFG.level.thresholds;
  return (state.level - 1) < th.length ? th[state.level - 1] : Infinity;
}

function gainXP(n) {
  if (state.level - 1 >= CFG.level.thresholds.length) return;   // đã max level
  state.xp += n;
  if (state.xp >= xpNeed()) openLevelUp();
}

// ---------------------------------------------------------------------------
// 9. [MOD-3] Lên cấp: pause + 3 card (1 màu rarity duy nhất) -> chọn -> resume
// ---------------------------------------------------------------------------
var CARD_POOL = [
  { id: 'atk',  name: 'Tấn Công +25%',    desc: 'Sát thương mỗi mũi tên tăng 25%.' },
  { id: 'rate', name: 'Tốc Độ Bắn +20%',  desc: 'Nhịp bắn tự động nhanh hơn 20%.' },
  { id: 'hp',   name: 'HP Tối Đa +300',   desc: 'Tăng 300 HP tối đa và hồi đầy máu.' }
];

function openLevelUp() {
  state.xp -= xpNeed();
  state.level++;
  if (state.xp < 0) state.xp = 0;
  state.cards = [];
  for (var i = 0; i < CFG.level.cardCount; i++) state.cards.push(CARD_POOL[ri(CARD_POOL.length)]);
  state.phase = 'levelup';
  renderCards();
  showOverlay('ovCard', true);
  syncHUD();
}

function chooseCard(i) {
  if (state.phase !== 'levelup') return;
  var c = state.cards[i] || state.cards[0];
  if (c.id === 'atk') state.stat.atkMul += CFG.level.atkBonus;
  else if (c.id === 'rate') state.stat.fireMul += CFG.level.fireRateBonus;
  else {
    state.stat.hpBonus += CFG.level.hpBonus;
    state.hero.hpMax = CFG.hero.hpMax + state.stat.hpBonus;
    state.hero.hp = state.hero.hpMax;
  }
  showOverlay('ovCard', false);
  state.phase = 'playing';
  // Còn đủ XP cho cấp kế -> mở tiếp
  if (state.level - 1 < CFG.level.thresholds.length && state.xp >= xpNeed()) openLevelUp();
  syncHUD();
}

function renderCards() {
  var box = $('cards'); if (!box) return;
  box.innerHTML = '';
  for (var i = 0; i < state.cards.length; i++) {
    (function (idx) {
      var c = state.cards[idx];
      var d = document.createElement('div');
      d.className = 'card';
      d.innerHTML = '<h4>' + c.name + '</h4><p>' + c.desc + '</p>';
      d.addEventListener('click', function () { chooseCard(idx); });
      box.appendChild(d);
    })(i);
  }
}

// ---------------------------------------------------------------------------
// 10. Luồng wave & kết thúc — [ADD-1] thắng, [ADD-2] thua
// ---------------------------------------------------------------------------
function updateWaveFlow(dt) {
  if (state.enemies.length > 0) { state.waitingNextWave = false; return; }
  if (!state.waitingNextWave) {
    state.waitingNextWave = true;
    state.waveTimer = CFG.wave.nextDelay;      // hết quái -> wave kế sau 1.5s
    return;
  }
  state.waveTimer -= dt;
  if (state.waveTimer <= 0) {
    if (state.wave >= CFG.wave.count) endGame(true);   // [ADD-1] dọn hết 5 wave = Thắng
    else spawnWave(state.wave + 1);
  }
}

function endGame(won) {
  state.phase = won ? 'won' : 'lost';
  $('endTitle').textContent = won ? 'CHIẾN THẮNG' : 'THẤT BẠI';
  $('endTitle').style.color = won ? '#ffe27a' : '#ff8a8a';
  $('endSub').textContent = won
    ? ('Đã dọn sạch ' + CFG.wave.count + ' đợt — Lv.' + state.level)
    : ('Gục ngã ở đợt ' + state.wave + '/' + CFG.wave.count);
  showOverlay('ovCard', false);
  showOverlay('ovEnd', true);
  syncHUD();
}

function showOverlay(id, on) {
  var el = $(id); if (!el) return;
  if (on) el.classList.add('show'); else el.classList.remove('show');
}

// ---------------------------------------------------------------------------
// 11. Số damage nổi (DOM, nhẹ) + HUD
// ---------------------------------------------------------------------------
var _proj = new THREE.Vector3();
function addText(x, y, z, txt, cls) {
  var fx = $('fx'); if (!fx) return;
  var el = document.createElement('div');
  el.className = 'dmg' + (cls ? ' ' + cls : '');
  el.textContent = txt;
  fx.appendChild(el);
  state.texts.push({ x: x, y: y, z: z, life: 0.85, max: 0.85, el: el });
}

function updateTexts(dt) {
  var rect = stageEl ? { w: stageEl.clientWidth, h: stageEl.clientHeight } : { w: 540, h: 960 };
  for (var i = state.texts.length - 1; i >= 0; i--) {
    var t = state.texts[i]; t.life -= dt;
    if (t.life <= 0) { if (t.el.parentNode) t.el.parentNode.removeChild(t.el); state.texts.splice(i, 1); continue; }
    var k = 1 - t.life / t.max;
    _proj.set(t.x, t.y + k * 0.9, t.z).project(camera);
    t.el.style.left = ((_proj.x * 0.5 + 0.5) * rect.w) + 'px';
    t.el.style.top = ((-_proj.y * 0.5 + 0.5) * rect.h) + 'px';
    t.el.style.opacity = String(Math.min(1, t.life / (t.max * 0.5)));
  }
}

/* [MOD-6] HUD wave rút gọn: "Đợt k/5" + "Quái còn X". */
function syncHUD() {
  var h = state.hero;
  $('waveLine').textContent = 'Đợt ' + Math.max(1, state.wave) + '/' + CFG.wave.count;
  $('enemyLine').textContent = 'Quái còn ' + state.enemies.length;
  $('lvLine').textContent = 'Lv.' + state.level;
  var need = xpNeed(), maxed = !isFinite(need);
  $('xpLine').textContent = maxed ? 'MAX' : (state.xp + '/' + need);
  $('xpFill').style.width = (maxed ? 100 : clamp(state.xp / need * 100, 0, 100)) + '%';
  $('hpLine').textContent = Math.max(0, Math.round(h ? h.hp : 0));
  $('hpFill').style.width = (h ? clamp(h.hp / h.hpMax * 100, 0, 100) : 0) + '%';
}

// ---------------------------------------------------------------------------
// 12. Render + vòng lặp rAF
// ---------------------------------------------------------------------------
function render() {
  // nháy đỏ khi trúng đòn (đổi màu emissive tạm — giữ nhẹ, không tạo material mới)
  renderer.render(scene, camera);
}

var _last = 0, _running = false;
function loop(now) {
  requestAnimationFrame(loop);
  if (!_running) return;
  var dt = _last ? (now - _last) / 1000 : 0;
  _last = now;
  if (dt > 0) tick(dt);
  render();
}

// ---------------------------------------------------------------------------
// 13. API công khai: window.__game
// ---------------------------------------------------------------------------
function clearScene() {
  if (!state) return;
  function purge(arr, g) { for (var i = 0; i < arr.length; i++) g.remove(arr[i].mesh); arr.length = 0; }
  purge(state.enemies, groupEntities);
  purge(state.arrows, groupEntities);
  purge(state.ebullets, groupEntities);
  purge(state.hearts, groupEntities);
  purge(state.rings, groupFx);
  for (var i = 0; i < state.texts.length; i++) { var el = state.texts[i].el; if (el.parentNode) el.parentNode.removeChild(el); }
  state.texts.length = 0;
  if (state.hero) groupEntities.remove(state.hero.mesh);
}

/* [ADD-2] Reset toàn bộ state, KHÔNG reload trang. */
function reset() {
  clearScene();
  state = freshState();
  state.hero = makeHero();
  api.state = state;
  input.up = input.down = input.left = input.right = false;
  showOverlay('ovCard', false);
  showOverlay('ovEnd', false);
  syncHUD();
}

function start() {
  reset();
  spawnWave(1);
  _running = true;
  _last = 0;
}

function killAll() {
  for (var i = state.enemies.length - 1; i >= 0; i--) killEnemy(state.enemies[i]);
  syncHUD();
}

function setInput(o) {
  o = o || {};
  if ('up' in o) input.up = !!o.up;
  if ('down' in o) input.down = !!o.down;
  if ('left' in o) input.left = !!o.left;
  if ('right' in o) input.right = !!o.right;
}

function getSnapshot() {
  return {
    wave: state.wave,
    enemiesAlive: state.enemies.length,
    heroHP: Math.max(0, Math.round(state.hero ? state.hero.hp : 0)),
    heroHPMax: state.hero ? state.hero.hpMax : 0,
    level: state.level,
    xp: state.xp,
    phase: state.phase
  };
}

var api = {
  CFG: CFG, state: null,
  start: start, reset: reset, tick: tick, setInput: setInput,
  killAll: killAll, spawnWave: spawnWave, getSnapshot: getSnapshot,
  chooseCard: chooseCard,
  hasFBX: function (k) { return Assets.has(k); },
  _internal: { Assets: Assets, get scene() { return scene; } }
};
window.__game = api;

// ---------------------------------------------------------------------------
// 14. Boot
// ---------------------------------------------------------------------------
function boot() {
  Assets.load();
  initThree();
  initInput();
  $('btnReplay').addEventListener('click', function () { start(); });
  start();
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
