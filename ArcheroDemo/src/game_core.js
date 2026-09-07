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
var VIEW_H = ROOM_W * 16 / 9;    // chiều cao 1 màn hình 9:16 (≈17.78 world-unit)

var CFG = {
  // --- Phòng (MOD-5 v2: rộng 1 màn hình, CAO 2 màn hình 9:16) ---
  room: {
    w: ROOM_W,                   // chiều rộng phòng (= bề ngang 1 màn hình)
    h: VIEW_H * 2,               // chiều cao phòng = 2 màn hình (≈35.56)
    wallH: 0.9,                  // chiều cao tường trang trí
    margin: 0.55                 // biên trong: tâm entity không vượt quá
  },

  // --- Camera top-down nghiêng nhẹ, FOLLOW hero theo trục z (MOD-5 v2) ---
  camera: {
    tiltDeg: 30,                 // độ nghiêng khỏi phương thẳng đứng
    dist: 40,                    // khoảng cách (ortho: chỉ ảnh hưởng near/far)
    fitMargin: 1.06,             // hệ số nới khung ngắm (theo chiều ngang phòng)
    followLerp: 8,               // tốc độ bám mượt theo z (1/giây); 0 = bám tức thì
    // [MOD-6 v2] Chừa thêm khoảng trống ở MÉP TRÊN khung nhìn đúng bằng chiều
    // cao dải HUD (đo trực tiếp từ DOM #hudTop) + hudPadExtra px cho thoáng, để
    // hero đứng sát đầu TRÊN phòng không bị HUD đè. Xem hudPadZ()/camLimitTopZ().
    hudPadExtra: 30              // px cộng thêm (chừa chỗ cho thanh HP trên đầu hero)
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

  // --- Juice tối thiểu [ADD-3] (Agent D vòng D-4): số damage đã có sẵn
  // (xem addText/damageEnemy/damageHero), phần dưới chỉ phục vụ trail/
  // telegraph-pulse/hit-flash mới thêm. KHÔNG đổi fireInterval/telegraph gốc.
  juice: {
    trailInterval: 0.045,  // giây giữa 2 lần rơi vệt khi hero đang di chuyển
    trailLife: 0.3,        // vệt mờ dần trong ~0.3s                 [ADD-3(b)]
    windup: 0.3,           // hoa quái phình ~0.3s trước khi bắn      [ADD-3(c)]
    bugPulse: 0.12         // biên độ phình thân bọ đỏ lúc telegraph  [ADD-3(c)]
  },

  // --- [VÒNG D-5] 4 SKILL người chơi bấm (phím 1-4 / 4 nút HUD góc dưới-phải).
  // MỌI số liệu skill nằm ở đây, KHÔNG hardcode rải rác trong logic. Damage
  // luôn tính theo BỘI SỐ của 1 mũi tên thường (arrowDmg() = CFG.arrow.damage
  // * state.stat.atkMul) nên card "Tấn Công +25%" tự động buff cả skill.
  skill: {
    shakeMag: 0.16,              // biên độ rung camera (world-unit) lúc t=0
    fire: {                      // (1) Cầu Lửa
      cd: 6.0,
      speed: 180 * PCT,          // 180% chiều rộng phòng / giây
      range: 12,                 // tầm bay tối đa (world-unit)
      radius: 0.35,              // bán kính quả cầu (cũng là bán kính va chạm)
      aoe: 2.0,                  // bán kính nổ
      dmgMul: 3.0,               // trúng trực tiếp = 3x mũi tên (mỗi quái 1 lần)
      aoeDmgMul: 2.0,            // trong vùng nổ = 2x mũi tên
      trailLen: 1.9, trailW: 0.8,
      // vòng tròn sáng của vfx_ring nằm THỤT vào trong khung ảnh -> phải scale
      // plane to hơn đường kính AOE thật (đo bằng ảnh vòng 2) thì vòng vẽ ra
      // mới trùng bán kính sát thương.
      ringLife: 0.35, ringFade: 0.2, ringTexFit: 1.3,
      shake: 0.15,
      color: 0xff8a1e
    },
    ice: {                       // (2) Băng Nổ
      cd: 8.0,
      radius: 3.5,
      dmgMul: 1.0,
      slowPct: 0.6,              // giảm 60% tốc độ
      slowTime: 3.0,
      ringLife: 0.4, ringFade: 0.18, ringTexFit: 1.3,   // xem CFG.skill.fire.ringTexFit
      color: 0x4fe0ff,
      tint: 0x1d5f7a,            // emissive tint quái đang bị slow
      iconSize: 0.55, iconY: 1.35
    },
    thunder: {                   // (3) Sét Xích
      cd: 5.0,
      range: 8.0,                // tầm tìm mục tiêu ĐẦU TIÊN
      jumpRange: 4.0,            // bán kính nhảy sang mục tiêu kế
      maxTargets: 4,
      dmgMul: [2.5, 2.0, 1.5, 1.0],
      segDelay: 0.06,            // 60ms lệch pha giữa 2 đoạn -> cảm giác "xích"
      segLife: 0.3, segW: 0.95,  // [đo bằng ảnh vòng 1] 0.62 quá mảnh, nhìn như vệt xước
      skyH: 3.0,                 // đoạn đầu xuất phát từ y=3 (như sét đánh xuống)
      sparkLife: 0.25, sparkSize: 0.95,   // [ảnh vòng 2] 1.15 còn to, che quái
      shake: 0.12,
      color: 0xffe14a
    },
    poison: {                    // (4) Mây Độc
      cd: 10.0,
      radius: 2.5,
      life: 4.0,
      tickInterval: 0.5,
      dmgMul: 0.6,
      clusterR: 2.5,             // bán kính đếm cụm quái đông nhất
      dropAhead: 3.0,            // không có quái -> thả trước mặt hero 3 unit
      bubbles: 5, bubbleRise: 1.2, bubbleSize: 0.6,
      color: 0xa14bff
    }
  },

  // --- [VÒNG D-3b] Hệ số scale THÊM cho từng asset FBX (nhân sau khi đã
  // chuẩn hoá theo chiều cao — xem normalizeToHeight()/normalizeToSize()) để
  // Agent D/user tune độ lớn thị giác mà KHÔNG đổi hitbox va chạm (CFG.hero/
  // slime/bug/flower.radius KHÔNG đổi). 1 = giữ nguyên kích thước sau chuẩn
  // hoá theo chiều cao.
  assetScale: {
    hero: 1, monster_flower: 1,
    monster_bug: 2.16,   // [D-3b→D-3c] bug bbox.h chuẩn hoá = 0.416 (ASSET_SIZE) quá
                          // nhỏ cạnh slime; 0.416*2.16≈0.9 unit — user yêu cầu ~0.9
    monster_slime: 1, arrow: 1
  },

  // --- Màu primitive fallback (khi chưa có FBX) ---
  color: {
    floorA: 0x3d4a5c, floorB: 0x34404f, wall: 0x8b90a9, wallEdge: 0x8fa3bd,  // [D-3b] wall = xám đá gần viền gạch floor.png
    hero: 0x9fd8ff, heroHat: 0x1b1f27,
    slime: 0x56d962, bug: 0xe0453a, flowerStem: 0x3f8f4a, flowerHead: 0xff77c2,
    arrow: 0xffe680, enemyBullet: 0xff9a4d, heart: 0xff4d63, ring: 0xff2f2f,  // [D-3c] arrow vàng nhạt hơn, dễ thấy
    trail: 0x9fd8ff, hitFlash: 0xffffff                              // [ADD-3]
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
// [VÒNG D-3b] BỎ 'floor' khỏi ASSET_KEYS: Mesh_ShenMiaoRoom_13x25.fbx là 1
// tranh nguyên phòng KHÔNG lát được (xem BUILD_HANDOFF nhật ký D-3b) — sàn
// quay lại plane primitive với texture crop từ floor.png (Prim.floor(),
// makeFloorCropTexture()), KHÔNG qua AssetLoader nữa.
var ASSET_KEYS = ['hero', 'monster_flower', 'monster_bug', 'monster_slime', 'arrow', 'wall'];

// Kích thước chuẩn hoá dùng làm mục tiêu.
// [VÒNG D-3b] hero/monster_*: CHỈ còn dùng .h (chuẩn hoá theo CHIỀU CAO qua
// normalizeToHeight() — bỏ ràng buộc đường kính .d vì bind-pose gốc của rig
// khiến trục ngang bị chọn làm giới hạn, ra model nhỏ hơn hẳn mục tiêu, xem
// nhật ký D-3). .d giữ lại chỉ để tham khảo/tài liệu, KHÔNG còn dùng để tính
// scale các key này nữa. arrow/wall vẫn dùng normalizeToSize (d+h) như cũ.
var ASSET_SIZE = {
  hero:           { d: CFG.hero.radius * 2,   h: CFG.hero.height },
  monster_slime:  { d: CFG.slime.radius * 2,  h: CFG.slime.radius * 1.4 },
  monster_bug:    { d: CFG.bug.radius * 2,    h: CFG.bug.radius * 1.3 },
  monster_flower: { d: CFG.flower.radius * 2, h: CFG.flower.radius * 3.0 },
  // [D-3c] arrow_normal.fbx: bbox thô của "child" (thân mũi tên thật, sau khi
  // loại "shadow" decal phẳng + "Public_Weapon05" là CÂY CUNG riêng — xem
  // hideArrowFxChildren()) có trục DÀI nằm ở Z (~115 so với X/Y ~28), KHÔNG
  // phải Y như hero/quái -> dùng normalizeToLengthZ() riêng, ASSET_SIZE.arrow.h
  // giờ nghĩa là "chiều dài dọc Z" (≈1.0 unit theo yêu cầu), .d không dùng.
  arrow:          { d: CFG.arrow.radius * 2,  h: 1.0 },
  wall:           { d: 1,                     h: CFG.room.wallH }
};
var HEIGHT_ONLY_KEYS = { hero: true, monster_flower: true, monster_bug: true, monster_slime: true };

// [VÒNG D-3] Offset xoay (radian) cộng thêm cho model FBX khi hướng "forward"
// gốc của mesh không khớp quy ước game: rotation.y = 0 => quay mặt về +Z (xem
// atan2(dx,dz) ở updateHero()/shootArrow()/updateBug()). 0 = không cần offset.
// Xác định bằng vòng lặp chụp ảnh (r3_after_*), KHÔNG đổi logic xoay gốc.
var ASSET_ROT_OFFSET = {
  hero: 0,
  monster_flower: Math.PI / 2,   // [D-3b] xác nhận qua gallery: miệng hoa quái
                                  // khớp +Z (hướng camera) ở rotation.y=90°,
                                  // KHÔNG phải 0° như hero — xem BUILD_HANDOFF §6.
  monster_bug: 0,                // [D-3b] KHÔNG xác định được — rig cuộn tròn
                                  // (bind-pose không animation), không có chi
                                  // tiết đầu/đuôi rõ để soi hướng, xem §6.
  monster_slime: 0,              // [D-3b] hình tinh thể, KHÔNG có mặt/chi tiết
                                  // định hướng rõ — offset không áp dụng được.
  arrow: 0                       // [D-3c] trục dài "child" đã nằm sẵn ở Z (xem
                                  // ASSET_SIZE.arrow) — không cần xoay Y thêm.
};

// [D-3c] Offset xoay quanh trục X (radian) — RIÊNG cho model bind-pose bị
// "đổ/nghiêng" theo trục dọc (rotation.y không sửa được việc này, chỉ xoay
// quanh trục đứng). Xác định bằng vòng lặp chụp ảnh so sánh vài góc X, xem
// BUILD_HANDOFF §6. 0 = không cần.
var ASSET_ROT_OFFSET_X = {
  monster_flower: Math.PI / 2    // [D-3c] so sánh -90/-180/0/+90 qua ảnh: +90°
                                  // là góc DUY NHẤT lộ rõ miệng/răng hoa quái
                                  // (mặt trước thật) hướng ra ngoài — xem §6.
};

// 1x1 PNG trong suốt — dùng làm texture "rỗng" khi model tham chiếu texture
// ngoài mà ta KHÔNG có file thay thế (vd arrow), để tránh loader cố tải một
// đường dẫn Windows tuyệt đối không tồn tại trong môi trường trình duyệt.
var BLANK_TEX_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/* [VÒNG D-3] LoadingManager riêng cho 1 key: FBXLoader tự xử lý texture ĐÃ
   NHÚNG (Content -> blob:/data: URL) bình thường; mọi URL tham chiếu NGOÀI
   (không phải blob:/data:) bị thay bằng texture đã nhúng sẵn của game
   (window.FBX_TEX[key], base64 từ embed_fbx.js) hoặc BLANK_TEX_URI nếu không
   có. */
function makeAssetLoadingManager(texUri) {
  var mgr = new THREE.LoadingManager();
  mgr.setURLModifier(function (url) {
    if (url.indexOf('blob:') === 0 || url.indexOf('data:') === 0) return url;
    return texUri || BLANK_TEX_URI;
  });
  return mgr;
}

function makeTextureFromDataURI(uri) {
  var tex = new THREE.TextureLoader().load(uri);
  tex.encoding = THREE.sRGBEncoding;   // texture màu (albedo) xuất từ Unity
  return tex;
}

/* Model KHÔNG có node Texture/Video nào trong FBX (hero, 3 quái) -> material
   parse ra map=null dù ta có PNG thật. Gán trực tiếp làm lưới an toàn. */
function applyTextureFallback(root, tex) {
  if (!tex) return;
  root.traverse(function (n) {
    if (!n.isMesh || !n.material) return;
    var mats = Array.isArray(n.material) ? n.material : [n.material];
    for (var i = 0; i < mats.length; i++) {
      var m = mats[i];
      if (m && !m.map) { m.map = tex; m.needsUpdate = true; }
    }
  });
}

/* [VÒNG D-3/D-3c] arrow_normal.fbx có child "shadow" (decal phẳng RỘNG dưới
   chân, xem khảo sát), "trail", và "Public_Weapon05" (CÂY CUNG — 1 prop riêng
   đóng gói chung file, KHÔNG phải mũi tên) — chỉ giữ lại "child" (thân mũi
   tên thật). [D-3c] ĐỔI từ set visible=false sang GỠ HẲN khỏi cây (remove):
   THREE.Box3.setFromObject() KHÔNG quan tâm cờ .visible, vẫn tính cả mesh ẩn
   vào bbox — đây là NGUYÊN NHÂN mũi tên bị normalize dẹt (h=0.093 thay vì
   mục tiêu) ở vòng D-3: bbox bị "shadow" 180x180 (rất rộng, rất phẳng) chi
   phối. Phải gỡ TRƯỚC khi đo bbox để chuẩn hoá, không phải sau. */
function hideArrowFxChildren(root) {
  var re = /trail|shadow|eff|mask|weapon/i;
  var toRemove = [], hidden = [];
  root.traverse(function (n) {
    if (n !== root && re.test(n.name || '')) toRemove.push(n);
  });
  toRemove.forEach(function (n) { if (n.parent) { n.parent.remove(n); hidden.push(n.name); } });
  return hidden;
}

/* [VÒNG D-3c] Mũi tên gần như vô hình khi bay (dẹt, tối, không PNG). Ép hẳn
   MeshBasicMaterial màu vàng nhạt KHÔNG phụ thuộc ánh sáng (luôn thấy rõ dù
   bối cảnh sáng/tối) thay vì chỉ sửa màu khi tối như bản D-3 cũ. */
function forceArrowMaterial(root) {
  var m = new THREE.MeshBasicMaterial({ color: CFG.color.arrow });
  root.traverse(function (n) {
    if (n.isMesh) { n.material = m; }
  });
}

var Assets = {
  raw: {},        // key -> { buf, mgr, tex, hasRig, root, clips }
  ready: false,

  load: function () {
    var FBX = (typeof window !== 'undefined' && window.FBX) ? window.FBX : {};
    var TEX = (typeof window !== 'undefined' && window.FBX_TEX) ? window.FBX_TEX : {};
    for (var i = 0; i < ASSET_KEYS.length; i++) {
      var k = ASSET_KEYS[i];
      if (!FBX[k]) continue;                       // chưa có FBX -> primitive
      try {
        var buf = b64ToArrayBuffer(FBX[k]);
        var texUri = TEX[k] || null;
        var tex = texUri ? makeTextureFromDataURI(texUri) : null;
        var mgr = makeAssetLoadingManager(texUri);
        var root = new THREE.FBXLoader(mgr).parse(buf, '');
        var hasRig = false;
        root.traverse(function (n) { if (n.isSkinnedMesh) hasRig = true; });
        applyTextureFallback(root, tex);
        // [D-3c] arrow: GỠ shadow/trail/weapon + ép material TRƯỚC khi đo bbox
        // chuẩn hoá (bbox phải phản ánh đúng phần còn lại sẽ hiển thị).
        if (k === 'arrow') { hideArrowFxChildren(root); forceArrowMaterial(root); }
        if (k === 'arrow') normalizeToLengthZ(root, ASSET_SIZE[k].h, CFG.assetScale[k]);
        else if (HEIGHT_ONLY_KEYS[k]) normalizeToHeight(root, ASSET_SIZE[k].h, CFG.assetScale[k]);
        else normalizeToSize(root, ASSET_SIZE[k], CFG.assetScale[k]);
        if (ASSET_ROT_OFFSET_X[k]) root.rotation.x += ASSET_ROT_OFFSET_X[k];
        if (ASSET_ROT_OFFSET[k]) root.rotation.y += ASSET_ROT_OFFSET[k];
        if (ASSET_ROT_OFFSET_X[k]) realignAfterRotation(root);
        this.raw[k] = { buf: buf, mgr: mgr, tex: tex, hasRig: hasRig, root: root, clips: pickClips(root.animations) };
      } catch (e) {
        console.warn('[AssetLoader] Parse FBX lỗi cho "' + k + '":', e);
      }
    }
    this.ready = true;
  },

  has: function (k) { return !!this.raw[k]; },

  /* Trả về Object3D dùng được ngay (clone FBX hoặc primitive cùng kích thước).
     [VÒNG D-3] Entity CÓ rig (SkinnedMesh: hero + 3 quái) được RE-PARSE riêng
     từ buffer đã cache (KHÔNG .clone(true)) để mỗi entity có bộ xương độc lập
     -> animation của con này không ảnh hưởng con khác. Lý do: three r136 dùng
     trong lib KHÔNG có THREE.SkeletonUtils để clone-rebind đúng skeleton; parse
     lại rẻ hơn viết & bảo trì 1 bản clone thủ công, và chỉ tốn lúc SPAWN (không
     phải mỗi frame). Entity KHÔNG rig (arrow) vẫn clone(true) như cũ (rẻ, an
     toàn, không cần animation độc lập). */
  make: function (k) {
    var r = this.raw[k];
    if (r) {
      var o;
      if (r.hasRig) {
        o = new THREE.FBXLoader(r.mgr).parse(r.buf, '');
        applyTextureFallback(o, r.tex);
        if (HEIGHT_ONLY_KEYS[k]) normalizeToHeight(o, ASSET_SIZE[k].h, CFG.assetScale[k]);
        else normalizeToSize(o, ASSET_SIZE[k], CFG.assetScale[k]);
        if (ASSET_ROT_OFFSET_X[k]) o.rotation.x += ASSET_ROT_OFFSET_X[k];
        if (ASSET_ROT_OFFSET[k]) o.rotation.y += ASSET_ROT_OFFSET[k];
        if (ASSET_ROT_OFFSET_X[k]) realignAfterRotation(o);
      } else {
        o = r.root.clone(true);
      }
      o.traverse(function (n) { if (n.isMesh) { n.castShadow = !NOSHADOW; n.receiveShadow = false; } });
      // Bọc vào Group: game logic set position trên Group, offset canh tâm của
      // FBX nằm ở object con nên không bị ghi đè.
      var g = new THREE.Group(); g.add(o);
      g.userData.fbxRoot = o;              // [VÒNG D-3] root thật để bind AnimationMixer
      g.userData.fbxClips = r.clips;       // {idle,run,attack} AnimationClip hoặc null — dùng chung cho mọi entity cùng key (an toàn: clip bind theo TÊN node, không theo instance)
      return g;
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

/* Scale FBX về kích thước CFG (đường kính XZ + chiều cao Y) bằng Box3, đặt
   gốc toạ độ ở đáy-tâm. extraScale: hệ số nhân thêm (CFG.assetScale[key]),
   mặc định 1. [VÒNG D-3b] chỉ còn dùng cho arrow/wall — hero/monster_* dùng
   normalizeToHeight() bên dưới. */
function normalizeToSize(root, size, extraScale) {
  if (!size) return;
  var box = new THREE.Box3().setFromObject(root);
  var s = new THREE.Vector3(); box.getSize(s);
  if (!isFinite(s.x) || s.x <= 0 || s.y <= 0 || s.z <= 0) return;
  var sc = Math.min(size.d / Math.max(s.x, s.z), size.h / s.y) * (extraScale || 1);
  if (!isFinite(sc) || sc <= 0) return;
  root.scale.setScalar(sc);
  box.setFromObject(root);
  var c = new THREE.Vector3(); box.getCenter(c);
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y;
}

/* [VÒNG D-3b] Scale FBX CHỈ theo CHIỀU CAO Y (bỏ ràng buộc đường kính XZ) —
   dùng cho hero/monster_* vì bind-pose gốc của rig có tỉ lệ ngang/dọc khác
   primitive cũ, ràng buộc đường kính khiến model nhỏ hơn hẳn mục tiêu (xem
   nhật ký D-3). extraScale = CFG.assetScale[key] để user tune thêm sau mà
   KHÔNG đổi hitbox (CFG.*.radius). */
function normalizeToHeight(root, targetH, extraScale) {
  if (!targetH) return;
  var box = new THREE.Box3().setFromObject(root);
  var s = new THREE.Vector3(); box.getSize(s);
  if (!isFinite(s.y) || s.y <= 0) return;
  var sc = (targetH / s.y) * (extraScale || 1);
  if (!isFinite(sc) || sc <= 0) return;
  root.scale.setScalar(sc);
  box.setFromObject(root);
  var c = new THREE.Vector3(); box.getCenter(c);
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y;
}

/* [VÒNG D-3c] Scale FBX theo CHIỀU DÀI dọc trục Z (không phải Y) — dùng riêng
   cho arrow: "child" (thân mũi tên thật, sau khi gỡ shadow/trail/weapon) có
   trục dài nằm ở Z, không phải Y như hero/quái đứng thẳng. */
function normalizeToLengthZ(root, targetLen, extraScale) {
  if (!targetLen) return;
  var box = new THREE.Box3().setFromObject(root);
  var s = new THREE.Vector3(); box.getSize(s);
  if (!isFinite(s.z) || s.z <= 0) return;
  var sc = (targetLen / s.z) * (extraScale || 1);
  if (!isFinite(sc) || sc <= 0) return;
  root.scale.setScalar(sc);
  box.setFromObject(root);
  var c = new THREE.Vector3(); box.getCenter(c);
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y;
}

/* [VÒNG D-3c] normalizeTo*() canh giữa/đáy DỰA TRÊN bbox TRƯỚC khi xoay
   ASSET_ROT_OFFSET_X — xoay quanh X làm đáy/tâm thật sự lệch đi. Gọi lại sau
   khi xoay xong (X rồi Y) để đáy luôn ở y=0, tâm X/Z luôn ở 0 — như primitive
   cũ (entity đứng đúng trên sàn). */
function realignAfterRotation(root) {
  var box = new THREE.Box3().setFromObject(root);
  if (!isFinite(box.min.y)) return;
  var c = new THREE.Vector3(); box.getCenter(c);
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y;
}

/* Lấy AnimationClip theo tên (không phân biệt hoa thường).
   [VÒNG D-3] HeroKuLou KHÔNG có clip tên "idle"/"run"/"walk" thật (xem
   BUILD_HANDOFF §6) — mở rộng: idle nhận thêm "hold" (đứng cầm cung); attack
   ưu tiên "firehold" (khớp trước để không lẫn "Hold" thường vào idle), rồi
   "attack"/"fire"/"shoot". */
function pickClips(anims) {
  var out = { idle: null, run: null, attack: null };
  if (!anims) return out;
  for (var i = 0; i < anims.length; i++) {
    var nm = (anims[i].name || '').toLowerCase();
    var isAttack = nm.indexOf('firehold') >= 0 || nm.indexOf('attack') >= 0 ||
                   nm.indexOf('fire') >= 0 || nm.indexOf('shoot') >= 0;
    if (!out.attack && isAttack) out.attack = anims[i];
    if (!out.run && (nm.indexOf('run') >= 0 || nm.indexOf('walk') >= 0)) out.run = anims[i];
    if (!out.idle && !isAttack && (nm.indexOf('idle') >= 0 || nm.indexOf('hold') >= 0)) out.idle = anims[i];
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

/* [ADD-3](d) Clone material riêng cho MỖI thực thể (hero/quái). mat() cache
   material theo màu -> nhiều quái cùng loại đang SHARE 1 material instance;
   nếu sửa emissive trực tiếp trên đó thì mọi quái cùng loại sẽ nháy theo.
   Clone 1 lần lúc spawn (KHÔNG phải mỗi frame) -> mỗi thực thể có material
   riêng, hit-flash chỉ ảnh hưởng đúng thực thể đó. */
function cloneEntityMaterials(root) {
  var mats = [];
  root.traverse(function (n) {
    if (!n.isMesh || !n.material) return;
    if (Array.isArray(n.material)) {
      n.material = n.material.map(function (m) { return m.clone(); });
      for (var i = 0; i < n.material.length; i++) mats.push(n.material[i]);
    } else {
      n.material = n.material.clone();
      mats.push(n.material);
    }
  });
  var base = [];
  for (var j = 0; j < mats.length; j++) base.push(mats[j].emissive ? mats[j].emissive.clone() : null);
  return { mats: mats, base: base };
}
function applyHitFlash(fx) {
  if (!fx) return;
  for (var i = 0; i < fx.mats.length; i++) if (fx.mats[i].emissive) fx.mats[i].emissive.setHex(CFG.color.hitFlash);
}
function clearHitFlash(fx) {
  if (!fx) return;
  for (var i = 0; i < fx.mats.length; i++) if (fx.mats[i].emissive && fx.base[i]) fx.mats[i].emissive.copy(fx.base[i]);
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
  // Sàn: plane — texture = vùng sân đá crop từ floor.png nếu có [VÒNG D-3b],
  // không có thì lát ô canvas 2D như v1 (checkerTexture()).
  floor: function () {
    var geo = new THREE.PlaneGeometry(CFG.room.w, CFG.room.h);
    var map = makeFloorCropTexture() || checkerTexture();
    var m = new THREE.MeshStandardMaterial({ map: map, roughness: 0.95 });
    var p = new THREE.Mesh(geo, m);
    p.rotation.x = -Math.PI / 2; p.receiveShadow = !NOSHADOW;
    return p;
  },
  // Tường: box viền (dựng riêng ở buildRoom)
  wall: function () { return new THREE.Group(); }
};

/* Lưới ô màu runtime bằng canvas 2D (nhẹ, không cần file ảnh) — fallback khi
   KHÔNG có floor.png. */
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

/* [VÒNG D-3b/D-3c] Sàn FBX (Mesh_ShenMiaoRoom_13x25.fbx) là 1 TRANH nguyên
   khối (sân đá + viền cây/đá xung quanh) KHÔNG lát được — bỏ hẳn, quay lại
   plane primitive nhưng lấy TEXTURE = vùng sân đá crop từ floor.png (KHÔNG
   lấy viền gạch/trang trí) thay cho lưới ô 2D cũ. Toạ độ crop (px, gốc
   trên-trái, ảnh gốc 1024x2048): D-3b dùng x280-760/y760-1400 nhưng còn lộ
   vệt cam (viền sỏi) ở mép trên/dưới tile -> [D-3c] THU HẸP vào trong: x
   300-740, y 790-1370 (vùng 440x580), + đổi RepeatWrapping -> MirroredRepeat
   Wrapping (mỗi tile kế tiếp lật gương) để giấu đường nối giữa các tile.
   repeat.x = room.w/5 = 2, repeat.y = room.h/5 ≈ 7.11 (~7). Ảnh load ASYNC
   (Image.onload) nên vài frame đầu canvas có thể rỗng — texture.needsUpdate
   khi vẽ xong. */
var FLOOR_CROP = { x: 300, y: 790, w: 440, h: 580 };
var _floorCropTex = null;
function makeFloorCropTexture() {
  if (_floorCropTex !== null) return _floorCropTex || null;
  var TEX = (typeof window !== 'undefined' && window.FBX_TEX) ? window.FBX_TEX : {};
  var uri = TEX.floor;
  if (!uri) { _floorCropTex = false; return null; }
  var canvas = document.createElement('canvas');
  canvas.width = FLOOR_CROP.w; canvas.height = FLOOR_CROP.h;
  var ctx = canvas.getContext('2d');
  var tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;   // [D-3c] giấu đường nối tile
  tex.repeat.set(CFG.room.w / 5, CFG.room.h / 5);
  tex.encoding = THREE.sRGBEncoding;
  var img = new Image();
  img.onload = function () {
    ctx.drawImage(img, FLOOR_CROP.x, FLOOR_CROP.y, FLOOR_CROP.w, FLOOR_CROP.h, 0, 0, canvas.width, canvas.height);
    tex.needsUpdate = true;
  };
  img.src = uri;
  _floorCropTex = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// 2b. [VÒNG D-5] Texture rời (KHÔNG qua FBX) + helper dựng plane/billboard VFX
//     Mọi ảnh dùng cho skill nằm sẵn trong window.FBX_TEX (data URI PNG).
//     texFromURI() cache theo key -> KHÔNG tạo lại THREE.Texture mỗi lần bắn.
// ---------------------------------------------------------------------------
var _texCache = {};
function texFromURI(key) {
  if (Object.prototype.hasOwnProperty.call(_texCache, key)) return _texCache[key];
  var TEX = (typeof window !== 'undefined' && window.FBX_TEX) ? window.FBX_TEX : {};
  var uri = TEX[key];
  if (!uri) { _texCache[key] = null; return null; }
  var t = new THREE.TextureLoader().load(uri);
  t.encoding = THREE.sRGBEncoding;
  _texCache[key] = t;
  return t;
}

/* Geometry dùng chung cho MỌI plane VFX (unit 1x1, kích thước thật đặt bằng
   mesh.scale) — cache 1 instance duy nhất, KHÔNG dispose (không thể rò rỉ). */
var _unitPlaneGeo = null;
function unitPlaneGeo() {
  if (!_unitPlaneGeo) _unitPlaneGeo = new THREE.PlaneGeometry(1, 1);
  return _unitPlaneGeo;
}

/* Camera ortho nghiêng CỐ ĐỊNH tiltDeg khỏi phương thẳng đứng => góc xoay X
   để plane quay thẳng mặt vào camera là 1 HẰNG SỐ (không cần billboard động
   mỗi frame). */
function billboardRotX() { return (CFG.camera.tiltDeg * Math.PI / 180) - Math.PI / 2; }

/* Tạo 1 plane VFX có texture.
   opt = { tex, color, additive, opacity, w, h, ground, billboard, cloneTex }
     ground    : nằm ngửa trên sàn (rotation.x = -90°)
     billboard : dựng đứng quay mặt vào camera
     cloneTex  : clone texture riêng (cần khi phải chỉnh offset/repeat, vd
                 chọn 1 ô trong sheet 2x2 vfx_spark) — sẽ được dispose khi hết
                 đời qua userData.ownTex. */
function makeFxPlane(opt) {
  var tex = opt.tex ? texFromURI(opt.tex) : null;
  if (tex && opt.cloneTex) { tex = tex.clone(); tex.needsUpdate = true; }
  var m = new THREE.MeshBasicMaterial({
    map: tex, color: (opt.color == null ? 0xffffff : opt.color),
    transparent: true, opacity: (opt.opacity == null ? 1 : opt.opacity),
    depthWrite: false, side: THREE.DoubleSide,
    blending: opt.additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  var mesh = new THREE.Mesh(unitPlaneGeo(), m);
  mesh.scale.set(opt.w || 1, opt.h || opt.w || 1, 1);
  if (opt.ground) mesh.rotation.x = -Math.PI / 2;
  else if (opt.billboard) mesh.rotation.x = billboardRotX();
  mesh.userData.ownTex = !!(tex && opt.cloneTex);
  return mesh;
}

/* Plane NẰM SÀN có trục DÀI của ẢNH (trục X của texture) chạy dọc theo hướng
   yaw `a` (quy ước game: a = atan2(dx,dz), 0 = +Z). Dùng cho vệt cầu lửa và
   các đoạn sét nối 2 điểm.
   Cách làm: rotation.x = -90° (ngửa lên) rồi rotateZ(+90°) TRONG hệ cục bộ ->
   trục X cục bộ (đã scale = chiều dài) được ánh xạ về -Z thế giới; bọc trong
   Group xoay yaw = a để -Z cục bộ chỉ đúng hướng mong muốn. */
function makeStripPlane(texKey, color, len, wid, additive) {
  var p = makeFxPlane({ tex: texKey, color: color, additive: additive, w: len, h: wid, ground: true });
  p.rotateZ(Math.PI / 2);
  return p;
}

// ---------------------------------------------------------------------------
// 3. Scene / Camera / Ánh sáng
// ---------------------------------------------------------------------------
var NOSHADOW = (typeof window !== 'undefined' && window.__NOSHADOW === true);
var renderer, scene, camera, stageEl, canvasEl;
var groupEntities, groupFx;
var dirLight, dirTarget;         // đèn chính + target (dịch theo camera)
var camZ = 0;                    // tâm khung nhìn theo trục z (MOD-5 v2)

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

  // [MOD-5 v2] Camera top-down nghiêng nhẹ, khung ngang = bề ngang phòng,
  // FOLLOW hero theo trục z (xem updateCamera).
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camZ = 0;

  var hemi = new THREE.HemisphereLight(0xbcd6ff, 0x2a3040, 0.95);
  scene.add(hemi);
  dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dirTarget = new THREE.Object3D();
  scene.add(dirTarget);
  dirLight.target = dirTarget;
  if (!NOSHADOW) {
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    // Frustum shadow chỉ cần phủ VÙNG ĐANG NHÌN (1 màn hình), vì cả đèn lẫn
    // target đều dịch theo camera trong updateCamera().
    var cam = dirLight.shadow.camera;
    cam.left = -CFG.room.w; cam.right = CFG.room.w;
    cam.top = VIEW_H * 0.8; cam.bottom = -VIEW_H * 0.8;
    cam.near = 1; cam.far = VIEW_H * 4;
    cam.updateProjectionMatrix();
  }
  scene.add(dirLight);

  groupEntities = new THREE.Group(); scene.add(groupEntities);
  groupFx = new THREE.Group(); scene.add(groupFx);
  initTrailPool();                 // [ADD-3](b) pool vệt di chuyển của hero

  buildRoom();
  resize();
  window.addEventListener('resize', resize);
}

function buildRoom() {
  scene.add(Assets.make('floor'));   // [VÒNG D-3b] luôn primitive plane (crop texture hoặc checker)

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

/* Khung 9:16 letterbox + ortho frustum = ĐÚNG 1 MÀN HÌNH (MOD-5 v2).
   Khung ngang ôm vừa chiều rộng phòng; chiều dọc suy ra từ tỉ lệ 9:16 —
   KHÔNG ôm cả phòng nữa (phòng cao 2 màn hình), phần thiếu do camera follow. */
function resize() {
  var ww = window.innerWidth, wh = window.innerHeight, aspect = 9 / 16;
  var w = Math.min(ww, wh * aspect), h = w / aspect;
  stageEl.style.width = Math.round(w) + 'px';
  stageEl.style.height = Math.round(h) + 'px';
  renderer.setSize(Math.round(w), Math.round(h), false);

  var halfW = (CFG.room.w / 2) * CFG.camera.fitMargin;
  var halfH = halfW / aspect;
  camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  applyCamera();
}

/* Nửa chiều cao vùng nhìn quy chiếu về MẶT SÀN (khung nghiêng nên bị co lại
   theo cos(tilt) khi chiếu lên camera => chia ngược lại để ra world-unit z). */
function viewHalfZ() {
  return camera.top / Math.cos(CFG.camera.tiltDeg * Math.PI / 180);
}

/* Giới hạn tâm khung nhìn để khung không lòi ra ngoài 2 đầu phòng. */
function camLimitZ() {
  return Math.max(0, CFG.room.h / 2 - viewHalfZ());
}

/* [MOD-6 v2] Chiều cao dải HUD quy đổi sang world-unit trên trục z.
   Dải HUD chiếm hudPx / stageH phần khung nhìn; khung nhìn cao 2*viewHalfZ
   world-unit khi quy về mặt sàn => padZ tương ứng. */
function hudPadZ() {
  var hud = $('hudTop');
  var stH = stageEl ? stageEl.clientHeight : 0;
  if (!hud || !stH) return 0;
  var px = hud.offsetHeight + CFG.camera.hudPadExtra;
  return (px / stH) * (viewHalfZ() * 2);
}

/* Giới hạn tâm khung nhìn về phía ĐẦU TRÊN phòng (z âm): nới thêm hudPadZ()
   nên mép trên khung nhìn vượt qua đỉnh phòng đúng bằng dải HUD -> hero đứng
   sát đỉnh phòng vẫn nằm DƯỚI dải HUD, thấy trọn. [MOD-6 v2] */
function camLimitTopZ() {
  return camLimitZ() + hudPadZ();
}

/* Đặt camera + đèn theo camZ hiện tại. */
function applyCamera() {
  var t = CFG.camera.tiltDeg * Math.PI / 180;
  // [VÒNG D-5] Screen shake: TỊNH TIẾN cả vị trí camera lẫn điểm nhìn cùng một
  // lượng (_shakeX/_shakeY) -> chỉ rung khung hình, KHÔNG đổi hướng nhìn và
  // KHÔNG đụng tới camZ nên clamp camLimitZ()/camLimitTopZ() vẫn nguyên vẹn.
  camera.position.set(_shakeX, CFG.camera.dist * Math.cos(t) + _shakeY, camZ + CFG.camera.dist * Math.sin(t));
  camera.lookAt(_shakeX, _shakeY, camZ);
  // project() trong updateTexts() chạy TRƯỚC render() nên phải tự cập nhật
  // matrixWorldInverse ngay tại đây, nếu không thanh máu/số damage sẽ lệch.
  camera.updateMatrixWorld(true);

  if (dirLight) {
    dirLight.position.set(CFG.room.w * 0.6, VIEW_H * 0.9, camZ + VIEW_H * 0.35);
    dirTarget.position.set(0, 0, camZ);
    dirTarget.updateMatrixWorld(true);
  }
}

/* [MOD-5 v2] Camera FOLLOW hero chỉ theo trục z, clamp ở 2 đầu phòng. */
function updateCamera(dt) {
  // clamp KHÔNG đối xứng: phía dưới ôm đúng đáy phòng, phía trên nới thêm
  // hudPadZ() để dải HUD không đè lên hero. [MOD-6 v2]
  var lim = camLimitZ();
  var want = clamp(state && state.hero ? state.hero.z : 0, -camLimitTopZ(), lim);
  var k = CFG.camera.followLerp;
  if (k > 0 && dt > 0) camZ += (want - camZ) * Math.min(1, k * dt);
  else camZ = want;
  applyCamera();
}

/* [ADD-3](b) Vệt màu phía sau hero khi di chuyển: pool cố định N plane dẹt
   nằm sàn (KHÔNG tạo geometry/material mới mỗi frame), mỗi node bật lên tại
   vị trí hero rồi tự mờ dần trong CFG.juice.trailLife (~0.3s). */
var TRAIL_POOL_N = 14;
var trailPool = null, trailRR = -1;
function initTrailPool() {
  if (trailPool) return;
  trailPool = [];
  var geo = new THREE.PlaneGeometry(CFG.hero.radius * 1.6, CFG.hero.radius * 1.6);
  for (var i = 0; i < TRAIL_POOL_N; i++) {
    var m = new THREE.MeshBasicMaterial({
      color: CFG.color.trail, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(geo, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    groupFx.add(mesh);
    trailPool.push({ mesh: mesh, mat: m, active: false, life: 0, max: CFG.juice.trailLife });
  }
}
function spawnTrailNode(x, z) {
  trailRR = (trailRR + 1) % trailPool.length;
  var n = trailPool[trailRR];
  n.active = true; n.life = n.max; n.mat.opacity = 0.5;
  n.mesh.position.set(x, 0.02, z);
  n.mesh.scale.setScalar(1);
  n.mesh.visible = true;
}
function updateTrail(dt) {
  if (!trailPool || !state || !state.hero) return;
  state.trailTimer -= dt;
  if (state.hero.moving && state.trailTimer <= 0) {
    state.trailTimer = CFG.juice.trailInterval;
    spawnTrailNode(state.hero.x, state.hero.z);
  }
  for (var i = 0; i < trailPool.length; i++) {
    var n = trailPool[i];
    if (!n.active) continue;
    n.life -= dt;
    if (n.life <= 0) { n.active = false; n.life = 0; n.mesh.visible = false; n.mat.opacity = 0; continue; }
    var k = n.life / n.max;
    n.mat.opacity = 0.5 * k;
    n.mesh.scale.setScalar(0.55 + 0.45 * k);
  }
}
function clearTrail() {
  if (!trailPool) return;
  for (var i = 0; i < trailPool.length; i++) {
    var n = trailPool[i];
    n.active = false; n.life = 0; n.mesh.visible = false; n.mat.opacity = 0;
  }
}

// ---------------------------------------------------------------------------
// 4. STATE
// ---------------------------------------------------------------------------
var state = null;

function freshState() {
  return {
    phase: 'playing',        // 'playing' | 'paused' | 'levelup' | 'won' | 'lost'
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
    kills: 0,
    trailTimer: 0,           // [ADD-3](b) đếm ngược tới lần rơi vệt kế
    // --- [VÒNG D-5] hệ skill ---
    skills: freshSkills(),   // 4 ô cooldown, xem SKILL_DEFS
    skillFx: [],             // VFX tạm (ring/mask/bolt/spark...) — tự huỷ khi hết đời
    skillPending: [],        // hành động hẹn giờ (đoạn sét lệch pha 60ms)
    fireballs: [],           // cầu lửa đang bay
    clouds: []               // mây độc đang tồn tại
  };
}

/* [VÒNG D-3] Tạo AnimationMixer cho 1 entity NẾU có ít nhất 1 clip khớp
   (idle/run/attack) — KHÔNG tạo mixer rỗng cho entity không có clip nào
   (3 quái hiện tại: có rig nhưng KHÔNG có animation clip thật trong file). */
function attachMixerIfAny(mesh) {
  var cl = mesh.userData && mesh.userData.fbxClips;
  if (!cl || (!cl.idle && !cl.run && !cl.attack)) return null;
  var mixer = new THREE.AnimationMixer(mesh.userData.fbxRoot);
  var actions = { idle: null, run: null, attack: null };
  if (cl.idle) actions.idle = mixer.clipAction(cl.idle);
  if (cl.run) actions.run = mixer.clipAction(cl.run);
  if (cl.attack) actions.attack = mixer.clipAction(cl.attack);
  var animState = null;
  if (actions.idle) { actions.idle.play(); animState = 'idle'; }
  else if (actions.run) { actions.run.play(); animState = 'run'; }
  return { mixer: mixer, actions: actions, animState: animState, attackT: 0 };
}

/* Chuyển idle<->run mượt (fade); KHÔNG đụng khi đang giữa clip attack
   (updateHeroAttackAnim quản lý riêng, trả lại idle/run khi xong). */
function updateAnimIdleRun(am, moving) {
  if (!am || am.animState === 'attack') return;
  var wantRun = moving && am.actions.run;
  var target = wantRun ? 'run' : (am.actions.idle ? 'idle' : null);
  if (target && am.animState !== target) {
    am.actions[target].reset().fadeIn(0.15).play();
    if (am.animState && am.actions[am.animState]) am.actions[am.animState].fadeOut(0.15);
    am.animState = target;
  }
}

/* [VÒNG D-3](C.5) Fade-in ngắn clip attack (FireHold) khi hero bắn, rồi trả
   về idle/run sau khi hết thời lượng clip — KHÔNG lặp (không phải trạng thái
   thường trực), KHÔNG đổi nhịp bắn (CFG.arrow.fireRate không đổi). */
function playHeroAttackAnim(h) {
  var am = h.anim; if (!am || !am.actions.attack) return;
  var a = am.actions.attack;
  a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
  if (am.animState && am.actions[am.animState]) am.actions[am.animState].fadeOut(0.1);
  a.fadeIn(0.08).play();
  am.animState = 'attack';
  am.attackT = a.getClip().duration || 0.3;
}
function updateHeroAttackAnim(h, dt) {
  var am = h.anim; if (!am || am.animState !== 'attack') return;
  am.attackT -= dt;
  if (am.attackT <= 0) am.animState = null;   // updateAnimIdleRun() sẽ gán lại idle/run
}

function makeHero() {
  var mesh = Assets.make('hero');
  groupEntities.add(mesh);
  return {
    // [MOD-5 v2] Hero bắt đầu ở ĐẦU DƯỚI phòng (z dương = phía dưới màn hình).
    mesh: mesh, x: 0, z: CFG.room.h / 2 - 2.5, r: CFG.hero.radius,
    hp: CFG.hero.hpMax, hpMax: CFG.hero.hpMax,
    fireCd: 0, moving: false, facing: 0, flash: 0,
    fx: cloneEntityMaterials(mesh),                     // [ADD-3](d) hit-flash riêng
    anim: attachMixerIfAny(mesh)                         // [VÒNG D-3] null nếu không có clip
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
    var d = keyDir(e.code); if (d) { input[d] = true; e.preventDefault(); return; }
    // [VÒNG D-5] phím 1-4 dùng skill: ONE-SHOT — giữ phím sinh keydown lặp,
    // chặn bằng _skillKeyHeld để không cast liên tục.
    var si = skillIndexFromCode(e.code);
    if (si >= 0) {
      e.preventDefault();
      if (!_skillKeyHeld[e.code]) { _skillKeyHeld[e.code] = true; castSkill(si); }
    }
  });
  window.addEventListener('keyup', function (e) {
    var d = keyDir(e.code); if (d) { input[d] = false; e.preventDefault(); return; }
    if (skillIndexFromCode(e.code) >= 0) { _skillKeyHeld[e.code] = false; e.preventDefault(); }
  });
  window.addEventListener('blur', function () {
    input.up = input.down = input.left = input.right = false;
    _skillKeyHeld = {};                       // [VÒNG D-5]
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
          speed: 0, fireCd: rnd(0.3, CFG.flower.fireInterval), windup: false,
          mesh: Assets.make('monster_flower') };
  }
  e.x = p.x; e.z = p.z; e.flash = 0;
  e.slow = 0; e.slowIcon = null;             // [VÒNG D-5] Băng Nổ
  e.fx = cloneEntityMaterials(e.mesh);      // [ADD-3](d) hit-flash riêng từng quái
  e.anim = attachMixerIfAny(e.mesh);        // [VÒNG D-3] null hiện tại (3 quái không có clip)
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
  // dừng gameplay khi paused [MOD-6 v2] / levelup / kết thúc
  if (state.phase !== 'playing') { updateTexts(dt); return; }
  dt = Math.min(dt, 0.05);        // chống nhảy dt lớn
  state.time += dt;

  updateHero(dt);
  updateSkills(dt);                // [VÒNG D-5] cooldown + cầu lửa + mây độc + VFX + shake
  updateTrail(dt);                 // [ADD-3](b) vệt di chuyển
  updateCamera(dt);               // [MOD-5 v2] follow trục z, trước updateTexts
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

  var heroWasFlash = h.flash > 0;                     // [ADD-3](d) hit-flash
  h.flash = Math.max(0, h.flash - dt);
  if (heroWasFlash && h.flash <= 0) clearHitFlash(h.fx);
  h.mesh.position.set(h.x, 0, h.z);
  h.mesh.rotation.y = h.facing;

  // [VÒNG D-3] AnimationMixer: Hold (idle) khi đứng HOẶC di chuyển (không có
  // clip run thật) — FireHold (attack) fade ngắn khi bắn, xem shootArrow().
  if (h.anim) {
    h.anim.mixer.update(dt);
    updateHeroAttackAnim(h, dt);
    updateAnimIdleRun(h.anim, h.moving);
  }
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
  playHeroAttackAnim(h);   // [VÒNG D-3] fade-in FireHold ngắn, không đổi fireRate
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
    if (e.anim) e.anim.mixer.update(dt);   // [VÒNG D-3] hiện tại luôn null (quái không có clip), giữ tổng quát
    var wasFlash = e.flash > 0;                       // [ADD-3](d) hit-flash
    e.flash = Math.max(0, e.flash - dt);
    // [VÒNG D-5] Băng Nổ: đếm ngược slow. Hit-flash và tint-slow DÙNG CHUNG
    // kênh emissive nên phải đi qua refreshEnemyTint(): hết flash mà VẪN đang
    // slow thì quay về tint xanh, không về màu gốc.
    var wasSlow = e.slow > 0;
    if (wasSlow) {
      e.slow = Math.max(0, e.slow - dt);
      if (e.slow <= 0) removeSlowIcon(e);
      else updateSlowIcon(e);
    }
    if ((wasFlash && e.flash <= 0) || (wasSlow && e.slow <= 0)) refreshEnemyTint(e);

    if (e.type === 'slime') {
      // Slime: đi chậm về hero, gây damage khi chạm (có cooldown)
      moveToward(e, h.x, h.z, enemySpeed(e) * dt);
      e.touchCd -= dt;
      var rr = e.r + h.r;
      if (dist2(e.x, e.z, h.x, h.z) <= rr * rr && e.touchCd <= 0) {
        e.touchCd = CFG.slime.touchCd;
        damageHero(CFG.slime.touchDamage);
      }
    } else if (e.type === 'bug') {
      updateBug(e, dt, h);
    } else {
      // Hoa quái: đứng yên, bắn đạn về hero theo chu kỳ; [ADD-3](c) windup
      // ngắn (phình thân) ngay trước phát bắn, KHÔNG đổi fireInterval.
      e.fireCd -= dt;
      var wud = CFG.juice.windup, wasWindup = e.windup;
      e.windup = e.fireCd <= wud;
      if (e.windup) {
        var kw = 1 - clamp(e.fireCd / wud, 0, 1);
        e.mesh.scale.setScalar(1 + 0.22 * kw);
      } else if (wasWindup) {
        e.mesh.scale.setScalar(1);
      }
      if (e.fireCd <= 0) {
        e.fireCd = CFG.flower.fireInterval;
        e.windup = false;
        e.mesh.scale.setScalar(1);
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
    moveToward(e, h.x, h.z, enemySpeed(e) * dt);     // [VÒNG D-5] nhân hệ số slow
    e.mesh.rotation.y = Math.atan2(h.x - e.x, h.z - e.z);
    var rr = CFG.bug.attackRange;
    if (dist2(e.x, e.z, h.x, h.z) <= rr * rr) {
      e.st = 'telegraph'; e.t = CFG.bug.telegraph;
      e.ring = addRing(e.x, e.z, CFG.bug.hitRadius, CFG.bug.telegraph);
      var a = Math.atan2(h.x - e.x, h.z - e.z);
      e.dx = Math.sin(a); e.dz = Math.cos(a);
    }
  } else if (e.st === 'telegraph') {
    // Vòng đỏ 0.6s trên sàn (đã có) — hero rời khỏi vòng là né được;
    // [ADD-3](c) thêm thân nháy: phình nhẹ theo nhịp nhanh trong lúc telegraph.
    if (e.ring) { e.ring.x = e.x; e.ring.z = e.z; }
    var pulse = 1 + CFG.juice.bugPulse * Math.abs(Math.sin(state.time * 16));
    e.mesh.scale.setScalar(pulse);
    if (e.t <= 0) {
      var cx = e.ring ? e.ring.x : e.x, cz = e.ring ? e.ring.z : e.z;
      if (dist2(h.x, h.z, cx, cz) <= Math.pow(CFG.bug.hitRadius, 2)) damageHero(CFG.bug.damage);
      e.st = 'dash'; e.t = CFG.bug.dashTime; e.ring = null;
      e.mesh.scale.setScalar(1);
    }
  } else if (e.st === 'dash') {
    var ds = CFG.bug.dashSpeed * slowFactor(e);      // [VÒNG D-5] lao cũng bị slow
    e.x += e.dx * ds * dt;
    e.z += e.dz * ds * dt;
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

// ===========================================================================
// 7b. [VÒNG D-5] HỆ 4 SKILL NGƯỜI CHƠI BẤM
//     Phím 1/2/3/4 (one-shot trên keydown, giữ phím KHÔNG lặp) hoặc 4 nút HUD
//     góc dưới-phải. Chỉ hiệu lực khi state.phase === 'playing' và cd = 0.
//     Hero KHÔNG cần đứng yên. Mọi số liệu ở CFG.skill.
// ===========================================================================
var SKILL_DEFS = [
  { id: 'fire',    icon: 'skill_fire',    key: 'Digit1' },
  { id: 'ice',     icon: 'skill_ice',     key: 'Digit2' },
  { id: 'thunder', icon: 'skill_thunder', key: 'Digit3' },
  { id: 'poison',  icon: 'skill_poison',  key: 'Digit4' }
];

function freshSkills() {
  var a = [];
  for (var i = 0; i < SKILL_DEFS.length; i++) {
    a.push({ id: SKILL_DEFS[i].id, cd: 0, cdMax: CFG.skill[SKILL_DEFS[i].id].cd });
  }
  return a;
}

/* Damage 1 mũi tên thường ở thời điểm hiện tại — mọi damage skill là bội số
   của nó (card "Tấn Công +25%" tự động buff theo). */
function arrowDmg() { return Math.round(CFG.arrow.damage * state.stat.atkMul); }

// --- Rung màn hình (dùng ở applyCamera) ------------------------------------
var _shakeT = 0, _shakeMax = 0, _shakeX = 0, _shakeY = 0;
function shakeCam(t) { if (t > _shakeT) { _shakeT = t; _shakeMax = t; } }
function updateShake(dt) {
  if (_shakeT <= 0) return;
  _shakeT = Math.max(0, _shakeT - dt);
  if (_shakeT <= 0) { _shakeX = 0; _shakeY = 0; return; }
  var m = CFG.skill.shakeMag * (_shakeMax > 0 ? _shakeT / _shakeMax : 0);
  _shakeX = rnd(-m, m); _shakeY = rnd(-m, m);
}

// --- Kho VFX tạm: mọi mesh đều tự gỡ khỏi scene + dispose material khi hết đời
//     (geometry là unitPlaneGeo() dùng chung, không dispose). ----------------
/* holder: object thật được add vào groupFx (khi plane nằm trong 1 Group khung
   xoay, vd đoạn sét) — gỡ holder mới không để lại Group rỗng trong scene. */
function addFx(mesh, life, upd, holder) {
  var root = holder || mesh;
  groupFx.add(root);
  var o = { mesh: mesh, root: root, mat: mesh.material, life: life, max: life, t: 0, upd: upd };
  state.skillFx.push(o);
  return o;
}
/* Chỉ giải phóng material (+ texture clone riêng); geometry là unitPlaneGeo()
   dùng chung nên KHÔNG dispose. */
function disposeFxPlane(mesh) {
  var m = mesh.material;
  if (m) {
    if (m.map && mesh.userData.ownTex) m.map.dispose();
    m.dispose();
  }
}
function disposeFx(o) { groupFx.remove(o.root); disposeFxPlane(o.mesh); }
function updateSkillFx(dt) {
  for (var i = state.skillFx.length - 1; i >= 0; i--) {
    var o = state.skillFx[i];
    o.life -= dt; o.t += dt;
    if (o.life <= 0) { disposeFx(o); state.skillFx.splice(i, 1); continue; }
    if (o.upd) o.upd(o);
  }
}
function purgeSkillFx() {
  if (!state || !state.skillFx) return;
  for (var i = 0; i < state.skillFx.length; i++) disposeFx(state.skillFx[i]);
  state.skillFx.length = 0;
  state.skillPending.length = 0;
}

// --- Slow (Băng Nổ): tint + icon băng trên đầu ------------------------------
function slowFactor(e) { return (e && e.slow > 0) ? (1 - CFG.skill.ice.slowPct) : 1; }
function enemySpeed(e) { return e.speed * slowFactor(e); }

function setEmissive(fx, hex) {
  if (!fx) return;
  for (var i = 0; i < fx.mats.length; i++) if (fx.mats[i].emissive) fx.mats[i].emissive.setHex(hex);
}
/* Hit-flash và tint-slow dùng CHUNG kênh emissive -> luôn đi qua hàm này để
   thứ tự ưu tiên đúng: flash > slow > màu gốc. */
function refreshEnemyTint(e) {
  if (e.flash > 0) applyHitFlash(e.fx);
  else if (e.slow > 0) setEmissive(e.fx, CFG.skill.ice.tint);
  else clearHitFlash(e.fx);
}
function applySlow(e) {
  var C = CFG.skill.ice;
  e.slow = C.slowTime;
  if (!e.slowIcon) {
    e.slowIcon = makeFxPlane({ tex: 'vfx_mask_ice', color: 0xffffff, w: C.iconSize, billboard: true });
    groupFx.add(e.slowIcon);
  }
  updateSlowIcon(e);
  refreshEnemyTint(e);
}
function updateSlowIcon(e) {
  if (!e.slowIcon) return;
  e.slowIcon.position.set(e.x, CFG.skill.ice.iconY + Math.sin(state.time * 4) * 0.07, e.z);
}
function removeSlowIcon(e) {
  if (!e || !e.slowIcon) return;
  groupFx.remove(e.slowIcon);
  if (e.slowIcon.material) e.slowIcon.material.dispose();
  e.slowIcon = null;
}

// ---------------------------------------------------------------------------
// (1) CẦU LỬA — bay xuyên quái, nổ AOE ở quái ĐẦU TIÊN trúng (hoặc cuối tầm)
// ---------------------------------------------------------------------------
function castFire() {
  var h = state.hero, C = CFG.skill.fire;
  var tg = nearestEnemy(h.x, h.z);
  var a = tg ? Math.atan2(tg.x - h.x, tg.z - h.z) : h.facing;

  var g = new THREE.Group();
  g.rotation.y = a;
  var ball = new THREE.Mesh(
    new THREE.SphereGeometry(C.radius, 14, 10),
    new THREE.MeshBasicMaterial({ color: C.color })
  );
  ball.position.y = 0.62; g.add(ball);
  // Vệt lửa kéo dài PHÍA SAU (local -Z), nằm ngửa để camera top-down thấy rõ.
  var tr = makeStripPlane('vfx_trail_fire', 0xffffff, C.trailLen, C.trailW, true);
  tr.position.set(0, 0.5, -C.trailLen / 2); g.add(tr);
  g.position.set(h.x, 0, h.z);
  groupFx.add(g);

  state.fireballs.push({
    x: h.x, z: h.z, vx: Math.sin(a) * C.speed, vz: Math.cos(a) * C.speed,
    travel: 0, hit: [], exploded: false, mesh: g, ball: ball, trail: tr
  });
  return true;
}

function removeFireball(i) {
  var f = state.fireballs[i];
  groupFx.remove(f.mesh);
  f.ball.geometry.dispose(); f.ball.material.dispose();
  disposeFxPlane(f.trail);
  state.fireballs.splice(i, 1);
}

function updateFireballs(dt) {
  var C = CFG.skill.fire;
  for (var i = state.fireballs.length - 1; i >= 0; i--) {
    var f = state.fireballs[i];
    var step = Math.hypot(f.vx, f.vz) * dt;
    f.x += f.vx * dt; f.z += f.vz * dt; f.travel += step;
    f.mesh.position.set(f.x, 0, f.z);
    f.ball.rotation.x += dt * 9;

    for (var j = 0; j < state.enemies.length; j++) {
      var e = state.enemies[j];
      if (f.hit.indexOf(e) >= 0) continue;
      var rr = C.radius + e.r;
      if (dist2(f.x, f.z, e.x, e.z) <= rr * rr) {
        f.hit.push(e);
        // Quái ĐẦU TIÊN chạm: nổ AOE ngay tại đó; quả cầu vẫn XUYÊN tiếp và
        // gây damage trực tiếp cho các quái sau (mỗi quái đúng 1 lần).
        if (!f.exploded) { f.exploded = true; fireExplode(f.x, f.z); }
        damageEnemy(e, Math.round(arrowDmg() * C.dmgMul));
        j--;                                    // damageEnemy có thể giết -> splice
      }
    }
    if (f.travel >= C.range || outOfRoom(f.x, f.z)) {
      if (!f.exploded) { f.exploded = true; fireExplode(f.x, f.z); }
      removeFireball(i);
    }
  }
}

function fireExplode(x, z) {
  var C = CFG.skill.fire, dm = Math.round(arrowDmg() * C.aoeDmgMul);
  for (var i = state.enemies.length - 1; i >= 0; i--) {
    var e = state.enemies[i];
    if (!e) continue;
    if (dist2(x, z, e.x, e.z) <= C.aoe * C.aoe) damageEnemy(e, dm);
  }
  // Vòng nổ nằm sàn: 0.3 -> đường kính AOE trong ringLife rồi tan.
  var ring = makeFxPlane({ tex: 'vfx_ring', color: C.color, additive: true, w: 1, ground: true });
  ring.position.set(x, 0.06, z);
  addFx(ring, C.ringLife + C.ringFade, function (o) {
    var k = Math.min(1, o.t / CFG.skill.fire.ringLife);
    var s = 0.3 + (CFG.skill.fire.aoe * 2 * CFG.skill.fire.ringTexFit - 0.3) * k;
    o.mesh.scale.set(s, s, 1);
    o.mat.opacity = o.t <= CFG.skill.fire.ringLife ? 1
                  : Math.max(0, 1 - (o.t - CFG.skill.fire.ringLife) / CFG.skill.fire.ringFade);
  });
  // Biểu tượng lửa phồng lên rồi tan (billboard, có alpha nên KHÔNG additive).
  // nhuộm cam theo màu skill (tint trắng ra đốm TRẮNG vô nghĩa — ảnh vòng 1)
  var mk = makeFxPlane({ tex: 'vfx_mask_fire', color: C.color, w: 1, billboard: true });
  mk.position.set(x, 1.0, z);
  addFx(mk, 0.42, function (o) {
    var k = o.t / o.max;
    var s = 0.7 + 1.7 * k;
    o.mesh.scale.set(s, s, 1);
    o.mesh.position.y = 1.0 + k * 0.5;
    o.mat.opacity = 1 - k * k;
  });
  shakeCam(C.shake);
}

// ---------------------------------------------------------------------------
// (2) BĂNG NỔ — vòng băng lan từ hero: damage + slow 60%/3s
// ---------------------------------------------------------------------------
function castIce() {
  var h = state.hero, C = CFG.skill.ice, dm = Math.round(arrowDmg() * C.dmgMul);
  for (var i = state.enemies.length - 1; i >= 0; i--) {
    var e = state.enemies[i];
    if (dist2(h.x, h.z, e.x, e.z) > C.radius * C.radius) continue;
    damageEnemy(e, dm);
    if (state.enemies.indexOf(e) >= 0) applySlow(e);    // còn sống mới slow
  }
  var ring = makeFxPlane({ tex: 'vfx_ring', color: C.color, additive: true, w: 0.01, ground: true });
  ring.position.set(h.x, 0.05, h.z);
  addFx(ring, C.ringLife + C.ringFade, function (o) {
    var CC = CFG.skill.ice;
    var k = Math.min(1, o.t / CC.ringLife);
    var s = CC.radius * 2 * CC.ringTexFit * k;
    o.mesh.scale.set(Math.max(0.01, s), Math.max(0.01, s), 1);
    o.mat.opacity = o.t <= CC.ringLife ? 1 : Math.max(0, 1 - (o.t - CC.ringLife) / CC.ringFade);
  });
  return true;
}

// ---------------------------------------------------------------------------
// (3) SÉT XÍCH — đánh quái gần nhất rồi nhảy tối đa 4 mục tiêu
// ---------------------------------------------------------------------------
function castThunder() {
  var h = state.hero, C = CFG.skill.thunder;
  var first = null, bd = C.range * C.range;
  for (var i = 0; i < state.enemies.length; i++) {
    var e = state.enemies[i], d = dist2(h.x, h.z, e.x, e.z);
    if (d <= bd) { bd = d; first = e; }
  }
  if (!first) {
    addText(h.x, CFG.hero.height * 1.4, h.z, 'Không có mục tiêu', 'hero');
    return false;                       // KHÔNG tốn cooldown
  }
  // Dựng chuỗi mục tiêu: mỗi bước nhảy sang quái gần nhất CHƯA bị đánh trong
  // jumpRange quanh mục tiêu hiện tại.
  var chain = [first];
  while (chain.length < C.maxTargets) {
    var cur = chain[chain.length - 1], nx = null, nd = C.jumpRange * C.jumpRange;
    for (var j = 0; j < state.enemies.length; j++) {
      var c = state.enemies[j];
      if (chain.indexOf(c) >= 0) continue;
      var d2 = dist2(cur.x, cur.z, c.x, c.z);
      if (d2 <= nd) { nd = d2; nx = c; }
    }
    if (!nx) break;
    chain.push(nx);
  }
  // Mỗi đoạn hiện lệch 60ms -> cảm giác "xích" chạy dần.
  for (var k = 0; k < chain.length; k++) {
    (function (idx) {
      var from = idx === 0 ? null : chain[idx - 1];
      var to = chain[idx];
      state.skillPending.push({ t: idx * C.segDelay, fn: function () { thunderHit(from, to, idx); } });
    })(k);
  }
  shakeCam(C.shake);
  return true;
}

function thunderHit(from, to, idx) {
  var C = CFG.skill.thunder, h = state.hero;
  if (state.enemies.indexOf(to) < 0) return;      // mục tiêu đã chết trước lượt
  if (from === null) {
    // Đoạn đầu: sét TỪ TRÊN CAO đánh xuống (billboard đứng ngay trên mục tiêu).
    // tint TRẮNG: giữ nguyên vàng-cam sẵn có của texture (nhân thêm C.color
    // làm tối kênh xanh -> nhìn ra nâu xỉn, thấy ở ảnh vòng 1)
    var sky = makeFxPlane({ tex: 'vfx_bolt', color: 0xffffff, additive: true,
                            w: C.segW * 1.6, h: C.skyH, billboard: true });
    sky.position.set(to.x, C.skyH * 0.5, to.z);
    addFx(sky, C.segLife, fadeOutFx);
    // + 1 đoạn ngang ngắn từ hero tới mục tiêu để thấy liên kết với hero
    addBoltSegment(h.x, h.z, to.x, to.z);
  } else {
    addBoltSegment(from.x, from.z, to.x, to.z);
  }
  // Tia lửa tại điểm trúng: 1 trong 4 ô của sheet 2x2 vfx_spark.
  var sp = makeFxPlane({ tex: 'vfx_spark', color: 0xffffff, additive: true,
                         w: C.sparkSize, billboard: true, cloneTex: true });
  if (sp.material.map) {
    sp.material.map.repeat.set(0.5, 0.5);
    sp.material.map.offset.set(0.5 * ri(2), 0.5 * ri(2));
  }
  sp.position.set(to.x, 0.9, to.z);
  addFx(sp, C.sparkLife, fadeOutFx);

  var mul = C.dmgMul[Math.min(idx, C.dmgMul.length - 1)];
  damageEnemy(to, Math.round(arrowDmg() * mul));
}

function addBoltSegment(ax, az, bx, bz) {
  var C = CFG.skill.thunder;
  var dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
  if (len < 1e-3) return;
  var g = new THREE.Group();
  g.rotation.y = Math.atan2(dx, dz);              // +Z cục bộ chỉ từ A về B
  g.position.set(bx, 0, bz);
  var p = makeStripPlane('vfx_bolt', 0xffffff, len, C.segW, true);
  p.position.set(0, 0.85, -len / 2);              // trải dọc -Z cục bộ => về A
  g.add(p);
  // Group chỉ là khung xoay -> truyền làm holder để gỡ luôn khi plane hết đời.
  addFx(p, C.segLife, fadeOutFx, g);
}

/* GIỮ nguyên độ sáng nửa đầu đời rồi mới tắt dần — fade tuyến tính từ đầu
   khiến cả chuỗi sét đã mờ 30-70% ngay khi đoạn cuối vừa hiện (ảnh vòng 1). */
function fadeOutFx(o) {
  var k = o.t / o.max;
  o.mat.opacity = k < 0.5 ? 1 : Math.max(0, 1 - (k - 0.5) / 0.5);
}

// ---------------------------------------------------------------------------
// (4) MÂY ĐỘC — thả tại tâm cụm quái đông nhất, tick damage 0.5s trong 4s
// ---------------------------------------------------------------------------
function castPoison() {
  var C = CFG.skill.poison, h = state.hero, cx, cz;
  if (state.enemies.length) {
    var best = null, bestN = -1;
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i], n = 0;
      for (var j = 0; j < state.enemies.length; j++) {
        if (dist2(e.x, e.z, state.enemies[j].x, state.enemies[j].z) <= C.clusterR * C.clusterR) n++;
      }
      if (n > bestN) { bestN = n; best = e; }
    }
    cx = best.x; cz = best.z;
  } else {
    cx = h.x + Math.sin(h.facing) * C.dropAhead;
    cz = h.z + Math.cos(h.facing) * C.dropAhead;
  }
  var p = { x: cx, z: cz }; clampToRoom(p); cx = p.x; cz = p.z;

  var g = new THREE.Group(); g.position.set(cx, 0, cz);
  var glow = makeFxPlane({ tex: 'vfx_glow', color: C.color, additive: true, w: C.radius * 2.1, ground: true });
  glow.position.y = 0.04; g.add(glow);
  var ring = makeFxPlane({ tex: 'vfx_ring', color: C.color, additive: true, w: C.radius * 2, ground: true });
  ring.position.y = 0.08; g.add(ring);
  // Pool bọt: tạo 1 lần lúc thả, TÁI SỬ DỤNG suốt vòng đời mây (không tạo/xoá
  // mesh mỗi frame), dispose 1 lượt khi mây tan.
  var bubbles = [];
  for (var b = 0; b < C.bubbles; b++) {
    var bm = makeFxPlane({ tex: 'vfx_mask_poison', color: 0xffffff, w: C.bubbleSize, billboard: true });
    g.add(bm);
    bubbles.push({ mesh: bm, t: -b * (1.4 / C.bubbles), dur: 1.4, ox: 0, oz: 0 });
    resetBubble(bubbles[b], C);
  }
  groupFx.add(g);
  // tickT = 0: nhịp damage ĐẦU TIÊN nổ ngay frame sau khi thả (không bắt người
  // chơi chờ trắng 0.5s), các nhịp sau cách nhau đúng tickInterval.
  state.clouds.push({ x: cx, z: cz, life: C.life, tickT: 0,
                      mesh: g, glow: glow, ring: ring, bubbles: bubbles, ticks: 0 });
  return true;
}

function resetBubble(b, C) {
  var a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * C.radius * 0.8;
  b.ox = Math.sin(a) * r; b.oz = Math.cos(a) * r;
  b.dur = rnd(1.1, 1.7);
}

function updatePoisonClouds(dt) {
  var C = CFG.skill.poison;
  for (var i = state.clouds.length - 1; i >= 0; i--) {
    var c = state.clouds[i];
    c.life -= dt;
    // decal xoay chậm + vòng nhấp nháy 0.9 <-> 1.05
    c.glow.rotation.z += dt * 0.55;
    var pl = 0.9 + 0.15 * (0.5 + 0.5 * Math.sin(state.time * 6));
    var rs = C.radius * 2 * pl;
    c.ring.scale.set(rs, rs, 1);
    var fade = c.life < 0.5 ? c.life / 0.5 : 1;
    c.glow.material.opacity = 0.85 * fade;
    c.ring.material.opacity = 0.9 * fade;
    for (var b = 0; b < c.bubbles.length; b++) {
      var bb = c.bubbles[b];
      bb.t += dt;
      if (bb.t >= bb.dur) { bb.t = 0; resetBubble(bb, C); }
      var k = bb.t <= 0 ? 0 : bb.t / bb.dur;
      bb.mesh.visible = bb.t > 0;
      bb.mesh.position.set(bb.ox, 0.15 + C.bubbleRise * k, bb.oz);
      bb.mesh.material.opacity = (k < 0.2 ? k / 0.2 : (1 - (k - 0.2) / 0.8)) * fade;
    }
    // tick damage
    c.tickT -= dt;
    if (c.tickT <= 0) {
      c.tickT += C.tickInterval;
      c.ticks++;
      var dm = Math.round(arrowDmg() * C.dmgMul);
      for (var j = state.enemies.length - 1; j >= 0; j--) {
        var e = state.enemies[j];
        if (dist2(c.x, c.z, e.x, e.z) <= C.radius * C.radius) damageEnemy(e, dm, 'poison');
      }
    }
    if (c.life <= 0) { disposeCloud(c); state.clouds.splice(i, 1); }
  }
}

function disposeCloud(c) {
  groupFx.remove(c.mesh);
  c.glow.material.dispose(); c.ring.material.dispose();
  for (var b = 0; b < c.bubbles.length; b++) c.bubbles[b].mesh.material.dispose();
}
function purgeClouds() {
  if (!state || !state.clouds) return;
  for (var i = 0; i < state.clouds.length; i++) disposeCloud(state.clouds[i]);
  state.clouds.length = 0;
}
function purgeFireballs() {
  if (!state || !state.fireballs) return;
  for (var i = state.fireballs.length - 1; i >= 0; i--) removeFireball(i);
}

// ---------------------------------------------------------------------------
// Cast + vòng cập nhật chung
// ---------------------------------------------------------------------------
function castSkill(i) {
  if (!state || state.phase !== 'playing') return false;
  var s = state.skills[i];
  if (!s || s.cd > 0) return false;
  var ok = false;
  if (s.id === 'fire') ok = castFire();
  else if (s.id === 'ice') ok = castIce();
  else if (s.id === 'thunder') ok = castThunder();
  else if (s.id === 'poison') ok = castPoison();
  if (ok) { s.cd = s.cdMax; bumpSkillBtn(i); }
  return ok;
}

function updateSkills(dt) {
  for (var i = 0; i < state.skills.length; i++) {
    var s = state.skills[i];
    if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
  }
  for (var p = state.skillPending.length - 1; p >= 0; p--) {
    var q = state.skillPending[p];
    q.t -= dt;
    if (q.t <= 0) { state.skillPending.splice(p, 1); q.fn(); }
  }
  updateFireballs(dt);
  updatePoisonClouds(dt);
  updateSkillFx(dt);
  updateShake(dt);
}

function getSkillState() {
  var out = [];
  for (var i = 0; i < state.skills.length; i++) {
    var s = state.skills[i];
    out.push({ id: s.id, cd: Math.round(s.cd * 1000) / 1000, cdMax: s.cdMax, ready: s.cd <= 0 });
  }
  return out;
}

// --- HUD 4 nút -------------------------------------------------------------
var skillBtns = null, _skillPrev = null;
function buildSkillBar() {
  if (skillBtns) return;
  var bar = $('skillBar'); if (!bar) return;
  skillBtns = []; _skillPrev = [];
  for (var i = 0; i < SKILL_DEFS.length; i++) {
    var el = $('sk' + i); if (!el) continue;
    var img = el.querySelector('img');
    var uri = ((typeof window !== 'undefined' && window.FBX_TEX) ? window.FBX_TEX : {})[SKILL_DEFS[i].icon];
    if (img && uri) img.src = uri;                 // icon lấy từ FBX_TEX, không chép base64 vào HTML
    skillBtns.push({ el: el, arc: el.querySelector('.cd'), txt: el.querySelector('.cdTxt') });
    _skillPrev.push({ frac: -1, ready: null });
  }
}
function syncSkillBar() {
  buildSkillBar();
  if (!skillBtns || !state || !state.skills) return;
  for (var i = 0; i < skillBtns.length; i++) {
    var s = state.skills[i], b = skillBtns[i], pv = _skillPrev[i];
    var frac = s.cdMax > 0 ? s.cd / s.cdMax : 0;
    // chỉ ghi DOM khi đổi >= 1% (hoặc vừa chạm 0)
    if (pv.frac < 0 || Math.abs(frac - pv.frac) >= 0.01 || (frac === 0) !== (pv.frac === 0)) {
      if (b.arc) b.arc.style.setProperty('--cd', frac.toFixed(3));
      if (b.txt) b.txt.textContent = s.cd > 0 ? s.cd.toFixed(1) : '';
      pv.frac = frac;
    }
    var ready = s.cd <= 0;
    if (ready !== pv.ready) {
      if (ready) {
        b.el.classList.add('ready');
        if (pv.ready === false) flashSkillBtn(i);   // vừa sẵn sàng -> nháy 1 lần
      } else b.el.classList.remove('ready');
      pv.ready = ready;
    }
  }
}
function pulseClass(i, cls, ms) {
  if (!skillBtns || !skillBtns[i]) return;
  var el = skillBtns[i].el;
  el.classList.remove(cls);
  void el.offsetWidth;                              // ép reflow để animation chạy lại
  el.classList.add(cls);
  setTimeout(function () { el.classList.remove(cls); }, ms);
}
function bumpSkillBtn(i) { pulseClass(i, 'bump', 220); }
function flashSkillBtn(i) { pulseClass(i, 'flash', 480); }

// --- Input: phím 1-4 (one-shot) + pointerdown trên nút ---------------------
var _skillKeyHeld = {};
function skillIndexFromCode(code) {
  switch (code) {
    case 'Digit1': case 'Numpad1': return 0;
    case 'Digit2': case 'Numpad2': return 1;
    case 'Digit3': case 'Numpad3': return 2;
    case 'Digit4': case 'Numpad4': return 3;
  }
  return -1;
}
function initSkillInput() {
  buildSkillBar();
  if (!skillBtns) return;
  for (var i = 0; i < skillBtns.length; i++) {
    (function (idx) {
      var el = skillBtns[idx].el;
      // pointerdown: phản hồi ngay trên touch; preventDefault để không cướp
      // focus bàn phím và không kéo/scroll trang.
      el.addEventListener('pointerdown', function (ev) { ev.preventDefault(); castSkill(idx); });
      el.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
      el.addEventListener('click', function (ev) { ev.preventDefault(); });
    })(i);
  }
}

// ---------------------------------------------------------------------------
// 8. Damage / chết / XP / tim hồi máu
// ---------------------------------------------------------------------------
/* cls: lớp CSS cho số damage nổi ('' = trắng mặc định; [VÒNG D-5] 'poison' =
   tím cho Mây Độc). Tham số THÊM, mọi lời gọi cũ giữ nguyên ý nghĩa. */
function damageEnemy(e, dmg, cls) {
  e.hp -= dmg; e.flash = 0.1;
  applyHitFlash(e.fx);                    // [ADD-3](d) nháy sáng ~0.1s khi trúng đòn
  addText(e.x, CFG.hero.height, e.z, '-' + dmg, cls || '');
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  var i = state.enemies.indexOf(e); if (i < 0) return;
  state.enemies.splice(i, 1);
  groupEntities.remove(e.mesh);
  removeSlowIcon(e);                      // [VÒNG D-5] gỡ icon băng trên đầu
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
  applyHitFlash(h.fx);                    // [ADD-3](d) nháy sáng ~0.1s khi hero trúng đòn
  addText(h.x, CFG.hero.height * 1.2, h.z, '-' + dmg, 'hero');       // [ADD-3](a) đã có sẵn
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

/* [MOD-6 v2] Tạm dừng: đặt phase='paused' -> tick() bỏ qua toàn bộ update
   gameplay (chỉ chạy updateTexts), hiện overlay có nút "Tiếp tục". */
function pause() {
  if (!state || state.phase !== 'playing') return false;
  state.phase = 'paused';
  input.up = input.down = input.left = input.right = false;
  showOverlay('ovPause', true);
  return true;
}

function resume() {
  if (!state || state.phase !== 'paused') return false;
  state.phase = 'playing';
  showOverlay('ovPause', false);
  return true;
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

/* [MOD-6 v2] HUD dựng theo Refs/Layout_1.png: nút Pause | Lv + thanh XP | coin,
   bộ đếm quái, thanh Đợt 5 icon kiếm chéo. Thanh HP hero bám trên đầu hero
   (đúng như layout gốc), không nằm trên HUD. */

// Icon kiếm chéo (inline SVG, không tải file ngoài). Màu theo currentColor
// để trạng thái .current đổi sang màu tối trên nền vàng.
var WAVE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<g fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">' +
  '<path d="M4.5 3.5 L15.5 15"/><path d="M19.5 3.5 L8.5 15"/>' +
  '</g>' +
  '<g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round">' +
  '<path d="M6 20.5 L9.6 16.6"/><path d="M18 20.5 L14.4 16.6"/>' +   // chuôi kiếm
  '<path d="M4.6 16 L9 20"/><path d="M19.4 16 L15 20"/>' +           // chắn tay
  '</g></svg>';

var waveCells = null;            // 5 phần tử .wv, dựng 1 lần

function buildWaveBar() {
  var row = $('waveRow'); if (!row || waveCells) return;
  waveCells = [];
  var html = '';
  for (var i = 1; i <= CFG.wave.count; i++) {
    html += '<div class="wv upcoming">' + WAVE_ICON +
            '<span class="no">' + i + '</span><span class="tick">✔</span></div>';
  }
  row.innerHTML = html;
  for (var j = 0; j < row.children.length; j++) waveCells.push(row.children[j]);
}

function syncHUD() {
  buildWaveBar();

  // (b) Lv + thanh XP tới mốc kế
  $('lvLine').textContent = 'Lv.' + state.level;
  var need = xpNeed(), maxed = !isFinite(need);
  $('xpFill').style.width = (maxed ? 100 : clamp(state.xp / need * 100, 0, 100)) + '%';

  // (d) số quái còn sống của wave hiện tại
  $('enemyLine').textContent = state.enemies.length;

  // (e) thanh Đợt: đã dọn / hiện tại / chưa tới
  var cur = Math.max(1, state.wave);
  for (var i = 0; i < waveCells.length; i++) {
    var k = i + 1, cls;
    if (k < cur || (k === cur && state.phase === 'won')) cls = 'wv done';
    else if (k === cur) cls = 'wv current';
    else cls = 'wv upcoming';
    if (waveCells[i].className !== cls) waveCells[i].className = cls;
  }

  updateHeroBar();
  syncSkillBar();                  // [VÒNG D-5] 4 nút skill + quét cooldown
}

/* Thanh HP hero bám theo hero, chiếu bằng camera.project() giống số damage nổi. */
var _projHP = new THREE.Vector3();
function updateHeroBar() {
  var bar = $('heroBar'); if (!bar) return;
  var h = state.hero;
  if (!h || h.hp <= 0 || state.phase === 'lost') { bar.classList.remove('on'); return; }
  bar.classList.add('on');
  $('heroHPFill').style.width = clamp(h.hp / h.hpMax * 100, 0, 100) + '%';
  $('heroHPText').textContent = Math.max(0, Math.round(h.hp));
  var rect = stageEl ? { w: stageEl.clientWidth, h: stageEl.clientHeight } : { w: 540, h: 960 };
  _projHP.set(h.x, CFG.hero.height + 0.35, h.z).project(camera);
  bar.style.left = ((_projHP.x * 0.5 + 0.5) * rect.w) + 'px';
  bar.style.top = ((-_projHP.y * 0.5 + 0.5) * rect.h) + 'px';
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
  // [VÒNG D-5] dọn toàn bộ VFX skill trước (mesh + material), tránh rò rỉ
  // node trong scene khi reset()/start() lại.
  for (var si = 0; si < state.enemies.length; si++) removeSlowIcon(state.enemies[si]);
  purgeFireballs(); purgeClouds(); purgeSkillFx();
  _shakeT = 0; _shakeX = 0; _shakeY = 0;
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
  clearTrail();                   // [ADD-3](b) tắt vệt còn sót từ ván trước
  state = freshState();
  state.hero = makeHero();
  api.state = state;
  input.up = input.down = input.left = input.right = false;
  updateCamera(0);                // [MOD-5 v2] snap camera về đầu dưới phòng
  showOverlay('ovPause', false);
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
  pause: pause, resume: resume,                       // [MOD-6 v2]
  castSkill: castSkill, getSkillState: getSkillState, // [VÒNG D-5]
  hasFBX: function (k) { return Assets.has(k); },
  _internal: { Assets: Assets, ASSET_SIZE: ASSET_SIZE, get scene() { return scene; }, get camera() { return camera; },
               camLimitZ: function () { return camLimitZ(); },
               camLimitTopZ: function () { return camLimitTopZ(); },
               hudPadZ: function () { return hudPadZ(); },
               viewHalfZ: function () { return viewHalfZ(); },
               // [ADD-3](b) số node vệt đang active — dùng cho test_juice
               trailActiveCount: function () {
                 if (!trailPool) return 0;
                 var n = 0;
                 for (var i = 0; i < trailPool.length; i++) if (trailPool[i].active) n++;
                 return n;
               },
               // [VÒNG D-3b] có đang dùng crop texture từ floor.png hay không (false = fallback checker)
               floorTexture: function () { return !!makeFloorCropTexture(); },
               // [VÒNG D-5] đếm object VFX skill đang sống (test rò rỉ mesh)
               skillFx: function () {
                 return {
                   fx: state && state.skillFx ? state.skillFx.length : 0,
                   fireballs: state && state.fireballs ? state.fireballs.length : 0,
                   clouds: state && state.clouds ? state.clouds.length : 0,
                   pending: state && state.skillPending ? state.skillPending.length : 0,
                   rings: state && state.rings ? state.rings.length : 0,
                   enemies: state && state.enemies ? state.enemies.length : 0,
                   groupFxChildren: groupFx ? groupFx.children.length : 0,
                   groupFxCensus: (function () {
                     if (!groupFx) return [];
                     var c = {};
                     for (var i = 0; i < groupFx.children.length; i++) {
                       var n = groupFx.children[i];
                       var k = n.type + ':' + (n.geometry && n.geometry.type ? n.geometry.type : '-') +
                               ':' + (n.material && n.material.map && n.material.map.image && n.material.map.image.width ? n.material.map.image.width : 'nomap');
                       c[k] = (c[k] || 0) + 1;
                     }
                     return c;
                   })()
                 };
               } }
};
window.__game = api;

// ---------------------------------------------------------------------------
// 14. Boot
// ---------------------------------------------------------------------------
function boot() {
  Assets.load();
  initThree();
  initInput();
  initSkillInput();                 // [VÒNG D-5] gán icon + pointerdown 4 nút skill
  $('btnReplay').addEventListener('click', function () { start(); });
  // [MOD-6 v2] nút Pause góc trên trái + nút "Tiếp tục" trong overlay
  $('btnPause').addEventListener('click', function () { pause(); });
  $('btnResume').addEventListener('click', function () { resume(); });
  start();
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
