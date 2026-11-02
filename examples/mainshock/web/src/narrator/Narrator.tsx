// The narrator: docMentis's guide, bolted on beside the app, which never calls
// it (docs/design/examples-mainshock.md). A tab with docMentis's mark sits at
// the window's right edge, and folds and unfolds a panel that pushes the app
// narrower. When something's new while the panel is folded, the tab says so as
// the viewer chose: not at all, with a dot, or with the dot and a flash of the
// tab and the edge; the dot and the flash last until the panel unfolds.
//
// On the sign-in page, the panel offers to sign in as each persona, through
// the app's own form: the narrator fills it in and presses its button, as a
// visitor would. It knows the app's pages and forms; the app knows nothing of
// it.
//
// A mockup so far: something new arrives two seconds after the page loads, to
// show how it's announced.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

import { DEMO_PASSWORD, PERSONAS } from "../../../shared/personas.ts";
import { DocMentisMark } from "./DocMentisMark";
import "./narrator.css";

/** The docmentis.com typeface the panel is set in. */
const FONT_URL = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap";

/** How the folded tab announces something new. */
type Announce = "off" | "dot" | "flash";

const ANNOUNCE_STYLES: { value: Announce; label: string }[] = [
    { value: "off", label: "Off" },
    { value: "dot", label: "Dot" },
    { value: "flash", label: "Flash" },
];

const ANNOUNCE_KEY = "mainshock.narrator.announce";

/** The style this browser chose, or the flash: a first-time visitor finds the guide by it. */
function savedAnnounce(): Announce {
    try {
        const saved = localStorage.getItem(ANNOUNCE_KEY);
        if (ANNOUNCE_STYLES.some(({ value }) => value === saved)) return saved as Announce;
    } catch {
        // Not kept; the default it is.
    }
    return "flash";
}

/**
 * Sign in as `username` through the app's sign-in form, as a visitor would:
 * fill in its username and the demo's password, then press its button.
 */
function signInAs(username: string): void {
    const user = document.querySelector<HTMLInputElement>('input[autocomplete="username"]');
    const password = document.querySelector<HTMLInputElement>('input[autocomplete="current-password"]');
    const submit = user?.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!user || !password || !submit) return;
    enter(user, username);
    enter(password, DEMO_PASSWORD);
    // A moment to see it filled in before it's sent.
    setTimeout(() => submit.click(), 400);
}

/** Put `value` in `input` as typing does, so that the app's form hears it. */
function enter(input: HTMLInputElement, value: string): void {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

function saveAnnounce(announce: Announce): void {
    try {
        localStorage.setItem(ANNOUNCE_KEY, announce);
    } catch {
        // Kept for this visit alone.
    }
}

export function Narrator() {
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const [announce, setAnnounce] = useState(savedAnnounce);
    const [flashing, setFlashing] = useState(false);
    const [unseen, setUnseen] = useState(false);
    const now = useRef({ open, announce });
    now.current = { open, announce };

    useEffect(() => {
        if (document.querySelector(`link[href="${FONT_URL}"]`)) return;
        const font = Object.assign(document.createElement("link"), { rel: "stylesheet", href: FONT_URL });
        document.head.append(font);
    }, []);

    // The mockup's arrival. With the panel unfolded, it's simply there.
    useEffect(() => {
        const arrival = setTimeout(() => {
            if (now.current.open || now.current.announce === "off") return;
            setUnseen(true);
            if (now.current.announce === "flash") setFlashing(true);
        }, 2000);
        return () => clearTimeout(arrival);
    }, []);

    function toggle() {
        setOpen(!open);
        if (open) return;
        setUnseen(false);
        setFlashing(false);
    }

    function choose(chosen: Announce) {
        setAnnounce(chosen);
        saveAnnounce(chosen);
    }

    return (
        <aside className={open ? "narrator narrator-open" : "narrator"} aria-label="docMentis guide">
            <button
                className={flashing ? "narrator-tab narrator-flash" : "narrator-tab"}
                aria-expanded={open}
                aria-label={open ? "Fold the docMentis guide" : "Unfold the docMentis guide"}
                onClick={toggle}
            >
                <DocMentisMark />
                {unseen && <span className="narrator-dot" />}
            </button>
            {flashing && <div className="narrator-edge" />}
            {open && (
                <div className="narrator-panel">
                    {pathname === "/sign-in" && (
                        <ul className="narrator-cards">
                            {PERSONAS.map(({ username, name, title }) => (
                                <li key={username}>
                                    <button className="narrator-card" onClick={() => signInAs(username)}>
                                        <strong>Sign in as {name}</strong>
                                        <span>{title}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="narrator-setting">
                        <span id="narrator-announce" className="narrator-label">
                            Notify me
                        </span>
                        <div className="narrator-segmented" role="radiogroup" aria-labelledby="narrator-announce">
                            {ANNOUNCE_STYLES.map(({ value, label }) => (
                                <button
                                    key={value}
                                    role="radio"
                                    aria-checked={announce === value}
                                    onClick={() => choose(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
