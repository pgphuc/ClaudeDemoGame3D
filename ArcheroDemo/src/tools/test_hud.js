/* test_hud.js — [MOD-6 v2] kiểm tra HUD mới (Layout_1.png) + pause + hero
   không bị dải HUD che.
   Chạy ĐỒNG BỘ trong 1 lượt JS (gọi tick() thủ công), không setTimeout.

   Kịch bản:
     1. start() -> dọn wave 1, wave 2 để vào wave 3, đọc trạng thái 5 icon đợt,
        số quái còn, Lv, % thanh XP, text coin.
     2. pause(): kiểm tra overlay hiện + tick() KHÔNG đổi state hero/quái.
     3. resume(): overlay tắt + tick() chạy lại bình thường.
     4. Ghim hero ở sát ĐỈNH phòng -> chiếu vị trí đỉnh đầu hero lên màn hình,
        so với cạnh dưới dải HUD (heroTopPx > hudBottomPx = không bị che).

   Chạy: bash tools/run.sh <html> <out.png> <ms> tools/test_hud.js */
window.__runTest = function () {
  var g = window.__game;
  var r3 = function (v) { return Math.round(v * 1000) / 1000; };
  var $ = function (id) { return document.getElementById(id); };

  g.start();

  // --- 1. tiến tới wave 3 -------------------------------------------------
  var steps = 0;
  while (steps < 60 * 60 && g.state.wave < 3) {
    if (g.state.phase === 'levelup') { g.chooseCard(0); continue; }
    if (g.state.phase !== 'playing') break;
    g.killAll();
    g.tick(1 / 60);
    steps++;
  }
  // chạy thêm vài frame để wave 3 spawn xong và HUD đồng bộ
  for (var i = 0; i < 5; i++) {
    if (g.state.phase === 'levelup') { g.chooseCard(0); continue; }
    g.tick(1 / 60);
  }

  var cells = document.querySelectorAll('#waveRow .wv');
  var waveIcons = [];
  for (var c = 0; c < cells.length; c++) {
    var cl = cells[c].className;
    waveIcons.push(cl.indexOf('done') >= 0 ? 'done'
                 : (cl.indexOf('current') >= 0 ? 'current' : 'upcoming'));
  }

  var snapWave3 = {
    wave: g.state.wave,
    waveIcons: waveIcons,
    waveIconCount: cells.length,
    enemyText: $('enemyLine').textContent,
    enemiesAlive: g.state.enemies.length,
    lvText: $('lvLine').textContent,
    xpBarPct: $('xpFill').style.width,
    coinText: $('coinLine').textContent,
    // HUD 2 dòng chữ cũ đã bị bỏ
    oldHudGone: !$('waveLine') && !$('hpLine') && !$('xpLine') && !$('hpFill'),
    heroBarOnHero: $('heroBar').classList.contains('on')
  };

  // --- 2. pause: tick() không được đổi state gameplay ----------------------
  var okPause = g.pause();
  var before = {
    hx: g.state.hero.x, hz: g.state.hero.z, hp: g.state.hero.hp,
    n: g.state.enemies.length,
    ex: g.state.enemies.length ? g.state.enemies[0].x : 0,
    ez: g.state.enemies.length ? g.state.enemies[0].z : 0,
    t: g.state.time
  };
  g.setInput({ up: true });                  // giữ phím: nếu không pause hero sẽ chạy
  for (var p = 0; p < 30; p++) g.tick(1 / 60);
  var after = {
    hx: g.state.hero.x, hz: g.state.hero.z, hp: g.state.hero.hp,
    n: g.state.enemies.length,
    ex: g.state.enemies.length ? g.state.enemies[0].x : 0,
    ez: g.state.enemies.length ? g.state.enemies[0].z : 0,
    t: g.state.time
  };
  var pauseFrozen = before.hx === after.hx && before.hz === after.hz &&
                    before.hp === after.hp && before.n === after.n &&
                    before.ex === after.ex && before.ez === after.ez &&
                    before.t === after.t;
  var pauseOverlayShown = $('ovPause').classList.contains('show');
  var pausePhase = g.state.phase;

  // --- 3. resume ----------------------------------------------------------
  var okResume = g.resume();
  var resumePhase = g.state.phase;
  var resumeOverlayShown = $('ovPause').classList.contains('show');
  var tz0 = g.state.hero.z;
  for (var q = 0; q < 20; q++) g.tick(1 / 60);
  var resumeMoved = g.state.hero.z !== tz0;   // phím 'up' vẫn giữ -> hero phải đi
  g.setInput({ up: false });

  // --- 4. hero sát ĐỈNH phòng có bị dải HUD che không? --------------------
  var targetZ = -(g.CFG.room.h / 2 - g.CFG.room.margin);
  for (var s2 = 0; s2 < 180; s2++) {
    if (g.state.phase === 'levelup') { g.chooseCard(0); continue; }
    if (g.state.phase !== 'playing') break;
    g.state.hero.z = targetZ;
    g.tick(1 / 60);
  }
  g.state.hero.z = targetZ;
  g.tick(1 / 60);

  var stage = $('stage'), hud = $('hudTop');
  var stH = stage.clientHeight;
  var cam = g._internal.camera;
  // đỉnh đầu hero (y = chiều cao hero) chiếu lên toạ độ pixel của stage
  var v = new THREE.Vector3(g.state.hero.x, g.CFG.hero.height, g.state.hero.z).project(cam);
  var heroTopPx = (-v.y * 0.5 + 0.5) * stH;
  var hudBottomPx = hud.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;

  return {
    // --- (a..e) HUD ---
    wave: snapWave3.wave,
    waveIconCount: snapWave3.waveIconCount,
    waveIcons: snapWave3.waveIcons,
    enemyText: snapWave3.enemyText,
    enemiesAlive: snapWave3.enemiesAlive,
    lvText: snapWave3.lvText,
    xpBarPct: snapWave3.xpBarPct,
    coinText: snapWave3.coinText,
    oldHudGone: snapWave3.oldHudGone,
    heroBarOnHero: snapWave3.heroBarOnHero,
    // --- pause / resume ---
    pauseCalled: okPause, pausePhase: pausePhase,
    pauseOverlayShown: pauseOverlayShown, pauseFrozen: pauseFrozen,
    resumeCalled: okResume, resumePhase: resumePhase,
    resumeOverlayShown: resumeOverlayShown, resumeMoved: resumeMoved,
    // --- hero ở đỉnh phòng không bị HUD đè ---
    hudBottomPx: r3(hudBottomPx),
    heroTopPx: r3(heroTopPx),
    heroBarTopPx: r3($('heroBar').getBoundingClientRect().top - stage.getBoundingClientRect().top),
    heroClearOfHUD: heroTopPx > hudBottomPx &&
                    ($('heroBar').getBoundingClientRect().top -
                     stage.getBoundingClientRect().top) > hudBottomPx,
    hudPadZ: r3(g._internal.hudPadZ()),
    limitZ: r3(g._internal.camLimitZ()),
    limitTopZ: r3(g._internal.camLimitTopZ()),
    steps: steps
  };
};
