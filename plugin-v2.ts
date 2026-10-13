// opencode-rtl-fix — OpenCode v2 server plugin.
//
// V2 loads this file directly (`"./v2": "./plugin-v2.ts"`) and resolves
// `@opencode/plugin` at runtime, so this file intentionally lives OUTSIDE
// `src/` (tsc never compiles it) and uses no static type imports.
// Shared bidi logic comes from the built `dist/core.js` (same as v1).
//
// Mapping from v1 hooks (see src/server.ts):
//   chat.message                          -> ctx.session.hook("prompt")
//   experimental.chat.system.transform    -> ctx.session.hook("context" + "compaction" + "generate" + "title")
//   experimental.chat.messages.transform  -> ctx.session.hook("context")
//   tool.execute.after                    -> ctx.tool.hook("execute.after")
//   shell.env                             -> ctx.shell.hook("create.before")
//   (experimental.text.complete has no v2 equivalent; assistant text is
//    covered by sanitizing context messages + system guidance.)
import { Plugin } from "@opencode/plugin"
import { formatBidiText, normalizeOptions, statusText, systemPrompt } from "./dist/core.js"

const ID = "opencode-rtl-fix"

function mutateTextFields(value, format) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return
  for (const key of ["text", "content", "value", "output", "summary", "title"]) {
    const current = value[key]
    if (typeof current !== "string" || !current.trim()) continue
    value[key] = format(current)
  }
}

function mutateMessages(messages, format) {
  if (!Array.isArray(messages)) return
  for (const message of messages) {
    if (!message || typeof message !== "object") continue
    mutateTextFields(message, format)
    const parts = message.parts
    if (Array.isArray(parts)) for (const part of parts) mutateTextFields(part, format)
  }
}

export default {
  ...Plugin.define({
    id: ID,
    async setup(ctx) {
      const settings = normalizeOptions(ctx.options)
      const plain = { ...settings, alignRtlParagraphs: false }
      const clean = !settings.inlineControls
      const userMode = settings.isolateUserMessages
      const assistantMode = settings.isolateAssistantText
      const fmtUser = (s) => formatBidiText(s, userMode, plain)
      const fmtAssistant = (s) => formatBidiText(s, assistantMode, plain)

      console.log(`[${ID}] initialized (${statusText(settings)})`)

      // 1) Prompt admission — the v2 equivalent of v1 `chat.message`.
      await ctx.session.hook("prompt", (event) => {
        if (!settings.enabled) return
        if (!clean && userMode === "off") return
        if (event.prompt) mutateTextFields(event.prompt, fmtUser)
        const files = event.prompt?.files
        if (Array.isArray(files)) for (const f of files) mutateTextFields(f, fmtUser)
      })

      // 2) System guidance + history sanitation for every model-request kind.
      // v1 only had one system hook; v2 splits requests into context /
      // compaction / generate / title, so register on all four.
      const guidance = systemPrompt(settings)
      const applyContext = (event) => {
        if (!settings.enabled) return
        if (guidance && Array.isArray(event.system)) {
          const exists = event.system.some(
            (s) => (typeof s === "string" ? s : s?.text ?? "").includes("RTL language support is active."),
          )
          if (!exists) event.system.push({ type: "text", text: guidance })
        }
        if (clean || userMode !== "off") mutateMessages(event.messages, fmtUser)
      }
      await ctx.session.hook("context", applyContext)
      await ctx.session.hook("compaction", (event) => {
        if (!settings.enabled) return
        if (clean || userMode !== "off") mutateMessages(event.messages, fmtUser)
        if (event.result) mutateTextFields(event.result, fmtAssistant)
      })
      await ctx.session.hook("generate", applyContext)
      await ctx.session.hook("title", (event) => {
        if (!settings.enabled) return
        if (event.result) mutateTextFields(event.result, fmtAssistant)
      })

      // 3) Tool output — v2 equivalent of v1 `tool.execute.after`.
      if (settings.enabled && settings.isolateToolOutput !== "off") {
        const toolMode = settings.isolateToolOutput
        await ctx.tool.hook("execute.after", (event) => {
          const out = event.output ?? event.result ?? event.data
          if (typeof out === "string") {
            const fixed = formatBidiText(out, toolMode, plain)
            if (event.output !== undefined) event.output = fixed
            else if (event.result !== undefined) event.result = fixed
            else if (event.data !== undefined) event.data = fixed
          } else if (out && typeof out === "object") {
            mutateTextFields(out, (s) => formatBidiText(s, toolMode, plain))
          }
        })
      }

      // 4) Direction env — v2 equivalent of v1 `shell.env`.
      if (settings.directionEnv) {
        await ctx.shell.hook("create.before", (event) => {
          event.env = {
            ...event.env,
            OPENCODE_RTL: settings.enabled ? "1" : "0",
            OPENCODE_RTL_LANGUAGE: settings.language,
            OPENCODE_RTL_USER_ISOLATION: settings.isolateUserMessages,
            OPENCODE_RTL_ASSISTANT_ISOLATION: settings.isolateAssistantText,
          }
        })
      }
    },
  }),
  // V1 object entrypoint (opencode >= 1.18.29 also accepts this shape).
  // Kept so the SAME package runs on v1.19 without a separate install.
  async server(input, options) {
    const { server } = await import("./dist/server.js")
    const hooks = await server(input, options)
    return hooks
  },
}
