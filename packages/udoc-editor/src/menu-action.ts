// The menu rows edit mode adds carry an intent of its own, which the shell hands
// back to edit mode (`UIExtension.menuAction`).
import type { TableSelectionEdit } from "@docmentis/udoc-wasm";
import type { AlignEdge, EditAxis, MenuAction, TextParagraphAlign, ZOrder } from "@docmentis/udoc-ui/internal";
import type { ClipboardOp, TableSelectScope } from "./context-menu.js";
import type { CropAspect } from "./crop-box.js";
import { editState, updateEditState } from "./state.js";
import type { ParagraphSpaceEdge } from "./text-format.js";
import type { EditTools } from "./tools.js";

/**
 * What activating one of edit mode's menu rows does. Each variant carries its
 * full payload, so the handler is a switch on `kind` with no side lookup
 * tables. `reorder` is the Arrange dropdown's z-order; `align` / `distribute`
 * / `flip` / `rotate` the Align and Rotate dropdowns; `alignToPage` the Align
 * dropdown's reference toggle (a UI flag, not a document edit). `clipboard` /
 * `delete` are the context menu's acts on the selection, and `selectTable` /
 * `tableEdit` its rows over a table. `cropAspect` is crop mode's Aspect Ratio
 * dropdown.
 *
 * The first five are the paragraph menus' rows. `indent` carries a *step*, not
 * a measure: an indent is relative per paragraph — a selection spanning two
 * levels keeps their offset instead of flattening to one — so the engine owns
 * what one step means (the list level of a listed paragraph, the left indent of
 * any other), and the menu only says which way.
 */
export type EditMenuAction =
    | { kind: "widthScale"; scale: number }
    | { kind: "paragraphAlign"; align: TextParagraphAlign }
    | { kind: "indent"; delta: number }
    | { kind: "lineSpacing"; lines: number }
    | { kind: "paragraphSpace"; edge: ParagraphSpaceEdge }
    | { kind: "reorder"; order: ZOrder }
    | { kind: "group" }
    | { kind: "ungroup" }
    | { kind: "align"; edge: AlignEdge }
    | { kind: "alignToPage" }
    | { kind: "distribute"; axis: EditAxis }
    | { kind: "flip"; axis: EditAxis }
    | { kind: "rotate"; angle: number }
    | { kind: "clipboard"; op: ClipboardOp }
    | { kind: "delete" }
    | { kind: "selectTable"; scope: TableSelectScope }
    | { kind: "tableEdit"; edit: TableSelectionEdit }
    | { kind: "cropAspect"; aspect: CropAspect };

/** `action` as a shell {@link MenuAction}: carried as the extension's own. */
export function editAction(action: EditMenuAction): MenuAction {
    return { kind: "extension", action };
}

/** Run one of edit mode's menu rows' intents on the current selection. */
export function runEditMenuAction(tools: EditTools, action: EditMenuAction): void {
    const { arrange, text, clipboard, crop, host } = tools;
    switch (action.kind) {
        case "reorder":
            void arrange.reorderSelection(action.order);
            break;
        case "group":
            void arrange.groupSelection();
            break;
        case "ungroup":
            void arrange.ungroupSelection();
            break;
        case "align":
            void arrange.alignSelection(action.edge);
            break;
        case "distribute":
            void arrange.distributeSelection(action.axis);
            break;
        case "flip":
            void arrange.flipSelection(action.axis);
            break;
        case "rotate":
            void arrange.rotateSelectionEach(action.angle);
            break;
        case "alignToPage":
            updateEditState(host.store, { alignToPage: !editState(host.store.getState()).alignToPage });
            break;
        case "widthScale":
            void text.setCharacterProperties([{ widthScale: action.scale }]);
            break;
        case "paragraphAlign":
            void text.setParagraphProperties([{ align: action.align }]);
            break;
        case "lineSpacing":
            void text.setParagraphProperties([{ lineSpacing: { percent: action.lines } }]);
            break;
        case "paragraphSpace":
            void text.toggleParagraphSpace(action.edge);
            break;
        case "indent":
            void text.indentSelection(action.delta);
            break;
        case "clipboard":
            switch (action.op) {
                case "cut":
                    clipboard.cut();
                    break;
                case "paste":
                    void clipboard.paste();
                    break;
            }
            break;
        case "delete":
            void host.deleteSelection();
            break;
        case "selectTable":
            // Presence, not an edit: the three widenings re-state what is
            // picked inside the table and report fresh geometry, so they go
            // straight to the client rather than through the edit path.
            switch (action.scope) {
                case "rows":
                    host.client.selectTableRows();
                    break;
                case "columns":
                    host.client.selectTableColumns();
                    break;
                case "table":
                    host.client.selectTable();
                    break;
            }
            break;
        case "tableEdit": {
            // A structural edit on the table the selection sits in — one
            // committing edit like any other. The engine binds it to the
            // innermost table the selection is in; its kind (`deleteRows`, not
            // `delete`) is what keeps it off the frame around that table.
            const { edit } = action;
            void host.commit(() => host.client.executeOnSelection(edit));
            break;
        }
        case "cropAspect":
            crop.setAspect(action.aspect);
            break;
    }
}
