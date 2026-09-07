#!/usr/bin/env bash
# opencode Desktop RTL/bidi patch — Linux
# =====================================================================
# Injects `dir="auto"` + `unicode-bidi: plaintext` support into the
# opencode Desktop app (Electron) via the shared engine
# (patch/lib/patch-asar.mjs). This wrapper only locates app.asar and
# re-runs the engine with root so it can write next to the installed
# app.asar.
#
# Usage:
#   sudo bash patch/linux/desktop-rtl.sh              # apply the patch
#   sudo bash patch/linux/desktop-rtl.sh --unpatch    # restore backup
#   sudo DESKTOP_ASAR=/path/to/app.asar bash patch/linux/desktop-rtl.sh
#   SUDO_PASS='...' bash patch/linux/desktop-rtl.sh   # non-interactive
set -euo pipefail

say()  { printf '\033[1;36m[i]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[!]\033[0m %s\n' "$*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE="$SCRIPT_DIR/../lib/patch-asar.mjs"

command -v node >/dev/null 2>&1 || die "node is required (https://nodejs.org)"
NODE_BIN="$(command -v node)"
[ -f "$ENGINE" ] || die "engine not found at $ENGINE"

ASAR="${DESKTOP_ASAR:-}"
if [ -z "$ASAR" ]; then
  for candidate in \
    /opt/OpenCode/resources/app.asar \
    /usr/lib/OpenCode/resources/app.asar \
    /usr/lib/opencode/resources/app.asar \
    /usr/local/lib/OpenCode/resources/app.asar
  do
    [ -f "$candidate" ] && ASAR="$candidate" && break
  done
fi
[ -n "$ASAR" ] || die "opencode Desktop app.asar not found — set DESKTOP_ASAR=/path/to/app.asar"
[ -f "$ASAR" ] || die "app.asar not found at $ASAR"
say "patching: $ASAR"

# sudo helper: passwordless or explicit SUDO_PASS / interactive prompt.
run_sudo() {
  if [ -n "${SUDO_PASS:-}" ]; then
    printf '%s\n' "$SUDO_PASS" | sudo -S -p '' env "PATH=$PATH" "$@"
  else
    sudo env "PATH=$PATH" "$@"
  fi
}

ARGS=(--asar "$ASAR")
case "${1:-}" in
  --unpatch|-u)      ARGS+=(--unpatch) ;;
  --no-backup)       ARGS+=(--no-backup) ;;
esac

run_sudo "$NODE_BIN" "$ENGINE" "${ARGS[@]}"