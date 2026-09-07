/* test_juice.js — [ADD-3] kiểm juice tối thiểu (Agent D vòng D-4):
     (a) số damage nổi cho quái VÀ cho hero (đã có sẵn, chỉ xác nhận lại)
     (b) vệt (trail) phía sau hero khi di chuyển, mờ dần ~0.3s
     (c) telegraph trực quan: bọ đỏ (vòng + thân nháy), hoa quái (windup trước bắn)
     (d) quái/hero nháy sáng (hit flash) ~0.1s khi trúng đòn, KHÔNG lan sang
         quái khác (material clone riêng từng thực thể)
   Chạy ĐỒNG BỘ (gọi tick() thủ công), không setTimeout.
   Chạy: bash tools/run.sh <html> <out.png> <ms> tools/test_juice.js */
window.__runTest = function () {
  var g = window.__game;
  var out = {};

  // -------------------------------------------------------------------
  // (b) TRAIL: hero di chuyển -> có node active; đứng yên 1s -> hết (0.3s life)
  // -------------------------------------------------------------------
  g.start();
  g.setInput({ right: true });
  for (var i = 0; i < 20; i++) g.tick(1 / 60);
  out.trailCountMoving = g._internal.trailActiveCount();
  g.setInput({ up: false, down: false, left: false, right: false });
  for (var i2 = 0; i2 < 60; i2++) g.tick(1 / 60);     // đứng yên 1s (>> trailLife 0.3s)
  out.trailCountAfterStop = g._internal.trailActiveCount();

  // -------------------------------------------------------------------
  // Chuẩn bị wave có bug + flower để test (c) telegraph / windup
  // -------------------------------------------------------------------
  g.reset();
  g.spawnWave(2);   // CFG.wave.list[1] = 2 bug + 2 flower
  var bug = null, flower = null;
  for (var k = 0; k < g.state.enemies.length; k++) {
    var en = g.state.enemies[k];
    if (en.type === 'bug' && !bug) bug = en;
    if (en.type === 'flower' && !flower) flower = en;
  }

  // --- (c) TELEGRAPH bọ đỏ: vòng cảnh báo + thân nháy trong 0.6s ---
  var bugInfo = { found: !!bug };
  if (bug) {
    bug.x = g.state.hero.x; bug.z = g.state.hero.z + 0.1;   // vào tầm attackRange
    g.tick(1 / 60);                       // chase -> phát hiện trong tầm -> 'telegraph'
    bugInfo.stateAfterEnter = bug.st;
    var sawPulse = false, ringVisible = false;
    for (var t = 0; t < 20 && bug.st === 'telegraph'; t++) {
      g.tick(1 / 60);
      if (bug.mesh.scale.x !== 1) sawPulse = true;
      if (bug.ring && bug.ring.mesh.visible) ringVisible = true;
    }
    bugInfo.sawBodyPulse = sawPulse;
    bugInfo.ringVisibleDuringTelegraph = ringVisible;
  }
  out.bugTelegraph = bugInfo;

  // --- (c) WINDUP hoa quái: phình ngắn trước khi bắn, KHÔNG đổi fireInterval ---
  var flowerInfo = { found: !!flower };
  if (flower) {
    flowerInfo.fireIntervalUnchanged = (g.CFG.flower.fireInterval === 1.5);
    flower.fireCd = 0.05;                 // < CFG.juice.windup (0.3) -> vào windup ngay
    g.tick(1 / 60);
    flowerInfo.windupOn = flower.windup;
    flowerInfo.scaleDuringWindup = flower.mesh.scale.x;
    var bulletsBefore = g.state.ebullets.length;
    var fired = false;
    for (var w = 0; w < 6 && !fired; w++) {
      g.tick(1 / 60);
      if (g.state.ebullets.length > bulletsBefore) fired = true;
    }
    flowerInfo.bulletFired = fired;
    flowerInfo.windupOffAfterFire = flower.windup;
    flowerInfo.scaleAfterFire = flower.mesh.scale.x;
  }
  out.flowerWindup = flowerInfo;

  // -------------------------------------------------------------------
  // (d) HIT FLASH quái: timer >0 ngay sau khi trúng đòn rồi về 0; material
  // clone riêng nên quái KHÁC (chưa bị bắn) không bị ảnh hưởng.
  // -------------------------------------------------------------------
  var hitInfo = { found: !!flower };
  if (flower) {
    var otherEnemy = null;
    for (var m = 0; m < g.state.enemies.length; m++) {
      if (g.state.enemies[m] !== flower) { otherEnemy = g.state.enemies[m]; break; }
    }
    // đẩy các quái không liên quan ra thật xa (spawnPos() chỉ đảm bảo cách HERO,
    // KHÔNG đảm bảo cách nhau) để mũi tên không vô tình trúng nhầm quái khác
    // đứng gần hoa hơn là "otherEnemy" cố ý giữ lại để kiểm cách ly material.
    for (var mo = 0; mo < g.state.enemies.length; mo++) {
      var eo = g.state.enemies[mo];
      if (eo !== flower && eo !== otherEnemy) { eo.x = 1000; eo.z = 1000; }
    }
    if (otherEnemy) { otherEnemy.x = flower.x + 5; otherEnemy.z = flower.z + 5; }
    g.state.hero.x = flower.x; g.state.hero.z = flower.z - 3;   // cùng x (trong khung camera), lệch z
    g.setInput({ up: false, down: false, left: false, right: false });
    g.tick(1 / 60);            // hero đứng yên, fireCd ban đầu 0 -> auto-fire về quái gần nhất
    if (g.state.arrows.length) {
      var arr = g.state.arrows[g.state.arrows.length - 1];
      arr.x = flower.x; arr.z = flower.z; arr.vx = 0; arr.vz = 0;   // ép trúng đích ngay tick sau
    }
    hitInfo.otherFlashBefore = otherEnemy ? otherEnemy.flash : null;
    hitInfo.otherEmissiveBefore = otherEnemy ? otherEnemy.fx.mats[0].emissive.getHex() : null;
    g.tick(1 / 60);            // updateArrows phát hiện va chạm -> damageEnemy(flower)
    hitInfo.flashRightAfterHit = flower.flash;
    hitInfo.emissiveRightAfterHit = flower.fx.mats[0].emissive.getHex();
    hitInfo.otherFlashUnaffected = otherEnemy ? (otherEnemy.flash === hitInfo.otherFlashBefore) : null;
    hitInfo.otherEmissiveUnaffected = otherEnemy
      ? (otherEnemy.fx.mats[0].emissive.getHex() === hitInfo.otherEmissiveBefore) : null;
    for (var f = 0; f < 10; f++) g.tick(1 / 60);   // > 0.1s -> flash phải tắt hẳn
    hitInfo.flashAfterWait = flower.flash;
    hitInfo.emissiveAfterWait = flower.fx.mats[0].emissive.getHex();
  }
  out.enemyHitFlash = hitInfo;

  // -------------------------------------------------------------------
  // (d) HIT FLASH hero + (a) số damage nổi màu riêng khi hero trúng đòn
  // -------------------------------------------------------------------
  g.reset();
  g.spawnWave(1);              // 3 slime -> gây damage chạm dễ kiểm soát
  var slime = g.state.enemies[0];
  g.state.hero.x = slime.x; g.state.hero.z = slime.z;   // chạm ngay
  var heroFlashBefore = g.state.hero.flash;
  var heroEmissiveBefore = g.state.hero.fx.mats[0].emissive.getHex();
  var dmgHeroDomBefore = document.querySelectorAll('#fx .dmg.hero').length;
  g.tick(1 / 60);               // slime touch -> damageHero()
  var heroInfo = {
    flashBefore: heroFlashBefore,
    flashRightAfterHit: g.state.hero.flash,
    emissiveRightAfterHit: g.state.hero.fx.mats[0].emissive.getHex(),
    dmgHeroDomAfterHit: document.querySelectorAll('#fx .dmg.hero').length,
    dmgHeroDomIncreased: document.querySelectorAll('#fx .dmg.hero').length > dmgHeroDomBefore
  };
  for (var fh = 0; fh < 15; fh++) g.tick(1 / 60);   // > hitFlash(0.12s) -> tắt hẳn
  heroInfo.flashAfterWait = g.state.hero.flash;
  heroInfo.emissiveAfterWait = g.state.hero.fx.mats[0].emissive.getHex();
  out.heroHitFlashAndDmgNumber = heroInfo;

  return out;
};
