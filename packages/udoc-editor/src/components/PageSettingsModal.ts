// The shared per-page settings dialog, opened from a page's control rail (the
// "more" button). A modal — backdrop + centered dialog — that lets the user
// read and change one page's size (a named preset or a custom width × height in
// inches / millimetres / points) and rotation. It replaces the old anchored
// info popup; being a real dialog gives the size fields room and a clear
// commit (Apply) instead of a hover-dismissed flyout.
//
// Storeless and imperative: mounted once by the shell and reused across pages.
// `open(ctx)` seeds it with a page's current geometry and the callbacks that
// turn an Apply / rotate into a page edit; it owns no document state of its own.

import { ICON_CLEAR, ICON_ROTATE_LEFT, ICON_ROTATE_RIGHT, on } from "@docmentis/udoc-ui/internal";
import type { I18n, MessageKey } from "../i18n/index.js";

/** The unit the width/height fields are shown and entered in. */
type Unit = "in" | "mm" | "pt";

/** Document points per unit — points are the engine's native page unit. */
const PT_PER_UNIT: Record<Unit, number> = {
    in: 72,
    mm: 72 / 25.4,
    pt: 1,
};

/** Decimal places shown per unit (points are whole). */
const UNIT_DECIMALS: Record<Unit, number> = { in: 2, mm: 1, pt: 0 };

/** What the unit dropdown calls each unit. */
const UNIT_LABELS: Record<Unit, MessageKey> = {
    in: "pageSettings.inches",
    mm: "pageSettings.millimeters",
    pt: "pageSettings.points",
};

/** A named page size, in points, portrait (height ≥ width). */
interface Preset {
    name: string;
    label: MessageKey;
    width: number;
    height: number;
}

/** The common page sizes offered in the preset dropdown. */
const PRESETS: Preset[] = [
    { name: "Letter", label: "pageSize.letter", width: 612, height: 792 },
    { name: "Legal", label: "pageSize.legal", width: 612, height: 1008 },
    { name: "Tabloid", label: "pageSize.tabloid", width: 792, height: 1224 },
    { name: "A3", label: "pageSize.a3", width: 841.89, height: 1190.55 },
    { name: "A4", label: "pageSize.a4", width: 595.28, height: 841.89 },
    { name: "A5", label: "pageSize.a5", width: 419.53, height: 595.28 },
];

/** Two sizes count as the same preset within half a point either way. */
const MATCH_TOLERANCE = 0.5;

/** What `open` needs: the page being edited and how to apply changes to it. */
export interface PageSettingsContext {
    /** 0-based page index. */
    index: number;
    /** Current media-box width in points (rotation-independent). */
    width: number;
    /** Current media-box height in points. */
    height: number;
    /** Resize the page to `width` × `height` points (one undo step). */
    onResize: (width: number, height: number) => void;
    /** Rotate the page one quarter turn (clockwise, or counter-clockwise). */
    onRotate: (clockwise: boolean) => void;
}

function fmtLen(pt: number, unit: Unit): string {
    return (pt / PT_PER_UNIT[unit]).toFixed(UNIT_DECIMALS[unit]);
}

function parseLen(text: string, unit: Unit): number | null {
    const n = parseFloat(text);
    if (!isFinite(n) || n <= 0) return null;
    return n * PT_PER_UNIT[unit];
}

/** The preset matching `width` × `height` (either orientation), or null. */
function matchPreset(width: number, height: number): Preset | null {
    const near = (a: number, b: number) => Math.abs(a - b) <= MATCH_TOLERANCE;
    return (
        PRESETS.find(
            (p) => (near(p.width, width) && near(p.height, height)) || (near(p.width, height) && near(p.height, width)),
        ) ?? null
    );
}

function labeledField(labelText: string): { field: HTMLLabelElement; input: HTMLInputElement } {
    const field = document.createElement("label");
    field.className = "udoc-page-modal__field";
    const label = document.createElement("span");
    label.className = "udoc-page-modal__field-label";
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.className = "udoc-page-modal__input";
    field.append(label, input);
    return { field, input };
}

/**
 * Build the page-settings modal. The returned handle is mounted once by the
 * shell; `open` re-seeds it for whichever page's rail was clicked.
 */
export function createPageSettingsModal(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-page-modal";
    el.style.display = "none";

    const backdrop = document.createElement("div");
    backdrop.className = "udoc-page-modal__backdrop";

    const dialog = document.createElement("div");
    dialog.className = "udoc-page-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    // --- header ---
    const header = document.createElement("div");
    header.className = "udoc-page-modal__header";
    const heading = document.createElement("h2");
    heading.className = "udoc-page-modal__heading";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "udoc-page-modal__close";
    closeBtn.setAttribute("aria-label", i18n.t("common.close"));
    closeBtn.title = i18n.t("common.close");
    closeBtn.innerHTML = ICON_CLEAR;
    header.append(heading, closeBtn);

    const body = document.createElement("div");
    body.className = "udoc-page-modal__body";

    // --- size section ---
    const sizeLabel = document.createElement("div");
    sizeLabel.className = "udoc-page-modal__section-label";
    sizeLabel.textContent = i18n.t("pageSettings.pageSize");

    const presetSelect = document.createElement("select");
    presetSelect.className = "udoc-page-modal__select udoc-page-modal__preset";
    presetSelect.setAttribute("aria-label", i18n.t("pageSettings.preset"));
    for (const p of PRESETS) {
        const opt = document.createElement("option");
        opt.value = p.name;
        opt.textContent = i18n.t(p.label);
        presetSelect.appendChild(opt);
    }
    const customOpt = document.createElement("option");
    customOpt.value = "Custom";
    customOpt.textContent = i18n.t("pageSize.custom");
    presetSelect.appendChild(customOpt);

    const dims = document.createElement("div");
    dims.className = "udoc-page-modal__dims";
    const { field: wField, input: widthInput } = labeledField(i18n.t("pageSettings.width"));
    const { field: hField, input: heightInput } = labeledField(i18n.t("pageSettings.height"));
    widthInput.setAttribute("aria-label", i18n.t("pageSettings.pageWidth"));
    heightInput.setAttribute("aria-label", i18n.t("pageSettings.pageHeight"));

    const unitSelect = document.createElement("select");
    unitSelect.className = "udoc-page-modal__select udoc-page-modal__unit";
    unitSelect.setAttribute("aria-label", i18n.t("pageSettings.units"));
    for (const u of ["in", "mm", "pt"] as Unit[]) {
        const opt = document.createElement("option");
        opt.value = u;
        opt.textContent = i18n.t(UNIT_LABELS[u]);
        unitSelect.appendChild(opt);
    }
    dims.append(wField, hField, unitSelect);

    const orient = document.createElement("div");
    orient.className = "udoc-page-modal__orient";
    const portraitBtn = document.createElement("button");
    portraitBtn.type = "button";
    portraitBtn.className = "udoc-page-modal__orient-btn";
    portraitBtn.textContent = i18n.t("pageSettings.portrait");
    const landscapeBtn = document.createElement("button");
    landscapeBtn.type = "button";
    landscapeBtn.className = "udoc-page-modal__orient-btn";
    landscapeBtn.textContent = i18n.t("pageSettings.landscape");
    orient.append(portraitBtn, landscapeBtn);

    // --- rotation section ---
    const rotLabel = document.createElement("div");
    rotLabel.className = "udoc-page-modal__section-label";
    rotLabel.textContent = i18n.t("pageSettings.rotation");
    const rotRow = document.createElement("div");
    rotRow.className = "udoc-page-modal__rotate";
    const rotLeftBtn = document.createElement("button");
    rotLeftBtn.type = "button";
    rotLeftBtn.className = "udoc-page-modal__rotate-btn";
    rotLeftBtn.title = i18n.t("pageSettings.rotateLeft");
    rotLeftBtn.setAttribute("aria-label", i18n.t("pageSettings.rotatePageLeft"));
    rotLeftBtn.innerHTML = ICON_ROTATE_LEFT;
    const rotRightBtn = document.createElement("button");
    rotRightBtn.type = "button";
    rotRightBtn.className = "udoc-page-modal__rotate-btn";
    rotRightBtn.title = i18n.t("pageSettings.rotateRight");
    rotRightBtn.setAttribute("aria-label", i18n.t("pageSettings.rotatePageRight"));
    rotRightBtn.innerHTML = ICON_ROTATE_RIGHT;
    rotRow.append(rotLeftBtn, rotRightBtn);

    // --- footer ---
    const footer = document.createElement("div");
    footer.className = "udoc-page-modal__footer";
    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "udoc-page-modal__apply";
    applyBtn.textContent = i18n.t("pageSettings.applySize");
    footer.appendChild(applyBtn);

    body.append(sizeLabel, presetSelect, dims, orient, rotLabel, rotRow);
    dialog.append(header, body, footer);
    el.append(backdrop, dialog);

    // --- state ---
    // Width/height the fields currently represent, in points. `unit` persists
    // across opens so a user's chosen unit sticks for the session.
    let widthPt = 612;
    let heightPt = 792;
    let unit: Unit = "in";
    let ctx: PageSettingsContext | null = null;
    let isOpen = false;
    const unsubEvents: Array<() => void> = [];

    /** Reflect the current points/unit into the inputs, preset, orientation. */
    function render(): void {
        widthInput.value = fmtLen(widthPt, unit);
        heightInput.value = fmtLen(heightPt, unit);
        unitSelect.value = unit;
        const preset = matchPreset(widthPt, heightPt);
        presetSelect.value = preset ? preset.name : "Custom";
        const landscape = widthPt > heightPt;
        portraitBtn.classList.toggle("udoc-page-modal__orient-btn--selected", !landscape);
        landscapeBtn.classList.toggle("udoc-page-modal__orient-btn--selected", landscape);
    }

    /** Commit an edited field, falling back to the prior value if unparseable. */
    function commitInput(input: HTMLInputElement, set: (pt: number) => void): void {
        const pt = parseLen(input.value, unit);
        if (pt !== null) set(pt);
        render();
    }

    on(widthInput, "change", () => commitInput(widthInput, (pt) => (widthPt = pt)));
    on(heightInput, "change", () => commitInput(heightInput, (pt) => (heightPt = pt)));

    on(presetSelect, "change", () => {
        const preset = PRESETS.find((p) => p.name === presetSelect.value);
        if (preset) {
            // Keep the page's current orientation when swapping in a preset.
            const landscape = widthPt > heightPt;
            widthPt = landscape ? preset.height : preset.width;
            heightPt = landscape ? preset.width : preset.height;
        }
        render();
    });

    on(unitSelect, "change", () => {
        unit = unitSelect.value as Unit;
        render();
    });

    /** Force orientation by swapping the dimensions if needed. */
    function setOrientation(landscape: boolean): void {
        const isLandscape = widthPt > heightPt;
        if (isLandscape !== landscape) [widthPt, heightPt] = [heightPt, widthPt];
        render();
    }
    on(portraitBtn, "click", () => setOrientation(false));
    on(landscapeBtn, "click", () => setOrientation(true));

    on(rotLeftBtn, "click", () => ctx?.onRotate(false));
    on(rotRightBtn, "click", () => ctx?.onRotate(true));

    function apply(): void {
        ctx?.onResize(widthPt, heightPt);
    }
    on(applyBtn, "click", apply);
    for (const input of [widthInput, heightInput]) {
        on(input, "keydown", (e) => {
            if ((e as KeyboardEvent).key === "Enter") {
                e.preventDefault();
                input.dispatchEvent(new Event("change"));
                apply();
            }
        });
    }

    on(closeBtn, "click", () => close());
    on(backdrop, "click", () => close());

    function open(context: PageSettingsContext): void {
        ctx = context;
        widthPt = context.width;
        heightPt = context.height;
        heading.textContent = i18n.t("pageSettings.title", { page: context.index + 1 });
        dialog.setAttribute("aria-label", i18n.t("pageSettings.label", { page: context.index + 1 }));
        render();
        isOpen = true;
        el.style.display = "";
        widthInput.focus();
        widthInput.select();
    }

    function close(): void {
        if (!isOpen) return;
        isOpen = false;
        ctx = null;
        el.style.display = "none";
    }

    function mount(parent: HTMLElement): void {
        parent.appendChild(el);
        const onKeydown = (e: KeyboardEvent) => {
            if (isOpen && e.key === "Escape") {
                e.stopPropagation();
                close();
            }
        };
        document.addEventListener("keydown", onKeydown);
        unsubEvents.push(() => document.removeEventListener("keydown", onKeydown));
    }

    function destroy(): void {
        for (const off of unsubEvents) off();
        el.remove();
    }

    return { el, mount, open, close, destroy };
}

export type PageSettingsModal = ReturnType<typeof createPageSettingsModal>;
