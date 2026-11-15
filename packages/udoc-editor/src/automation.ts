// A deck's Automation tab's commands: Template, which makes a plain deck a
// template, so its braces are read as tags, or a template plain again;
// Variable, Repeat, Condition and Choice, which each write a binding at the
// caret — a variable's tag, or a pair's tags with nothing between them, a
// choice's with an option and its otherwise — with the path in its braces
// selected, for the author to type the value's path over; Data, which shows or
// hides the right panel's Data tab, what the deck's text binds; and Preview,
// which shows the template filled with its sample data in place of it, or the
// template again (automation-preview.ts). All but Template are a template's
// alone: in a plain deck braces are only text, and an
// instance is filled, not written. A tag is the text itself — the engine reads
// braces wherever they are written — so each writes what typing would.
import { allowsTextEdit } from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef } from "@docmentis/udoc-ui/internal";
import type { Automation } from "@docmentis/udoc-wasm";
import type { AutomationPreview } from "./automation-preview.js";
import type { EditHost } from "./edit-client.js";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_DATA_PANEL,
    ICON_INSERT_CHOICE,
    ICON_INSERT_CONDITION,
    ICON_INSERT_REPEAT,
    ICON_INSERT_VARIABLE,
    ICON_PREVIEW,
    ICON_TEMPLATE,
} from "./icons.js";
import { editState } from "./state.js";

/** A binding's tags as the tab writes them: the text before the path, the path
 *  the author types over, and the text after it. */
interface NewBinding {
    readonly before: string;
    readonly path: string;
    readonly after: string;
}

/** A variable: `{{var}}`. */
const NEW_VARIABLE: NewBinding = { before: "{{", path: "var", after: "}}" };

/** A repeat, its item `item`, over nothing yet: `{{#item in items}}{{/item}}`. */
const NEW_REPEAT: NewBinding = { before: "{{#item in ", path: "items", after: "}}{{/item}}" };

/** A condition, over nothing yet: `{{#if flag}}{{/if}}`. */
const NEW_CONDITION: NewBinding = { before: "{{#if ", path: "flag", after: "}}{{/if}}" };

/** A choice with one option and its otherwise, each empty:
 *  `{{#choose value}}{{:when "a"}}{{:otherwise}}{{/choose}}`. */
const NEW_CHOICE: NewBinding = {
    before: "{{#choose ",
    path: "value",
    after: '}}{{:when "a"}}{{:otherwise}}{{/choose}}',
};

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

/** Write `binding`'s tags at the caret — over the text selected, as typing
 *  writes — then select its path, and give the keyboard back to the text, so
 *  what is typed next replaces the path. */
async function insertBinding(host: EditHost, binding: NewBinding): Promise<void> {
    await host.insertSelectionText(`${binding.before}${binding.path}${binding.after}`);
    // The caret is after the tags: back over what follows the path, then back
    // over the path with the selection extended.
    for (let i = 0; i < binding.after.length; i++) host.client.moveTextCaret("left", false);
    for (let i = 0; i < binding.path.length; i++) host.client.moveTextCaret("left", true);
    host.focusClipboardSink();
}

/** The command writing `binding`, labelled `label` beside `icon`: live in a
 *  template, wherever typing is, a caret or a range in a shape's text or a
 *  table's cell. */
function insertCommand(
    host: () => EditHost | null,
    id: string,
    label: MessageKey,
    icon: string,
    binding: NewBinding,
): CommandDef<MessageKey> {
    return {
        id,
        label,
        icon,
        group: "bindings",
        labeled: true,
        run: {
            kind: "action",
            press: () => {
                const mounted = host();
                if (mounted) void insertBinding(mounted, binding);
            },
        },
        enabledWhen: (c) => template(c) && allowsTextEdit(c.selection, "insertText"),
    };
}

/** The Automation tab's commands, over the shell `host` lends once mounted. */
export function automationCommands(
    host: () => EditHost | null,
    preview: AutomationPreview,
): Readonly<Record<string, CommandDef<MessageKey>>> {
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
        // Variable, Repeat, Condition and Choice, each named beside its icon.
        insertVariable: insertCommand(
            host,
            "insertVariable",
            "command.insertVariable",
            ICON_INSERT_VARIABLE,
            NEW_VARIABLE,
        ),
        insertRepeat: insertCommand(host, "insertRepeat", "command.insertRepeat", ICON_INSERT_REPEAT, NEW_REPEAT),
        insertCondition: insertCommand(
            host,
            "insertCondition",
            "command.insertCondition",
            ICON_INSERT_CONDITION,
            NEW_CONDITION,
        ),
        insertChoice: insertCommand(host, "insertChoice", "command.insertChoice", ICON_INSERT_CHOICE, NEW_CHOICE),
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
        // Last Preview, pressed while the template's preview is shown or on its
        // way.
        preview: {
            id: "preview",
            label: "command.preview",
            icon: ICON_PREVIEW,
            group: "preview",
            labeled: true,
            run: {
                kind: "toggle",
                pressed: (state) => editState(state).automationPreview,
                press: () => {
                    const mounted = host();
                    if (mounted) preview.toggle(mounted);
                },
            },
            enabledWhen: template,
        },
    };
}
