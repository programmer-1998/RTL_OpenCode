import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, sep } from "node:path"
import { fileURLToPath } from "node:url"
import asar from "@electron/asar"

const ENGINE = fileURLToPath(new URL("../patch/lib/patch-asar.mjs", import.meta.url))
const HTML = `<html><head></head><body>
  <div id="app"></div>
  <script type="module" src="/__app.js"></script>
</body></html>
`
const MARKERS = ["id=\"rtl-bidi-fix\"", "unicode-bidi: plaintext", "MutationObserver"]

function runEngine(...args) {
  execFileSync(process.execPath, [ENGINE, ...args], { stdio: "inherit" })
}

// @electron/asar caches the archive header per path; call uncache so each
// read reflects the archive file that the engine just replaced.
function readHtml(archive) {
  asar.uncache(archive)
  return asar.extractFile(archive, "out/renderer/index.html").toString("utf8")
}

function buildFakeApp(work) {
  const src = join(work, "app")
  mkdirSync(join(src, "out", "renderer"), { recursive: true })
  writeFileSync(join(src, "out", "renderer", "index.html"), HTML, "utf8")
  writeFileSync(join(src, "package.json"), JSON.stringify({ name: "opencode-desktop" }), "utf8")
  // a native module kept unpacked, like node-pty / msgpackr-extract
  mkdirSync(join(src, "node_modules", "native-demo"), { recursive: true })
  writeFileSync(join(src, "node_modules", "native-demo", "index.node"), "binary", "utf8")

  const archive = join(work, "app.asar")
  // async on purpose: createPackageWithOptions is a promise API
  return asar.createPackageWithOptions(src, archive, { unpack: "**/*.node" }).then(() => archive)
}

test("patch engine: applies, backs up and unpatch-restores a fake asar", async () => {
  const work = mkdtempSync(join(tmpdir(), "rtl-patch-test-"))
  try {
    const archive = await buildFakeApp(work)
    assert.ok(existsSync(archive))
    assert.ok(existsSync(`${archive}.unpacked`), "unpacked sibling should exist")

    const plain = readHtml(archive)
    for (const marker of MARKERS) assert.ok(!plain.includes(marker), `pre-patch must not contain ${marker}`)
    assert.ok(plain.includes("<script type=\"module\""), "anchor must exist before patching")

    runEngine("--asar", archive)

    const patched = readHtml(archive)
    for (const marker of MARKERS) assert.ok(patched.includes(marker), `patched must contain ${marker}`)
    assert.ok(existsSync(`${archive}.bak-rtl`), "backup must be created")
    assert.ok(
      existsSync(join(`${archive}.unpacked`, "node_modules", "native-demo", "index.node")),
      "unpacked native file must be preserved",
    )

    runEngine("--asar", archive)
    const twice = readHtml(archive)
    assert.equal((twice.match(/<style id="rtl-bidi-fix"/g) || []).length, 1, "no duplicate style injection")
    assert.equal((twice.match(/<script id="rtl-bidi-fix"/g) || []).length, 1, "no duplicate script injection")

    runEngine("--asar", archive, "--unpatch")
    const restored = readHtml(archive)
    for (const marker of MARKERS) assert.ok(!restored.includes(marker), `unpatched must drop ${marker}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})