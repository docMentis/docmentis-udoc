// The narrator: docMentis's guide, bolted on beside the app, which never calls
// it (docs/design/examples-shockwave.md). A tab with docMentis's mark sits at
// the window's right edge, and folds and unfolds a panel that pushes the app
// narrower. When something's new while the panel is folded, the tab says so as
// the viewer chose: not at all, with a dot, or with the dot and a flash of the
// tab and the edge; the dot and the flash last until the panel unfolds, or
// what's new is gone.
//
// It shows two kinds of card, the script's. A page's guides, which the visitor
// clicks for the narrator to act in the app, as signing in as a persona fills
// in the sign-in form and presses its button: new from the moment the page
// shows, and gone with it. Then the highlights, from the moments the app
// announces: each while what it tells about shows, from the moment it shows to
// the moment it goes, newest first, and new as it shows while the panel is
// folded.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

import { onMoment } from "../moments";
import type { Moment } from "../moments";
import { DocMentisMark } from "./DocMentisMark";
import { GUIDES, HIGHLIGHTS } from "./script";
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
    const offered = GUIDES.filter((guide) => guide.offeredAt(pathname));
    // What's new, told on the folded tab as the viewer chose: a page's guides, or a highlight while it's there.
    const unseen = (offersNew || (toldNew && told.length > 0)) && announce !== "off";
    const flashing = unseen && announce === "flash";

    useEffect(() => {
        if (document.querySelector(`link[href="${FONT_URL}"]`)) return;
        const font = Object.assign(document.createElement("link"), { rel: "stylesheet", href: FONT_URL });
        document.head.append(font);
    }, []);

    // A page's guides, new as it shows and gone as it goes. With the panel
    // unfolded, they're simply there.
    useEffect(() => {
        setOffersNew(GUIDES.some((guide) => guide.offeredAt(pathname)) && !now.current.open);
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
                        {offered.length > 0 && (
                            <ul className="narrator-guides">
                                {offered.map(({ id, title, detail, act }) => (
                                    <li key={id}>
                                        <button className="narrator-guide" onClick={act}>
                                            <strong>{title}</strong>
                                            {detail && <span>{detail}</span>}
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
                                        {figures.length > 0 && <span>{figures.join(" · ")}</span>}
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
