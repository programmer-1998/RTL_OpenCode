import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { PLUGIN_ID, analyzeDirection, normalizeOptions, statusText } from "./core.js"

export const tui: TuiPlugin = async (api, options) => {
  const settings = normalizeOptions(options)
  const disposers: Array<() => void> = []

  const showStatus = () => {
    api.ui.toast({
      variant: settings.enabled ? "success" : "warning",
      title: "RTL fix",
      message: statusText(settings),
      duration: 6000,
    })
  }

  const analyzeSample = () => {
    const sample = "\u0633\u0644\u0627\u0645 \u0645\u0646 opencode \u0647\u0633\u062a\u0645"
    const analysis = analyzeDirection(sample, settings)
    api.ui.toast({
      variant: analysis.direction === "rtl" ? "success" : "warning",
      title: "RTL sample",
      message: `direction=${analysis.direction} bidi=${String(analysis.bidi)} language=${analysis.language} ratio=${analysis.rtlRatio.toFixed(2)}`,
      duration: 6000,
    })
  }

  if (api.command) {
    disposers.push(
      api.command.register(() => [
        {
          title: "RTL: Show Status",
          value: "rtl.status",
          description: "Show current RTL fix settings.",
          category: "Plugins",
          onSelect: showStatus,
        },
        {
          title: "RTL: Analyze Sample",
          value: "rtl.sample",
          description: "Run RTL detection against a mixed Persian/English sample.",
          category: "Plugins",
          onSelect: analyzeSample,
        },
      ]),
    )
  }

  api.lifecycle.onDispose(() => {
    for (const item of disposers) item()
  })
}

export default {
  id: PLUGIN_ID,
  tui,
} satisfies TuiPluginModule