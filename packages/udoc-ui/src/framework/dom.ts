/**
 * DOM patch helpers.
 *
 * Adapted from the `docmentis-udoc-viewer` ui/framework layer (MIT).
 *
 * Rules:
 * - Use in render subscribers only.
 * - Avoid redundant writes for performance.
 */
export function setText(el: Element, text: string): void {
    if (el.textContent !== text) el.textContent = text;
}

/** Set or remove attribute with change detection. */
export function setAttr(el: Element, name: string, value: string | null): void {
    if (value === null) el.removeAttribute(name);
    else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** Toggle class with optional explicit boolean. */
export function toggleClass(el: Element, className: string, force?: boolean): void {
    el.classList.toggle(className, force);
}
