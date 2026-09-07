/* =============================================================================
 * build_single.js — gộp game.html + mọi <script src> thành 1 file .html
 * self-contained (mở bằng double-click, không cần server, không cần CDN).
 *
 *   node tools/build_single.js <srcDir> <out.html>
 * Ví dụ:
 *   node tools/build_single.js "D:/Project/ClaudeDemoGame3D/ArcheroDemo/src" \
 *                              "D:/Project/ClaudeDemoGame3D/ArcheroDemo/ArcheroDemo.html"
 * KHÔNG dùng npm package.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

function main() {
  const srcDir = process.argv[2];
  const outFile = process.argv[3];
  if (!srcDir || !outFile) {
    console.error('Dùng: node build_single.js "<srcDir>" "<out.html>"');
    process.exit(1);
  }

  const htmlPath = path.join(srcDir, 'game.html');
  if (!fs.existsSync(htmlPath)) {
    console.error('Không thấy ' + htmlPath); process.exit(1);
  }
  let html = fs.readFileSync(htmlPath, 'utf8');

  const re = /<script\s+src=["']([^"']+)["']\s*>\s*<\/script>/gi;
  let total = 0, count = 0;
  html = html.replace(re, function (m, src) {
    if (/^https?:/i.test(src)) {
      console.warn('  ! Bỏ qua script từ xa (không được phép): ' + src);
      return m;
    }
    const p = path.join(srcDir, src);
    if (!fs.existsSync(p)) {
      console.warn('  ! Thiếu file: ' + p + ' (giữ nguyên thẻ)');
      return m;
    }
    let code = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
    // Chống việc chuỗi "</script>" bên trong code làm đứt thẻ script
    code = code.replace(/<\/script>/gi, '<\\/script>');
    total += code.length; count++;
    console.log('  + inline ' + src + ' (' + code.length + ' ký tự)');
    return '<script>\n/* ==== ' + src + ' ==== */\n' + code + '\n</script>';
  });

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, 'utf8');
  console.log('OK: ' + outFile + '  (' + count + ' script inline, ' +
              Math.round(fs.statSync(outFile).size / 1024) + ' KB)');
}

main();
