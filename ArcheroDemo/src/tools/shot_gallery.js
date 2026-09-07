/* shot_gallery.js — [VÒNG D-3b] xếp 5 asset (hero, flower, bug, slime, arrow)
   thành 1 hàng ngang giữa phòng để user duyệt hình + hướng mặt. Mỗi asset có
   1 khối nhỏ màu VÀNG đặt ở phía +Z (forward theo quy ước game) trước mặt nó.
   Camera zoom 1.6x CHỈ trong script này (KHÔNG đổi game_core.js/CFG.camera).
   KHÔNG tick gameplay (tránh auto-fire/lên cấp/spawn wave mới trong lúc chụp):
   xoá enemy wave1 TRỰC TIẾP (không qua killAll()->gainXP), đóng băng
   state.phase='paused' TRỰC TIẾP (không qua api.pause() để khỏi hiện overlay
   "TẠM DỪNG") — camera đã ở camZ=0 sẵn từ lúc initThree(), không cần chờ
   camera follow bằng tick(). render() vẫn chạy mỗi rAF frame dù phase=paused
   (chỉ tick() logic bị bỏ qua) nên Chrome vẫn chụp được cảnh tĩnh này.
   Chạy: bash tools/run.sh <html> shots/r3b_gallery.png <ms> tools/shot_gallery.js "" */
window.__runTest = function () {
  var g = window.__game;
  g.start();

  // Xoá enemy wave1 TRỰC TIẾP khỏi scene + state (KHÔNG qua killAll()/gainXP)
  // để KHÔNG lên cấp / không đổi XP.
  g.state.enemies.forEach(function (e) { if (e.mesh.parent) e.mesh.parent.remove(e.mesh); });
  g.state.enemies.length = 0;

  // Ẩn hero thật, đóng băng gameplay (không overlay).
  g.state.hero.mesh.visible = false;
  g.state.phase = 'paused';

  // Đặt camera TRỰC TIẾP về camZ=0 (không dựa vào biến camZ nội bộ — trang đã
  // chạy sẵn 1 vòng start() lúc boot() nên camera có thể đã lerp theo hero
  // spawn z~15 trước khi __runTest tới lượt chạy). Công thức y hệt
  // applyCamera() trong game_core.js, chỉ ép camZ=0.
  var cam = g._internal.camera;
  var tilt = g.CFG.camera.tiltDeg * Math.PI / 180;
  cam.position.set(0, g.CFG.camera.dist * Math.cos(tilt), g.CFG.camera.dist * Math.sin(tilt));
  cam.lookAt(0, 0, 0);
  cam.zoom = 1.6;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);

  var Assets = g._internal.Assets;
  var scene = g._internal.scene;
  var keys = ['hero', 'monster_flower', 'monster_bug', 'monster_slime', 'arrow'];
  var spacing = 1.4;
  var startX = -spacing * (keys.length - 1) / 2;
  var markerGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  var markerMat = new THREE.MeshStandardMaterial({ color: 0xffe000, emissive: 0x554400 });

  var placed = [];
  keys.forEach(function (k, i) {
    var x = startX + i * spacing;
    var m = Assets.make(k);
    m.position.set(x, 0, 0);
    m.rotation.y = 0;   // forward = +Z theo quy ước game (atan2(dx,dz)=0 khi dz>0)
    scene.add(m);
    var marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(x, 0.25, 0.9);   // đặt ở +Z phía trước model, đủ xa để không lẫn vào thân
    scene.add(marker);
    placed.push({ key: k, x: x });
  });

  return {
    placed: placed,
    note: 'moi asset dat tai x nhu tren, z=0, rotation.y=0 (forward=+Z). ' +
          'Khoi vang dat tai z=+0.9 (phia +Z, "truoc mat" model). ' +
          'zoom=1.6 (chi trong script). KHONG tick gameplay.'
  };
};
