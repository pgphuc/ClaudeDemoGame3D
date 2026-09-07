/* shot_trail.js — chụp ảnh minh hoạ vệt (trail) khi hero di chuyển [ADD-3(b)].
   Đóng băng gameplay (state.phase='paused' trực tiếp, KHÔNG qua api.pause()
   để tránh hiện overlay che màn hình) ngay khi có vệt, chụp đúng khung đó dù
   vòng lặp rAF tự nhiên còn chạy thêm sau khi __runTest return. */
window.__runTest = function () {
  var g = window.__game;
  g.start();
  g.setInput({ up: true, right: true });
  for (var i = 0; i < 25; i++) g.tick(1 / 60);
  var count = g._internal.trailActiveCount();
  g.state.phase = 'paused';
  return { trailActive: count };
};
