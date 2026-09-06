#!/usr/bin/env bash
# opencode Desktop RTL/bidi patch
# =============================================================
# Injects `dir="auto"` + `unicode-bidi: plaintext` support into the
# opencode Desktop app (Electron) so that typing/rendering mixed
# Persian/Arabic/Hebrew + English text no longer scrambles.
#
# How it works:
#   * Electron loads the renderer page (`out/renderer/index.html`) from
#     `app.asar` via the custom `oc://` protocol (see out/main/index.js).
#   * We unpack app.asar, append a <style> + inline <script> to that
#     index.html, then repack. No JS bundles are modified.
#   * Native-module layout (`app.asar.unpacked`) is preserved: the unpack
#     glob is derived from the existing `app.asar.unpacked` dir and the
#     regenerated set is compared against the original.
#
# Usage:
#   ./desktop-rtl.sh            # apply the patch (needs sudo + node/npx)
#   ./desktop-rtl.sh --unpatch  # restore the saved backup
#   sudo DESKTOP_ASAR=/path/to/app.asar ./desktop-rtl.sh
#
# Notes:
#   * A backup is kept at <asar>.bak-rtl the first time.
#   * The app auto-updates; re-run this script after every update.
#   * Restart opencode Desktop after patching.
set -euo pipefail

ASAR="${DESKTOP_ASAR:-/opt/OpenCode/resources/app.asar}"
BACKUP="${ASAR}.bak-rtl"
NODE_BIN="node"

say()  { printf '\033[1;36m[i]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[w]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[!]\033[0m %s\n' "$*" >&2; exit 1; }

# sudo helper: passwordless or explicit SUDO_PASS / interactive prompt.
run_sudo() {
  if [ -n "${SUDO_PASS:-}" ]; then
    printf '%s\n' "$SUDO_PASS" | sudo -S -p '' "$@"
  else
    sudo "$@"
  fi
}

command -v "$NODE_BIN" >/dev/null || die "node is required"
[ -f "$ASAR" ] || die "app.asar not found at $ASAR (set DESKTOP_ASAR)"

# Resolve asar CLI: prefer a local copy, otherwise npx.
ASAR_CLI=""
if [ -x "/tmp/opencode/asar-tools/node_modules/.bin/asar" ]; then
  ASAR_CLI="/tmp/opencode/asar-tools/node_modules/.bin/asar"
else
  ASAR_CLI="npx --yes --package @electron/asar -- asar"
fi

unpatch() {
  [ -f "$BACKUP" ] || die "no backup at $BACKUP"
  say "restoring $BACKUP -> $ASAR"
  run_sudo cp -f "$BACKUP" "$ASAR"
  say "restored. restart opencode."
  exit 0
}
[ "${1:-}" = "--unpatch" ] && unpatch

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

say "checking for existing backup"
if [ ! -f "$BACKUP" ]; then
  say "creating backup: $BACKUP"
  run_sudo cp -f "$ASAR" "$BACKUP"
fi

ORIG_UNPACKED="$(dirname "$ASAR")/app.asar.unpacked"
say "preparing work dir (asar + unpacked sibling)"
cp -f "$ASAR" "$WORK/app.asar"
if [ -d "$ORIG_UNPACKED" ]; then
  cp -r "$ORIG_UNPACKED" "$WORK/app.asar.unpacked"
fi

say "extracting asar"
$ASAR_CLI extract "$WORK/app.asar" "$WORK/app" | tail -5
HTML="$WORK/app/out/renderer/index.html"
[ -f "$HTML" ] || die "out/renderer/index.html not found in this app version"

if grep -q 'id="rtl-bidi-fix"' "$HTML"; then
  say "already patched, nothing to do."
  exit 0
fi

say "injecting RTL/bidi style + script into index.html"
python3 - "$HTML" <<'PY'
import sys
path = sys.argv[1]
html = open(path, encoding="utf-8").read()
inject = '''  <style id="rtl-bidi-fix" data-from="desktop-rtl.sh">
    /* RTL/bidi fix: let each paragraph pick its own base direction. */
    [data-component="prompt-input"],
    [data-slot="user-message-text"],
    [data-slot="text-part-body"],
    [data-component="text-part"] {
      unicode-bidi: plaintext;
      text-align: start;
    }
  </style>
  <script id="rtl-bidi-fix" data-from="desktop-rtl.sh">
    (function () {
      function apply() {
        var nodes = document.querySelectorAll('[data-component="prompt-input"]');
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (el.getAttribute("dir") === null) el.setAttribute("dir", "auto");
        }
      }
      apply();
      new MutationObserver(apply).observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    })();
  </script>
'''
anchor = '<script type="module"'
idx = html.find(anchor)
if idx == -1:
    sys.exit("cannot locate module script anchor")
html = html[:idx] + inject + html[idx:]
open(path, "w", encoding="utf-8").write(html)
print("injected OK")
PY

# Derive unpack glob from the existing app.asar.unpacked tree (native modules).
UNPACK_GLOB="${UNPACK_GLOB:-}"
if [ -z "$UNPACK_GLOB" ] && [ -d "$WORK/app.asar.unpacked" ]; then
  names="$(find "$WORK/app.asar.unpacked/node_modules" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sed 's|.*/node_modules/||' | sort)"
  if [ -n "$names" ]; then
    UNPACK_GLOB="**/$(echo "$names" | paste -sd'|' - | sed 's/|/,/g')/**"
    UNPACK_GLOB="**/{$(echo "$names" | paste -sd',' -)}/**"
    say "derived unpack glob: $UNPACK_GLOB"
  fi
fi
[ -n "$UNPACK_GLOB" ] || UNPACK_GLOB="**/*.node"
say "packing new asar (unpack: ${UNPACK_GLOB})"
NEW="$WORK/app.asar.new"
rm -f "$NEW"; rm -rf "$NEW.unpacked"
$ASAR_CLI pack --unpack "$UNPACK_GLOB" "$WORK/app" "$NEW" | tail -3

# Safety: the regenerated unpacked layout must match the original.
if [ -d "$WORK/app.asar.unpacked" ]; then
  : > "$WORK/orig-u.txt"
  find "$WORK/app.asar.unpacked" -type f | sed "s|$WORK/app.asar.unpacked/||" | sort > "$WORK/orig-u.txt"
  new_u_list="$NEW.unpacked"
  : > "$WORK/new-u.txt"
  find "$new_u_list" -type f 2>/dev/null | sed "s|$new_u_list/||" | sort > "$WORK/new-u.txt"
  if ! diff -q "$WORK/orig-u.txt" "$WORK/new-u.txt" >/dev/null; then
    warn "unpacked layout changed (see diff below); installing anyway"
    diff "$WORK/orig-u.txt" "$WORK/new-u.txt" | head -20 || true
  else
    say "unpacked layout identical to original"
  fi
fi

say "installing patched asar (owner root:root)"
run_sudo cp -f "$NEW" "$ASAR"
run_sudo chown root:root "$ASAR"
run_sudo chmod 0644 "$ASAR"

say "done. restart opencode Desktop to apply the patch."