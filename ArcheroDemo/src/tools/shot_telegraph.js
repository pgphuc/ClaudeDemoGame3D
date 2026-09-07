/* shot_telegraph.js — chụp ảnh bọ đỏ đang telegraph (vòng cảnh báo + thân
   nháy) [ADD-3(c)]. Đóng băng gameplay ngay giữa telegraph để chụp đúng khung. */
window.__runTest = function () {
  var g = window.__game;
  g.start();
  g.spawnWave(2);
  var bug = null;
  for (var i = 0; i < g.state.enemies.length; i++) {
    if (g.state.enemies[i].type === 'bug') { bug = g.state.enemies[i]; break; }
  }
  var info = { found: !!bug };
  if (bug) {
    bug.x = g.state.hero.x; bug.z = g.state.hero.z + 0.1;
    g.tick(1 / 60);   // chase -> vào tầm -> chuyển 'telegraph' + tạo ring
    g.tick(1 / 60);   // thêm 1 frame cho thân kịp phình (pulse) rõ hơn
    info.state = bug.st;
    info.ring = !!bug.ring;
  }
  g.state.phase = 'paused';
  return info;
};
