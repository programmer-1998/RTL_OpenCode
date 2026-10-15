// Desktop (Electron) self-heal.
//
// OpenCode Desktop loads its renderer from `app.asar`, which no plugin hook
// can reach, so the RTL/bidi + Vazirmatn fix is a one-time asar patch
// (`patch/lib/patch-asar.mjs`). This guard keeps that patch applied: it runs
// from the server/CLI plugin, and re-applies the patch whenever the asar has
// been replaced (e.g. after an auto-update).
//
// The asar is locked while the Desktop runs, so we (a) probe writability and
// only then run the engine, and (b) retry on a slow timer until it succeeds.
import { spawn } from "node:child_process"
import { closeSync, existsSync, openSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ENGINE = fileURLToPath(new URL("../patch/lib/patch-asar.mjs", import.meta.url))

type Logger = (message: string) => void

function candidates(): string[] {
  const local = process.env.LOCALAPPDATA ?? ""
  const pf = process.env.ProgramFiles ?? ""
  const pfx86 = process.env["ProgramFiles(x86)"] ?? ""
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ""
  const list: Array<string | undefined> = [
    local && join(local, "Programs", "OpenCode", "resources", "app.asar"),
    local && join(local, "Programs", "opencode", "resources", "app.asar"),
    pf && join(pf, "OpenCode", "resources", "app.asar"),
    pfx86 && join(pfx86, "OpenCode", "resources", "app.asar"),
    "/Applications/OpenCode.app/Contents/Resources/app.asar",
    home && join(home, "Applications", "OpenCode.app", "Contents", "Resources", "app.asar"),
    "/opt/OpenCode/resources/app.asar",
    "/usr/lib/opencode-desktop/resources/app.asar",
    "/usr/lib/opencode/resources/app.asar",
  ]
  return list.filter((value): value is string => typeof value === "string" && value.length > 0)
}

function locate(): string | undefined {
  const override = process.env.DESKTOP_ASAR
  if (override && existsSync(override)) return override
  return candidates().find((path) => existsSync(path))
}

// The engine writes `<asar>.rtl-stamp` = "v<version>:<size>:<mtimeMs>" after a
// successful patch; a fresh stamp means the current asar is fully patched.
// Keep version in sync with PATCH_VERSION in patch/lib/patch-asar.mjs.
const PATCH_VERSION = 2

function patched(asar: string): boolean {
  try {
    const info = statSync(asar)
    const stamp = readFileSync(`${asar}.rtl-stamp`, "utf8").trim()
    return stamp === `v${PATCH_VERSION}:${info.size}:${Math.trunc(info.mtimeMs)}`
  } catch {
    return false
  }
}

// Writing requires an exclusive handle the running Desktop holds.
function writable(asar: string): boolean {
  try {
    closeSync(openSync(asar, "r+"))
    return true
  } catch {
    return false
  }
}

function runtime(): string {
  const exe = process.execPath ?? ""
  return /[\\/](node|bun)(\.exe)?$/i.test(exe) ? exe : "node"
}

export function ensureDesktopPatch(options: { enabled: boolean; log?: Logger }): void {
  if (!options.enabled) return
  const log: Logger = (message) => options.log?.(message)
  const asar = locate()
  if (!asar) return
  if (patched(asar)) return

  let done = false
  let running = false

  const attempt = () => {
    if (done || running) return
    if (patched(asar)) {
      done = true
      return
    }
    if (!writable(asar)) return // Desktop is running; try again later.
    running = true
    const child = spawn(runtime(), [ENGINE, "--asar", asar], { stdio: "ignore", windowsHide: true })
    child.on("error", () => {
      running = false
      done = true
      log("desktop patch skipped: could not run node (install Node 20+ or run patch/ manually)")
    })
    child.on("exit", (code) => {
      running = false
      if (code === 0) {
        done = true
        log("desktop patch applied")
      }
    })
  }

  attempt()
  const timer = setInterval(() => {
    if (done) {
      clearInterval(timer)
      return
    }
    attempt()
  }, 120_000)
  ;(timer as { unref?: () => void }).unref?.()
}
