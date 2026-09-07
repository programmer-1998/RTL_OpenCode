<p align="center">

# 🇺🇸 OpenCode RTL Fix

**Bidirectional (RTL/LTR) plugin for opencode** — fixes mixed Persian/Arabic/Hebrew + English text in the opencode terminal, Desktop and web UI

[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green?style=for-the-badge)]()
[![CI](https://img.shields.io/github/actions/workflow/status/programmer-1998/RTL_OpenCode/ci.yml?style=for-the-badge)](https://github.com/programmer-1998/RTL_OpenCode/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/opencode-rtl-fix?style=for-the-badge&label=npm)](https://www.npmjs.com/package/opencode-rtl-fix)
[![GitHub](https://img.shields.io/badge/GitHub-RTL__OpenCode-181717?style=for-the-badge&logo=github)](https://github.com/programmer-1998/RTL_OpenCode)

**Languages:** [🇮🇷 فارسی](README.md) · [🇬🇧 English](README.en.md) · [🇸🇦 العربية](README.ar.md)

</p>

<p align="center">
  <img src="example.png" alt="opencode RTL fix in action — mixed Persian/English text rendered correctly without scrambling" width="800">
</p>

## 📌 The Problem

When an English word or identifier appears inside a Persian/Arabic sentence — like `SINA`, a filename, a path or a package name — the opencode UI scrambles the word order because it does not implement the Unicode Bidirectional Algorithm (**UAX #9**):

```
You typed (logical order):     سلام من SINA هستم
Broken rendering:              هستم SINA سلام من
Correct rendering (visual):    هستم SINA من سلام    ← read right-to-left = «سلام من SINA هستم»
```

This affects the **terminal/TUI**, the **Desktop app** and the **web UI**, both while typing the prompt (composer) and when displaying messages / model replies.

## 🧠 The Solution — Two Layers

This project solves the problem in **two complementary layers**:

| Layer | Tool | What it fixes |
| --- | --- | --- |
| **1) Text layer (opencode server)** | `server` plugin | Sent user messages, chat history, model replies and tool output — using Unicode **bidi isolates** (`RLI` / `LRI` / `PDI`) per UAX #9 |
| **2) UI layer (Desktop)** | `patch/` scripts (Linux / macOS / Windows) | The **live prompt composer** that no plugin hook can touch — by injecting `dir="auto"` + `unicode-bidi: plaintext` into `app.asar` |

<details>
<summary>🔍 How does it work?</summary>

- **The plugin** hooks into opencode's server hooks (`chat.message`, `experimental.text.complete`, `tool.execute.after`, …). For each paragraph it resolves the direction via the **first-strong character** rule; RTL paragraphs are wrapped in `RLI…PDI`, and the English/code tokens inside them (like `SINA`, `/path/to/file`) are isolated with `LRI…PDI` so their order never flips. These Unicode control characters are **invisible** and have no effect on the model.
- **The Desktop patch** appends a `<style>` and `<script>` to `out/renderer/index.html` inside `app.asar` so the app's Chromium auto-detects each paragraph's direction — the same thing `dir="auto"` does in modern browsers.

</details>

## ✨ Features

- ✅ Correct rendering of mixed Persian/Arabic/Hebrew/Urdu + English paragraphs
- ✅ Isolation of English words and identifiers inside RTL text (`SINA`, `API`, paths)
- ✅ Full protection of **code** — fenced blocks, indented code and `inline code` are left untouched
- ✅ Previous messages (chat history) are corrected when loaded
- ✅ Automatic direction detection (first-strong character) + optional forced `rtl`/`ltr`
- ✅ Optional system-guidance so the model answers in your language and keeps code/paths LTR
- ✅ Optional `OPENCODE_RTL*` env vars for tools
- ✅ TUI status commands: `RTL: Show Status` and `RTL: Analyze Sample`
- ✅ Desktop patch for all three OSes (Linux / macOS / Windows) with automatic backup, `app.asar.unpacked` layout verification and `--unpatch`

## ⚠️ Important limitation (honest)

**The prompt composer, while you are still typing, is rendered by opencode's own UI and no plugin hook has access to the live buffer.** So:

- **Desktop app** → this part is fixed by the `patch/` scripts — `patch/linux/desktop-rtl.sh`, `patch/macos/desktop-rtl.sh` or `patch/windows/desktop-rtl.ps1` (layer 2).
- **Terminal/TUI** → it is rendered cell-by-cell by `@opentui/core`; the real fix there belongs to opencode itself. Yet as soon as you send the message, your prompt and the model reply are fixed by layer 1 everywhere.

---

## 🚀 Install & enable in opencode

opencode loads plugins **only at startup**. After any config change, close opencode and launch it again.

### Option 1 — from npm (once published)

```jsonc
// ~/.config/opencode/opencode.jsonc  (global)
// or  opencode.jsonc  in your project root (local)
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "opencode-rtl-fix",
      { "language": "auto" }
    ]
  ]
}
```

### Option 2 — from source / local path

```sh
git clone git@github.com:programmer-1998/RTL_OpenCode.git
cd RTL_OpenCode
npm ci && npm run build
```

Then point the config at the folder (or at `dist/server.js`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "/home/<user>/RTL_OpenCode",
      { "language": "auto", "isolateToolOutput": "off" }
    ]
  ]
}
```

> 💡 Instead of an absolute path you can use `./RTL_OpenCode` (relative to the config dir) or `file:///...` — all three forms are valid.

### Option 3 — auto-detected inside a project

Put the plugin in one of these project-local folders and opencode will find it with no config:

```
.opencode/plugin/rtl/package.json
.opencode/plugin/rtl/dist/…
```

> 💡 Layer 1 (the server plugin, written in JavaScript) behaves **exactly the same on Linux, macOS and Windows**. Only the Desktop patch (layer 2) has a separate file per OS — see below.

---

## ⚙️ Plugin options

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `true` | Master switch |
| `language` | `"auto"` | `auto`, `none`, or `fa` / `ar` / `he` / `ur` (force a language) |
| `systemGuidance` | `true` | Append RTL guidance to the system prompt (or a custom string) |
| `isolateUserMessages` | `"auto"` | `off` / `auto` / `always` — isolate user messages |
| `isolateAssistantText` | `"auto"` | Isolate model replies |
| `isolateToolOutput` | `"off"` | Isolate tool output (keep `off` if exact copy/paste matters) |
| `minRtlRatio` | `0.2` | Minimum RTL character ratio for auto-detection |
| `minRtlCharacters` | `2` | Minimum RTL character count |
| `digitMode` | `"preserve"` | Digit conversion: `preserve` / `latin` / `arabic-indic` / `eastern-arabic` |
| `forceDirection` | `"auto"` | Force isolate direction: `auto` / `rtl` / `ltr` |
| `alignRtlParagraphs` | `false` | Visual right-align in terminal via padding **(`align` also changes raw text; TUI only)** |
| `rtlWrapColumn` | `96` | Wrap column used by alignment |
| `rtlAlignColumn` | `96` | Right-align column |
| `directionEnv` | `true` | Export `OPENCODE_RTL*` in tool environments |
| `debug` | `false` | Log via `client.app.log()` |

> **Direction note:** direction follows the *first strong character* — a sentence starting with Persian becomes RTL, one starting with English/code becomes LTR. To force everything RTL: `"forceDirection": "rtl"`.

---

## 🖥️ Desktop app patch (for the composer)

The Electron app renders text without any automatic direction. The patch appends a `<style>` + `<script>` to `out/renderer/index.html` inside `app.asar` so the composer and messages behave exactly like in modern browsers.

The patch is powered by a **shared JavaScript engine** (`patch/lib/patch-asar.mjs`) that runs identically on all three OSes; only the per-OS **wrapper** locates the app and takes the needed privileges (sudo / UAC):

| OS | Install file | Requirements |
| --- | --- | --- |
| 🐧 Linux | `patch/linux/desktop-rtl.sh` | node 20+ and sudo |
| 🍎 macOS | `patch/macos/desktop-rtl.sh` | node 20+ and sudo |
| 🪟 Windows | `patch/windows/desktop-rtl.ps1` | node 20+ |

### Install on Linux

```sh
sudo bash patch/linux/desktop-rtl.sh
```

### Install on macOS

```sh
sudo bash patch/macos/desktop-rtl.sh
```

> 💡 If the app refuses to open after patching (broken code signature), re-sign it:
> `sudo codesign --force --deep --sign - "/Applications/OpenCode.app"`

### Install on Windows

Open PowerShell and run:

```powershell
powershell -ExecutionPolicy Bypass -File patch\windows\desktop-rtl.ps1
```

Confirm the UAC prompt. (Or simply double-click `patch\windows\desktop-rtl.cmd`.)

### What it does

1. Backs up `app.asar` in place (`app.asar.bak-rtl`);
2. Extracts, patches `index.html`, repacks the archive;
3. **Verifies the `app.asar.unpacked` layout (native modules like `node-pty`) one-by-one against the previous version** so nothing breaks.

Then **close and reopen the opencode Desktop app**.

### Revert

```sh
# Linux / macOS
sudo bash patch/linux/desktop-rtl.sh --unpatch
sudo bash patch/macos/desktop-rtl.sh --unpatch
```

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File patch\windows\desktop-rtl.ps1 -Unpatch
```

### ⚠️ After every Desktop update

The app auto-updates and the update replaces the patched file. Just re-run your OS's script after each update.

> Default paths: Linux `/opt/OpenCode/resources/app.asar`, macOS `/Applications/OpenCode.app/Contents/Resources/app.asar`, Windows `%LOCALAPPDATA%\Programs\OpenCode\resources\app.asar`. If installed elsewhere: Linux/macOS `sudo DESKTOP_ASAR=/path/to/app.asar bash patch/<linux|macos>/desktop-rtl.sh`, Windows `powershell ... -Asar C:\path\to\app.asar`.

---

## 🧪 Test in opencode (step by step)

1. Close and reopen opencode (so the plugin loads).
2. In **Desktop**, type this in the composer — it should read naturally right-to-left with `SINA` in the right place:

   ```
   سلام من SINA هستم
   ```

3. Send a mixed prompt containing a path/code, e.g.:

   ```
   محتوای فایل src/config.ts را بخوان و لیست بده
   ```

   and check that `src/config.ts` and the Persian sentence are not reordered.
4. In the **terminal**, if you have the command, check plugin status:

   ```
   /rtl.status
   ```

5. Run the automated tests:

   ```sh
   cd RTL_OpenCode && npm test
   ```

---

## 🛠️ Development

```sh
npm ci
npm run build      # tsc → dist/
npm run typecheck
npm test           # build + 15 tests (incl. the desktop-patch engine)
```

## 📂 Structure

```
RTL_OpenCode/
├── src/
│   ├── core.ts      ← bidi engine: direction detection, isolates, markdown/code, alignment
│   ├── server.ts    ← server hooks (Plugin)
│   ├── tui.ts       ← TUI commands (RTL: Show Status / Analyze Sample)
│   └── index.ts     ← exports
├── test/core.test.js   ← tests
├── patch/
│   ├── lib/patch-asar.mjs      ← shared cross-platform patch engine
│   ├── linux/desktop-rtl.sh    ← Desktop patch for Linux
│   ├── macos/desktop-rtl.sh    ← Desktop patch for macOS
│   └── windows/
│       ├── desktop-rtl.ps1     ← Desktop patch for Windows
│       └── desktop-rtl.cmd     ← Windows double-click launcher
├── examples/opencode.json ← full example config
└── dist/             ← build output (committed)
```

## 🤖 CI & Releases (GitHub Actions)

- **`.github/workflows/ci.yml`** — on push/PR: install, typecheck, build, test on Node 20/22/24 + assert `dist` is in sync with source + syntax and engine tests for all three OS patch scripts.
- **`.github/workflows/release.yml`** — on a `v*` tag push:
  - creates a GitHub **Release** with a bundle (zip) + `npm pack` (.tgz);
  - if the `NPM_TOKEN` secret is configured, it also **publishes to npm** (`opencode-rtl-fix`).

  Tag a version:

  ```sh
  git tag v0.1.0 && git push origin v0.1.0
  ```

---

## 🙏 Credits

- **opencode** — [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode) · [opencode.ai](https://opencode.ai)
- The **opencode-rtl** npm plugin (author: `razavioo`) that inspired this implementation
- Related items in the opencode monorepo:
  - [issue #35319](https://github.com/anomalyco/opencode/issues/35319) — broken mixed text on Desktop
  - [issue #32984](https://github.com/anomalyco/opencode/issues/32984) — RTL rendering in the UIs
  - [issue #40286](https://github.com/anomalyco/opencode/issues/40286) — TUI RTL/bidi
  - [PR #25455](https://github.com/anomalyco/opencode/pull/25455) — `dir="auto"` for web

## 📄 License

[MIT](LICENSE) © sina khanzadeh