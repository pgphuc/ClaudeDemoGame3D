#!/usr/bin/env bash
# =============================================================================
# run.sh — chạy game.html bằng Chrome headless: chụp screenshot + chạy test JS.
#
#   bash tools/run.sh <html> <out.png> <waitMs> [test.js] [extra chrome args...]
#
# In ra:
#   ready=true|false
#   shot=<đường dẫn png>
#   CODE_RESULT: {...}        (chỉ khi có test.js)
#
# Cách hoạt động (KHÔNG cần npm package, không cần CDP):
#   - Sinh 1 file HTML tạm CẠNH file gốc (để <script src> tương đối vẫn nạp được):
#       *_probe.html : __NOSHADOW=true + nội dung test.js + harness.
#   - Harness ghi kết quả vào <div id="__probe">{"ready":..,"result":..}</div>
#   - Chrome chạy 2 pass trên cùng file đó: --screenshot rồi --dump-dom;
#     nhờ vậy ảnh chụp phản ánh đúng trạng thái sau khi test chạy.
#   - Chrome headless dùng software GL nên chậm -> luôn tắt shadow.
# Đường dẫn dùng kiểu Windows D:/... (KHÔNG dùng /d/...).
# =============================================================================
set -u

CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"

HTML="${1:-}"
OUT="${2:-}"
WAIT="${3:-2600}"
TESTJS="${4:-}"
shift 4 2>/dev/null || shift $#
EXTRA="$*"

if [ -z "$HTML" ] || [ -z "$OUT" ]; then
  echo "Dùng: bash tools/run.sh <html> <out.png> <waitMs> [test.js] [extra...]" >&2
  exit 1
fi
if [ ! -f "$HTML" ]; then echo "Không thấy file HTML: $HTML" >&2; exit 1; fi
if [ ! -f "$CHROME" ]; then echo "Không thấy Chrome: $CHROME" >&2; exit 1; fi

DIR=$(dirname "$HTML")
BASE=$(basename "$HTML" .html)
STAMP=$$

PROBE_HTML="$DIR/__${BASE}_probe_${STAMP}.html"
DOMTXT="$DIR/__${BASE}_dom_${STAMP}.txt"
UDD="$DIR/__chrome_profile_${STAMP}"

cleanup() { rm -rf "$PROBE_HTML" "$DOMTXT" "$UDD" 2>/dev/null; }
trap cleanup EXIT

# --- absolute file:// URL ---
abs_url() {
  local p="$1"
  case "$p" in
    [A-Za-z]:/*) echo "file:///$p" ;;
    /*)          echo "file://$p" ;;
    *)           echo "file:///$(pwd -W 2>/dev/null || pwd)/$p" ;;
  esac
}

CHROME_ARGS="--headless=new --disable-gpu --enable-unsafe-swiftshader \
--allow-file-access-from-files --hide-scrollbars --no-first-run --no-default-browser-check \
--disable-extensions --disable-background-networking --mute-audio"

NOSHADOW_TAG='<script>window.__NOSHADOW=true;</script>'

# ---------------------------------------------------------------------------
# 1) File HTML tạm duy nhất: __NOSHADOW + test.js + harness (trước </body>).
#    Dùng chung cho cả pass screenshot lẫn pass dump-dom, nên ảnh chụp phản
#    ánh đúng trạng thái sau khi test chạy.
# ---------------------------------------------------------------------------
HARNESS="$DIR/__harness_${STAMP}.js"
cat > "$HARNESS" <<'HEOF'
(function(){
  function emit(txt){
    var d = document.createElement('div');
    d.id = '__probe'; d.style.display = 'none';
    d.textContent = txt;
    document.body.appendChild(d);
  }
  function run(){
    var ready = !!(window.__game && window.__game.state);
    var res = null;
    try { if (typeof window.__runTest === 'function') res = window.__runTest(); }
    catch (e) { res = { error: String((e && e.stack) || e) }; }
    emit(JSON.stringify({ ready: ready, result: res }));
  }
  if (document.readyState === 'complete') setTimeout(run, 0);
  else window.addEventListener('load', function(){ setTimeout(run, 0); });
})();
HEOF

{
  awk -v tag="$NOSHADOW_TAG" '
    /<\/body>/ { exit }
    { print }
    /<body[^>]*>/ && !done { print tag; done=1 }
  ' "$HTML"
  echo '<script>'
  if [ -n "$TESTJS" ] && [ -f "$TESTJS" ]; then cat "$TESTJS"; fi
  echo '</script>'
  echo '<script>'
  cat "$HARNESS"
  echo '</script>'
  echo '</body></html>'
} > "$PROBE_HTML"
rm -f "$HARNESS"

# ---------------------------------------------------------------------------
# 2) Chạy Chrome: pass 1 = screenshot, pass 2 = dump-dom (đọc ready/CODE_RESULT)
# ---------------------------------------------------------------------------
"$CHROME" $CHROME_ARGS --user-data-dir="$UDD" \
  --window-size=540,960 --screenshot="$OUT" \
  --virtual-time-budget="$WAIT" $EXTRA "$(abs_url "$PROBE_HTML")" >/dev/null 2>&1

PWAIT=$WAIT
[ "$PWAIT" -lt 1500 ] 2>/dev/null && PWAIT=1500
"$CHROME" $CHROME_ARGS --user-data-dir="${UDD}b" \
  --window-size=540,960 --dump-dom \
  --virtual-time-budget="$PWAIT" $EXTRA "$(abs_url "$PROBE_HTML")" > "$DOMTXT" 2>/dev/null
rm -rf "${UDD}b" 2>/dev/null

PROBE=$(tr -d '\r\n' < "$DOMTXT" | sed -n 's/.*<div id="__probe"[^>]*>\(.*\)<\/div>.*/\1/p' | head -1)
# lấy đoạn ngắn nhất: cắt tại </div> đầu tiên
PROBE=$(printf '%s' "$PROBE" | sed 's/<\/div>.*//')

READY=false
case "$PROBE" in *'"ready":true'*) READY=true ;; esac
echo "ready=$READY"

if [ -f "$OUT" ]; then echo "shot=$OUT"; else echo "shot=MISSING" >&2; fi

if [ -n "$TESTJS" ]; then
  RESULT=$(printf '%s' "$PROBE" | sed -n 's/^{"ready":[a-z]*,"result"://p' | sed 's/}$//')
  if [ -z "$RESULT" ] || [ "$RESULT" = "null" ]; then
    echo "CODE_RESULT: {\"error\":\"khong doc duoc ket qua test\",\"raw\":$(printf '%s' "$PROBE" | head -c 400 | sed 's/"/\\"/g;s/^/"/;s/$/"/')}"
  else
    echo "CODE_RESULT: $RESULT"
  fi
fi
