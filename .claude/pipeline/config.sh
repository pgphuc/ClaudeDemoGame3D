# config.sh — đường dẫn dùng chung cho cả pipeline.
# Đổi project/root: CHỈ sửa file này. Mọi lệnh trong README đều: source "$PIPE/config.sh"
# Dùng dấu "/" kiểu Windows (D:/...), KHÔNG dùng "/d/..." (Chrome trong run.sh sẽ lỗi).

# --- ROOT của project game hiện tại ---
ROOT="D:/Projects/ProjectDemoGame/SandDropDemo"

# --- Các thư mục con trong project (khớp cấu trúc SandDropDemo) ---
ASSETS="$ROOT/Assets"     # 5 file .fbx gốc
REFS="$ROOT/Refs"         # video gameplay (.mp4) + ảnh layout/level tham chiếu
DOCS="$ROOT/Docs"         # nơi đặt MECHANIC_ORIGINAL/CHANGES/BUILD_HANDOFF + frames tách ra
SRC="$ROOT/src"           # engine template (copy từ jelly3d_src) — game_core.js sửa ở đây

# --- Bộ khung pipeline (cố định, không đổi theo project) ---
PIPE="D:/Projects/ProjectDemoGame/.claude/pipeline"

export ROOT ASSETS REFS DOCS SRC PIPE
