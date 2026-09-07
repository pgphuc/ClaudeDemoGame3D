/* test_cam.js — [MOD-5 v2] kiểm tra camera follow theo trục z + clamp 2 đầu.
   Ghim hero vào 1 vị trí z rồi tick đồng bộ cho camera bám tới nơi, in ra
   heroZ / camZ (tâm khung nhìn) / limit. Vị trí lấy từ window.__CAMPOS:
     'bottom' = đầu dưới phòng (z dương), 'mid' = giữa, 'top' = đầu trên.
   Chạy: bash tools/run.sh <html> <out.png> <ms> tools/test_cam_<pos>.js */
window.__camTest = function (pos) {
  var g = window.__game;
  g.start();

  var m = g.CFG.room.margin, half = g.CFG.room.h / 2;
  var targetZ = pos === 'top' ? -(half - m) : (pos === 'mid' ? 0 : (half - m));

  var steps = 0;
  while (steps < 180) {
    if (g.state.phase === 'levelup') { g.chooseCard(0); continue; }
    if (g.state.phase !== 'playing') break;
    g.state.hero.z = targetZ;            // ghim hero, bỏ qua va chạm đẩy
    g.tick(1 / 60);
    steps++;
  }
  g.state.hero.z = targetZ;

  var cam = g._internal.camera;
  var t = g.CFG.camera.tiltDeg * Math.PI / 180;
  var camZ = cam.position.z - g.CFG.camera.dist * Math.sin(t);
  var r = function (v) { return Math.round(v * 1000) / 1000; };
  return {
    pos: pos,
    roomH: r(g.CFG.room.h),
    heroZ: r(g.state.hero.z),
    camZ: r(camZ),
    camPosZ: r(cam.position.z),
    limitZ: r(g._internal.camLimitZ()),
    limitTopZ: r(g._internal.camLimitTopZ()),   // [MOD-6 v2] nới thêm dải HUD
    hudPadZ: r(g._internal.hudPadZ()),
    viewHalfZ: r(g._internal.viewHalfZ()),
    // [MOD-6 v2] clamp KHÔNG đối xứng: mép dưới dùng camLimitZ, mép trên camLimitTopZ
    clamped: Math.abs(Math.abs(camZ) - (camZ < 0 ? g._internal.camLimitTopZ() : g._internal.camLimitZ())) < 0.01,
    viewTopZ: r(camZ - g._internal.viewHalfZ()),
    viewBottomZ: r(camZ + g._internal.viewHalfZ()),
    steps: steps
  };
};
window.__runTest = function () { return window.__camTest('bottom'); };
