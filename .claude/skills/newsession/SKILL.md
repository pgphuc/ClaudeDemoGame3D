---
name: newsession
description: Đóng session — doc-sync worklog + commit narrow + đẻ next-session prompt. Dùng khi user gõ "/newsession", "chốt nhanh". Dùng cho cả task còn dở lẫn task đã xong.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Agent
---

# /newsession — đóng session

Chốt một phiên làm việc (dở hoặc đã xong): cập nhật doc sống + commit hẹp + bàn giao
prompt ngắn cho session sau.

## Mục lục
1. Param (đọc trước khi chạy)
2. Phân vai — main think-first, subagent execute
3. Phạm vi
4. Quy trình 4 bước
5. Bẫy đã biết (lesson giữ nguyên)
6. Điểm dính project

## 1. Param (đọc trước khi chạy)

Skill KHÔNG hardcode path demo. Chạy (Git Bash, không phụ thuộc cwd)
`source "$(git rev-parse --show-toplevel)/.claude/pipeline/config.sh"` để lấy
`ROOT/ASSETS/REFS/DOCS/SRC/PIPE`. Từ đó suy:
- `worklogDir` = `$DOCS/worklog/` (tạo nếu chưa có).
- `docsRoot` (phạm vi grep bước 1b) = `$DOCS/*.txt` (trừ `worklog/` và `frames_*/`) +
  `$PIPE/README.md` + `$PIPE/agents/*.md` + `$PIPE/templates/*.txt`.
- Doc sống chính = `$DOCS/BUILD_HANDOFF.txt`.
- `attributionLine` = lấy từ hướng dẫn attribution trong system prompt của session hiện
  tại (dòng `Co-Authored-By` + `Claude-Session`), KHÔNG hardcode trong skill.

Đổi demo đang làm → **chỉ sửa `config.sh`**, KHÔNG sửa file skill này.

## 2. Phân vai — main think-first, subagent execute

Main CHỈ: chốt nội dung, review output subagent, quyết định, commit. Việc chân tay →
delegate `general-purpose` model `sonnet`. Chỉ thị self-contained: path cụ thể, format
output, acceptance — subagent KHÔNG thấy hội thoại của main.

| Việc | Ai làm |
|---|---|
| Gom state: git status/diff, suy slug, chạy doc-impact scan (bước 1b), grep BUILD_HANDOFF-stale (bước 2) | general-purpose Sonnet |
| Ghi worklog fragment + cập nhật doc sống (bước 1) theo content main đã chốt | general-purpose Sonnet |
| Commit, đẻ next-session prompt, báo doc/handoff stale | main |

Session nhỏ (diff ít file, mọi thứ đã trong context) → main làm thẳng được, đừng
delegate vì hình thức.

## 3. Phạm vi

- **Input:** optional slug/mô tả việc vừa làm. Không có → tự suy từ diff + hội thoại.
- **Output:** 1 fragment worklog mới; (optional) 1 dòng cảnh báo `BUILD_HANDOFF.txt`
  stale; 1 commit narrow (khi được xác nhận); 1 next-session prompt 4-field in ra cho
  user.
- **KHÔNG làm:** không `git add -A`; không tự sửa doc/handoff phát hiện sai (chỉ báo
  user — global rule 7); không tự chạy Agent D thay user.

## 4. Quy trình 4 bước

1. **Doc-sync** — 3 nước, **diff-derived** (KHÔNG dựa trí nhớ "có đụng gì đáng kể
   không" — đó là cái đẻ ra stale, bẫy #4):
   - **1a. Fragment worklog** — TẠO `$DOCS/worklog/<YYYY-MM-DD>__<slug>.txt`: 1 dòng
     **SUMMARY** mang TRẠNG THÁI VERIFY (bẫy #1; trạng thái verify cụ thể trong repo
     này = `run.sh ready=true` / `CODE_RESULT test_win PASS` / `user play-test PASS` /
     `CHƯA verify`) + 2-4 dòng đã làm + SHA nếu có. Ở **worktree** → slug BẮT BUỘC hậu
     tố worktree (vd `...-dev1`) tránh add/add collision cùng ngày (bẫy #3).
   - **1b. Doc-impact scan** *(delegate)* — floor grep: `git diff --name-only HEAD`
     (+ file untracked liên quan) → với mỗi path, grep basename + tên
     symbol/biến vừa đổi (vd `ASSET_MAP`, `ROOT`) trong `docsRoot` ở mục 1 → bảng
     `path đổi → doc:line`. Ví dụ thật của repo: đổi `scripts/embed_fbx.js` (bảng
     `ASSET_MAP`) mà `README.md` và `agents/C_build.md` vẫn ghi "5 asset FBX
     jelly/jar/lid/frame/belt" → doc đó stale.
   - **1c. Reconcile TỪNG ứng viên — KHÔNG bỏ im lặng.** Mỗi doc trong bảng, main ra
     đúng 1 quyết định GHI RÕ: **EDIT** (doc assert điều diff vừa làm sai/lỗi thời →
     subagent sửa theo nội dung main chốt) · **NO-CHANGE + lý do 1 câu** · **FLAG
     user** (doc sai nhưng ngoài scope/không chắc — global rule 7, KHÔNG tự sửa).
     Bảng rỗng → vẫn ghi rõ `NO_CANDIDATES` (khẳng định, không phải quên).
2. **BUILD_HANDOFF-stale check — CHỈ NHẮC, KHÔNG sửa.** Đối chiếu `$DOCS/BUILD_HANDOFF.txt`
   (mục CFG, giới hạn đã biết, việc tiếp theo) với diff trong `$SRC/` và file `.html`
   build cuối. Lệch thực tế (vd CFG đổi nhưng handoff ghi số cũ; bug ghi "việc tiếp
   theo" đã fix trong code) → **BÁO user**. Sửa `BUILD_HANDOFF.txt` là việc của Agent D
   (qua `/newgamedemo`) hoặc user, KHÔNG phải skill này. `$DOCS` chưa có
   `BUILD_HANDOFF.txt` (chưa chạy Agent C) → bỏ bước này.
3. **Commit narrow** — chỉ `git add` file thuộc việc này (liệt kê rõ trước khi add:
   `$ROOT/**` trừ `Refs/*.mp4` và `Docs/frames_*/` nếu quá lớn — hỏi user; ngoài ra
   `.claude/pipeline/**`, `.claude/skills/**`), KHÔNG `git add -A`. Message đa dòng qua
   `git commit -F <file>`; file message viết bằng `[IO.File]::WriteAllText` (UTF-8
   no-BOM) hoặc heredoc Git Bash — KHÔNG `Set-Content`/`Out-File -Encoding utf8` (chèn
   BOM). Chèn `attributionLine`. Commit CHỈ khi user xác nhận.
4. **Đẻ next-session prompt** — schema 4-field:
   ```
   read   <doc.txt §section>              ← cửa vào: section cụ thể (thiếu = đốt token)
   state  <S1..Sn done (SHA), còn Z>      ← session mới KHÔNG có memory/git log
   action <execute | propose-first | làm N việc §X>
   gate   <token budget / model nếu cần>
   ```
   `read` trỏ `$DOCS/BUILD_HANDOFF.txt §<mục>` (hoặc `MECHANIC_CHANGES.txt §<ID>` nếu
   việc dở là spec đang bàn). `action` lắp từ skill-token `/newgamedemo` (vd
   "`/newgamedemo` → Bước 6 Agent D với bug list: ..."), KHÔNG expand inline — prompt
   ngắn, session sau tự re-expand.

## 5. Bẫy đã biết (lesson giữ nguyên)

- **#1 — SUMMARY phải mang TRẠNG THÁI VERIFY, không chỉ mô tả việc.** Kết dòng SUMMARY
  bằng trạng thái verify cụ thể, không phải mô tả suông. Session sau CHỈ đọc SUMMARY
  rồi tin việc đã xong; caveat chôn ở cuối body = vô hình. **Mô tả việc ≠ bằng chứng
  việc chạy.**
- **#2 — Việc dở cần bàn giao chi tiết → cập nhật `BUILD_HANDOFF.txt` qua Agent D
  trước khi chốt, đừng nhồi vào worklog.** Worklog là log ngắn, không phải chỗ giữ
  trạng thái sống cho session sau parse.
- **#3 — Worktree quên hậu tố slug** → hai worktree cùng ngày tạo trùng tên fragment →
  add/add collision lúc merge. Luôn gắn hậu tố worktree ở bước 1a.
- **#4 — Doc-sync dựa trí nhớ "có đáng kể không" → quên → doc sống stale.** Agent
  không THẤY doc nào tả code mình vừa đổi thì quên bẵng. Fix = diff-derived: bước 1b
  để grep phơi doc ứng viên từ chính diff, bước 1c reconcile TỪNG hit. Đừng tự phán
  "chắc không đụng doc nào" — để grep trả lời. Bảng rỗng phải ghi rõ.
- **#5 — Video/frames nặng không commit mù.** `Refs/*.mp4` (hàng trăm MB),
  `Docs/frames_*/` (hàng trăm ảnh) → hỏi user trước khi add, hoặc đề xuất
  `.gitignore`.

## 6. Điểm dính project

- Giả định `config.sh` đang trỏ đúng demo mình làm — kiểm `ROOT` tồn tại trước khi
  chạy bất kỳ bước nào.
- Repo có nhiều demo → worklog nằm theo `$DOCS` của demo đang active, không gộp chung.
- KHÔNG assume hook/gate nào ngoài những gì `config.sh` và pipeline định nghĩa.
