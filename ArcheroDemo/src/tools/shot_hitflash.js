/* shot_hitflash.js — chụp ảnh quái đang nháy sáng (hit flash) đúng frame vừa
   trúng đòn [ADD-3(d)]. Đóng băng gameplay ngay khi flash vừa bật.
   Dùng reset() (KHÔNG start()) để tránh wave 1 (3 slime) spawn chồng lên
   wave 2; đẩy các quái khác ra thật xa và đặt hoa/hero gần tâm khung hình
   (x=0, cách nhau 2 unit) để hero auto-fire trúng ngay và ảnh rõ ràng,
   không phụ thuộc vị trí spawn ngẫu nhiên. */
window.__runTest = function () {
  var g = window.__game;
  g.reset();
  g.spawnWave(2);
  var flower = null;
  for (var i = 0; i < g.state.enemies.length; i++) {
    if (g.state.enemies[i].type === 'flower') { flower = g.state.enemies[i]; break; }
  }
  var info = { found: !!flower };
  if (flower) {
    // gỡ hẳn quái khác khỏi state.enemies (KHÔNG chỉ đẩy toạ độ — clampToRoom()
    // trong updateEnemies() sẽ kéo chúng về lại trong phòng mỗi tick) để khung
    // hình chỉ còn đúng 1 hoa quái, không có gì che/lấp góc ảnh.
    for (var j = g.state.enemies.length - 1; j >= 0; j--) {
      var eo = g.state.enemies[j];
      if (eo !== flower) {
        if (eo.mesh.parent) eo.mesh.parent.remove(eo.mesh);
        g.state.enemies.splice(j, 1);
      }
    }
    flower.x = 0; flower.z = 4; flower.mesh.position.set(0, 0, 4);
    g.state.hero.x = 0; g.state.hero.z = 0;   // đứng cách hoa 4 unit, x=0 để camera canh giữa
    g.state.hero.fireCd = 0.3;   // hoãn phát bắn đầu ~0.3s để camera kịp bám theo vị trí mới
    g.setInput({ up: false, down: false, left: false, right: false });
    var hit = false, t;
    for (t = 0; t < 180 && !hit; t++) {
      g.tick(1 / 60);
      if (flower.flash > 0) hit = true;
    }
    info.ticksUsed = t;
    info.flash = flower.flash;
    info.flowerHp = flower.hp;
  }
  g.state.phase = 'paused';
  return info;
};
