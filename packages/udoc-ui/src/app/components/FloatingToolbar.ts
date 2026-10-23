import type { I18n } from "../i18n/index.js";

/**
 * The bottom-center floating host for the view controls (page nav + zoom + view
 * mode). It owns only chrome: absolute positioning over the viewport and the
 * idle auto-hide. The controls themselves are the shared {@link createViewControls}
 * instance, appended by the shell — this host never builds them, so all three
 * placements show the exact same component.
 */
export function createFloatingToolbar(i18n: I18n) {
    const el = document.createElement("div");
    el.className = "udoc-floating-toolbar";
    el.setAttribute("role", "toolbar");
    el.setAttribute("aria-label", i18n.t("viewControls.pageNavigation"));

    const unsubEvents: Array<() => void> = [];
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let visible = true;
    const IDLE_TIMEOUT_MS = 3000;

    function resetIdleTimer(): void {
        el.classList.remove("udoc-floating-toolbar--idle");
        if (idleTimer !== null) clearTimeout(idleTimer);
        if (!visible) return;
        idleTimer = setTimeout(() => {
            if (el.contains(document.activeElement)) return;
            el.classList.add("udoc-floating-toolbar--idle");
        }, IDLE_TIMEOUT_MS);
    }

    /** Append the host to `container` and wire idle auto-hide to its activity. */
    function mount(container: HTMLElement): void {
        container.appendChild(el);

        const onActivity = () => resetIdleTimer();
        container.addEventListener("mousemove", onActivity);
        container.addEventListener("mousedown", onActivity);
        container.addEventListener("wheel", onActivity);
        container.addEventListener("touchstart", onActivity);
        container.addEventListener("keydown", onActivity);
        unsubEvents.push(() => {
            container.removeEventListener("mousemove", onActivity);
            container.removeEventListener("mousedown", onActivity);
            container.removeEventListener("wheel", onActivity);
            container.removeEventListener("touchstart", onActivity);
            container.removeEventListener("keydown", onActivity);
        });

        const cancelIdle = () => {
            if (idleTimer !== null) clearTimeout(idleTimer);
            el.classList.remove("udoc-floating-toolbar--idle");
        };
        el.addEventListener("mouseenter", cancelIdle);
        el.addEventListener("mouseleave", resetIdleTimer);
        el.addEventListener("focusin", cancelIdle);
        el.addEventListener("focusout", resetIdleTimer);
        unsubEvents.push(() => {
            el.removeEventListener("mouseenter", cancelIdle);
            el.removeEventListener("mouseleave", resetIdleTimer);
            el.removeEventListener("focusin", cancelIdle);
            el.removeEventListener("focusout", resetIdleTimer);
        });

        resetIdleTimer();
    }

    function setVisible(next: boolean): void {
        visible = next;
        el.style.display = next ? "" : "none";
        resetIdleTimer();
    }

    function destroy(): void {
        if (idleTimer !== null) clearTimeout(idleTimer);
        for (const off of unsubEvents) off();
        el.remove();
    }

    return { el, mount, setVisible, destroy };
}
