/**
 * The custom colour picker — what a paint panel's "More Colors…" shows in
 * place of its swatches, for a colour none of them is: a saturation /
 * brightness square over a hue strip, the `#rrggbb` they make (typed as well
 * as dragged), and the screen's eyedropper where the browser has one. Nothing
 * is applied until OK; Cancel goes back to the swatches.
 *
 * A pure content builder like the panel it sits in: it returns the element,
 * and the panel's dropdown keeps the open / close lifecycle (Escape and an
 * outside click still close it, applying nothing).
 */
import { hexToHsv, hsvToHex, parseHex, type Hsv } from "../color.js";
import { ICON_EYEDROPPER } from "../icons.js";
import type { I18n } from "../i18n/index.js";

export interface ColorPickerConfig {
    i18n: I18n;
    /** The colour it opens on, `#rrggbb`. */
    initial: string;
    /** OK: apply `hex`, a lowercase `#rrggbb`. */
    onApply: (hex: string) => void;
    /** Cancel: back to where it was opened from. */
    onCancel: () => void;
}

/** The browser's screen eyedropper (Chromium's `EyeDropper`), where it has one. */
type EyeDropperConstructor = new () => { open(): Promise<{ sRGBHex: string }> };
function eyeDropper(): EyeDropperConstructor | undefined {
    return (window as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * A drag that ends off the panel ends in a click on whatever holds both of its
 * ends — outside the menu, which closes it on that click. Swallow the one click
 * that release makes; a mouse's comes in the same task as its release.
 */
function swallowClick(): void {
    const stop = (e: Event): void => e.stopPropagation();
    window.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", stop, true), 0);
}

/** Drag on `area`: `move` gets the pointer's place in it, each axis `0..1`,
 *  from the press until the release. */
function dragOn(area: HTMLElement, move: (x: number, y: number) => void): void {
    area.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        // No text selection, and focus stays where a keyboard would put it.
        e.preventDefault();
        area.focus({ preventScroll: true });
        area.setPointerCapture(e.pointerId);
        const at = (ev: PointerEvent): void => {
            const r = area.getBoundingClientRect();
            move(clamp01((ev.clientX - r.left) / r.width), clamp01((ev.clientY - r.top) / r.height));
        };
        const end = (): void => {
            area.removeEventListener("pointermove", at);
            area.removeEventListener("pointerup", end);
            area.removeEventListener("pointercancel", end);
            swallowClick();
        };
        at(e);
        area.addEventListener("pointermove", at);
        area.addEventListener("pointerup", end);
        area.addEventListener("pointercancel", end);
    });
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = text;
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    return btn;
}

/** Build the picker, opened on `cfg.initial`. */
export function buildColorPicker(cfg: ColorPickerConfig): HTMLElement {
    const { i18n } = cfg;
    // HSV is what the square and strip hold, so a hue survives a drag through
    // grey or black, where the hex no longer carries one.
    let hsv: Hsv = hexToHsv(cfg.initial);

    const el = document.createElement("div");
    el.className = "udoc-colorpicker";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", i18n.t("paint.customColor"));

    // Saturation across, brightness up: the square's colour is its hue at full
    // strength, washed to white leftward and to black downward.
    const square = document.createElement("div");
    square.className = "udoc-colorpicker__square";
    square.tabIndex = 0;
    square.setAttribute("role", "slider");
    square.setAttribute("aria-label", i18n.t("paint.saturationBrightness"));
    square.setAttribute("aria-valuemin", "0");
    square.setAttribute("aria-valuemax", "100");
    const squareThumb = document.createElement("div");
    squareThumb.className = "udoc-colorpicker__thumb";
    square.appendChild(squareThumb);

    const hue = document.createElement("div");
    hue.className = "udoc-colorpicker__hue";
    hue.tabIndex = 0;
    hue.setAttribute("role", "slider");
    hue.setAttribute("aria-label", i18n.t("paint.hue"));
    hue.setAttribute("aria-valuemin", "0");
    hue.setAttribute("aria-valuemax", "359");
    const hueThumb = document.createElement("div");
    hueThumb.className = "udoc-colorpicker__thumb";
    hue.appendChild(hueThumb);

    const fields = document.createElement("div");
    fields.className = "udoc-colorpicker__fields";
    const preview = document.createElement("span");
    preview.className = "udoc-colorpicker__preview";
    preview.setAttribute("aria-hidden", "true");
    const input = document.createElement("input");
    input.className = "udoc-colorpicker__hex";
    input.type = "text";
    input.maxLength = 7;
    input.spellcheck = false;
    input.autocomplete = "off";
    input.setAttribute("aria-label", i18n.t("paint.hex"));
    input.title = i18n.t("paint.hex");
    fields.append(preview, input);

    const EyeDropper = eyeDropper();
    if (EyeDropper) {
        const pick = document.createElement("button");
        pick.type = "button";
        pick.className = "udoc-colorpicker__eyedropper";
        pick.innerHTML = ICON_EYEDROPPER;
        pick.title = i18n.t("paint.eyedropper");
        pick.setAttribute("aria-label", i18n.t("paint.eyedropper"));
        pick.addEventListener("click", (e) => {
            e.stopPropagation();
            new EyeDropper()
                .open()
                .then(({ sRGBHex }) => {
                    const hex = parseHex(sRGBHex);
                    if (hex) setHex(hex);
                })
                // Escape, or the browser refusing it: the colour stays.
                .catch(() => {});
        });
        fields.appendChild(pick);
    }

    const apply = (): void => cfg.onApply(hsvToHex(hsv));
    const actions = document.createElement("div");
    actions.className = "udoc-colorpicker__actions";
    actions.append(
        button("udoc-colorpicker__cancel", i18n.t("common.cancel"), cfg.onCancel),
        button("udoc-colorpicker__ok", i18n.t("common.ok"), apply),
    );

    el.append(square, hue, fields, actions);

    // Draw `hsv` into every part; the hex field too unless it is what's being
    // typed in, which a reformat would fight.
    const render = (typing = false): void => {
        const hex = hsvToHex(hsv);
        const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });
        square.style.setProperty("--hue-color", pure);
        squareThumb.style.left = `${hsv.s * 100}%`;
        squareThumb.style.top = `${(1 - hsv.v) * 100}%`;
        squareThumb.style.setProperty("--swatch-color", hex);
        hueThumb.style.left = `${(hsv.h / 360) * 100}%`;
        hueThumb.style.setProperty("--swatch-color", pure);
        preview.style.setProperty("--swatch-color", hex);
        const saturation = Math.round(hsv.s * 100);
        const brightness = Math.round(hsv.v * 100);
        square.setAttribute("aria-valuenow", String(saturation));
        square.setAttribute("aria-valuetext", i18n.t("paint.saturationBrightnessValue", { saturation, brightness }));
        hue.setAttribute("aria-valuenow", String(Math.round(hsv.h)));
        if (!typing) {
            input.value = hex;
            input.removeAttribute("aria-invalid");
        }
    };

    // A hex from outside the square and strip — typed, or picked off the
    // screen. A grey keeps the hue the strip was on.
    const setHex = (hex: string, typing = false): void => {
        const next = hexToHsv(hex);
        hsv = next.s === 0 || next.v === 0 ? { ...next, h: hsv.h } : next;
        render(typing);
    };

    dragOn(square, (x, y) => {
        hsv = { ...hsv, s: x, v: 1 - y };
        render();
    });
    // The strip's right end is the red it starts from again; stop short of it.
    dragOn(hue, (x) => {
        hsv = { ...hsv, h: Math.min(x * 360, 359) };
        render();
    });

    // Arrow keys step by 1 (Shift: 10) — percent on the square, degrees on the
    // strip.
    square.addEventListener("keydown", (e) => {
        const step = (e.shiftKey ? 10 : 1) / 100;
        const delta: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
        };
        const d = delta[e.key];
        if (!d) return;
        e.preventDefault();
        hsv = { ...hsv, s: clamp01(hsv.s + d[0]), v: clamp01(hsv.v + d[1]) };
        render();
    });
    hue.addEventListener("keydown", (e) => {
        const step = e.shiftKey ? 10 : 1;
        const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
        let h: number;
        if (e.key === "Home") h = 0;
        else if (e.key === "End") h = 359;
        else if (d !== undefined) h = Math.min(359, Math.max(0, hsv.h + d));
        else return;
        e.preventDefault();
        hsv = { ...hsv, h };
        render();
    });

    input.addEventListener("input", () => {
        const hex = parseHex(input.value);
        if (hex) setHex(hex, true);
        else input.setAttribute("aria-invalid", "true");
    });
    // Leaving the field shows the colour it holds, written out in full.
    input.addEventListener("change", () => render());

    // A key pressed in the picker is the picker's: an arrow moves its sliders
    // or the hex field's caret, not the toolbar's focus, and Enter or Delete
    // doesn't reach the shell's shortcuts for the selection. (Escape still
    // closes the menu, which takes it before it gets here.) Enter applies from
    // anywhere but a button, which presses itself.
    el.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key !== "Enter" || e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        apply();
    });

    render();
    return el;
}
