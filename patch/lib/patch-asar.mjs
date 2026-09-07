#!/usr/bin/env node
// opencode Desktop RTL/bidi patch — shared cross-platform engine
// =====================================================================
// Injects `dir="auto"` + `unicode-bidi: plaintext` support into the
// renderer page (`out/renderer/index.html`) inside the Electron
// `app.asar` of the opencode Desktop app.
//
// This engine is platform-agnostic (Node.js only) so that Linux, macOS
// and Windows wrappers share the exact same behavior. The wrappers only
// locate `app.asar`, escalate privileges (sudo / UAC) and then call this
// file: `node patch-asar.mjs --asar <path> [--unpatch]`.
//
// If the `@electron/asar` package is resolvable (e.g. inside this repo
// after `npm install`) its API is used; otherwise the `asar` CLI is
// invoked through `npx` so the released bundle works without a full
// install.
//
// Usage:
//   node patch-asar.mjs                          # patch (uses DESKTOP_ASAR)
//   node patch-asar.mjs --asar <path>            # patch a specific asar
//   node patch-asar.mjs --asar <path> --unpatch  # restore the backup
//   node patch-asar.mjs --asar <path> --no-backup
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, sep } from "node:path"

const require = createRequire(import.meta.url)

const INJECT = `  <style id="rtl-bidi-fix" data-from="opencode-rtl-patch">
    /* RTL/bidi fix: let each paragraph pick its own base direction. */
    [data-component="prompt-input"],
    [data-slot="user-message-text"],
    [data-slot="text-part-body"],
    [data-component="text-part"] {
      unicode-bidi: plaintext;
      text-align: start;
    }
  </style>
  <script id="rtl-bidi-fix" data-from="opencode-rtl-patch">
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
`

const MARKER = 'id="rtl-bidi-fix"'
const ARCHIVE = '<script type="module"'

const say = (msg) => console.log(`[i] ${msg}`)
const warn = (msg) => console.error(`[w] ${msg}`)
const die = (msg) => {
  console.error(`[!] ${msg}`)
  process.exit(1)
}

// Prefer the `@electron/asar` npm package (fast, no download); fall back
// to running the `asar` CLI through `npx --yes`.
let asarLib = null
try {
  asarLib = require("@electron/asar")
} catch {
  asarLib = null
}

function npxAsar(command, extraArgs) {
  const args = ["--yes", "--package", "@electron/asar", "asar", command, ...extraArgs]
  const res =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/c", "npx", ...args], { stdio: "inherit" })
      : spawnSync("npx", args, { stdio: "inherit" })
  if (res.status !== 0) throw new Error(`asar ${command} failed (exit ${res.status})`)
}

async function extractArchive(asarPath, outDir) {
  if (asarLib) {
    asarLib.extractAll(asarPath, outDir)
    return
  }
  npxAsar("extract", [asarPath, outDir])
}

async function packArchive(srcDir, dest, unpackGlob) {
  if (asarLib) {
    await asarLib.createPackageWithOptions(srcDir, dest, unpackGlob ? { unpack: unpackGlob } : {})
    return
  }
  const args = unpackGlob ? ["--unpack", unpackGlob] : []
  npxAsar("pack", [...args, srcDir, dest])
}

// Derive the unpack glob from the existing sibling `app.asar.unpacked`
// (native modules such as node-pty) so the repacked archive keeps the
// same unpacked layout.
// @electron/asar matches the glob against each file's *parent directory*
// with minimatch, and minimatch treats single-item braces as literal, so:
//   - one name   -> `**/<name>/**`   (no braces!)
//   - many names -> `**/{a,b,c}/**`
function deriveUnpackGlob(unpackedDir) {
  if (!existsSync(unpackedDir)) return null
  const nm = join(unpackedDir, "node_modules")
  const names = []
  if (existsSync(nm)) {
    for (const entry of readdirSync(nm)) {
      if (statSync(join(nm, entry)).isDirectory()) names.push(entry)
    }
  }
  if (!names.length) return "**/*.node"
  return names.length === 1 ? `**/${names[0]}/**` : `**/{${names.join(",")}}/**`
}

function fileList(dir) {
  const out = []
  const walk = (base, rel) => {
    for (const entry of readdirSync(base).sort()) {
      const full = join(base, entry)
      const relPath = rel ? `${rel}/${entry}` : entry
      if (statSync(full).isDirectory()) walk(full, relPath)
      else out.push(relPath)
    }
  }
  walk(dir, "")
  return out
}

function fixMode(p) {
  if (process.platform === "win32") return
  try {
    chmodSync(p, 0o644)
  } catch {
    /* ignore */
  }
}

function parseArgs(argv) {
  const opts = { asar: process.env.DESKTOP_ASAR || "", unpatch: false, noBackup: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--asar") opts.asar = argv[++i] || ""
    else if (arg === "--unpatch") opts.unpatch = true
    else if (arg === "--no-backup") opts.noBackup = true
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "usage: node patch-asar.mjs [--asar <path>] [--unpatch] [--no-backup]\n" +
          "  --asar <path>  app.asar to patch (default: $DESKTOP_ASAR)\n" +
          "  --unpatch      restore app.asar.bak-rtl\n" +
          "  --no-backup    skip creating a backup",
      )
      process.exit(0)
    }
  }
  return opts
}

async function main() {
  const { asar, unpatch, noBackup } = parseArgs(process.argv.slice(2))
  const asarPath = asar
  if (!asarPath) die("no app.asar given (use --asar <path> or set DESKTOP_ASAR)")
  if (!existsSync(asarPath)) die(`app.asar not found at ${asarPath}`)

  const backupPath = `${asarPath}.bak-rtl`

  if (unpatch) {
    if (!existsSync(backupPath)) die(`no backup at ${backupPath}`)
    copyFileSync(backupPath, asarPath)
    fixMode(asarPath)
    say(`restored ${backupPath} -> ${asarPath}`)
    say("restart opencode Desktop.")
    return
  }

  if (existsSync(backupPath)) {
    say(`backup already exists: ${backupPath}`)
  } else if (!noBackup) {
    copyFileSync(asarPath, backupPath)
    say(`backup created: ${backupPath}`)
  }

  const work = mkdtempSync(join(tmpdir(), "opencode-rtl-"))
  try {
    const appDir = join(work, "app")
    say("extracting app.asar")
    await extractArchive(asarPath, appDir)

    const html = join(appDir, "out", "renderer", "index.html")
    if (!existsSync(html)) die("out/renderer/index.html not found in this app version")

    const original = readFileSync(html, "utf8")
    if (original.includes(MARKER)) {
      say("already patched, nothing to do.")
      return
    }

    say("injecting RTL/bidi style + script into index.html")
    const idx = original.indexOf(ARCHIVE)
    if (idx === -1) die("cannot locate module script anchor")
    writeFileSync(html, original.slice(0, idx) + INJECT + original.slice(idx), "utf8")

    const unpackDir = `${dirname(asarPath)}${sep}app.asar.unpacked`
    const unpackGlob = deriveUnpackGlob(unpackDir)
    if (unpackGlob) say(`unpack glob: ${unpackGlob}`)

    const newAsar = join(work, "app.asar.new")
    say("packing new app.asar")
    await packArchive(appDir, newAsar, unpackGlob)

    // Safety: the regenerated unpacked layout must match the original.
    if (existsSync(unpackDir)) {
      const orig = fileList(unpackDir)
      const newUnpack = `${newAsar}.unpacked`
      const updated = existsSync(newUnpack) ? fileList(newUnpack) : []
      if (JSON.stringify(orig) !== JSON.stringify(updated)) {
        warn("unpacked layout changed (see below); installing anyway")
        for (const line of diffLines(orig, updated).slice(0, 20)) warn(line)
      } else {
        say("unpacked layout identical to original")
      }
    }

    copyFileSync(newAsar, asarPath)
    fixMode(asarPath)
    say("installed patched app.asar")
    say("done. restart opencode Desktop to apply the patch.")
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function diffLines(a, b) {
  const setA = new Set(a)
  const setB = new Set(b)
  const out = []
  for (const file of a) if (!setB.has(file)) out.push(`- ${file}`)
  for (const file of b) if (!setA.has(file)) out.push(`+ ${file}`)
  return out
}

main().catch((err) => {
  console.error(`[!] ${err && err.message ? err.message : err}`)
  process.exit(1)
})