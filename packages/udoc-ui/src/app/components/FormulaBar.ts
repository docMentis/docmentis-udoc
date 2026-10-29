// The formula bar — a workbook's, above its grid, as Excel's: the Name Box,
// the active cell's reference; and the cell's contents, `=` and its formula or
// its value, or what is typed into it while an entry is open.
//
// The bar edits the cell as Excel's does. In edit mode a press in it begins
// editing the cell's contents, and what is typed there replaces the entry the
// grid draws over the cell, which shows it as it is typed; typing into the cell
// shows in the bar the same way. Enter saves and steps down (Shift up), Tab
// saves and steps right (Shift left), Ctrl or Cmd with Enter saves into every
// selected cell, Alt with Enter breaks the line, and Escape drops it — and ✕
// and ✓ drop and save, greyed while no entry is open. A save the engine refuses shows
// why under the bar, and editing goes on there. In view mode the bar only
// shows.

import type { GridCellSelectionMove } from "@docmentis/udoc-wasm";
import type { Store } from "../../framework/index.js";
import { subscribeSelector } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { I18n } from "../i18n/index.js";
import { ICON_CHECK, ICON_CLEAR } from "../icons.js";
import { createButton } from "./controls.js";
import { VIEW_MODE } from "../state.js";
import type { ActiveCell, UIState } from "../state.js";

export interface FormulaBarHooks {
    /** Begin editing the active cell's contents — a press in the bar. */
    begin: () => void;
    /** What the bar holds, the caret `caret` codepoints into it. */
    replace: (text: string, caret: number) => void;
    /** Save what is typed — into every selected cell with `fill` — and move
     *  `then`; resolves whether it was saved, `false` with the engine's
     *  refusal shown. */
    save: (fill: boolean, then: GridCellSelectionMove | null) => Promise<boolean>;
    /** Drop what is typed. */
    cancel: () => void;
    /** Hand the keyboard back to the grid. */
    focusGrid: () => void;
    /** The bar takes the keyboard (`true`) or leaves it: while it holds it,
     *  the caret is the bar's, and the cell shows none, as in Excel. */
    keyboard: (held: boolean) => void;
}

/** What the bar shows of `state`: the active cell where a workbook is open,
 *  and whether it is open at all. */
interface FormulaBarSlice {
    shown: boolean;
    cell: ActiveCell | null;
    editable: boolean;
}

function selectSlice(state: UIState): FormulaBarSlice {
    return {
        shown: state.status === "ready" && state.docType === "spreadsheet" && state.formulaBarVisible,
        cell: state.activeCell,
        editable: state.mode !== VIEW_MODE,
    };
}

function sliceEqual(a: FormulaBarSlice, b: FormulaBarSlice): boolean {
    return a.shown === b.shown && a.cell === b.cell && a.editable === b.editable;
}

export function createFormulaBar(i18n: I18n, hooks: FormulaBarHooks) {
    const el = document.createElement("div");
    el.className = "udoc-formula-bar";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", i18n.t("formulaBar.label"));

    const name = document.createElement("div");
    name.className = "udoc-formula-bar__name";
    name.setAttribute("aria-label", i18n.t("formulaBar.nameBox"));

    const button = (icon: string, label: string, press: () => void): HTMLButtonElement => {
        const b = createButton({ icon, label, className: "udoc-formula-bar__action" });
        b.type = "button";
        // Keep the keyboard where the typing is: the press acts, it doesn't focus.
        b.addEventListener("mousedown", (e) => e.preventDefault());
        b.addEventListener("click", press);
        return b;
    };
    const cancel = button(ICON_CLEAR, i18n.t("formulaBar.cancel"), () => {
        hooks.cancel();
        done();
    });
    const enter = button(ICON_CHECK, i18n.t("formulaBar.enter"), () => void save(false, null));

    const input = document.createElement("textarea");
    input.className = "udoc-formula-bar__input";
    input.rows = 1;
    input.spellcheck = false;
    input.autocomplete = "off";
    input.setAttribute("aria-label", i18n.t("formulaBar.input"));

    const refusal = document.createElement("div");
    refusal.className = "udoc-formula-bar__refusal";
    refusal.setAttribute("role", "alert");
    refusal.hidden = true;

    el.append(name, cancel, enter, input, refusal);

    let slice: FormulaBarSlice = { shown: false, cell: null, editable: false };

    /** The codepoints before the bar's caret. */
    function caret(): number {
        return Array.from(input.value.slice(0, input.selectionStart ?? 0)).length;
    }

    /** Show `slice`: the bar where a workbook is open, its cell's reference
     *  and contents — but what is being typed in the bar, which the bar holds. */
    function render(next: FormulaBarSlice): void {
        slice = next;
        el.hidden = !next.shown;
        // Hidden, with no workbook open, it holds no keyboard, whether or not
        // its field's blur fired as it went.
        if (!next.shown) hooks.keyboard(false);
        const cell = next.cell;
        name.textContent = cell?.reference ?? "";
        const typing = cell?.entry != null;
        cancel.disabled = !typing;
        enter.disabled = !typing;
        input.readOnly = !next.editable || cell === null;
        if (document.activeElement !== input) input.value = cell?.input ?? "";
        if (!typing) refusal.hidden = true;
    }

    /** Leave the bar for the grid, what it shows the cell's again — the
     *  latest, which a report landing while the bar held the keyboard left
     *  unshown. */
    function done(): void {
        refusal.hidden = true;
        // The grid's keyboard sink never takes the keyboard from a text field.
        input.blur();
        hooks.focusGrid();
        render(slice);
    }

    async function save(fill: boolean, then: GridCellSelectionMove | null): Promise<void> {
        if (await hooks.save(fill, then)) done();
    }

    input.addEventListener("focus", () => {
        hooks.keyboard(true);
        if (!input.readOnly && slice.cell?.entry == null) hooks.begin();
    });
    input.addEventListener("blur", () => hooks.keyboard(false));
    input.addEventListener("input", () => {
        refusal.hidden = true;
        hooks.replace(input.value, caret());
    });
    input.addEventListener("keydown", (e) => {
        if (e.isComposing || input.readOnly) return;
        const jump = e.ctrlKey || e.metaKey;
        if (e.key === "Enter" && e.altKey) {
            // A line break in the cell, at the caret.
            e.preventDefault();
            input.setRangeText("\n", input.selectionStart, input.selectionEnd, "end");
            hooks.replace(input.value, caret());
        } else if (e.key === "Enter") {
            e.preventDefault();
            void save(jump, jump ? null : e.shiftKey ? "up" : "down");
        } else if (e.key === "Tab") {
            e.preventDefault();
            void save(false, e.shiftKey ? "left" : "right");
        } else if (e.key === "Escape") {
            e.preventDefault();
            hooks.cancel();
            done();
        }
    });

    let unsub: (() => void) | null = null;

    function mount(container: HTMLElement, store: Store<UIState, Action>): void {
        container.prepend(el);
        render(selectSlice(store.getState()));
        unsub = subscribeSelector(store, selectSlice, render, { equality: sliceEqual });
    }

    /** Show why a save was refused, under the bar. */
    function showRefusal(message: string): void {
        refusal.textContent = message;
        refusal.hidden = false;
    }

    function destroy(): void {
        unsub?.();
        unsub = null;
        el.remove();
    }

    return { el, mount, showRefusal, destroy };
}
