/* shot_hud_cd.js — [VÒNG D-5] chụp 4 nút skill ở 4 mức cooldown KHÁC NHAU:
   cast lần lượt cách nhau vài giây để mỗi nút có góc quét radial + số giây
   còn lại khác nhau. */
window.__runTest = function () {
  var g = window.__game;
  g.CFG.level.thresholds = [1e9, 1e9, 1e9, 1e9];
  g.start();
  var h = g.state.hero;
  g.spawnWave(3);
  for (var i = 0; i < g.state.enemies.length; i++) {
    var e = g.state.enemies[i];
    e.x = h.x + ((i % 2) ? 0.5 : -0.5);
    e.z = h.z - (1.3 + i * 0.9);
    e.mesh.position.set(e.x, 0, e.z);
    if (e.st) { e.st = 'cool'; e.t = 99; }
  }
  function run(n) {
    for (var t = 0; t < n; t++) {
      g.state.hero.hp = g.state.hero.hpMax;
      for (var k = 0; k < g.state.enemies.length; k++) g.state.enemies[k].hp = g.state.enemies[k].hpMax;
      g.tick(1 / 60);
    }
  }
  var casts = [];
  casts.push(g.castSkill(0)); run(150);   // 2.5s
  casts.push(g.castSkill(1)); run(90);    // 1.5s
  casts.push(g.castSkill(2)); run(60);    // 1.0s
  casts.push(g.castSkill(3)); run(12);    // 0.2s
  var st = g.getSkillState();
  g.state.phase = 'paused';
  return { casts: casts, skillState: st };
};
