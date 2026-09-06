import { test } from "node:test"
import assert from "node:assert/strict"
import {
  formatBidiText,
  normalizeOptions,
  resolveDirection,
  stripDirectionalControls,
} from "../dist/index.js"

const DEFAULTS = normalizeOptions({})

const RLI = "\u2067"
const LRI = "\u2066"
const PDI = "\u2069"
const NBSP = "\u00a0"

test("mixed Persian + English sentence gets RTL isolate", () => {
  const out = formatBidiText("سلام من SINA هستم", "auto", DEFAULTS)
  assert.ok(out.startsWith(RLI))
  assert.ok(out.endsWith(PDI))
  assert.ok(out.includes(`${LRI}SINA${PDI}`))
  assert.equal(stripDirectionalControls(out), "سلام من SINA هستم")
})

test("pure English text is untouched in auto mode", () => {
  const out = formatBidiText("Hello world", "auto", DEFAULTS)
  assert.equal(out, "Hello world")
})

test("empty and neutral text are untouched", () => {
  assert.equal(formatBidiText("", "auto", DEFAULTS), "")
  assert.equal(formatBidiText("   ", "auto", DEFAULTS), "   ")
})

test("fenced code blocks are left alone", () => {
  const input = "سلام از کد زیر:\n```js\nconst x = \"hello\"\n```\nتمام شد"
  const out = formatBidiText(input, "auto", DEFAULTS)
  assert.ok(out.includes('const x = "hello"'))
  assert.ok(out.includes("```js"))
})

test("inline code is isolated as LTR inside RTL prose", () => {
  const out = formatBidiText("بگو `console.log(x)` چیست", "auto", DEFAULTS)
  assert.ok(out.includes(`${LRI}console.log(x)${PDI}`))
})

test("list markers survive isolation", () => {
  const out = formatBidiText("- سلام SINA هستم", "auto", DEFAULTS)
  assert.ok(out.startsWith("- "))
  assert.ok(out.includes(`${LRI}SINA${PDI}`))
})

test("table cells are isolated per cell", () => {
  const input = "| لازم | انگلیسی |\n| --- | --- |\n| بله | yes |"
  const out = formatBidiText(input, "auto", DEFAULTS)
  assert.ok(out.includes("| yes |"))
  assert.equal(stripDirectionalControls(out), input)
})

test("forceDirection ltr with always mode wraps RTL tokens", () => {
  const opts = normalizeOptions({ forceDirection: "ltr", isolateAssistantText: "always" })
  const out = formatBidiText("meh باقی ماند", "always", opts)
  assert.ok(out.startsWith(LRI))
  assert.ok(out.includes(`${RLI}باقی${PDI}`))
})

test("digit mode normalizes Persian digits", () => {
  const opts = normalizeOptions({ digitMode: "latin" })
  const out = formatBidiText("شماره ۱۲۳۴", "auto", opts)
  assert.equal(stripDirectionalControls(out), "شماره 1234")
})

test("alignRtlParagraphs pads lines to the align column", () => {
  const opts = normalizeOptions({ alignRtlParagraphs: true, rtlWrapColumn: 100, rtlAlignColumn: 30 })
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
  const opts = normalizeOptions({ isolateUserMessages: "off" })
  assert.equal(formatBidiText("سلام من SINA هستم", "off", opts), "سلام من SINA هستم")
})

test("newlines and blank lines are preserved", () => {
  const input = "سلام\n\nمتن دوم SINA\n"
  const out = formatBidiText(input, "auto", DEFAULTS)
  assert.equal(stripDirectionalControls(out), input)
  assert.equal(out.split("\n").length, 4)
})