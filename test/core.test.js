import { test } from "node:test"
import assert from "node:assert/strict"
import {
  formatBidiText,
  normalizeOptions,
  resolveDirection,
  stripDirectionalControls,
} from "../dist/index.js"

const DEFAULTS = normalizeOptions({})
const ISOLATED = normalizeOptions({ inlineControls: true })

const RLI = "\u2067"
const LRI = "\u2066"
const PDI = "\u2069"
const NBSP = "\u00a0"

test("mixed Persian + English sentence gets RTL isolate", () => {
  const out = formatBidiText("سلام من SINA هستم", "auto", ISOLATED)
  assert.ok(out.startsWith(RLI))
  assert.ok(out.endsWith(PDI))
  assert.ok(out.includes(`${LRI}SINA${PDI}`))
  assert.equal(stripDirectionalControls(out), "سلام من SINA هستم")
})

test("default inlineControls off injects no invisible characters", () => {
  const out = formatBidiText("سلام من SINA هستم", "auto", DEFAULTS)
  assert.equal(out, "سلام من SINA هستم")
  assert.ok(!out.includes(RLI))
  assert.ok(!out.includes(LRI))
  assert.ok(!out.includes(PDI))
})

test("inlineControls off strips pre-existing direction controls", () => {
  const out = formatBidiText(`\u200e${RLI}سلام PDI هستم`, "auto", DEFAULTS)
  assert.ok(!out.includes(RLI))
  assert.ok(!out.includes(PDI))
  assert.ok(!out.includes("\u200e"))
  assert.equal(out, "سلام PDI هستم")
})

test("inlineControls off keeps digitMode conversion", () => {
  const opts = normalizeOptions({ digitMode: "latin" })
  const out = formatBidiText("شماره ۱۲۳۴", "auto", opts)
  assert.equal(out, "شماره 1234")
})

test("pure English text is untouched in auto mode", () => {
  const out = formatBidiText("Hello world", "auto", ISOLATED)
  assert.equal(out, "Hello world")
})

test("empty and neutral text are untouched", () => {
  assert.equal(formatBidiText("", "auto", ISOLATED), "")
  assert.equal(formatBidiText("   ", "auto", ISOLATED), "   ")
})

test("fenced code blocks are left alone", () => {
  const input = "سلام از کد زیر:\n```js\nconst x = \"hello\"\n```\nتمام شد"
  const out = formatBidiText(input, "auto", ISOLATED)
  assert.ok(out.includes('const x = "hello"'))
  assert.ok(out.includes("```js"))
})

test("inline code is isolated as LTR inside RTL prose", () => {
  const out = formatBidiText("بگو `console.log(x)` چیست", "auto", ISOLATED)
  assert.ok(out.includes(`${LRI}console.log(x)${PDI}`))
})

test("list markers survive isolation", () => {
  const out = formatBidiText("- سلام SINA هستم", "auto", ISOLATED)
  assert.ok(out.startsWith("- "))
  assert.ok(out.includes(`${LRI}SINA${PDI}`))
})

test("table cells are isolated per cell", () => {
  const input = "| لازم | انگلیسی |\n| --- | --- |\n| بله | yes |"
  const out = formatBidiText(input, "auto", ISOLATED)
  assert.ok(out.includes("| yes |"))
  assert.equal(stripDirectionalControls(out), input)
})

test("forceDirection ltr with always mode wraps RTL tokens", () => {
  const opts = normalizeOptions({ inlineControls: true, forceDirection: "ltr", isolateAssistantText: "always" })
  const out = formatBidiText("meh باقی ماند", "always", opts)
  assert.ok(out.startsWith(LRI))
  assert.ok(out.includes(`${RLI}باقی${PDI}`))
})

test("digit mode normalizes Persian digits", () => {
  const opts = normalizeOptions({ inlineControls: true, digitMode: "latin" })
  const out = formatBidiText("شماره ۱۲۳۴", "auto", opts)
  assert.equal(stripDirectionalControls(out), "شماره 1234")
})

test("alignRtlParagraphs pads lines to the align column", () => {
  const opts = normalizeOptions({
    inlineControls: true,
    alignRtlParagraphs: true,
    rtlWrapColumn: 100,
    rtlAlignColumn: 30,
  })
  const out = formatBidiText("سلام دنیا", "auto", opts)
  assert.ok(out.includes(NBSP))
  assert.ok(out.startsWith(`${NBSP.repeat(21)}${RLI}`))
  assert.equal(stripDirectionalControls(out.replaceAll(NBSP, "")), "سلام دنیا")
})

test("direction resolution uses first strong character", () => {
  assert.equal(resolveDirection("سلام من SINA هستم", DEFAULTS), "rtl")
  assert.equal(resolveDirection("SINA is یک کلمه", DEFAULTS), "ltr")
  assert.equal(resolveDirection("123", DEFAULTS), "neutral")
})

test("disabled plugin returns input unchanged", () => {
  const opts = normalizeOptions({ enabled: false })
  assert.equal(formatBidiText("سلام من SINA هستم", "auto", opts), "سلام من SINA هستم")
})

test("isolateUserMessages off keeps user text unchanged", () => {
  const opts = normalizeOptions({ inlineControls: true, isolateUserMessages: "off" })
  assert.equal(formatBidiText("سلام من SINA هستم", "off", opts), "سلام من SINA هستم")
})

test("off mode bypasses stripping even with inlineControls off", () => {
  assert.equal(formatBidiText(`\u200e${RLI}سلام PDI هستم`, "off", DEFAULTS), `\u200e${RLI}سلام PDI هستم`)
})

test("newlines and blank lines are preserved", () => {
  const input = "سلام\n\nمتن دوم SINA\n"
  const out = formatBidiText(input, "auto", ISOLATED)
  assert.equal(stripDirectionalControls(out), input)
  assert.equal(out.split("\n").length, 4)
})