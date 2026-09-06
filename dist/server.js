import { PLUGIN_ID, formatBidiText, normalizeOptions, statusText, systemPrompt, } from "./core.js";
export const server = async ({ client }, options) => {
    const settings = normalizeOptions(options);
    const modelTextSettings = { ...settings, alignRtlParagraphs: false };
    await log(client, settings, "info", "initialized", { status: statusText(settings) });
    const hooks = {
        "experimental.chat.system.transform": async (_input, output) => {
            const prompt = systemPrompt(settings);
            if (prompt)
                output.system.push(prompt);
        },
        "chat.message": async (_input, output) => {
            if (!settings.enabled || settings.isolateUserMessages === "off")
                return;
            for (const part of output.parts) {
                mutateTextFields(part, (value) => formatBidiText(value, settings.isolateUserMessages, modelTextSettings));
            }
        },
        "experimental.chat.messages.transform": async (_input, output) => {
            if (!settings.enabled || settings.isolateUserMessages === "off")
                return;
            for (const message of output.messages) {
                if (message.info.role !== "user")
                    continue;
                for (const part of message.parts) {
                    mutateTextFields(part, (value) => formatBidiText(value, settings.isolateUserMessages, modelTextSettings));
                }
            }
        },
        "experimental.text.complete": async (_input, output) => {
            if (!settings.enabled || settings.isolateAssistantText === "off")
                return;
            output.text = formatBidiText(output.text, settings.isolateAssistantText, settings);
        },
        "tool.execute.after": async (_input, output) => {
            if (!settings.enabled || settings.isolateToolOutput === "off")
                return;
            output.output = formatBidiText(output.output, settings.isolateToolOutput, settings);
        },
        "shell.env": async (_input, output) => {
            if (!settings.directionEnv)
                return;
            output.env.OPENCODE_RTL = settings.enabled ? "1" : "0";
            output.env.OPENCODE_RTL_LANGUAGE = settings.language;
            output.env.OPENCODE_RTL_USER_ISOLATION = settings.isolateUserMessages;
            output.env.OPENCODE_RTL_ASSISTANT_ISOLATION = settings.isolateAssistantText;
        },
    };
    return hooks;
};
export const RtlPlugin = server;
export default {
    id: PLUGIN_ID,
    server,
};
function mutateTextFields(value, format) {
    if (!isMutableRecord(value))
        return;
    for (const key of ["text", "content", "value"]) {
        const current = value[key];
        if (typeof current !== "string")
            continue;
        if (!current.trim())
            continue;
        value[key] = format(current);
    }
}
function isMutableRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function log(client, settings, level, message, extra) {
    if (!settings.debug)
        return;
    const maybeClient = client;
    await maybeClient.app?.log?.({
        body: {
            service: PLUGIN_ID,
            level,
            message,
            extra,
        },
    });
}
