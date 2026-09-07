export const PLUGIN_ID = "opencode-rtl-fix";
export const RTL_LANGUAGES = ["ar", "fa", "he", "ur", "ps", "sd", "yi", "dv", "ug", "ku"];
const RLI = "\u2067";
const LRI = "\u2066";
const PDI = "\u2069";
const NBSP = "\u00a0";
const ZWNJ = "\u200c";
const RTL_STRONG = /[\u0591-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u;
const RTL_STRONG_G = /[\u0591-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/gu;
const LTR_STRONG = /[A-Za-z\u00c0-\u02af\u0370-\u052f\u10a0-\u10ff\u1e00-\u1eff]/u;
const LTR_STRONG_G = /[A-Za-z\u00c0-\u02af\u0370-\u052f\u10a0-\u10ff\u1e00-\u1eff]/gu;
const DIRECTIONAL_CONTROLS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const LATIN_TOKEN = /[A-Za-z0-9][A-Za-z0-9._~:/#%+@*-]*/g;
const RTL_TOKEN = /[\u0591-\u08ff\ufb1d-\ufdff\ufe70-\ufeff][\u0591-\u08ff\ufb1d-\ufdff\ufe70-\ufeff\u200c\u200d\u0660-\u0669\u06f0-\u06f9.,\-_]*/gu;
const INLINE_CODE = /(`+)([\s\S]*?)\1/g;
const EMPHASIS = /(?:\*\*|\*|__|_|~~)/g;
const HEBREW = /[\u0590-\u05ff]/u;
const URDU = /[\u0679\u0688\u0691\u06ba\u06be\u06c1-\u06c3\u06d2]/u;
const PERSIAN = /[\u067e\u0686\u0698\u06af]/u;
const ARABIC = /[\u0600-\u06ff\u0750-\u077f\u0870-\u089f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u;
const THAANA = /[\u0780-\u07bf]/u;
const YIDDISH = /[\u05f0-\u05f4]/u;
const DEFAULT_OPTIONS = {
    enabled: true,
    language: "auto",
    systemGuidance: true,
    isolateUserMessages: "auto",
    isolateAssistantText: "auto",
    isolateToolOutput: "off",
    minRtlRatio: 0.2,
    minRtlCharacters: 2,
    digitMode: "preserve",
    forceDirection: "auto",
    alignRtlParagraphs: false,
    rtlWrapColumn: 96,
    rtlAlignColumn: 96,
    directionEnv: true,
    debug: false,
};
export function normalizeOptions(input) {
    const raw = isRecord(input) ? input : {};
    return {
        enabled: readBoolean(raw.enabled, DEFAULT_OPTIONS.enabled),
        language: readLanguage(raw.language, DEFAULT_OPTIONS.language),
        systemGuidance: readSystemGuidance(raw.systemGuidance, DEFAULT_OPTIONS.systemGuidance),
        isolateUserMessages: readIsolation(raw.isolateUserMessages, DEFAULT_OPTIONS.isolateUserMessages),
        isolateAssistantText: readIsolation(raw.isolateAssistantText, DEFAULT_OPTIONS.isolateAssistantText),
        isolateToolOutput: readIsolation(raw.isolateToolOutput, DEFAULT_OPTIONS.isolateToolOutput),
        minRtlRatio: readNumber(raw.minRtlRatio, DEFAULT_OPTIONS.minRtlRatio, 0, 1),
        minRtlCharacters: Math.max(0, Math.trunc(readNumber(raw.minRtlCharacters, DEFAULT_OPTIONS.minRtlCharacters, 0, 1000))),
        digitMode: readDigitMode(raw.digitMode, DEFAULT_OPTIONS.digitMode),
        forceDirection: readForceDirection(raw.forceDirection, DEFAULT_OPTIONS.forceDirection),
        alignRtlParagraphs: readBoolean(raw.alignRtlParagraphs, DEFAULT_OPTIONS.alignRtlParagraphs),
        rtlWrapColumn: Math.trunc(readNumber(raw.rtlWrapColumn, DEFAULT_OPTIONS.rtlWrapColumn, 20, 240)),
        rtlAlignColumn: Math.trunc(readNumber(raw.rtlAlignColumn, DEFAULT_OPTIONS.rtlAlignColumn, 20, 240)),
        directionEnv: readBoolean(raw.directionEnv, DEFAULT_OPTIONS.directionEnv),
        debug: readBoolean(raw.debug, DEFAULT_OPTIONS.debug),
    };
}
export function analyzeDirection(text, options = DEFAULT_OPTIONS) {
    if (options.language === "none") {
        return {
            direction: "ltr",
            bidi: false,
            firstStrong: "ltr",
            language: "none",
            rtlCharacters: 0,
            ltrCharacters: 0,
            rtlRatio: 0,
        };
    }
    const rtlCharacters = countMatches(text, RTL_STRONG_G);
    const ltrCharacters = countMatches(text, LTR_STRONG_G);
    const directionalCharacters = rtlCharacters + ltrCharacters;
    const rtlRatio = directionalCharacters === 0 ? 0 : rtlCharacters / directionalCharacters;
    const firstStrong = findFirstStrong(text);
    const detectedLanguage = options.language === "auto" ? detectLanguage(text) : options.language;
    if (options.language !== "auto" && isRtlLanguage(options.language)) {
        return {
            direction: "rtl",
            bidi: rtlCharacters > 0 && ltrCharacters > 0,
            firstStrong,
            language: options.language,
            rtlCharacters,
            ltrCharacters,
            rtlRatio,
        };
    }
    if (firstStrong !== "neutral") {
        const direction = firstStrong;
        return {
            direction,
            bidi: rtlCharacters > 0 && ltrCharacters > 0,
            firstStrong,
            language: detectedLanguage,
            rtlCharacters,
            ltrCharacters,
            rtlRatio,
        };
    }
    const rtlDetected = rtlCharacters >= options.minRtlCharacters && rtlRatio >= options.minRtlRatio;
    if (rtlDetected) {
        return {
            direction: "rtl",
            bidi: ltrCharacters > 0,
            firstStrong,
            language: detectedLanguage,
            rtlCharacters,
            ltrCharacters,
            rtlRatio,
        };
    }
    if (directionalCharacters === 0) {
        return {
            direction: "neutral",
            bidi: false,
            firstStrong,
            language: detectedLanguage,
            rtlCharacters,
            ltrCharacters,
            rtlRatio,
        };
    }
    return {
        direction: "ltr",
        bidi: rtlCharacters > 0,
        firstStrong,
        language: detectedLanguage,
        rtlCharacters,
        ltrCharacters,
        rtlRatio,
    };
}
export function resolveDirection(text, options) {
    if (options.forceDirection !== "auto")
        return options.forceDirection;
    return analyzeDirection(stripDirectionalControls(text), options).direction;
}
export function detectLanguage(text) {
    if (YIDDISH.test(text))
        return "yi";
    if (HEBREW.test(text))
        return "he";
    if (THAANA.test(text))
        return "dv";
    if (URDU.test(text))
        return "ur";
    if (PERSIAN.test(text))
        return "fa";
    if (ARABIC.test(text))
        return "ar";
    return "unknown";
}
export function formatBidiText(text, mode, options) {
    if (!options.enabled)
        return text;
    if (!text.trim())
        return text;
    if (options.alignRtlParagraphs) {
        return alignAndIsolate(text, mode, options);
    }
    return isolateLines(text, mode, options);
}
export function stripDirectionalControls(text) {
    return text.replace(DIRECTIONAL_CONTROLS, "");
}
export function systemPrompt(options) {
    if (!options.enabled || options.systemGuidance === false)
        return undefined;
    if (options.language === "none")
        return undefined;
    if (typeof options.systemGuidance === "string")
        return options.systemGuidance;
    const language = options.language === "auto" ? "the user's RTL language" : languageName(options.language);
    const guidance = [
        "RTL language support is active.",
        `When the user writes in ${language}, answer in that same language unless they explicitly ask otherwise.`,
        "Preserve Markdown structure while making RTL prose natural and readable.",
        "Keep code blocks, shell commands, file paths, identifiers, URLs, logs, and API names left-to-right and unchanged.",
        "Do not translate code, command output, stack traces, package names, or file names unless the user explicitly asks for translation.",
        "For mixed RTL/LTR text, keep technical tokens close to their explanation and avoid reordering punctuation around code spans.",
        "When you embed a multi-word Western phrase in RTL prose (for example \"safe mode\", \"right click\"), keep its words in their natural Western order — never write \"mode safe\". The UI already renders mixed text correctly, so do not reorder anything yourself.",
    ];
    return guidance.join("\n");
}
export function languageName(language) {
    switch (language) {
        case "ar":
            return "Arabic";
        case "fa":
            return "Persian";
        case "he":
            return "Hebrew";
        case "ur":
            return "Urdu";
        case "ps":
            return "Pashto";
        case "sd":
            return "Sindhi";
        case "yi":
            return "Yiddish";
        case "dv":
            return "Divehi";
        case "ug":
            return "Uyghur";
        case "ku":
            return "Kurdish";
        case "none":
            return "left-to-right text";
        case "auto":
            return "auto-detected RTL text";
    }
}
export function isRtlLanguage(language) {
    return RTL_LANGUAGES.includes(language);
}
export function statusText(options) {
    return [
        `enabled=${String(options.enabled)}`,
        `language=${options.language}`,
        `user=${options.isolateUserMessages}`,
        `assistant=${options.isolateAssistantText}`,
        `tools=${options.isolateToolOutput}`,
        `digits=${options.digitMode}`,
        `force=${options.forceDirection}`,
        `align=${String(options.alignRtlParagraphs)}`,
    ].join(" ");
}
function isolateLines(text, mode, options) {
    const { lines, newlines } = splitKeepNewlines(text);
    const out = new Array(lines.length);
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (line.trim() === "") {
            out[i] = applyDigitMode(line, options.digitMode);
            continue;
        }
        const isFence = isFenceLine(line);
        if (isFence)
            inFence = !inFence;
        if (isFence || inFence || isIndentedCode(line)) {
            out[i] = line;
            continue;
        }
        if (isTableRow(line)) {
            out[i] = formatTableRow(line, mode, options);
            continue;
        }
        out[i] = formatBlockLine(line, mode, options);
    }
    return joinLines(out, newlines);
}
function alignAndIsolate(text, mode, options) {
    const { lines, newlines } = splitKeepNewlines(text);
    const resultParts = [];
    let inFence = false;
    let i = 0;
    while (i < lines.length) {
        const line = lines[i] ?? "";
        if (line.trim() === "") {
            resultParts.push(applyDigitMode(line, options.digitMode) + (newlines[i] ?? ""));
            i++;
            continue;
        }
        const isFence = isFenceLine(line);
        if (isFence)
            inFence = !inFence;
        if (isFence || inFence || isIndentedCode(line)) {
            resultParts.push(line + (newlines[i] ?? ""));
            i++;
            continue;
        }
        if (isTableRow(line)) {
            resultParts.push(formatTableRow(line, mode, options) + (newlines[i] ?? ""));
            i++;
            continue;
        }
        if (getLineKind(line) !== "paragraph") {
            resultParts.push(formatBlockLine(line, mode, options) + (newlines[i] ?? ""));
            i++;
            continue;
        }
        let j = i;
        const paragraphLines = [];
        while (j < lines.length &&
            lines[j]?.trim() &&
            !isFenceLine(lines[j]) &&
            !isIndentedCode(lines[j]) &&
            !isTableRow(lines[j]) &&
            getLineKind(lines[j]) === "paragraph") {
            paragraphLines.push(lines[j]);
            j++;
        }
        const paragraphText = paragraphLines.join("\n");
        const terminator = newlines[j - 1] ?? "";
        const direction = resolveDirection(paragraphText, options);
        const shouldIsolate = mode === "always" || (mode === "auto" && direction === "rtl");
        if (!shouldIsolate) {
            resultParts.push(applyDigitMode(paragraphText, options.digitMode) + terminator);
        }
        else {
            const wrapped = wrapVisualText(applyDigitMode(paragraphText, options.digitMode), options.rtlWrapColumn);
            const formattedLines = wrapped.map((chunk) => {
                if (!chunk.trim())
                    return chunk;
                const isolated = isolateWithProtection(chunk, direction, options);
                const padding = Math.max(0, options.rtlAlignColumn - visualWidth(chunk));
                return `${NBSP.repeat(padding)}${isolated}`;
            });
            resultParts.push(formattedLines.join("\n") + terminator);
        }
        i = j;
    }
    return resultParts.join("");
}
function formatBlockLine(line, mode, options) {
    const { marker, content } = splitMarkdownLine(line);
    if (!content.trim())
        return line;
    const withDigits = applyDigitMode(content, options.digitMode);
    const direction = resolveDirection(withDigits, options);
    const shouldIsolate = mode === "always" || (mode === "auto" && direction === "rtl");
    if (!shouldIsolate)
        return `${marker}${withDigits}`;
    return `${marker}${isolateWithProtection(withDigits, direction, options)}`;
}
function splitMarkdownLine(line) {
    const match = line.match(/^(\s*(?:(?:[-*+] |\d+\. |#{1,6} |> \[[^\]]+\]:? )?))(.*)$/u);
    if (!match)
        return { marker: "", content: line };
    return { marker: match[1] ?? "", content: match[2] ?? "" };
}
function getLineKind(line) {
    const trimmed = line.trimStart();
    if (/^#{1,6}\s/u.test(trimmed))
        return "heading";
    if (trimmed.startsWith(">"))
        return "blockquote";
    if (/^(?:[-*+]\s|\d+\.\s)/u.test(trimmed))
        return "list";
    if (/^(?:\*\*\*\s*$|___\s*$|---\s*$)/u.test(trimmed.trim()))
        return "mini";
    return "paragraph";
}
function isTableRow(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|"))
        return false;
    return trimmed.slice(1, -1).includes("|");
}
function isTableSeparatorCell(cell) {
    return /^\s*:?-{3,}:?\s*$/u.test(cell.trim());
}
function formatTableRow(line, mode, options) {
    const leading = line.match(/^\s*/u)?.[0] ?? "";
    const trimmed = line.trim();
    const cells = trimmed.slice(1, -1).split("|");
    const formatted = cells.map((cell) => {
        if (isTableSeparatorCell(cell))
            return cell;
        const leadingCell = cell.match(/^\s*/u)?.[0] ?? "";
        const trailingCell = cell.match(/\s*$/u)?.[0] ?? "";
        const content = cell.trim();
        if (!content)
            return cell;
        const direction = resolveDirection(content, options);
        const shouldIsolate = mode === "always" || (mode === "auto" && direction === "rtl");
        if (!shouldIsolate)
            return `${leadingCell}${applyDigitMode(content, options.digitMode)}${trailingCell}`;
        return `${leadingCell}${isolateWithProtection(applyDigitMode(content, options.digitMode), direction, options)}${trailingCell}`;
    });
    return `${leading}|${formatted.join("|")}|`;
}
function isolateWithProtection(text, direction, options) {
    const emphasis = splitEmphasis(text);
    const content = protectRuns(emphasis.content, direction);
    return `${emphasis.prefix}${isolate(content, direction)}${emphasis.suffix}`;
}
function splitEmphasis(text) {
    let prefix = "";
    let suffix = "";
    let content = text;
    const leadingMatch = text.match(/^(\s*(?:\*\*|\*|__|_|~~)+)/u);
    if (leadingMatch) {
        prefix = leadingMatch[1] ?? "";
        content = content.slice(prefix.length);
    }
    const trailingMatch = content.match(/((?:\*\*|\*|__|_|~~)+\s*)$/u);
    if (trailingMatch) {
        suffix = trailingMatch[1] ?? "";
        content = content.slice(0, -suffix.length);
    }
    return { prefix, suffix, content };
}
function protectRuns(text, direction) {
    if (direction === "neutral")
        return text;
    if (!containsOpposite(text, direction))
        return text;
    const segments = splitInlineCode(text);
    const out = segments.map((segment) => {
        if (segment.code) {
            return `${segment.delimiter}${LRI}${segment.text}${PDI}${segment.delimiter}`;
        }
        return protectPlain(segment.text, direction);
    });
    return out.join("");
}
function containsOpposite(text, direction) {
    const other = direction === "rtl" ? LTR_STRONG : RTL_STRONG;
    other.lastIndex = 0;
    return other.test(text);
}
function protectPlain(text, direction) {
    if (direction === "rtl") {
        LATIN_TOKEN.lastIndex = 0;
        return text.replace(LATIN_TOKEN, (token) => {
            if (token.length === 1 && /[0-9]/.test(token))
                return token;
            return `${LRI}${token}${PDI}`;
        });
    }
    RTL_TOKEN.lastIndex = 0;
    return text.replace(RTL_TOKEN, (token) => `${RLI}${token}${PDI}`);
}
function splitInlineCode(text) {
    const segments = [];
    let lastIndex = 0;
    INLINE_CODE.lastIndex = 0;
    let match;
    while ((match = INLINE_CODE.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ code: false, delimiter: "", text: text.slice(lastIndex, match.index) });
        }
        segments.push({ code: true, delimiter: match[1] ?? "`", text: match[2] ?? "" });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        segments.push({ code: false, delimiter: "", text: text.slice(lastIndex) });
    }
    return segments.length ? segments : [{ code: false, delimiter: "", text }];
}
function isolate(text, direction) {
    const start = direction === "rtl" ? RLI : LRI;
    return `${start}${text}${PDI}`;
}
function wrapVisualText(text, column) {
    const words = text.split(/\s+/u).filter(Boolean);
    const lines = [];
    let current = "";
    for (const word of words) {
        const pieces = splitLongWord(word, column);
        for (const piece of pieces) {
            if (!current) {
                current = piece;
                continue;
            }
            const next = `${current} ${piece}`;
            if (visualWidth(next) <= column) {
                current = next;
                continue;
            }
            lines.push(current);
            current = piece;
        }
    }
    if (current)
        lines.push(current);
    return lines.length ? lines : [text];
}
function splitLongWord(word, column) {
    if (visualWidth(word) <= column)
        return [word];
    const chunks = [];
    let current = "";
    for (const char of word) {
        if (current && visualWidth(`${current}${char}`) > column) {
            chunks.push(current);
            current = char;
            continue;
        }
        current += char;
    }
    if (current)
        chunks.push(current);
    return chunks;
}
function visualWidth(text) {
    let width = 0;
    for (const char of stripDirectionalControls(text)) {
        if (/\p{Mark}/u.test(char))
            continue;
        const code = char.codePointAt(0) ?? 0;
        width += isWideCodePoint(code) ? 2 : 1;
    }
    return width;
}
function isWideCodePoint(code) {
    return ((code >= 0x1100 && code <= 0x115f) ||
        code === 0x2329 ||
        code === 0x232a ||
        (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe10 && code <= 0xfe19) ||
        (code >= 0xfe30 && code <= 0xfe6f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6) ||
        (code >= 0x1f300 && code <= 0x1faff));
}
function applyDigitMode(text, mode) {
    if (mode === "preserve")
        return text;
    return text.replace(/[0-9\u0660-\u0669\u06f0-\u06f9]/gu, (digit) => convertDigit(digit, mode));
}
function convertDigit(digit, mode) {
    const code = digit.codePointAt(0) ?? 0;
    let value = 0;
    if (code >= 0x30 && code <= 0x39)
        value = code - 0x30;
    else if (code >= 0x660 && code <= 0x669)
        value = code - 0x660;
    else if (code >= 0x6f0 && code <= 0x6f9)
        value = code - 0x6f0;
    if (mode === "latin")
        return String(value);
    if (mode === "arabic-indic")
        return String.fromCodePoint(0x660 + value);
    return String.fromCodePoint(0x6f0 + value);
}
function findFirstStrong(text) {
    for (const char of text) {
        if (RTL_STRONG.test(char))
            return "rtl";
        if (LTR_STRONG.test(char))
            return "ltr";
    }
    return "neutral";
}
function countMatches(text, pattern) {
    pattern.lastIndex = 0;
    let count = 0;
    while (pattern.exec(text))
        count++;
    return count;
}
function isFenceLine(line) {
    const trimmed = line.trimStart();
    return trimmed.startsWith("```") || trimmed.startsWith("~~~");
}
function isIndentedCode(line) {
    return /^\s{4,}\S/u.test(line) && !/^\s{4,}[-*+]\s/u.test(line);
}
function splitKeepNewlines(text) {
    const parts = text.split(/(\r?\n)/);
    const lines = [];
    const newlines = [];
    for (let i = 0; i < parts.length; i += 2) {
        lines.push(parts[i] ?? "");
        newlines.push(parts[i + 1] ?? "");
    }
    return { lines, newlines };
}
function joinLines(lines, newlines) {
    let result = "";
    for (let i = 0; i < lines.length; i++) {
        result += (lines[i] ?? "") + (newlines[i] ?? "");
    }
    return result;
}
function readBoolean(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
}
function readNumber(value, fallback, min, max) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return fallback;
    return Math.min(max, Math.max(min, value));
}
function readSystemGuidance(value, fallback) {
    if (typeof value === "boolean" || typeof value === "string")
        return value;
    return fallback;
}
function readIsolation(value, fallback) {
    if (value === true)
        return "auto";
    if (value === false)
        return "off";
    if (value === "off" || value === "auto" || value === "always")
        return value;
    return fallback;
}
function readLanguage(value, fallback) {
    if (value === "auto" || value === "none" || isRtlLanguage(value))
        return value;
    return fallback;
}
function readDigitMode(value, fallback) {
    if (value === "preserve" || value === "latin" || value === "arabic-indic" || value === "eastern-arabic")
        return value;
    return fallback;
}
function readForceDirection(value, fallback) {
    if (value === "auto" || value === "rtl" || value === "ltr")
        return value;
    return fallback;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
