<p align="center">

# 🇺🇸 OpenCode RTL Fix

**Bidirectional (RTL/LTR) plugin for opencode** — fixes mixed Persian/Arabic/Hebrew + English text in the opencode terminal, Desktop and web UI

[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green?style=for-the-badge)]()
[![CI](https://img.shields.io/github/actions/workflow/status/programmer-1998/RTL_OpenCode/ci.yml?style=for-the-badge)](https://github.com/programmer-1998/RTL_OpenCode/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/opencode-rtl-fix?style=for-the-badge&label=npm)](https://www.npmjs.com/package/opencode-rtl-fix)
[![GitHub](https://img.shields.io/badge/GitHub-RTL__OpenCode-181717?style=for-the-badge&logo=github)](https://github.com/programmer-1998/RTL_OpenCode)

**Languages:** [🇮🇷 فارسی](README.md) · [🇬🇧 English](README.en.md) · [🇸🇦 العربية](README.ar.md)

**👤 Author:** [Sina Khanzadeh](https://sina-khanzadeh.ir) · ID: `programmer_1998` (Discord / Telegram / Instagram) · Email: khanzadeh.1377@gmail.com

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
| **1) Text layer (opencode server)** | `server` plugin | Sent user messages, chat history, model replies and tool output — using Unicode **bidi isolates** (`RLI` / `LRI` / `PDI`) per UAX #9. From opencode **1.18.31** the Terminal/Desktop renderer also applies `dir="auto"` + `unicode-bidi: plaintext` natively, so this layer focuses on the TUI/web and wording that the model keeps LTR tokens intact |
| **2) UI layer (Desktop)** | `app.asar` patch (engine `patch/lib/patch-asar.mjs` + per-OS wrapper), which the server plugin also applies & self-heals | **Every text surface of the UI**: the live prompt composer, chat messages, tab/session & terminal titles, menus, dialogs, toasts, settings, file tree, review filenames, attachments, permissions and questions — by injecting `dir="auto"` + `unicode-bidi: plaintext` into `app.asar` (code, diffs and shell output stay LTR) — plus the **Vazirmatn** font for all UI text |

<details>
<summary>🔍 How does it work?</summary>

- **The plugin** hooks into opencode's server hooks (`chat.message`, `experimental.text.complete`, `tool.execute.after`, …). For each paragraph it resolves the direction via the **first-strong character** rule; RTL paragraphs are wrapped in `RLI…PDI`, and the English/code tokens inside them (like `SINA`, `/path/to/file`) are isolated with `LRI…PDI` so their order never flips. These Unicode control characters can upset naive cell-by-cell terminal renderers and pollute the buffer fed to the model (e.g. `^` noise), so this wrapping is **opt-in** via `inlineControls: true`. By default the plugin injects no control characters and additionally **strips** any direction-control chars already stuck to the text.
- **The Desktop patch** appends a `<style>` and `<script>` to `out/renderer/index.html` inside `app.asar`. Since opencode **1.18.31** already fixes messages/replies natively, the patch targets only what the app still misses: the live composer (`[data-component="prompt-input"]`, `[data-component="prompt-input-v2"]`) and the window/tab titles (`[data-slot="tab-title"]`, `[data-slot="terminal-tab-title"]`), forcing `dir="auto"` + plaintext bidi on them. The same patch also inlines the **Vazirmatn** font as a base64 `@font-face` and sets `--font-family-sans`, so the whole UI uses Vazirmatn with no system font install and no network.
- **No plugin hook reaches the Desktop renderer:** the server plugin only has server hooks, the CLI plugin is terminal-only, and opencode's "GUI extensions" system is development-builds-only in the released app. So patching `app.asar` is the only route — and the server plugin applies and **self-heals** that patch automatically (see below).

</details>

## ✨ Features

- ✅ Correct rendering of mixed Persian/Arabic/Hebrew/Urdu + English paragraphs
- ✅ Isolation of English words and identifiers inside RTL text (`SINA`, `API`, paths)
- ✅ Full protection of **code** — fenced blocks, indented code and `inline code` are left untouched
- ✅ Previous messages (chat history) are corrected when loaded
- ✅ Automatic direction detection (first-strong character) + optional forced `rtl`/`ltr`
- ✅ Optional system-guidance so the model answers in your language and keeps code/paths LTR
- ✅ Optional `OPENCODE_RTL*` env vars for tools
- ✅ TUI status commands: `RTL: Show Status` and `RTL: Analyze Sample` (also on v2 via the new CLI API)
- ✅ Desktop patch for all three OSes (Linux / macOS / Windows) with automatic backup, `app.asar.unpacked` layout verification and `--unpatch`
- ✅ Full desktop UI coverage: chat & composer, session and terminal tabs, menus, dialogs, toasts, settings, file tree & file viewer, review panel, attachments, permissions and questions — with LTR protection for code/diffs/shell output
- ✅ **Vazirmatn (OFL)** font embedded in the desktop UI (no system font install needed)
- ✅ **Self-healing**: the server plugin applies the desktop patch automatically and re-applies it after every desktop update (no manual re-run)
- ✅ Compatible with opencode **1.19.0** and **2.x** (`./v2` server entry, `./v2/tui` CLI entry)

## ⚠️ Important limitation (honest)

**The prompt composer, while you are still typing, is rendered by opencode's own UI and no plugin hook has access to the live buffer.** So:

- **Desktop app** → this part is fixed by the `app.asar` patch (engine `patch/lib/patch-asar.mjs` plus a per-OS wrapper). No plugin/extension reaches the desktop renderer, so the server plugin applies this patch itself and **self-heals** it — set `desktop: false` if you'd rather patch manually.
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

### Option 4 — opencode 2 (v2)

In v2 the `plugin` key was renamed to `plugins`, and the TUI plugin is configured separately in `cli.json`:

```jsonc
// opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "opencode-rtl-fix", "options": { "language": "auto" } }
  ]
}
```

```jsonc
// cli.json (for the RTL terminal commands)
{
  "plugins": ["opencode-rtl-fix"]
}
```

This package ships both APIs: a `./v2` server entry (v2 `ctx.session.hook`) and a `./v2/tui` CLI entry. Hook mapping: `chat.message` → `prompt`, `system.transform` → `context/compaction/generate/title`, `tool.execute.after` → `tool.hook("execute.after")`, `shell.env` → `shell.hook("create.before")`.

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
| `inlineControls` | `false` | Never inject invisible Unicode control chars (`RLI`/`LRI`/`PDI`) into text. In the default mode the plugin also **strips** direction-control chars already stuck to the text (e.g. LRM/RLM pasted from the web) so the terminal buffer and the model context stay clean — this prevents `^` rendering noise. Set `true` for manual isolate wrapping |
| `minRtlRatio` | `0.2` | Minimum RTL character ratio for auto-detection |
| `minRtlCharacters` | `2` | Minimum RTL character count |
| `digitMode` | `"preserve"` | Digit conversion: `preserve` / `latin` / `arabic-indic` / `eastern-arabic` |
| `forceDirection` | `"auto"` | Force isolate direction: `auto` / `rtl` / `ltr` |
| `alignRtlParagraphs` | `false` | Visual right-align in terminal via padding **(`align` also changes raw text; TUI only)** |
| `rtlWrapColumn` | `96` | Wrap column used by alignment |
| `rtlAlignColumn` | `96` | Right-align column |
| `directionEnv` | `true` | Export `OPENCODE_RTL*` in tool environments |
| `desktop` | `true` | Auto-install / self-heal the Desktop patch (`app.asar` + Vazirmatn). Set `false` to leave app files untouched |
| `debug` | `false` | Log via `client.app.log()` |

> **Direction note:** direction follows the *first strong character* — a sentence starting with Persian becomes RTL, one starting with English/code becomes LTR. To force everything RTL: `"forceDirection": "rtl"`.

---

## 🔧 Troubleshooting: `^` rendering noise in the terminal

If you see extra characters such as `^^^^^` while RTL text renders in the TUI, the cause is **invisible Unicode characters** — bidi isolates (`U+2066`/`U+2067`/`U+2069`) or LRM/RLM stuck to text pasted from the web — that a naive cell-by-cell renderer miscalculates. What this plugin does:

- Since this version, control characters are **not injected** by default and any direction-control chars already present are **stripped** from the flowing text (`inlineControls: false`).
- If you manually set `inlineControls: true` and see noise, turn it back off.
- Old sessions created with previous plugin versions may still carry these characters in stored text; start a new session.

---

## 🖥️ Desktop app patch (full UI coverage)

The Electron app renders parts of its text without any automatic direction. The patch appends a `<style>` + `<script>` to `out/renderer/index.html` inside `app.asar` so **every text surface** — chat & composer, tabs, menus, dialogs, toasts, settings, file tree/viewer, review panel, attachments, permissions and questions — behaves exactly like in modern browsers (code, diffs and shell output intentionally stay LTR). The same patch inlines the **Vazirmatn** font as base64 and sets `--font-family-sans`, so the whole UI uses Vazirmatn with no system font install and no network.

> 🔁 **Important:** from **0.2.0** the server plugin applies this patch and **self-heals** it — after every desktop update (which replaces `app.asar`) the plugin re-applies it automatically. The manual scripts below are only needed if you set `desktop: false`, or want it applied right now without a restart.

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
2. Extracts, patches `index.html` (bidi rules + the Vazirmatn `@font-face`), repacks the archive;
3. **Verifies the `app.asar.unpacked` layout (native modules like `node-pty`) one-by-one against the previous version** so nothing breaks;
4. Writes a version stamp (`app.asar.rtl-stamp`) that the plugin uses to tell whether the patch is current and to **upgrade** older patches (never patching an already-patched file twice).

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

### 🔁 Self-healing after every update (default)

The app auto-updates and the update replaces the patched file. From **0.2.0** no manual step is needed:

- the server plugin (started with the Desktop/CLI) checks, on load, whether the patch exists and is current;
- the `app.asar` is locked while the app runs, so the plugin first probes whether the file is writable and only patches when the app is closed, retrying every 2 minutes meanwhile;
- so: install the plugin → quit the Desktop app → next launch it is patched. After every update it heals itself the same way.

> Prefer to keep the plugin away from app files? Set `"desktop": false` and use the manual scripts. None of this needs `sudo`/UAC unless the app is installed in a system location.

### Manual install (optional)

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
npm test           # build + tests (incl. the desktop-patch engine)
```

## 📂 Structure

```
RTL_OpenCode/
├── src/
│   ├── core.ts      ← bidi engine: direction detection, isolates, markdown/code, alignment
│   ├── desktop.ts   ← desktop self-heal guard (applies / re-applies app.asar)
│   ├── server.ts    ← server hooks, v1 (1.19)
│   ├── tui.ts       ← TUI commands in v1
│   └── index.ts     ← exports
├── plugin-v2.ts     ← v2 server plugin (opencode 2, `./v2`)
├── tui-v2.ts        ← v2 CLI plugin (RTL commands, `./v2/tui`)
│   └── index.ts     ← exports
├── test/core.test.js   ← tests
├── patch/
│   ├── lib/patch-asar.mjs      ← shared cross-platform patch engine + self-heal guard
│   ├── fonts/Vazirmatn-Variable.woff2 ← Vazirmatn (OFL), inlined as base64
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

## 👤 Author

This project was built by **Sina Khanzadeh**.

- 🌐 Personal site: [sina-khanzadeh.ir](https://sina-khanzadeh.ir)
- 📧 Email: [khanzadeh.1377@gmail.com](mailto:khanzadeh.1377@gmail.com)
- 🆔 Same ID across social media: `programmer_1998` (Discord · Telegram · Instagram)
- 📦 GitHub: [programmer-1998/RTL_OpenCode](https://github.com/programmer-1998/RTL_OpenCode)

## 🙏 Credits

- **opencode** — [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode) · [opencode.ai](https://opencode.ai)
- Contributor: **sadegh19b** — embedded Vazirmatn font, desktop-patch self-heal and the `desktop` option ([PR #2](https://github.com/programmer-1998/RTL_OpenCode/pull/2))
- **Vazirmatn** font — by Saber Rastikerdar, licensed under [SIL OFL 1.1](https://github.com/rastikerdar/vazirmatn/blob/master/OFL.txt)
- The **opencode-rtl** npm plugin (author: `razavioo`) that inspired this implementation
- Related items in the opencode monorepo:
  - [issue #35319](https://github.com/anomalyco/opencode/issues/35319) — broken mixed text on Desktop
  - [issue #32984](https://github.com/anomalyco/opencode/issues/32984) — RTL rendering in the UIs
  - [issue #40286](https://github.com/anomalyco/opencode/issues/40286) — TUI RTL/bidi
  - [PR #25455](https://github.com/anomalyco/opencode/pull/25455) — `dir="auto"` for web

## 📄 License

[MIT](LICENSE) © Sina Khanzadeh — sina-khanzadeh.ir · khanzadeh.1377@gmail.com