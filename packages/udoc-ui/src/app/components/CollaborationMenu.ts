import { subscribeSelector, shallowEqual } from "../../framework/index.js";
import type { Store } from "../../framework/index.js";
import type { Peer } from "../../geometry.js";
import type { Action } from "../actions.js";
import type { CollaborationStatus, UIState } from "../state.js";
import type { I18n } from "../i18n/index.js";
import { ICON_PAUSE, ICON_PEOPLE, ICON_RESUME, ICON_TOOL_POINTER } from "../icons.js";
import { createDropdownButton, nameButton } from "./controls.js";
import { peerColor } from "./SelectionLayer.js";

/** How many peers the button shows as faces before it counts the rest. */
const MAX_FACES = 3;

/** What the people button and its menu draw from. */
type CollaborationSlice = {
    collaboration: CollaborationStatus;
    peers: readonly Peer[];
    userName: string | null;
    pointerSharing: boolean;
};

function selectSlice(state: UIState): CollaborationSlice {
    return {
        collaboration: state.collaboration,
        peers: state.peers,
        userName: state.userName,
        pointerSharing: state.pointerSharing,
    };
}

/** What the menu's pause and resume rows ask the shell to do. */
export interface CollaborationMenuCallbacks {
    pause(): void;
    resume(): void;
    /** The button was shown or hidden — the toolbar's keyboard order changed. */
    shown(): void;
}

/**
 * The people button — the collaboration the open document is in, at the head of
 * the top toolbar's right zone, shown only while in one: joined, rejoining, or
 * paused. Its trigger shows the peers present as their initials, each in its
 * own color (the color of its selection and its pointer), the rest counted, or
 * the people glyph while no one else is there; a pause glyph marks it paused,
 * and a spinner while it rejoins. Its menu lists who is present, this one
 * first; then the switch sharing this one's pointer, and the pause or resume.
 *
 * Names are a peer's own words, so they reach the DOM as text, never markup.
 */
export function createCollaborationMenu(i18n: I18n) {
    const dropdown = createDropdownButton(
        { label: i18n.t("collaboration.label"), className: "udoc-collaboration__trigger" },
        { menuLabel: i18n.t("collaboration.label"), wrapperClass: "udoc-collaboration" },
    );
    const el = dropdown.el;
    el.style.display = "none";
    const faces = document.createElement("span");
    faces.className = "udoc-collaboration__faces";
    dropdown.trigger.prepend(faces);

    let unsub: (() => void) | null = null;

    function mount(store: Store<UIState, Action>, callbacks: CollaborationMenuCallbacks): void {
        const apply = (slice: CollaborationSlice): void => {
            const shown = slice.collaboration !== "none";
            if ((el.style.display !== "none") !== shown) {
                el.style.display = shown ? "" : "none";
                callbacks.shown();
            }
            if (!shown) {
                dropdown.controller.close();
                return;
            }
            renderTrigger(slice);
            renderMenu(slice, store, callbacks);
        };
        apply(selectSlice(store.getState()));
        unsub = subscribeSelector(store, selectSlice, apply, { equality: shallowEqual });
    }

    /** The faces of the peers present, or the people glyph; the status badge; the name. */
    function renderTrigger(slice: CollaborationSlice): void {
        faces.replaceChildren();
        faces.classList.toggle("udoc-collaboration__faces--paused", slice.collaboration === "paused");
        if (slice.peers.length === 0) {
            faces.insertAdjacentHTML("beforeend", ICON_PEOPLE);
        } else {
            for (const peer of slice.peers.slice(0, MAX_FACES)) faces.appendChild(face(peer.name, peerColor(peer.id)));
            if (slice.peers.length > MAX_FACES) {
                const more = document.createElement("span");
                more.className = "udoc-collaboration__more";
                more.textContent = `+${slice.peers.length - MAX_FACES}`;
                faces.appendChild(more);
            }
        }
        if (slice.collaboration === "paused" || slice.collaboration === "interrupted") {
            const badge = document.createElement("span");
            badge.className = `udoc-collaboration__badge udoc-collaboration__badge--${slice.collaboration}`;
            if (slice.collaboration === "paused") badge.innerHTML = ICON_PAUSE;
            faces.appendChild(badge);
        }
        nameButton(
            dropdown.trigger,
            i18n.t(
                slice.collaboration === "paused"
                    ? "collaboration.paused"
                    : slice.collaboration === "interrupted"
                      ? "collaboration.reconnecting"
                      : "collaboration.label",
            ),
        );
    }

    /** Who is present, this one first; then the pointer switch and the pause or resume. */
    function renderMenu(
        slice: CollaborationSlice,
        store: Store<UIState, Action>,
        callbacks: CollaborationMenuCallbacks,
    ): void {
        const rows: HTMLElement[] = [];
        const you = slice.userName ?? "";
        rows.push(person(face(you, null), i18n.t("collaboration.you", { name: you })));
        for (const peer of slice.peers) rows.push(person(face(peer.name, peerColor(peer.id)), peer.name ?? peer.id));

        const share = document.createElement("button");
        share.className = "udoc-toolbar__menu-item udoc-toolbar__menu-item--divider udoc-toolbar__menu-item--checkable";
        share.classList.toggle("udoc-toolbar__menu-item--checked", slice.pointerSharing);
        share.setAttribute("role", "menuitemcheckbox");
        share.setAttribute("aria-checked", String(slice.pointerSharing));
        share.innerHTML =
            `<span class="udoc-toolbar__menu-icon">${ICON_TOOL_POINTER}</span>` +
            `<span class="udoc-toolbar__menu-label">${i18n.t("collaboration.sharePointer")}</span>` +
            `<span class="udoc-toolbar__menu-switch" aria-hidden="true"></span>`;
        // The menu stays open, rebuilt with the switch in its new position.
        share.addEventListener("click", (e) => {
            e.stopPropagation();
            store.dispatch({ type: "SET_POINTER_SHARING", enabled: !slice.pointerSharing });
        });
        rows.push(share);

        const paused = slice.collaboration === "paused";
        const pause = document.createElement("button");
        pause.className = "udoc-toolbar__menu-item";
        pause.setAttribute("role", "menuitem");
        pause.innerHTML =
            `<span class="udoc-toolbar__menu-icon">${paused ? ICON_RESUME : ICON_PAUSE}</span>` +
            `<span class="udoc-toolbar__menu-label">${i18n.t(paused ? "collaboration.resume" : "collaboration.pause")}</span>`;
        pause.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.controller.close();
            if (paused) callbacks.resume();
            else callbacks.pause();
        });
        rows.push(pause);

        dropdown.menu.replaceChildren(...rows);
    }

    function destroy(): void {
        if (unsub) unsub();
        dropdown.destroy();
        el.remove();
    }

    return { el, mount, destroy };
}

/**
 * A face: the first letter of `name` in a disc of `color` — a peer's own — or,
 * for this one (`null`), the primary color.
 */
function face(name: string | null, color: string | null): HTMLElement {
    const disc = document.createElement("span");
    disc.className = color ? "udoc-collaboration__face" : "udoc-collaboration__face udoc-collaboration__face--you";
    if (color) disc.style.background = color;
    disc.textContent = Array.from(name?.trim() ?? "")[0]?.toUpperCase() ?? "?";
    return disc;
}

/** A roster row: someone's face and their name, which is not a command. */
function person(disc: HTMLElement, name: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "udoc-collaboration__person";
    row.setAttribute("role", "none");
    const label = document.createElement("span");
    label.className = "udoc-collaboration__name";
    label.textContent = name;
    row.append(disc, label);
    return row;
}
