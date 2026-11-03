// The narrator: docMentis's guide, bolted on beside the app, which never calls
// it (docs/design/examples-shockwave.md). A tab with docMentis's mark sits at
// the window's right edge, and folds and unfolds a panel that pushes the app
// narrower. When something's new while the panel is folded, the tab says so as
// the viewer chose: not at all, with a dot, or with the dot and a flash of the
// tab and the edge; the dot and the flash last until the panel unfolds, or
// what's new is gone.
//
// On the sign-in page, the panel offers to sign in as each persona, through
// the app's own form: the narrator fills it in and presses its button, as a
// visitor would. Those offers are new from the moment the page shows, and go
// with it. It knows the app's pages and forms; the app knows nothing of it.
//
// It hears the moments the app announces. A highlight shows while what it
// tells about shows: from the moment it shows to the moment it goes, in the
// panel, newest first, and new as it shows while the panel is folded.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

import { DEMO_PASSWORD, PERSONAS } from "../../../shared/personas.ts";
import { onMoment } from "../moments";
import type { Moment } from "../moments";
import { DocMentisMark } from "./DocMentisMark";
import { HIGHLIGHTS } from "./script";
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

const ANNOUNCE_KEY = "shockwave.narrator.announce";

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
 * Sign in as `email` through the app's sign-in form, as a visitor would:
 * fill in the email and the demo's password, then press its button.
 */
function signInAs(email: string): void {
    const user = document.querySelector<HTMLInputElement>('input[autocomplete="username"]');
    const password = document.querySelector<HTMLInputElement>('input[autocomplete="current-password"]');
    const submit = user?.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!user || !password || !submit) return;
    enter(user, email);
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

/** A highlight told: what it says, its moment's figures, and the moment it goes with. */
interface Told {
    id: string;
    title: string;
    body: string;
    figures: string[];
    ends: (moment: Moment) => boolean;
}

/** A four-pointed sparkle, marking a highlight. */
function Sparkle() {
    return (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
                d="M8 0c.4 3.9 2.1 5.6 6 6-3.9.4-5.6 2.1-6 6-.4-3.9-2.1-5.6-6-6 3.9-.4 5.6-2.1 6-6Z"
                fill="currentColor"
            />
        </svg>
    );
}

export function Narrator() {
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const [announce, setAnnounce] = useState(savedAnnounce);
    const [offersNew, setOffersNew] = useState(false);
    const [told, setTold] = useState<Told[]>([]);
    const [toldNew, setToldNew] = useState(false);
    const now = useRef({ open });
    now.current = { open };
    // What's new, told on the folded tab as the viewer chose: a highlight, while it's there.
    const unseen = (offersNew || (toldNew && told.length > 0)) && announce !== "off";
    const flashing = unseen && announce === "flash";

    useEffect(() => {
        if (document.querySelector(`link[href="${FONT_URL}"]`)) return;
        const font = Object.assign(document.createElement("link"), { rel: "stylesheet", href: FONT_URL });
        document.head.append(font);
    }, []);

    // The sign-in page's offers, new as it shows and gone as it goes. With the
    // panel unfolded, they're simply there.
    useEffect(() => {
        setOffersNew(pathname === "/sign-in" && !now.current.open);
    }, [pathname]);

    // Each highlight as what it tells about shows, and gone as that goes.
    useEffect(
        () =>
            onMoment((moment) => {
                setTold((before) => {
                    const kept = before.filter(({ ends }) => !ends(moment));
                    return kept.length === before.length ? before : kept;
                });
                const highlight = HIGHLIGHTS.find((candidate) => candidate.tells(moment));
                if (!highlight) return;
                const { id, title, body, ends } = highlight;
                const telling = { id, title, body, figures: highlight.figures(moment), ends };
                setTold((before) => [telling, ...before.filter((other) => other.id !== id)]);
                if (!now.current.open) setToldNew(true);
            }),
        [],
    );

    function toggle() {
        setOpen(!open);
        if (open) return;
        setOffersNew(false);
        setToldNew(false);
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
                    <div className="narrator-body">
                        {pathname === "/sign-in" && (
                            <ul className="narrator-cards">
                                {PERSONAS.map(({ email, name, title }) => (
                                    <li key={email}>
                                        <button className="narrator-card" onClick={() => signInAs(email)}>
                                            <strong>Sign in as {name}</strong>
                                            <span>{title}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {told.length > 0 && (
                            <ul className="narrator-highlights" aria-live="polite">
                                {told.map(({ id, title, body, figures }) => (
                                    <li key={id} className="narrator-highlight">
                                        <strong>
                                            <Sparkle />
                                            {title}
                                        </strong>
                                        <p>{body}</p>
                                        <span>{figures.join(" · ")}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
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
