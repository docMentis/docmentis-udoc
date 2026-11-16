// A deck's Automation tab's commands: Template, which makes a plain deck a
// template, turning the tags in its text into places, or a template plain
// again, its places written back as tags; Variable, Repeat, Condition and
// Choice, which each make a place of the selection — around what a range
// holds, or at a caret one holding its placeholder, the engine choosing a span
// or a block by the selection — and open its popover on a path made up for the
// author to type over; Data, which shows or hides the right panel's Data tab,
// what the deck's text binds; Preview, which shows the template filled with
// its sample data in place of it, or the template again
// (automation-preview.ts); Generate, which fills a copy of the template with
// the data the author gives and downloads it (automation-generate.ts); and an
// instance's Places, which shows its places as a template's always show, and
// Refresh, which fills it again in place from the data given.
import { allowsTextEdit } from "@docmentis/udoc-ui/internal";
import type { CommandContext, CommandDef } from "@docmentis/udoc-ui/internal";
import type { Automation, Binding } from "@docmentis/udoc-wasm";
import type { CurrentPlace } from "./automation-places.js";
import type { AutomationPreview } from "./automation-preview.js";
import type { EditHost } from "./edit-client.js";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_DATA_PANEL,
    ICON_GENERATE,
    ICON_INSERT_CHOICE,
    ICON_INSERT_CONDITION,
    ICON_INSERT_REPEAT,
    ICON_INSERT_VARIABLE,
    ICON_PREVIEW,
    ICON_REFRESH,
    ICON_SHOW_PLACES,
    ICON_TEMPLATE,
} from "./icons.js";
import { editState, updateEditState } from "./state.js";

/** A variable, its path made up for the author to type over. */
const NEW_VARIABLE: Binding = { variable: { path: "value" } };

/** A repeat, its item `item` over `items`. */
const NEW_REPEAT: Binding = { repeat: { item: "item", path: "items" } };

/** A condition on `flag`. */
const NEW_CONDITION: Binding = { condition: { not: false, path: "flag" } };

/** A choice by `option`, which the engine makes holding its options. */
const NEW_CHOICE: Binding = { choice: { path: "option" } };

/** What edit mode lends the tab of a template's places: finding the place a
 *  new binding made, and opening its popover. */
export interface PlaceEditing {
    /** Open the popover of the innermost place the caret is in whose binding
     *  is of `binding`'s kind, once the overlay has read it. */
    edit(binding: Binding): Promise<void>;
}

/** The kind of a binding: the key it is tagged by. */
export function bindingKind(binding: Binding): string {
    return typeof binding === "string" ? binding : Object.keys(binding)[0]!;
}

/** The places the caret is in whose binding is of `binding`'s kind. */
export function placesOfKind(places: readonly CurrentPlace[], binding: Binding): CurrentPlace[] {
    const kind = bindingKind(binding);
    return places.filter((place) => bindingKind(place.geometry.binding) === kind);
}

/** Whether `automation` makes its deck a template. */
function isTemplate(automation: Automation | null): boolean {
    return automation !== null && "template" in automation.role;
}

/** Whether `automation` makes its deck an instance. */
function isInstance(automation: Automation | null): boolean {
    return automation !== null && "instance" in automation.role;
}

/** Whether the open deck is an instance, filled from a template. */
function instance(c: CommandContext): boolean {
    return c.ready && c.docType === "presentation" && isInstance(c.automation);
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

/** Make a place of the selection binding `binding`, one undo step, then open
 *  its popover for the author to bind it as they mean. */
async function insertBinding(host: EditHost, places: PlaceEditing, binding: Binding): Promise<void> {
    await host.commit(() => host.client.executeOnSelection({ kind: "bind", binding }));
    await places.edit(binding);
}

/** The command making a place of the selection binding `binding`, labelled
 *  `label` beside `icon`: live in a template, wherever its text takes a place,
 *  a caret or a range in a shape's text or a table's cell. */
function insertCommand(
    host: () => EditHost | null,
    places: () => PlaceEditing | null,
    id: string,
    label: MessageKey,
    icon: string,
    binding: Binding,
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
                const editing = places();
                if (mounted && editing) void insertBinding(mounted, editing, binding);
            },
        },
        enabledWhen: (c) => template(c) && allowsTextEdit(c.selection, "bind"),
    };
}

/** The Automation tab's commands, over the shell `host` lends once mounted. */
export function automationCommands(
    host: () => EditHost | null,
    places: () => PlaceEditing | null,
    preview: AutomationPreview,
    generate: () => void,
    refresh: () => void,
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
            places,
            "insertVariable",
            "command.insertVariable",
            ICON_INSERT_VARIABLE,
            NEW_VARIABLE,
        ),
        insertRepeat: insertCommand(
            host,
            places,
            "insertRepeat",
            "command.insertRepeat",
            ICON_INSERT_REPEAT,
            NEW_REPEAT,
        ),
        insertCondition: insertCommand(
            host,
            places,
            "insertCondition",
            "command.insertCondition",
            ICON_INSERT_CONDITION,
            NEW_CONDITION,
        ),
        insertChoice: insertCommand(
            host,
            places,
            "insertChoice",
            "command.insertChoice",
            ICON_INSERT_CHOICE,
            NEW_CHOICE,
        ),
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
        // way, and Generate, which opens the Generate dialog.
        preview: {
            id: "preview",
            label: "command.preview",
            icon: ICON_PREVIEW,
            group: "output",
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
        generate: {
            id: "generate",
            label: "command.generate",
            icon: ICON_GENERATE,
            group: "output",
            labeled: true,
            run: { kind: "action", press: generate },
            enabledWhen: template,
        },
        // An instance's: Places, pressed while its places show, and Refresh,
        // which opens the data dialog to fill it again where it is.
        showPlaces: {
            id: "showPlaces",
            label: "command.showPlaces",
            icon: ICON_SHOW_PLACES,
            group: "instance",
            labeled: true,
            run: {
                kind: "toggle",
                pressed: (state) => editState(state).showPlaces,
                press: (store) => updateEditState(store, { showPlaces: !editState(store.getState()).showPlaces }),
            },
            shownWhen: instance,
            enabledWhen: instance,
        },
        refresh: {
            id: "refresh",
            label: "command.refresh",
            icon: ICON_REFRESH,
            group: "instance",
            labeled: true,
            run: { kind: "action", press: refresh },
            shownWhen: instance,
            enabledWhen: instance,
        },
    };
}
