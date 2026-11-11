// How buyers read a deal room's file, below the room's own buyer activity: a page
// for the file, each of its pages with how long it was on screen, by session, and
// its sessions, each opening a page of its own, its pages with when they were on
// screen. Those who sell read them, as they read the room.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";

import type { Asset, DealRoom, DocumentActivity, SessionActivity } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import {
    PageTimeline,
    PageTimes,
    SessionLegend,
    documentActivityPath,
    hasSheets,
    sessionActivityPath,
    sessionColor,
} from "../DealRoomActivity";
import { dealRoomPath } from "../DealRoomViews";
import { formatDateTime, formatDuration, typeLabel } from "../files";
import { ChevronRightIcon } from "../icons";
import { EmptyState, useDocumentTitle } from "../ui";
import { NotFoundPage } from "./PlaceholderPage";

/** The room and what `load` answers: `undefined` while they load, `null` for none, `"failed"` for an error. */
function useLoaded<T>(roomId: string, load: () => Promise<T>, key: string) {
    const [found, setFound] = useState<{ room: DealRoom; data: T } | null | "failed">();
    useEffect(() => {
        let gone = false;
        setFound(undefined);
        Promise.all([api.dealRoom(roomId), load()]).then(
            ([room, data]) => gone || setFound({ room, data }),
            (error: unknown) => {
                if (gone) return;
                setFound(error instanceof ApiError && [403, 404].includes(error.status) ? null : "failed");
            },
        );
        return () => {
            gone = true;
        };
        // `key` says what's loaded.
    }, [roomId, key]);
    return found;
}

/** A page of buyer activity: its way back, its title and what it's of, then what it shows. */
function ActivityPage({
    room,
    asset,
    sessionOf,
    title,
    subtitle,
    children,
}: {
    room: DealRoom;
    asset: Asset | undefined;
    /** For a session's page, the file's activity to go back to. */
    sessionOf?: string;
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    return (
        <div className="page">
            <header className="page-header">
                <nav className="breadcrumb" aria-label="Deal Rooms">
                    <Link to="/deal-rooms">Deal Rooms</Link>
                    <ChevronRightIcon />
                    <Link to={dealRoomPath(room.id)}>{room.title}</Link>
                    {sessionOf && asset && (
                        <>
                            <ChevronRightIcon />
                            <Link to={documentActivityPath(room.id, sessionOf)}>{asset.name}</Link>
                        </>
                    )}
                </nav>
                <h1>{title}</h1>
                <p className="page-subtitle">{subtitle}</p>
            </header>
            {children}
        </div>
    );
}

function Failed() {
    return (
        <div className="page">
            <p className="error" role="alert">
                Buyer activity didn't load. Try again.
            </p>
        </div>
    );
}

const sessionsLabel = (sessions: number) => (sessions === 1 ? "1 session" : `${sessions} sessions`);

/** A file's buyer activity: how long each page was on screen, by session, and its sessions. */
export function DocumentActivityPage() {
    const { roomId, assetId } = useParams();
    const navigate = useNavigate();
    const found = useLoaded<DocumentActivity>(roomId!, () => api.documentActivity(roomId!, assetId!), assetId!);
    const asset =
        found && found !== "failed" ? found.room.files.find((file) => file.asset.id === assetId)?.asset : undefined;
    useDocumentTitle(asset?.name ?? "Deal Rooms");
    if (found === null) return <NotFoundPage />;
    if (found === "failed") return <Failed />;
    if (!found) return null;
    const { room, data } = found;
    const { version, sessions, pages, thumbnails } = data;
    const unit = asset && hasSheets(asset.format) ? "Sheet" : "Page";
    const seen = (id: string) => pages.filter((page) => page.sessions.some((each) => each.id === id)).length;

    return (
        <ActivityPage
            room={room}
            asset={asset}
            title={asset?.name ?? ""}
            subtitle={[
                "Buyer activity",
                asset && typeLabel(asset.format),
                version !== null && `Version ${version}`,
                sessionsLabel(sessions.length),
            ]
                .filter(Boolean)
                .join(" · ")}
        >
            {sessions.length === 0 ? (
                <div className="card">
                    <EmptyState title="No one has opened it yet">
                        Each time a buyer opens it on the frontstage shows here, with how long each {unit.toLowerCase()}{" "}
                        was on screen.
                    </EmptyState>
                </div>
            ) : (
                <>
                    <section className="deal-files">
                        <header className="home-section-header">
                            <h2>Time on each {unit.toLowerCase()}</h2>
                        </header>
                        <div className="card activity-card">
                            <SessionLegend sessions={sessions} />
                            <PageTimes sessions={sessions} pages={pages} thumbnails={thumbnails} unit={unit} />
                        </div>
                    </section>
                    <section className="deal-files">
                        <header className="home-section-header">
                            <h2>Sessions</h2>
                        </header>
                        <div className="card file-list">
                            <table className="file-table">
                                <thead>
                                    <tr>
                                        <th>Session</th>
                                        <th>Opened</th>
                                        <th className="numeric">Length</th>
                                        <th className="numeric">Time on {unit.toLowerCase()}s</th>
                                        <th className="numeric">{unit}s seen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map((session, index) => {
                                        const path = sessionActivityPath(room.id, session.id);
                                        return (
                                            <tr key={session.id} onClick={() => navigate(path)}>
                                                <td>
                                                    <Link className="file-name" to={path}>
                                                        <span
                                                            className="session-swatch"
                                                            style={{ background: sessionColor(index) }}
                                                        />
                                                        <span>Visitor {session.visitor}</span>
                                                    </Link>
                                                </td>
                                                <td>{formatDateTime(session.startedAt)}</td>
                                                <td className="numeric">{formatDuration(session.length)}</td>
                                                <td className="numeric">{formatDuration(session.ms)}</td>
                                                <td className="numeric">{seen(session.id)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </ActivityPage>
    );
}

/** One session of a file: each page, with when it was on screen, from the opening to the last page view. */
export function SessionActivityPage() {
    const { roomId, sessionId } = useParams();
    const found = useLoaded<SessionActivity>(roomId!, () => api.sessionActivity(roomId!, sessionId!), sessionId!);
    const assetId = found && found !== "failed" ? found.data.assetId : undefined;
    const asset =
        found && found !== "failed" ? found.room.files.find((file) => file.asset.id === assetId)?.asset : undefined;
    useDocumentTitle(asset?.name ?? "Deal Rooms");
    if (found === null) return <NotFoundPage />;
    if (found === "failed") return <Failed />;
    if (!found) return null;
    const { room, data } = found;
    const { session, views, pageCount, thumbnails } = data;
    const unit = asset && hasSheets(asset.format) ? "Sheet" : "Page";

    return (
        <ActivityPage
            room={room}
            asset={asset}
            sessionOf={data.assetId}
            title={`Visitor ${session.visitor}`}
            subtitle={[
                `Opened ${formatDateTime(session.startedAt)}`,
                `Version ${session.version}`,
                `${formatDuration(session.length)} to the last ${unit.toLowerCase()}`,
                `${formatDuration(session.ms)} on ${unit.toLowerCase()}s`,
            ].join(" · ")}
        >
            {views.length === 0 ? (
                <div className="card">
                    <EmptyState title={`No ${unit.toLowerCase()} was read`}>
                        It was opened, and closed or left before a {unit.toLowerCase()} was on screen long enough to
                        count.
                    </EmptyState>
                </div>
            ) : (
                <section className="deal-files">
                    <header className="home-section-header">
                        <h2>{unit}s over time</h2>
                    </header>
                    <div className="card activity-card">
                        <PageTimeline
                            length={session.length}
                            views={views}
                            pageCount={pageCount}
                            thumbnails={thumbnails}
                            unit={unit}
                        />
                    </div>
                </section>
            )}
        </ActivityPage>
    );
}
