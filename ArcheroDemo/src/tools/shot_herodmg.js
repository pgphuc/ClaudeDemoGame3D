/* shot_herodmg.js — chụp ảnh số damage nổi màu riêng khi HERO trúng đòn
   [ADD-3(a)]. Đóng băng gameplay ngay sau damageHero() (updateTexts() vẫn
   chạy khi paused nên số vẫn fade bình thường, không đứng hình). */
window.__runTest = function () {
  var g = window.__game;
  g.start();
  g.spawnWave(1);           // 3 slime -> gây damage chạm dễ kiểm soát
  var slime = g.state.enemies[0];
  g.state.hero.x = slime.x; g.state.hero.z = slime.z;   // chạm ngay
  g.tick(1 / 60);            // slime touch -> damageHero()
  var info = {
    heroHP: g.state.hero.hp,
    dmgHeroDom: document.querySelectorAll('#fx .dmg.hero').length
  };
  g.state.phase = 'paused';
  return info;
};
