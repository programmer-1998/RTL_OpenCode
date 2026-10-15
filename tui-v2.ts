// opencode-rtl-fix — OpenCode v2 CLI (TUI) plugin.
//
// Loaded via `"./v2/tui": "./tui-v2.ts"` and configured in `cli.json`:
//   { "plugins": ["opencode-rtl-fix"] }
// Like plugin-v2.ts this file lives outside `src/` and relies on the
// runtime-resolved `@opencode/plugin/tui` import plus built dist/core.js.
import { Plugin } from "@opencode/plugin/tui"
import { analyzeDirection, normalizeOptions, statusText } from "./dist/core.js"
import { ensureDesktopPatch } from "./dist/desktop.js"

export default Plugin.define({
  id: "opencode-rtl-fix.cli",
  async setup(context) {
    const settings = normalizeOptions(context.options)
    ensureDesktopPatch({ enabled: settings.desktop, log: (message) => console.log(`[opencode-rtl-fix] ${message}`) })

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "rtl.status",
          title: "RTL: Show Status",
          group: "Plugins",
          palette: true,
          slash: { name: "rtl.status" },
          run: async () => {
            await context.ui.toast.show({
              title: "RTL fix",
              message: statusText(settings),
              variant: settings.enabled ? "success" : "warning",
              duration: 6000,
            })
          },
        },
        {
          id: "rtl.sample",
          title: "RTL: Analyze Sample",
          group: "Plugins",
          palette: true,
          slash: { name: "rtl.sample" },
          run: async () => {
            const sample = "سلام من opencode هستم"
            const analysis = analyzeDirection(sample, settings)
            await context.ui.toast.show({
              title: "RTL sample",
              message: `direction=${analysis.direction} bidi=${String(analysis.bidi)} language=${analysis.language} ratio=${analysis.rtlRatio.toFixed(2)}`,
              variant: analysis.direction === "rtl" ? "success" : "warning",
              duration: 6000,
            })
          },
        },
      ],
    }))
  },
})
