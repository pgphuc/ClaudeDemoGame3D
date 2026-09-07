/* shot_skill_thunder.js — [VÒNG D-5] chụp VFX skill "thunder".
   Dựng 5 quái sát hero -> cast -> tick tới đúng khung VFX rõ nhất -> đóng băng
   (state.phase='paused' TRỰC TIẾP, không qua api.pause() để khỏi hiện overlay)
   nên vòng rAF chạy thêm sau khi __runTest return không làm lệch ảnh. */
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
  for (var w = 0; w < 2; w++) g.tick(1 / 60);
  var cast = g.castSkill(2);
  for (var t = 0; t < 12; t++) { g.state.hero.hp = g.state.hero.hpMax; g.tick(1 / 60); }
  var fx = g._internal.skillFx();
  g.state.phase = 'paused';
  return { skill: 'thunder', cast: cast, fxAlive: fx.fx, fireballs: fx.fireballs,
           clouds: fx.clouds, enemies: g.state.enemies.length,
           skillState: g.getSkillState()[2] };
};
