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

// Map: tên key trong window.FBX  ->  tên file .fbx gốc (đúng tên tiếng Việt).
// Nếu bạn đổi tên asset, chỉ cần sửa bảng này.
const ASSET_MAP = {
  jelly: 'Jelly cube.fbx',
  jar:   'Lọ.fbx',
  lid:   'Nắp lọ.fbx',
  frame: 'Khung tranh.fbx',
  belt:  'Băng chuyền.fbx',
};

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
      console.error(`THIẾU FILE: ${fpath}`);
      process.exit(2);
    }
    const buf = fs.readFileSync(fpath);
    out[key] = buf.toString('base64');
    totalBytes += buf.length;
    console.log(`  + ${key.padEnd(6)} <- ${fname}  (${(buf.length/1024).toFixed(0)} KB)`);
  }

  // Sinh file JS. Mỗi base64 nằm trên 1 dòng để dễ diff/đọc.
  let js = '/* AUTO-GENERATED bởi embed_fbx.js — KHÔNG sửa tay. */\n';
  js += 'window.FBX = {\n';
  for (const key of Object.keys(out)) {
    js += `  ${key}: ${JSON.stringify(out[key])},\n`;
  }
  js += '};\n';

  fs.writeFileSync(outFile, js, 'utf8');
  console.log(`\nĐÃ GHI: ${outFile}`);
  console.log(`Tổng FBX gốc: ${(totalBytes/1024/1024).toFixed(2)} MB | assets_fbx.js: ${(js.length/1024/1024).toFixed(2)} MB`);
}

main();
