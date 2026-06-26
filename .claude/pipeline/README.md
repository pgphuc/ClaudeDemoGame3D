# Pipeline tạo Game Demo bằng Claude (multi-agent, tối ưu token)

Bộ khung này chia việc tạo 1 demo game HTML 3D thành các agent độc lập, mỗi agent
có **input/output riêng** và bàn giao nhau qua file `.txt` — để tiết kiệm token.

> Ý tưởng cốt lõi: **token "vision" (xem video/ảnh) chỉ tốn ĐÚNG 1 LẦN** ở Agent A.
> Mọi agent sau chỉ đọc text. Phần cơ học (nhúng FBX, tách frame) **không dùng LLM**.

---

## 0. Sơ đồ luồng

```
       [5 file .fbx]                 [video .mp4]            [yêu cầu của bạn]
            |                             |                         |
   (script) embed_fbx.js        (script) extract_frames.sh         |
            |                             |                         |
       assets_fbx.js                 frames_*/  ──►  AGENT A    AGENT B
            |                                          |            |
            |                              MECHANIC_ORIGINAL.txt   MECHANIC_CHANGES.txt
            |                                          |            |
            └──────────────┬───────────────────────────┴────────────┘
                           ▼
                       AGENT C  (build)  ──►  game_core.js + Game.html + BUILD_HANDOFF.txt
                           ▼
                       AGENT D  (fix bug, vòng lặp chụp ảnh)  ──►  bản .html cuối
```

- **Cơ học (không LLM):** `scripts/embed_fbx.js`, `scripts/extract_frames.sh`
- **Song song được:** Agent A, B (và bước embed_fbx) chạy độc lập.
- **Tuần tự:** C cần xong A+B; D cần xong C.

---

## 1. Cấu trúc thư mục này

```
.claude/pipeline/
├── README.md                     <- file bạn đang đọc
├── agents/
│   ├── A_analyze_gameplay.md      <- prompt/role Agent A (xem video → spec gốc)
│   ├── B_collect_changes.md       <- prompt/role Agent B (gom thay đổi → delta)
│   ├── C_build.md                 <- prompt/role Agent C (build game)
│   └── D_fix_debug.md             <- prompt/role Agent D (fix bug)
├── templates/
│   ├── MECHANIC_ORIGINAL.txt      <- template output của A
│   ├── MECHANIC_CHANGES.txt       <- template output của B
│   └── BUILD_HANDOFF.txt          <- template output của C/D (overview bàn giao)
└── scripts/
    ├── embed_fbx.js               <- nhúng .fbx → assets_fbx.js (Node)
    └── extract_frames.sh          <- tách .mp4 → ảnh frame (ffmpeg)
```

---

## 2. Chuẩn bị 1 lần (yêu cầu môi trường)

- **Node.js** (đã có Node v24 theo overview) — cho `embed_fbx.js` và `build_single.js`.
- **ffmpeg** trong PATH — cho `extract_frames.sh`. Kiểm tra: `ffmpeg -version`.
  Nếu chưa có: `winget install ffmpeg`.
- **Chrome** ở `C:\Program Files\Google\Chrome\Application\chrome.exe` — cho `run.sh`.
- **Engine template** `jelly3d_src/` (lib three r136 global + tools) — tái dùng từ
  demo Jelly Drop; copy cả thư mục này làm khung khởi đầu cho mỗi game mới.

---

## 3. TEST TỪNG BƯỚC

> Chạy lệnh trong **Git Bash** (trừ phần Node có thể chạy PowerShell). Thay
> `<...>` bằng đường dẫn thật. Dùng đường dẫn **kiểu Windows** `C:/Users/...`.

### Bước 0 — đặt biến đường dẫn (tiện copy)
```bash
ROOT="C:/Users/Admin/Desktop/LevelEditorGuide/demo game"
PIPE="D:/Projects/ProjectDemoGame/.claude/pipeline"
SRC="$ROOT/jelly3d_src"
```

### Bước 1 — (CƠ HỌC) nhúng FBX → assets_fbx.js
```bash
node "$PIPE/scripts/embed_fbx.js" "$ROOT" "$SRC/assets_fbx.js"
```
✅ **PASS khi:** in ra 5 dòng `+ jelly/jar/lid/frame/belt` và `ĐÃ GHI: .../assets_fbx.js`.
❌ Nếu "THIẾU FILE": kiểm tra tên `.fbx` tiếng Việt khớp bảng `ASSET_MAP` trong script.

### Bước 2 — (CƠ HỌC) tách frame video → ảnh
```bash
bash "$PIPE/scripts/extract_frames.sh" "$ROOT/gameplay_1_game_1.mp4" "$ROOT/frames_g1" 1
```
✅ **PASS khi:** in `ĐÃ TÁCH N frame vào ...` và thư mục `frames_g1/` có `frame_001.jpg`...
> Lặp lại cho từng video gameplay bạn muốn phân tích.

### Bước 3 — Agent A: phân tích gameplay
Giao cho 1 agent với role `agents/A_analyze_gameplay.md`.
- **Input đưa vào:** thư mục `frames_g1/`, ảnh `Layout_*.jpg`, template `MECHANIC_ORIGINAL.txt`.
- **Yêu cầu output:** ghi file `$ROOT/MECHANIC_ORIGINAL.txt`.

✅ **PASS khi:** file tồn tại, mọi mục template có nội dung (hoặc ghi "không quan sát
được"), mục 7 liệt kê điểm cần bạn xác nhận. **Bạn đọc & chốt các điểm (suy đoán).**

### Bước 4 — Agent B: gom thay đổi mechanic (song song với Bước 3)
Giao cho 1 agent với role `agents/B_collect_changes.md`.
- **Input:** yêu cầu chỉnh mechanic của bạn (text) + template `MECHANIC_CHANGES.txt`.
- **Output:** file `$ROOT/MECHANIC_CHANGES.txt` (chỉ DELTA, có ID [ADD/MOD/DEL-x]).

✅ **PASS khi:** mỗi thay đổi có ID + lý do; mục D (ràng buộc) và E (không đụng tới)
đã điền. Nếu **không đổi gì** so với gốc → tạo file rỗng chỉ giữ mục D, E.

### Bước 5 — Agent C: build game
Giao cho 1 agent với role `agents/C_build.md`.
- **Input:** `MECHANIC_ORIGINAL.txt` + `MECHANIC_CHANGES.txt` + `assets_fbx.js` + `jelly3d_src/`.
- **Output:** `game_core.js`, build 1 file `.html`, và `BUILD_HANDOFF.txt`.

Kiểm tra thủ công sau khi C báo xong:
```bash
# Chụp ảnh trạng thái đầu (kiểm layout)
bash "$SRC/tools/run.sh" "$SRC/game.html" "$SRC/tools/out.png" 2600 "" 200 460 940
# Chạy 1 kịch bản tới WIN
bash "$SRC/tools/run.sh" "$SRC/game.html" "$SRC/tools/win.png" 800 "$SRC/tools/test_win.js" 300
# Đóng gói 1 file
node "$SRC/tools/build_single.js" "$SRC" "$ROOT/Game.html"
```
✅ **PASS khi:** `run.sh` in `ready=true`; ảnh `out.png` đúng layout; `test_win.js` in
`CODE_RESULT: {won:true,...}`; mở `Game.html` (double-click) chơi được.
❌ **Bẫy đường dẫn:** nếu `ERR_FILE_NOT_FOUND` → đang truyền `/c/Users/...`; phải là `C:/Users/...`.

### Bước 6 — Agent D: fix bug & tinh chỉnh
Giao cho 1 agent với role `agents/D_fix_debug.md`.
- **Input:** `jelly3d_src/`, `BUILD_HANDOFF.txt`, mô tả bug (text hoặc ảnh lỗi).
- **Output:** code đã sửa + build lại + cập nhật `BUILD_HANDOFF.txt`.

✅ **PASS khi:** Agent D đưa được **bằng chứng ảnh trước/sau** hoặc `CODE_RESULT`
chứng minh bug hết; KHÔNG chấp nhận tuyên bố "đã fix" mà không có ảnh/test.

---

## 4. Checklist tổng (in ra mà tick)

- [ ] B1 `assets_fbx.js` sinh ra, đủ 5 asset.
- [ ] B2 frame video tách xong.
- [ ] B3 `MECHANIC_ORIGINAL.txt` đầy đủ, đã chốt các điểm suy đoán.
- [ ] B4 `MECHANIC_CHANGES.txt` có ID + ràng buộc.
- [ ] B5 `run.sh` ready=true, layout đúng, test_win `won:true`, `Game.html` mở được.
- [ ] B6 Bug fix có bằng chứng ảnh/test, handoff cập nhật.

---

## 5. Vì sao cách này tiết kiệm token (tóm tắt)

1. **Vision 1 lần:** chỉ Agent A xem ảnh; A → text; các agent sau đọc text → rẻ.
2. **Việc cơ học bỏ khỏi LLM:** nhúng FBX & tách frame là script, không tốn token agent.
3. **DELTA thay vì copy:** Agent B chỉ ghi phần khác (GỐC + DELTA), không lặp lại.
4. **Engine template bất biến:** Agent C không sinh lại three.js/harness; chỉ viết logic.
5. **Handoff `.txt` chuẩn hoá:** mỗi agent nhận đúng file mình cần parse, không đọc thừa.
6. **Fix có vòng lặp ảnh:** Agent D đọc đúng phần code liên quan, không quét cả repo.

---

## 6. Mở rộng cho game KHÁC (không chỉ Jelly Drop)

- Đổi bảng `ASSET_MAP` trong `embed_fbx.js` cho bộ FBX mới.
- Copy `jelly3d_src/` làm template khởi đầu; Agent C viết lại `game_core.js` theo
  spec mới nhưng giữ nguyên `lib/` + `tools/`.
- Mỗi game giữ 1 bộ 3 file `.txt` riêng (ORIGINAL / CHANGES / HANDOFF) cạnh source.
```
