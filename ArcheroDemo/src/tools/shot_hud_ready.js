/* shot_hud_ready.js — [VÒNG D-5] chụp cụm 4 nút skill ở trạng thái SẴN SÀNG
   (viền vàng sáng, không có lớp quét cooldown, không có số giây). */
window.__runTest = function () {
  var g = window.__game;
  g.start();
  for (var t = 0; t < 20; t++) g.tick(1 / 60);
  var st = g.getSkillState();
  g.state.phase = 'paused';
  return { skillState: st, allReady: st.every(function (s) { return s.ready; }) };
};
