// A deal room's frontstage, what a buyer opens at the link a seller shared, with no
// account, in the brand of the tenant it's from. Its banner, over its files, one to
// a row, the document and what it says side by side, turn about; a press on one
// opens the document, read-only, in the viewer. What's opened, and how long each page
// stays on screen, is reported for those who shared it, as both pages say.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import type { Frontstage } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { DealBanner } from "../DealRoomViews";
import { DocumentViewer } from "../DocumentViewer";
import { reportVisit, startReading } from "../frontstageActivity";
import type { Reading } from "../frontstageActivity";
import { Thumbnail, typeLabel } from "../files";
import { ChevronRightIcon } from "../icons";
import { announceMoment } from "../moments";
import { useBrandColors } from "../theme";
import { EmptyState } from "../ui";

const frontstagePath = (token: string) => `/rooms/${encodeURIComponent(token)}`;

/** The frontstage at `token`: `null` for none, `undefined` until it's known; and the page in its tenant's colors. */
function useFrontstage(token: string): { stage: Frontstage | null | undefined; failed: boolean } {
    const [stage, setStage] = useState<Frontstage | null>();
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let gone = false;
        api.frontstage(token).then(
            (found) => gone || setStage(found),
            (error: unknown) => {
                if (gone) return;
                if (error instanceof ApiError && error.status === 404) setStage(null);
                else setFailed(true);
            },
        );
        return () => {
            gone = true;
        };
    }, [token]);
    useBrandColors(stage?.from.brandColor ?? null);
    return { stage, failed };
}

/** Title the browser's tab after what's shown, and who it's from: this isn't the app's to sign. */
function useFrontstageTitle(title: string | undefined, from: string | undefined): void {
    useEffect(() => {
        if (title) document.title = from ? `${title} · ${from}` : title;
    }, [title, from]);
}

/** What the page says it records. */
function ActivityNotice() {
    return (
        <p className="frontstage-notice">
            So that those who shared this can see how it's read, this page records which documents are opened and how
            long each page stays on screen, against a cookie in this browser. It doesn't record who you are.
        </p>
    );
}

/** What shows for a link with no frontstage, or one that didn't load. */
function Unavailable({ failed }: { failed: boolean }) {
    return (
        <main className="frontstage frontstage-unavailable">
            <div className="card">
                {failed ? (
                    <EmptyState title="This page didn't load">Reload it to try again.</EmptyState>
                ) : (
                    <EmptyState title="This link isn't available">Ask whoever sent it to you for a new one.</EmptyState>
                )}
            </div>
        </main>
    );
}

export function FrontstagePage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { stage, failed } = useFrontstage(token!);
    useFrontstageTitle(stage?.title, stage?.from.name);
    const shown = stage !== undefined && stage !== null;
    useEffect(() => {
        if (shown) reportVisit(token!);
    }, [shown, token]);

    if (stage === null || failed) return <Unavailable failed={failed} />;
    if (!stage) return null;

    return (
        <main className="frontstage">
            <div className="frontstage-page">
                <DealBanner
                    banner={stage.banner}
                    title={stage.title}
                    description={stage.description}
                    from={stage.from}
                />
                <ul className="stage-files" aria-label="Documents">
                    {stage.files.map((file) => {
                        const path = `${frontstagePath(token!)}/files/${encodeURIComponent(file.id)}`;
                        return (
                            <li key={file.id} className="stage-file" onClick={() => navigate(path)}>
                                <Thumbnail file={file} />
                                <div className="stage-file-text">
                                    <Link className="stage-file-name" to={path}>
                                        {file.name}
                                    </Link>
                                    <p className="stage-file-type">{typeLabel(file.format)}</p>
                                    {file.description && <p className="stage-file-description">{file.description}</p>}
                                </div>
                            </li>
                        );
                    })}
                </ul>
                <ActivityNotice />
            </div>
        </main>
    );
}

export function FrontstageFilePage() {
    const { token, fileId } = useParams();
    const { stage, failed } = useFrontstage(token!);
    const file = stage?.files.find(({ id }) => id === fileId);
    useFrontstageTitle(file?.name ?? stage?.title, stage?.from.name);
    const reading = useRef<Reading>(undefined);
    // The pages on screen, which may come before the document says it's open.
    const onScreen = useRef<readonly number[]>([]);
    useEffect(
        () => () => {
            reading.current?.stop();
            reading.current = undefined;
        },
        [],
    );

    if (stage === null || failed || (stage && !file)) return <Unavailable failed={failed} />;
    if (!stage || !file) return null;

    return (
        <main className="frontstage frontstage-reading">
            <div className="page file-page">
                <nav className="breadcrumb" aria-label="Deal room">
                    <Link to={frontstagePath(token!)}>{stage.title}</Link>
                    <ChevronRightIcon />
                    <span>{file.name}</span>
                </nav>
                <ActivityNotice />
                <div className="file-columns">
                    <section className="document-card">
                        <header className="document-title-bar">
                            <div className="document-title">
                                <h1>{file.name}</h1>
                                <p>{file.description ?? typeLabel(file.format)}</p>
                            </div>
                        </header>
                        <div className="document-viewer">
                            <DocumentViewer
                                packagePath={file.package}
                                colors={stage.from.viewerColors}
                                readsOnly
                                onOpened={({ format, ms }) => {
                                    reading.current ??= startReading(token!, file.id, onScreen.current);
                                    announceMoment({ kind: "document:opened", where: "file", format, ms });
                                }}
                                onClosed={() => {
                                    reading.current?.stop();
                                    reading.current = undefined;
                                    announceMoment({ kind: "document:closed", where: "file" });
                                }}
                                onPages={(pages) => {
                                    onScreen.current = pages;
                                    reading.current?.see(pages);
                                }}
                                onSlideShow={(playing) => reading.current?.presenting(playing)}
                            />
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
