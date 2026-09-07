/* test_skills.js — [VÒNG D-5] kiểm hệ 4 skill người chơi bấm.
   Chạy ĐỒNG BỘ trong 1 lượt JS (gọi tick() thủ công), không setTimeout.

   Với MỖI skill: dựng lại cụm 5 quái sát hero -> chờ cd = 0 -> cast ->
   tick 0.5s -> đo tổng HP quái tụt. Ngoài ra kiểm:
     - cd sau cast == cdMax, cast lại khi cd > 0 -> false
     - cast khi phase = 'paused' -> false
     - Băng Nổ: quái trong bán kính có slow > 0
     - Mây Độc: HP tụt qua >= 3 nhịp tick 0.5s riêng biệt
     - Sét Xích: không có mục tiêu -> false và KHÔNG tốn cooldown
     - Rò rỉ mesh: groupFx.children trước/sau 20s tick phải bằng nhau

   Chạy: bash tools/run.sh <html> <out.png> <ms> tools/test_skills.js */
window.__runTest = function () {
  var g = window.__game;
  var out = { errors: [] };
  var r3 = function (v) { return Math.round(v * 1000) / 1000; };

  try {
    // Không cho lên cấp (overlay levelup sẽ chặn tick) và không cho hero chết.
    g.CFG.level.thresholds = [1e9, 1e9, 1e9, 1e9];
    g.start();

    // ---- tiện ích ---------------------------------------------------------
    function heroSafe() { g.state.hero.hp = g.state.hero.hpMax; g.state.hero.fireCd = 99; }
    // tick "sạch": vô hiệu auto-fire của hero để damage đo được CHỈ do skill.
    function tickClean(n) {
      for (var i = 0; i < n; i++) {
        heroSafe();
        for (var a = 0; a < g.state.arrows.length; a++) g.state.arrows[a].dmg = 0;
        g.tick(1 / 60);
      }
    }
    // dùng killAll() (đường chết THẬT) để mọi phụ kiện của quái — vd icon băng
    // slow trong groupFx — được dọn đúng như lúc chơi.
    function clearEnemies() { g.killAll(); }
    // 5 quái xếp thành cụm sát hero về phía -Z (phía trên màn hình)
    function setupCluster() {
      clearEnemies();
      g.spawnWave(3);                       // 5 quái (3 bug + 2 slime)
      var h = g.state.hero;
      for (var i = 0; i < g.state.enemies.length; i++) {
        var e = g.state.enemies[i];
        e.x = h.x + ((i % 2) ? 0.45 : -0.45);
        e.z = h.z - (1.2 + i * 0.85);
        e.hp = e.hpMax;
        e.mesh.position.set(e.x, 0, e.z);
        if (e.st) { e.st = 'cool'; e.t = 99; }   // bọ đỏ: đứng yên cho ổn định
      }
      heroSafe();
      return g.state.enemies.slice();
    }
    function totalHP(list) {
      var s = 0;
      for (var i = 0; i < list.length; i++) s += Math.max(0, list[i].hp);
      return s;
    }
    function waitReady(idx) {
      for (var i = 0; i < 60 * 30; i++) {
        if (g.getSkillState()[idx].ready) return true;
        tickClean(1);
      }
      return false;
    }

    var baseFx = g._internal.skillFx().groupFxChildren;

    // ---- cast khi phase != 'playing' --------------------------------------
    g.state.phase = 'paused';
    out.castWhenPaused = g.castSkill(0);          // kỳ vọng false
    g.state.phase = 'playing';

    // ---- Sét Xích khi KHÔNG có mục tiêu -----------------------------------
    clearEnemies();
    out.thunderNoTarget = { cast: g.castSkill(2), cdAfter: r3(g.getSkillState()[2].cd) };

    // ---- lần lượt 4 skill --------------------------------------------------
    var names = ['fire', 'ice', 'thunder', 'poison'];
    out.skills = {};
    for (var s = 0; s < 4; s++) {
      var list = setupCluster();
      if (!waitReady(s)) { out.errors.push('skill ' + names[s] + ' không bao giờ ready'); continue; }
      var hp0 = totalHP(list);
      var cast = g.castSkill(s);
      var st = g.getSkillState()[s];
      var reCast = g.castSkill(s);               // đang cd -> phải false
      tickClean(30);                             // 0.5s
      var rec = {
        cast: cast,
        cdAfterCast: r3(st.cd),
        cdMax: st.cdMax,
        cdIsFull: Math.abs(st.cd - st.cdMax) < 1e-6,
        recastWhileCd: reCast,
        hpBefore: hp0,
        hpAfter: totalHP(list),
        dmgDealt: hp0 - totalHP(list)
      };
      if (names[s] === 'ice') {
        var slowed = 0;
        for (var i = 0; i < list.length; i++) if (list[i].slow > 0) slowed++;
        rec.slowedCount = slowed;
        rec.slowIconCount = (function () { var n = 0; for (var k = 0; k < list.length; k++) if (list[k].slowIcon) n++; return n; })();
      }
      if (names[s] === 'poison') {
        // đo HP tụt theo từng nhịp 0.5s (đã tick 1 nhịp ở trên)
        var steps = [rec.dmgDealt];
        for (var t = 0; t < 6; t++) {
          var h0 = totalHP(list);
          tickClean(30);
          steps.push(h0 - totalHP(list));
        }
        rec.poisonTickDrops = steps;
        rec.poisonTicksWithDamage = steps.filter(function (v) { return v > 0; }).length;
        rec.cloudsAlive = g._internal.skillFx().clouds;
      }
      out.skills[names[s]] = rec;
    }

    // ---- rò rỉ mesh: chạy 20s cho mọi VFX hết đời --------------------------
    // Dọn quái LIÊN TỤC trong suốt 20s: nếu để luồng wave chạy, quái mới sinh
    // ra và có thể đang telegraph -> addRing() bỏ 1 RingGeometry vào groupFx
    // ĐÚNG lúc đếm; đó là vòng đỏ của bọ (có từ MOD-4), KHÔNG phải VFX skill,
    // nên phép đo dao động 14/15/16 mà không phải code skill rò rỉ.
    // (mọi VFX skill đều là PlaneGeometry hoặc Group -> census phân biệt được)
    g.CFG.wave.nextDelay = 1e9;
    clearEnemies();
    for (var lt = 0; lt < 60 * 20; lt++) {
      if (g.state.enemies.length) clearEnemies();
      tickClean(1);
    }
    var fx = g._internal.skillFx();
    out.leak = {
      groupFxBefore: baseFx,
      groupFxAfter: fx.groupFxChildren,
      fxAlive: fx.fx, fireballs: fx.fireballs, clouds: fx.clouds, pending: fx.pending,
      rings: fx.rings, enemiesLeft: fx.enemies, census: fx.groupFxCensus,
      noLeak: fx.groupFxChildren === baseFx && fx.fx === 0 && fx.fireballs === 0 &&
              fx.clouds === 0 && fx.pending === 0 && fx.rings === 0
    };

    // ---- HUD 4 nút ---------------------------------------------------------
    var btns = document.querySelectorAll('#skillBar .skBtn');
    out.hud = { btnCount: btns.length, iconsSet: 0, cdVarSet: 0 };
    for (var b = 0; b < btns.length; b++) {
      var im = btns[b].querySelector('img');
      if (im && im.src && im.src.indexOf('data:image/png') === 0) out.hud.iconsSet++;
      var arc = btns[b].querySelector('.cd');
      if (arc && arc.style.getPropertyValue('--cd') !== '') out.hud.cdVarSet++;
    }

    out.skillStateFinal = g.getSkillState();
  } catch (e) {
    out.errors.push(String((e && e.stack) || e));
  }
  return out;
};
