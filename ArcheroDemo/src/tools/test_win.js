/* test_win.js — kịch bản THẮNG:
   start -> mỗi frame killAll() + tick() cho tới khi qua đủ 5 wave;
   gặp phase='levelup' thì tự chọn card. Kỳ vọng phase='won'. */
window.__runTest = function () {
  var g = window.__game;
  g.start();

  var steps = 0, MAX = 60 * 180;      // trần 180 giây mô phỏng
  var picks = 0, PICK_MAX = 40;
  while (steps < MAX) {
    var ph = g.state.phase;
    if (ph === 'won' || ph === 'lost') break;
    if (ph === 'levelup') {
      if (picks++ > PICK_MAX) break;
      g.chooseCard(0);
      continue;
    }
    g.killAll();
    g.tick(1 / 60);
    steps++;
  }

  var s = g.getSnapshot();
  return {
    won: s.phase === 'won',
    wave: s.wave,
    phase: s.phase,
    level: s.level,
    heroHP: s.heroHP,
    enemiesAlive: s.enemiesAlive,
    cardPicks: picks,
    steps: steps
  };
};
