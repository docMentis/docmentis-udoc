// A deck's Automation tab's commands: Template, which makes a plain deck a
// template, so its braces are read as tags, or a template plain again; Variable,
// which writes a variable's tag at the caret with a name in its braces selected,
// for the author to type the value's path over; and Data, which shows or hides
// the right panel's Data tab, what the deck's text binds. Variable and Data are
// a template's alone: in a plain deck braces are only text, and an instance is
// filled, not written. A tag is the text itself — the engine reads braces
// wherever they are written — so Variable writes what typing would.
import { allowsTextEdit } from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef } from "@docmentis/udoc-ui/internal";
import type { Automation } from "@docmentis/udoc-wasm";
import type { EditHost } from "./edit-client.js";
import type { MessageKey } from "./i18n/index.js";
import { ICON_DATA_PANEL, ICON_INSERT_VARIABLE, ICON_TEMPLATE } from "./icons.js";

/** The name a new variable's braces hold until the author types its path over it. */
const NEW_VARIABLE = "var";

/** The braces closing a tag, which the caret steps back over to select the name. */
const CLOSE = "}}";

/** Whether `automation` makes its deck a template. */
function isTemplate(automation: Automation | null): boolean {
    return automation !== null && "template" in automation.role;
}

/** Whether the open deck is a template, ready to be written. */
function template(c: CommandContext): boolean {
    return c.ready && c.docType === "presentation" && isTemplate(c.automation);
}

/** Make the open deck a template, or a template plain again, one undo step. An
 *  instance: nothing. */
async function toggleTemplate(host: EditHost): Promise<void> {
    const automation = host.store.getState().automation;
    if (automation !== null && !isTemplate(automation)) return;
    const command = automation === null ? "makeTemplate" : "makePlain";
    await host.commit(() => host.client.execute({ automation: command }));
}

/** Write a variable's tag at the caret — over the text selected, as typing
 *  writes — then select the name in its braces, and give the keyboard back to
 *  the text, so what is typed next replaces the name. */
async function insertVariable(host: EditHost): Promise<void> {
    await host.insertSelectionText(`{{${NEW_VARIABLE}${CLOSE}`);
    // The caret is after the tag: back over its closing braces, then back over
    // the name with the selection extended.
    for (let i = 0; i < CLOSE.length; i++) host.client.moveTextCaret("left", false);
    for (let i = 0; i < NEW_VARIABLE.length; i++) host.client.moveTextCaret("left", true);
    host.focusClipboardSink();
}

/** The Automation tab's commands, over the shell `host` lends once mounted. */
export function automationCommands(host: () => EditHost | null): Readonly<Record<string, CommandDef<MessageKey>>> {
    return {
        // Template, named beside its icon: pressed for a template, and live for
        // a plain deck and a template — an instance stays what it is.
        template: {
            id: "template",
            label: "command.template",
            icon: ICON_TEMPLATE,
            group: "template",
            labeled: true,
            run: {
                kind: "toggle",
                pressed: (state) => isTemplate(state.automation),
                press: () => {
                    const mounted = host();
                    if (mounted) void toggleTemplate(mounted);
                },
            },
            enabledWhen: (c) =>
                c.ready && c.docType === "presentation" && (c.automation === null || isTemplate(c.automation)),
        },
        // Variable, named beside its icon: live in a template, wherever typing
        // is, a caret or a range in a shape's text or a table's cell.
        insertVariable: {
            id: "insertVariable",
            label: "command.insertVariable",
            icon: ICON_INSERT_VARIABLE,
            group: "variables",
            labeled: true,
            run: {
                kind: "action",
                press: () => {
                    const mounted = host();
                    if (mounted) void insertVariable(mounted);
                },
            },
            enabledWhen: (c) => template(c) && allowsTextEdit(c.selection, "insertText"),
        },
        // Then Data, which shows or hides the panel listing the tags, as the
        // Review tab's Revisions does its panel.
        dataPanel: {
            id: "dataPanel",
            label: "rightPanel.data",
            icon: ICON_DATA_PANEL,
            group: "data",
            labeled: true,
            run: {
                kind: "toggle",
                pressed: (state) => state.activePanel === "data",
                press: (store) => store.dispatch({ type: "TOGGLE_PANEL", panel: "data" }),
            },
            shownWhen: (c) => c.dataPanel,
            enabledWhen: template,
        },
    };
}
