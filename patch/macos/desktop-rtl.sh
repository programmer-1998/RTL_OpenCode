#!/usr/bin/env bash
# opencode Desktop RTL/bidi patch — macOS
# =====================================================================
# Injects `dir="auto"` + `unicode-bidi: plaintext` support into the
# opencode Desktop app (Electron .app bundle) via the shared engine
# (patch/lib/patch-asar.mjs). This wrapper only locates app.asar and
# re-runs the engine with root so it can write inside the app bundle.
#
# Usage:
#   sudo bash patch/macos/desktop-rtl.sh              # apply the patch
#   sudo bash patch/macos/desktop-rtl.sh --unpatch    # restore backup
#   sudo DESKTOP_ASAR=/path/to/app.asar bash patch/macos/desktop-rtl.sh
set -euo pipefail

say()  { printf '\033[1;36m[i]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[w]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[!]\033[0m %s\n' "$*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE="$SCRIPT_DIR/../lib/patch-asar.mjs"

command -v node >/dev/null 2>&1 || die "node is required (https://nodejs.org)"
NODE_BIN="$(command -v node)"
[ -f "$ENGINE" ] || die "engine not found at $ENGINE"

ASAR="${DESKTOP_ASAR:-}"
if [ -z "$ASAR" ]; then
  for candidate in \
    "/Applications/OpenCode.app/Contents/Resources/app.asar" \
    "$HOME/Applications/OpenCode.app/Contents/Resources/app.asar"
  do
    [ -f "$candidate" ] && ASAR="$candidate" && break
  done
fi
[ -n "$ASAR" ] || die "opencode Desktop app.asar not found — set DESKTOP_ASAR=/path/to/app.asar"
[ -f "$ASAR" ] || die "app.asar not found at $ASAR"
say "patching: $ASAR"

ARGS=(--asar "$ASAR")
case "${1:-}" in
  --unpatch|-u)      ARGS+=(--unpatch) ;;
  --no-backup)       ARGS+=(--no-backup) ;;
esac

sudo env "PATH=$PATH" "$NODE_BIN" "$ENGINE" "${ARGS[@]}"

# Modifying the app bundle invalidates its (ad-hoc) code signature.
warn "if the app refuses to open after this patch, re-sign it:"
warn "  sudo codesign --force --deep --sign - \"$(dirname "$(dirname "$(dirname "$ASAR")")")\""