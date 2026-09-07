/* test_shot_wave2.js — tiện ích tạm (Agent D vòng D-4) chỉ để CHỤP ẢNH giữa
   wave 2 (có bọ đỏ + hoa quái) làm mốc so sánh trước/sau ADD-3. KHÔNG phải
   test chính thức, không cần giữ lại lâu dài.
   Chạy: bash tools/run.sh <html> <out.png> <ms> tools/test_shot_wave2.js */
window.__runTest = function () {
  var g = window.__game;
  g.start();
  var steps = 0;
  while (steps < 60 * 60 && g.state.wave < 2) {
    if (g.state.phase === 'levelup') { g.chooseCard(0); continue; }
    if (g.state.phase !== 'playing') break;
    g.tick(1 / 60);
    steps++;
  }
  // để vài quái bọ/hoa còn sống, chỉ giết bớt 1 con cho có XP rồi dừng lại
  // giữa chừng wave 2 (không killAll để giữ bọ + hoa trên màn hình)
  // [VÒNG D-3b] guard levelup: hero lớn hơn không đổi combat, nhưng nếu XP
  // vượt ngưỡng ngay trong đoạn tick cuối này thì overlay "TĂNG CẤP!" sẽ che
  // hết màn hình lúc chụp ảnh — tự chọn card đầu tiên để ảnh luôn sạch.
  for (var i = 0; i < 20; i++) {
    if (g.state.phase === 'levelup') { g.chooseCard(0); continue; }
    g.tick(1 / 60);
  }
  // tick cuối cùng của vòng trên có thể VỪA đẩy state sang 'levelup' (không
  // còn lượt lặp nào để xử lý) -> kiểm thêm 1 lần chắc chắn trước khi trả về.
  if (g.state.phase === 'levelup') g.chooseCard(0);
  // [VÒNG D-3b] ĐÓNG BĂNG trực tiếp (không qua api.pause() để khỏi hiện
  // overlay "TẠM DỪNG"): vòng lặp rAF TỰ NHIÊN của game vẫn chạy độc lập với
  // các g.tick() thủ công ở trên trong suốt phần --virtual-time-budget CÒN
  // LẠI (screenshot chụp ở CUỐI budget, không phải ngay sau khi script này
  // return) — nếu không đóng băng, hero có thể tiếp tục auto-fire giết thêm
  // quái wave2, đủ XP lên cấp NGAY LÚC CHỤP dù CODE_RESULT (đọc sớm hơn, qua
  // dump-dom) vẫn báo xp=3/level=1 — gây lệch ảnh chụp vs CODE_RESULT.
  g.state.phase = 'paused';
  return {
    wave: g.state.wave,
    enemiesAlive: g.state.enemies.length,
    types: g.state.enemies.map(function (e) { return e.type; }),
    steps: steps,
    xp: g.state.xp, level: g.state.level, kills: g.state.kills, phase: g.state.phase
  };
};
