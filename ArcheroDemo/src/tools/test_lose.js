/* test_lose.js — kịch bản THUA:
   đặt damage đạn hero = 0 (hero bắn nhưng không giết được ai), hero đứng yên
   không di chuyển -> quái tiếp cận và đánh chết hero. Kỳ vọng phase='lost'. */
window.__runTest = function () {
  var g = window.__game;
  g.CFG.arrow.damage = 0;
  g.start();
  g.setInput({ up: false, down: false, left: false, right: false });

  var steps = 0, MAX = 60 * 120;      // trần 120 giây mô phỏng
  while (steps < MAX) {
    var ph = g.state.phase;
    if (ph === 'lost' || ph === 'won') break;
    if (ph === 'levelup') { g.chooseCard(0); continue; }
    g.tick(1 / 60);
    steps++;
  }

  var s = g.getSnapshot();
  return {
    lost: s.phase === 'lost',
    phase: s.phase,
    wave: s.wave,
    heroHP: s.heroHP,
    enemiesAlive: s.enemiesAlive,
    steps: steps,
    simSeconds: Math.round(steps / 60 * 10) / 10
  };
};
