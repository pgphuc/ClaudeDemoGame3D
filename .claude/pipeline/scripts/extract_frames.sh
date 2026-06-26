#!/usr/bin/env bash
# extract_frames.sh — PHẦN CƠ HỌC, KHÔNG CẦN AGENT/LLM.
# --------------------------------------------------------------------------
# Claude KHÔNG đọc trực tiếp file .mp4. Phải tách video gameplay gốc thành
# các frame ảnh để Agent A (phân tích gameplay) "xem" được.
#
# Tách 1 frame mỗi giây (đủ để đọc mechanic, không phình token vision).
# Đổi fps=1 thành fps=2 nếu gameplay nhanh; nhưng càng nhiều ảnh càng tốn token.
#
# CÁCH CHẠY (Git Bash, cần ffmpeg trong PATH):
#   bash extract_frames.sh "<video.mp4>" "<thư-mục-output-frames>" [fps]
# Ví dụ:
#   bash extract_frames.sh \
#     "D:/Projects/ProjectDemoGame/SandDropDemo/Refs/gameplay_1_game_1.mp4" \
#     "D:/Projects/ProjectDemoGame/SandDropDemo/Docs/frames_g1" 1
# --------------------------------------------------------------------------
set -e
VIDEO="$1"
OUTDIR="$2"
FPS="${3:-1}"

if [ -z "$VIDEO" ] || [ -z "$OUTDIR" ]; then
  echo "Dùng: bash extract_frames.sh <video.mp4> <thư-mục-output> [fps=1]"
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "LỖI: không thấy ffmpeg trong PATH. Cài ffmpeg trước (winget install ffmpeg)."
  exit 2
fi

mkdir -p "$OUTDIR"
# scale=640:-1 -> giảm về rộng 640px cho nhẹ token vision mà vẫn đọc được mechanic.
ffmpeg -y -i "$VIDEO" -vf "fps=${FPS},scale=640:-1" "${OUTDIR}/frame_%03d.jpg"

N=$(ls -1 "${OUTDIR}"/frame_*.jpg 2>/dev/null | wc -l)
echo "ĐÃ TÁCH ${N} frame vào: ${OUTDIR}"
echo "=> Đưa thư mục này cho Agent A (xem agents/A_analyze_gameplay.md)."
