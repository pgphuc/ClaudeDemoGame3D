/*
 * embed_fbx.js  —  PHẦN CƠ HỌC, KHÔNG CẦN AGENT/LLM.
 * --------------------------------------------------------------------------
 * Nhúng 5 file .fbx (ASCII) thành base64 -> sinh ra assets_fbx.js dạng:
 *     window.FBX = { jelly, jar, lid, frame, belt };   // mỗi giá trị là base64
 *
 * Trong game, FBXLoader nạp trực tiếp trong browser (KHÔNG convert GLB,
 * KHÔNG cần Python). Cách decode phía game (tham khảo, đặt trong game_core.js):
 *
 *     function loadFBX(b64){
 *       const bin = atob(b64);
 *       const buf = new ArrayBuffer(bin.length);
 *       const view = new Uint8Array(buf);
 *       for (let i=0;i<bin.length;i++) view[i] = bin.charCodeAt(i) & 0xff;
 *       return new THREE.FBXLoader().parse(buf, '');   // FBX ASCII vẫn parse OK
 *     }
 *
 * CÁCH CHẠY:
 *     node embed_fbx.js "<thư-mục-chứa-fbx>" "<đường-dẫn-assets_fbx.js-output>"
 * Ví dụ:
 *     node embed_fbx.js "D:/Projects/ProjectDemoGame/SandDropDemo/Assets" \
 *                       "D:/Projects/ProjectDemoGame/SandDropDemo/src/assets_fbx.js"
 * --------------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');

// Map: tên key trong window.FBX  ->  tên file .fbx gốc.
// Nếu bạn đổi tên asset, chỉ cần sửa bảng này.
// ArcheroDemo VÒNG D-3: tên file THỰC TẾ do user export từ Unity (FBX Exporter,
// Binary). Thiếu file -> BỎ QUA (game dùng primitive fallback qua AssetLoader),
// không exit. KHÔNG có wall.fbx -> luôn bị bỏ qua (đúng như trước).
// [VÒNG D-3b] BỎ 'floor' khỏi ASSET_MAP: Mesh_ShenMiaoRoom_13x25.fbx là 1 tranh
// nguyên phòng KHÔNG lát được (xem BUILD_HANDOFF nhật ký D-3b) — sàn quay lại
// plane primitive, texture crop từ floor.png dựng runtime trong game_core.js.
// KHÔNG xoá floor.fbx khỏi Assets/, chỉ không nhúng nữa (giảm ~1.3 MB).
const ASSET_MAP = {
  hero:           'HeroKuLou.fbx',
  monster_flower: 'ShiRenHua_Skin.fbx',
  monster_bug:    'ShaChong_Skin.fbx',
  monster_slime:  'Slime_Skin.fbx',
  arrow:          'arrow_normal.fbx',
  wall:           'wall.fbx',
};

// [VÒNG D-3] Texture PNG/JPG đã đổi tên theo vai trò (<key>.png / <key>.jpg)
// nằm cùng thư mục Assets. Có thì nhúng base64 data URI vào window.FBX_TEX[key]
// để game_core.js gán qua FBXLoader.setURLModifier(); không có thì bỏ qua
// (giữ nguyên hành vi cũ — không lỗi).
// [VÒNG D-3b] TEX_KEYS tách RIÊNG khỏi ASSET_MAP: 'floor' không còn .fbx nhưng
// floor.png VẪN PHẢI nhúng (dùng làm crop texture runtime cho sàn primitive) —
// nếu lặp theo Object.keys(ASSET_MAP) như cũ sẽ BỎ SÓT floor.png vì 'floor' đã
// bị xoá khỏi ASSET_MAP ở trên.
// [VÒNG D-5] Thêm icon 4 skill (skill_*) + texture VFX (vfx_*) crop/copy từ
// Archero2_Sources — chỉ là texture, không có .fbx đi kèm.
const TEX_KEYS = ['hero', 'monster_flower', 'monster_bug', 'monster_slime', 'arrow', 'floor', 'wall',
  'skill_fire', 'skill_ice', 'skill_thunder', 'skill_poison',
  'vfx_trail_fire', 'vfx_trail_ice', 'vfx_trail_thunder', 'vfx_trail_poison',
  'vfx_ring', 'vfx_bolt', 'vfx_spark', 'vfx_glow',
  'vfx_mask_fire', 'vfx_mask_ice', 'vfx_mask_thunder', 'vfx_mask_poison'];
const TEX_EXTS = ['.png', '.jpg', '.jpeg'];
const TEX_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

function main() {
  const srcDir = process.argv[2];
  const outFile = process.argv[3];
  if (!srcDir || !outFile) {
    console.error('Dùng: node embed_fbx.js "<thư-mục-fbx>" "<output assets_fbx.js>"');
    process.exit(1);
  }

  const out = {};
  let totalBytes = 0;
  for (const [key, fname] of Object.entries(ASSET_MAP)) {
    const fpath = path.join(srcDir, fname);
    if (!fs.existsSync(fpath)) {
      console.warn(`  - ${key.padEnd(14)} THIẾU: ${fname} (bỏ qua, game dùng primitive fallback)`);
      continue;
    }
    const buf = fs.readFileSync(fpath);
    out[key] = buf.toString('base64');
    totalBytes += buf.length;
    console.log(`  + ${key.padEnd(14)} <- ${fname}  (${(buf.length/1024).toFixed(0)} KB)`);
  }

  const outTex = {};
  let totalTexBytes = 0;
  for (const key of TEX_KEYS) {
    let found = null, ext = null;
    for (const e of TEX_EXTS) {
      const p = path.join(srcDir, key + e);
      if (fs.existsSync(p)) { found = p; ext = e; break; }
    }
    if (!found) continue;
    const buf = fs.readFileSync(found);
    outTex[key] = `data:${TEX_MIME[ext]};base64,${buf.toString('base64')}`;
    totalTexBytes += buf.length;
    console.log(`  + tex ${key.padEnd(10)} <- ${path.basename(found)}  (${(buf.length/1024).toFixed(0)} KB)`);
  }

  // Sinh file JS. Mỗi base64 nằm trên 1 dòng để dễ diff/đọc.
  let js = '/* AUTO-GENERATED bởi embed_fbx.js — KHÔNG sửa tay. */\n';
  js += 'window.FBX = {\n';
  for (const key of Object.keys(out)) {
    js += `  ${key}: ${JSON.stringify(out[key])},\n`;
  }
  js += '};\n';
  js += 'window.FBX_TEX = {\n';
  for (const key of Object.keys(outTex)) {
    js += `  ${key}: ${JSON.stringify(outTex[key])},\n`;
  }
  js += '};\n';

  fs.writeFileSync(outFile, js, 'utf8');
  console.log(`\nĐÃ GHI: ${outFile}`);
  console.log(`Tổng FBX gốc: ${(totalBytes/1024/1024).toFixed(2)} MB | Tổng texture gốc: ${(totalTexBytes/1024/1024).toFixed(2)} MB | assets_fbx.js: ${(js.length/1024/1024).toFixed(2)} MB`);
}

main();
