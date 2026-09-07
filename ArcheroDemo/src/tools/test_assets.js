/* test_assets.js — [VÒNG D-3/D-3b/D-3c] kiểm swap FBX + texture + AnimationMixer.
   Chạy: bash tools/run.sh <html> <out.png> <ms> tools/test_assets.js "" */
window.__runTest = function () {
  var g = window.__game;
  g.start();

  var Assets = g._internal.Assets;
  var ASSET_SIZE = g._internal.ASSET_SIZE;
  var keys = ['hero', 'monster_flower', 'monster_bug', 'monster_slime', 'arrow', 'wall'];
  var out = { assets: {} };

  keys.forEach(function (k) {
    var loaded = g.hasFBX(k);
    var rec = { loaded: loaded };
    if (loaded) {
      var mesh = Assets.make(k);   // bản dựng thử để đo, KHÔNG add vào scene
      var meshCount = 0, hasMapAll = true;
      mesh.traverse(function (n) {
        if (n.isMesh) {
          meshCount++;
          var mats = Array.isArray(n.material) ? n.material : [n.material];
          for (var i = 0; i < mats.length; i++) { if (!mats[i] || !mats[i].map) hasMapAll = false; }
        }
      });
      var box = new THREE.Box3().setFromObject(mesh);
      var size = new THREE.Vector3(); box.getSize(size);
      var clips = mesh.userData.fbxClips || {};
      rec.meshCount = meshCount;
      rec.hasMap = hasMapAll;
      rec.bbox = { w: +size.x.toFixed(3), h: +size.y.toFixed(3), d: +size.z.toFixed(3) };
      rec.targetSize = ASSET_SIZE[k] || null;
      // [VÒNG D-3b] hero/monster_* chuẩn hoá theo bbox.h == targetSize.h (chỉ
      // chiều cao, .d không còn ràng buộc); arrow/wall vẫn theo cả d lẫn h.
      rec.normalizeMode = (k === 'arrow' || k === 'wall') ? 'size(d+h)' : 'height-only';
      rec.clipNames = {
        idle: clips.idle ? clips.idle.name : null,
        run: clips.run ? clips.run.name : null,
        attack: clips.attack ? clips.attack.name : null
      };
      rec.mixerCreated = !!(clips.idle || clips.run || clips.attack);
      if (k === 'arrow') {
        // [D-3c] hideArrowFxChildren() giờ GỠ HẲN (remove) shadow/trail/weapon
        // khỏi cây thay vì chỉ set visible=false (Box3 không loại trừ node ẩn
        // -> phải gỡ thật mới chuẩn hoá đúng, xem game_core.js) — nên không
        // còn "hidden" node nào để liệt kê; báo trực tiếp mesh còn lại.
        var remaining = [];
        mesh.traverse(function (n) { if (n.isMesh) remaining.push(n.name); });
        out.arrowRemainingMeshes = remaining;   // kỳ vọng: ["child"] (đã gỡ shadow/trail/Public_Weapon05)
        out.arrowMaterial = (function () {
          var n2 = null; mesh.traverse(function (n) { if (n.isMesh) n2 = n; });
          return n2 && n2.material ? { type: n2.material.type, color: n2.material.color ? n2.material.color.getHexString() : null } : null;
        })();
      }
    }
    out.assets[k] = rec;
  });

  // [VÒNG D-3b] Floor: LUÔN primitive plane (không còn qua AssetLoader/FBX) —
  // đo trực tiếp material.map của Prim.floor() qua Assets.make('floor').
  out.floorTexture = g._internal.floorTexture();   // true = dùng crop texture floor.png, false = fallback checker
  (function () {
    var mesh = Assets.make('floor');
    var meshCount = 0, hasMapAll = true;
    mesh.traverse(function (n) {
      if (n.isMesh) {
        meshCount++;
        if (!n.material || !n.material.map) hasMapAll = false;
      }
    });
    out.assets.floor = { loadedFBX: g.hasFBX('floor'), meshCount: meshCount, hasMap: hasMapAll, usesCropTexture: out.floorTexture };
  })();

  // Chạy vài bước để mixer hero (nếu có) update không lỗi + hero di chuyển
  // 1 đoạn để kiểm animState chuyển idle<->run<->attack không văng exception.
  g.setInput({ up: true });
  for (var i = 0; i < 30; i++) g.tick(1 / 60);
  g.setInput({ up: false });
  for (var j = 0; j < 90; j++) g.tick(1 / 60);   // đứng yên đủ lâu để auto-fire 1 phát (fireRate 2.5/s)

  var h = g.state.hero;
  out.heroAnim = h && h.anim ? {
    mixerCreated: true,
    animStateAfterRun: 'checked-during-run(above)',
    hasIdle: !!h.anim.actions.idle, hasRun: !!h.anim.actions.run, hasAttack: !!h.anim.actions.attack
  } : { mixerCreated: false };

  return out;
};
