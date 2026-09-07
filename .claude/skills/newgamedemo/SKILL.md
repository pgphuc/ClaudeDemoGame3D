---
name: newgamedemo
description: Khởi động pipeline multi-agent tạo demo game HTML 3D từ video/ảnh gameplay (Agent A→B→C, sau đó Agent D khi có bug). Dùng khi user gõ /newgamedemo để bắt đầu 1 demo game mới, hoặc để tiếp tục vòng fix bug của 1 demo đã build bằng pipeline này.
---

# /newgamedemo — orchestrate pipeline tạo demo game

Đây là skill điều phối bộ pipeline có sẵn tại `.claude/pipeline/` (xem `README.md` ở
đó để hiểu đầy đủ triết lý: chỉ Agent A tốn token "vision", các agent sau chỉ đọc
text). Skill này KHÔNG lặp lại nội dung các file agent — nó ra lệnh cho bạn (Claude)
đọc và dùng đúng các file đó khi spawn subagent.

File tham chiếu bắt buộc phải đọc trước khi hành động (nếu chưa có trong context):
- `.claude/pipeline/config.sh` — biến đường dẫn `ROOT/ASSETS/REFS/DOCS/SRC/PIPE`
- `.claude/pipeline/agents/A_analyze_gameplay.md`
- `.claude/pipeline/agents/B_collect_changes.md`
- `.claude/pipeline/agents/C_build.md`
- `.claude/pipeline/agents/D_fix_debug.md`
- `.claude/pipeline/templates/*.txt`

Xác định trạng thái hiện tại trước: nếu user gõ `/newgamedemo` mà một demo đã có
`BUILD_HANDOFF.txt` và họ đang mô tả bug/điều muốn chỉnh → nhảy thẳng tới **Bước 5
(Agent D)**, không chạy lại A/B/C. Nếu là project/demo mới hoặc chưa có
`MECHANIC_ORIGINAL.txt` → chạy từ Bước 1.

## Bước 1 — Hỏi user đủ thông tin cho Agent A + B chạy song song

KHÔNG tự đoán đường dẫn hay bịa nội dung. Hỏi trực tiếp (hoặc dùng
AskUserQuestion nếu lựa chọn rời rạc) cho tới khi có đủ:

1. **Project root**: dùng project hiện có (đọc `ROOT` trong `config.sh`) hay tạo
   project demo mới? Nếu mới — tên thư mục, đặt ở đâu dưới
   `D:/Projects/ProjectDemoGame/`. Cấu trúc con bắt buộc: `Assets/`, `Refs/`,
   `Docs/`, `src/` (như mô tả ở README mục 3, Bước 0).
2. **Video gameplay gốc** (`.mp4`) đã đặt trong `Refs/` chưa — đường dẫn cụ thể.
   Nếu có nhiều video/nhiều màn, cần rõ mỗi video ứng với gì.
3. **Ảnh layout tham chiếu** (vd `Layout_*.jpg`) trong `Refs/`, nếu có.
4. **Bộ asset FBX** (thường 5 file) và mapping vai trò của chúng (map theo
   `ASSET_MAP` trong `scripts/embed_fbx.js` — hỏi rõ nếu bộ asset khác 5 loại
   jelly/jar/lid/frame/belt hiện có, vì Agent C sẽ ràng buộc CHỈ dùng đúng asset
   có sẵn, không tự vẽ thêm).
5. **Yêu cầu thay đổi mechanic** so với gameplay gốc trong video (input trực tiếp
   cho Agent B) — có thể là "không đổi gì, giữ y nguyên gameplay gốc".

Chỉ tiếp tục sang Bước 2 khi cả 5 mục trên đã rõ ràng.

## Bước 2 — Chuẩn bị cơ học (KHÔNG spawn agent, tự làm bằng Bash)

Đây là phần "không dùng LLM" theo README — bạn tự chạy trực tiếp:

1. Nếu là project mới: tạo cấu trúc thư mục, copy engine template
   `jelly3d_src/` vào `$SRC` (xem README Bước 0b), và nếu cần, sửa `ROOT` trong
   `config.sh` (hoặc tạo bản `config.sh` riêng cho project mới — hỏi user muốn
   cách nào nếu không hiển nhiên).
2. `node "$PIPE/scripts/embed_fbx.js" "$ASSETS" "$SRC/assets_fbx.js"`
3. `bash "$PIPE/scripts/extract_frames.sh" "<video.mp4>" "$DOCS/frames_xxx" 1`
   (lặp cho mỗi video liên quan)

Xác nhận PASS theo tiêu chí ở README (Bước 1, Bước 2) trước khi sang Agent A/B.

## Bước 3 — Chạy Agent A và Agent B SONG SONG

Gửi **một message với hai lời gọi Agent tool cùng lúc** (không tuần tự) — đây là
điểm mấu chốt của bước này:

- **Agent A** (`subagent_type: general-purpose`): prompt = nội dung
  `agents/A_analyze_gameplay.md` + đường dẫn tuyệt đối cụ thể tới thư mục frame,
  ảnh layout, và nơi ghi output `MECHANIC_ORIGINAL.txt`. Nhắc rõ: chỉ agent này
  được xem ảnh; phải điền hết template `templates/MECHANIC_ORIGINAL.txt`, đánh
  dấu **(suy đoán)** và liệt kê điểm cần xác nhận ở mục 7.
- **Agent B** (`subagent_type: general-purpose`): prompt = nội dung
  `agents/B_collect_changes.md` + yêu cầu thay đổi mechanic user vừa cung cấp ở
  Bước 1 (mục 5) + đường dẫn ghi output `MECHANIC_CHANGES.txt`. Nhắc rõ: KHÔNG
  chép lại mechanic gốc, chỉ ghi delta có ID.

Đợi cả hai notification hoàn thành trước khi sang bước 4. Nếu Agent A liệt kê
điểm cần user xác nhận (mục 7 của output) — đọc và hỏi user chốt lại trước khi
đưa cho Agent C, vì Agent C sẽ không xem lại ảnh/video.

## Bước 4 — Chạy Agent C (build)

Chỉ chạy sau khi cả A và B đã xong VÀ mọi điểm suy đoán của A đã được user chốt.

- **Agent C** (`subagent_type: general-purpose`, đây là agent nặng nhất — có thể
  cho `model: opus` nếu cần chất lượng code cao hơn): prompt = nội dung
  `agents/C_build.md` + đường dẫn tuyệt đối tới `MECHANIC_ORIGINAL.txt`,
  `MECHANIC_CHANGES.txt`, `assets_fbx.js`, thư mục `$SRC` (engine template), và
  yêu cầu ghi `BUILD_HANDOFF.txt` theo `templates/BUILD_HANDOFF.txt`.

Sau khi Agent C báo xong, tự verify bằng các lệnh ở README Bước 5 (`run.sh`,
`build_single.js`, kiểm tra `ready=true` và file `.html` cuối tồn tại) trước khi
báo cho user — không chỉ tin lời agent.

## Bước 5 — Hướng dẫn user test & thu thập bug

Khi có file `.html` self-contained cuối cùng, báo cho user:
- Đường dẫn file để họ double-click mở và chơi thử.
- Yêu cầu họ báo lại: bug gặp phải (mô tả hoặc ảnh chụp lỗi) hoặc điều muốn
  chỉnh tiếp, để chạy Agent D.

Dừng ở đây, chờ user phản hồi. KHÔNG tự bịa bug hay tự chạy Agent D khi chưa có
phản hồi cụ thể từ user.

## Bước 6 — Khi user báo bug/muốn chỉnh → Agent D

- **Agent D** (`subagent_type: general-purpose`): prompt = nội dung
  `agents/D_fix_debug.md` + đường dẫn `$SRC`, `BUILD_HANDOFF.txt` hiện tại, và mô
  tả bug/yêu cầu chỉnh user vừa đưa (kèm ảnh lỗi nếu có).
- Bắt buộc yêu cầu Agent D làm đúng vòng lặp visual feedback (chạy → chụp ảnh →
  đọc ảnh → sửa → build lại → chụp lại) và cập nhật `BUILD_HANDOFF.txt`.
- Sau khi D báo xong, đòi bằng chứng ảnh trước/sau hoặc `CODE_RESULT` — KHÔNG
  chấp nhận tuyên bố "đã fix" suông (đúng tiêu chí README Bước 6).
- Báo lại cho user, quay về Bước 5 (chờ họ test tiếp / báo bug tiếp). Có thể lặp
  lại Bước 6 nhiều lần trong cùng phiên làm việc.
