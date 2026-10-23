import { on, subscribeSelector } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Action } from "../actions.js";
import type { DeveloperOptions, UIState } from "../state.js";
import { ICON_CLEAR } from "../icons.js";

interface OptionRow {
    key: keyof DeveloperOptions;
    label: string;
    description: string;
}

/** The toggles shown in the dialog, in display order. */
const OPTION_ROWS: OptionRow[] = [
    {
        key: "performanceCounter",
        label: "Show Performance Counter",
        description: "Overlay open / repaint timings (and rough fps) in the corner of the viewport.",
    },
    {
        key: "repaintArea",
        label: "Show Repaint Area",
        description:
            "Outline the part of the canvas the latest frame actually repainted — the engine's dirty rect.",
    },
];

/**
 * The "Developer" modal, opened from the toolbar's More menu. A small
 * dialog of diagnostic toggles, each bound to {@link UIState.developerOptions}
 * — flipping one dispatches `SET_DEVELOPER_OPTION`, and whichever component owns
 * that diagnostic acts on the change: the shell shows the performance HUD, the
 * canvas draws the repaint-area box.
 *
 * Session-only: nothing here is persisted. Owns no document state, so it can be
 * mounted once and opened/closed freely.
 */
export function createDeveloperOptionsModal() {
    const el = document.createElement("div");
    el.className = "udoc-dev-modal";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-dev-modal__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-dev-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Developer");

    const header = document.createElement("div");
    header.className = "udoc-dev-modal__header";
    const heading = document.createElement("h2");
    heading.className = "udoc-dev-modal__heading";
    heading.textContent = "Developer";
    const closeBtn = document.createElement("button");
    closeBtn.className = "udoc-dev-modal__close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.title = "Close";
    closeBtn.innerHTML = ICON_CLEAR;
    header.append(heading, closeBtn);

    const body = document.createElement("div");
    body.className = "udoc-dev-modal__body";

    dialog.append(header, body);
    el.append(backdrop, dialog);

    let storeRef: Store<UIState, Action> | null = null;
    let unsub: (() => void) | null = null;
    const unsubEvents: Array<() => void> = [];
    const checkboxes = new Map<keyof DeveloperOptions, HTMLInputElement>();
    let isOpen = false;

    // Build the (static) toggle rows once.
    for (const row of OPTION_ROWS) {
        const id = `udoc-dev-opt-${row.key}`;

        const item = document.createElement("label");
        item.className = "udoc-dev-modal__option";
        item.htmlFor = id;

        const text = document.createElement("div");
        text.className = "udoc-dev-modal__option-text";
        const label = document.createElement("div");
        label.className = "udoc-dev-modal__option-label";
        label.textContent = row.label;
        const desc = document.createElement("div");
        desc.className = "udoc-dev-modal__option-desc";
        desc.textContent = row.description;
        text.append(label, desc);

        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = id;
        input.className = "udoc-dev-modal__switch";
        input.addEventListener("change", () => {
            storeRef?.dispatch({ type: "SET_DEVELOPER_OPTION", key: row.key, value: input.checked });
        });
        checkboxes.set(row.key, input);

        item.append(text, input);
        body.appendChild(item);
    }

    function syncFrom(options: DeveloperOptions): void {
        for (const [key, input] of checkboxes) input.checked = options[key];
    }

    function open(): void {
        if (isOpen) return;
        isOpen = true;
        if (storeRef) syncFrom(storeRef.getState().developerOptions);
        el.style.display = "";
        closeBtn.focus();
    }

    function close(): void {
        if (!isOpen) return;
        isOpen = false;
        el.style.display = "none";
    }

    function mount(store: Store<UIState, Action>): void {
        storeRef = store;
        syncFrom(store.getState().developerOptions);

        unsubEvents.push(on(closeBtn, "click", close));
        unsubEvents.push(on(backdrop, "click", close));

        const onKeydown = (e: KeyboardEvent) => {
            if (isOpen && e.key === "Escape") {
                e.stopPropagation();
                close();
            }
        };
        document.addEventListener("keydown", onKeydown);
        unsubEvents.push(() => document.removeEventListener("keydown", onKeydown));

        // Keep the switches in sync if the options change elsewhere.
        unsub = subscribeSelector(
            store,
            (s) => s.developerOptions,
            (options) => syncFrom(options),
        );
    }

    function destroy(): void {
        if (unsub) unsub();
        for (const off of unsubEvents) off();
        el.remove();
    }

    return { el, mount, open, close, destroy };
}

export type DeveloperOptionsModal = ReturnType<typeof createDeveloperOptionsModal>;
