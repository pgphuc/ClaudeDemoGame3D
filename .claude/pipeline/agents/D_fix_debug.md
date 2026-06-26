# AGENT D — FIX BUG & TINH CHỈNH (cần "mắt" để thấy kết quả)

> Sửa game đồ hoạ mà không nhìn được kết quả thì mù. Agent D BẮT BUỘC dùng vòng
> lặp: chạy → chụp ảnh → đọc ảnh → sửa → chụp lại.

## INPUT
- Source `jelly3d_src/` (đặc biệt `game_core.js`).
- `BUILD_HANDOFF.txt` (biết mechanic đã chốt + CFG + cách build/test).
- Mô tả bug / yêu cầu chỉnh của người dùng (text, hoặc ảnh chụp lỗi).
- Harness test: `tools/run.sh`, `tools/drive.js`, các `tools/test_*.js`.

## OUTPUT
- `game_core.js` (và/hoặc `game.html`, CFG) đã sửa.
- File `.html` self-contained build lại.
- Cập nhật `BUILD_HANDOFF.txt`: ghi bug đã fix + thay đổi CFG (mục giới hạn/việc tiếp).

## VÒNG LẶP BẮT BUỘC (visual feedback loop)
1. Tái hiện bug: chạy `run.sh` (hoặc 1 `test_*.js`) → chụp `out.png`.
2. ĐỌC ảnh/`CODE_RESULT` để xác nhận triệu chứng.
3. Sửa nhỏ trong `game_core.js`. Ưu tiên chỉnh CFG trước khi đổi logic.
4. Build lại + chụp lại. So sánh trước/sau.
5. Lặp tới khi hết bug. KHÔNG tuyên bố "đã fix" nếu chưa thấy bằng chứng ảnh/test.

## CÁC BẪY ĐÃ BIẾT (đọc trước khi chạy)
- Đường dẫn Git Bash: `run.sh` cần đường dẫn kiểu Windows `C:/Users/...`, KHÔNG
  phải `/c/Users/...` (nếu không Chrome báo ERR_FILE_NOT_FOUND).
- Headless dùng swiftshader (software GL) → CHẬM. Nếu nặng, đặt
  `window.__NOSHADOW=true` trước `start()` khi chụp.
- `collideFallers` là O(n^2): thả hàng trăm cube 1 lúc sẽ nặng; chơi tay thì nhẹ.

## NGUYÊN TẮC TIẾT KIỆM TOKEN
- Mỗi lần chỉ sửa 1 nhóm nguyên nhân, rồi mới chụp lại — tránh sửa lan man.
- Chỉ đọc đúng phần code liên quan bug (grep theo tên hàm trong handoff), không
  đọc lại cả file nếu không cần.

## TIÊU CHÍ HOÀN THÀNH
Bug được chứng minh đã hết bằng ảnh hoặc `CODE_RESULT`; handoff cập nhật; file
`.html` cuối build lại thành công.
