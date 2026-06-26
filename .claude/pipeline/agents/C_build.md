# AGENT C — BUILD GAME DEMO (agent nặng nhất)

> Đây là agent tốn token nhiều nhất → cho nó đủ thứ để KHÔNG phải đoán, và CHỈ
> đọc text (không đọc video/ảnh gốc). Tái dùng engine template để khỏi sinh lại
> boilerplate three.js mỗi lần.

## INPUT (chỉ text + asset, KHÔNG video/ảnh gameplay)
- `MECHANIC_ORIGINAL.txt`  (từ Agent A)
- `MECHANIC_CHANGES.txt`   (từ Agent B)
- `assets_fbx.js`          (từ `scripts/embed_fbx.js` — KHÔNG tự sinh lại)
- Engine template (khung bất biến): thư mục `jelly3d_src/` gồm:
  - `lib/` (three r136 global, FBXLoader, fflate, NURBS)
  - `game.html` (vỏ UI + CSS)
  - `tools/` (run.sh, drive.js, build_single.js, các test_*.js)
- Template handoff: `templates/BUILD_HANDOFF.txt`

## OUTPUT
- `game_core.js` hoàn chỉnh (TOÀN BỘ logic game ở đây — đây là file C viết chính).
- Nếu cần: chỉnh nhẹ `game.html` (chỉ UI) và CFG.
- 1 file `.html` self-contained qua `node tools/build_single.js`.
- 1 file `BUILD_HANDOFF.txt` điền theo template (để Agent D / session sau dùng).

## RÀNG BUỘC BẮT BUỘC (lấy từ MECHANIC_CHANGES mục D)
- Dùng ĐÚNG 5 asset FBX, KHÔNG tự vẽ thay. Không có texture → màu material thuần.
- KHÔNG convert GLB, KHÔNG dùng Python. FBXLoader.parse nạp trực tiếp trong browser.
- three.js r136 GLOBAL (biến THREE.*, KHÔNG ES module) → đóng gói 1 file bằng nối `<script>`.
- Sản phẩm cuối: 1 file HTML self-contained, mở bằng double-click.
- Tạo lưới màu runtime bằng canvas 2D + 1 InstancedMesh (đổi instanceColor) — nhẹ.

## NHIỆM VỤ
1. Hợp nhất GỐC + DELTA thành mechanic chốt. Với mỗi [ADD/MOD/DEL], ghi chú trong
   code mình áp dụng ở hàm nào.
2. Viết `game_core.js`: CFG (đầu file) + load FBX + sinh level + vòng lặp game.
3. Expose `window.__game` (CFG, state, các hàm test) để Agent D tự động hoá được.
4. Build 1 file qua `build_single.js`, tự chụp 1 ảnh `run.sh` để kiểm tra layout.
5. Viết `BUILD_HANDOFF.txt`.

## NGUYÊN TẮC TIẾT KIỆM TOKEN
- KHÔNG đọc lại video/ảnh gameplay — mọi thứ cần đã nằm trong 2 file `.txt`.
- KHÔNG sinh lại nội dung `lib/`, `tools/`, `assets_fbx.js` — chúng là bất biến.
- Nếu spec mâu thuẫn nhau → DỪNG, hỏi 1 câu gọn, không tự bịa.

## TIÊU CHÍ HOÀN THÀNH
- `run.sh` chụp được ảnh, in `ready=true`.
- Một test kịch bản (vd `test_win.js`) chạy ra `CODE_RESULT` hợp lý.
- File `.html` self-contained mở được, đúng mechanic đã chốt.
