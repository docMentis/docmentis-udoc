// How buyers read a deal room's frontstage, backstage, at three depths: the room's,
// a table of its files; a file's, each of its pages with how long it was on screen,
// a bar split by session; and a session's, each page with when it was on screen, a
// timeline from the opening to the last page view. Material has no chart: these are
// its lists and tables, with marks drawn after the docs' data-viz rules (thin bars
// with a rounded data end, a 2px surface gap between parts, recessive gridlines,
// each value written out, and a tooltip on each mark). Sessions are told apart by a
// categorical palette, the latest seven each a color of their own and the earlier
// ones together in gray; text never wears it.
import { useState } from "react";
import type { FocusEvent, PointerEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import type { DealRoom, DealRoomActivity, PageView, ReadingSession, Thumbnails } from "../../shared/api.ts";
import { FileBadge, formatDateTime, formatDuration } from "./files";
import { EmptyState } from "./ui";

export const documentActivityPath = (roomId: string, assetId: string) =>
    `/deal-rooms/${roomId}/activity/files/${assetId}`;

export const sessionActivityPath = (roomId: string, sessionId: string) =>
    `/deal-rooms/${roomId}/activity/sessions/${sessionId}`;

/** How many sessions have a color of their own: the categorical palette's, in app.css. */
export const SESSION_COLORS = 7;

/** Whether a file of `format` is read a sheet at a time. */
export const hasSheets = (format: string) => ["xlsx", "xls", "csv"].includes(format);

const visitorsLabel = (visitors: number) => (visitors === 1 ? "1 visitor" : `${visitors} visitors`);

/** A session as people tell it apart: "Visitor 3 · Nov 10, 2:05 PM". */
export const sessionLabel = (session: ReadingSession) =>
    `Visitor ${session.visitor} · ${formatDateTime(session.startedAt)}`;

/** The color of the session at `index`, the latest first: its own, or the earlier sessions' gray. */
export const sessionColor = (index: number) =>
    index < SESSION_COLORS ? `var(--sw-session-${index + 1})` : "var(--sw-session-earlier)";

/** The room's section: what came of the frontstage, a row to each file, or that nothing has yet. */
export function BuyerActivity({ room, activity }: { room: DealRoom; activity: DealRoomActivity }) {
    const navigate = useNavigate();
    const fileOf = (id: string) => room.files.find(({ asset }) => asset.id === id)?.asset;

    return (
        <section className="deal-files">
            <header className="home-section-header">
                <h2>Buyer activity</h2>
                {activity.lastVisitAt !== null && (
                    <p className="settings-help">
                        {visitorsLabel(activity.visitors)} · last {formatDateTime(activity.lastVisitAt)}
                    </p>
                )}
            </header>
            {activity.visitors === 0 ? (
                <div className="card">
                    <EmptyState title="No one has come yet">
                        Each browser that opens the link shows here, with what it reads. Yours, signed in, doesn't.
                    </EmptyState>
                </div>
            ) : (
                <div className="card file-list">
                    <table className="file-table">
                        <thead>
                            <tr>
                                <th>Document</th>
                                <th className="numeric">Visitors</th>
                                <th className="numeric">Sessions</th>
                                <th className="numeric">Time read</th>
                                <th>Last opened</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activity.files.map((file) => {
                                const asset = fileOf(file.assetId);
                                const path = documentActivityPath(room.id, file.assetId);
                                return (
                                    <tr key={file.assetId} onClick={() => navigate(path)}>
                                        <td>
                                            <Link className="file-name" to={path}>
                                                {asset && <FileBadge format={asset.format} />}
                                                <span>{asset?.name}</span>
                                            </Link>
                                        </td>
                                        <td className="numeric">{file.visitors}</td>
                                        <td className="numeric">{file.sessions}</td>
                                        <td className="numeric">{formatDuration(file.ms)}</td>
                                        <td>
                                            {file.lastOpenedAt === null ? "Not yet" : formatDateTime(file.lastOpenedAt)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

/** What a mark's tooltip says: its value, strong, then what it's of. */
interface Tip {
    x: number;
    y: number;
    value: string;
    label: string;
}

/**
 * A tooltip for a chart's marks, Material's plain tooltip: `marked` gives a mark
 * the handlers that show it, on hover and on keyboard focus alike, and its
 * accessible name; `tooltip` is the tooltip itself, while one shows.
 */
function useTooltip() {
    const [tip, setTip] = useState<Tip>();
    const marked = (value: string, label: string) => ({
        tabIndex: 0,
        role: "img",
        "aria-label": `${label}: ${value}`,
        onPointerMove: (event: PointerEvent) => setTip({ x: event.clientX, y: event.clientY, value, label }),
        onPointerLeave: () => setTip(undefined),
        onFocus: (event: FocusEvent<HTMLElement>) => {
            const box = event.currentTarget.getBoundingClientRect();
            setTip({ x: box.left + box.width / 2, y: box.top, value, label });
        },
        onBlur: () => setTip(undefined),
    });
    const tooltip = tip && (
        <div className="chart-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
            <strong>{tip.value}</strong>
            <span>{tip.label}</span>
        </div>
    );
    return { marked, tooltip };
}

/** A page's image, as its card shows it, or none for a version with none kept. */
function PageImage({ thumbnails, page }: { thumbnails: Thumbnails | null; page: number }) {
    return (
        <span className="activity-page-image">
            {thumbnails && page < thumbnails.pageCount && (
                <img src={`${thumbnails.path}/${page}`} alt="" loading="lazy" />
            )}
        </span>
    );
}

/** A row to a page: its image, its number, its chart, and its value. */
function PageRow({
    thumbnails,
    unit,
    page,
    value,
    children,
}: {
    thumbnails: Thumbnails | null;
    unit: string;
    page: number;
    value: string;
    children: ReactNode;
}) {
    return (
        <li className="activity-page">
            <PageImage thumbnails={thumbnails} page={page} />
            <span className="activity-page-number">
                {unit} {page + 1}
            </span>
            <div className="activity-page-chart">{children}</div>
            <span className="activity-page-value">{value}</span>
        </li>
    );
}

/** The sessions' colors, in the order their parts sit in a bar: the latest first, then the earlier ones. */
export function SessionLegend({ sessions }: { sessions: ReadingSession[] }) {
    return (
        <ul className="session-legend" aria-label="Sessions">
            {sessions.slice(0, SESSION_COLORS).map((session, index) => (
                <li key={session.id}>
                    <span className="session-swatch" style={{ background: sessionColor(index) }} />
                    {sessionLabel(session)}
                </li>
            ))}
            {sessions.length > SESSION_COLORS && (
                <li>
                    <span className="session-swatch" style={{ background: sessionColor(SESSION_COLORS) }} />
                    {sessions.length - SESSION_COLORS} earlier sessions
                </li>
            )}
        </ul>
    );
}

/**
 * Each page with how long it was on screen in all, a bar as long as that against
 * the longest page's, split into a part for each session as long as its share, in
 * the legend's order: the latest seven each in its color, the earlier ones
 * together in gray.
 */
export function PageTimes({
    sessions,
    pages,
    thumbnails,
    unit,
}: {
    sessions: ReadingSession[];
    pages: { page: number; ms: number; sessions: { id: string; ms: number }[] }[];
    thumbnails: Thumbnails | null;
    unit: string;
}) {
    const { marked, tooltip } = useTooltip();
    const longest = Math.max(1, ...pages.map(({ ms }) => ms));
    const indexOf = new Map(sessions.map(({ id }, index) => [id, index]));
    return (
        <>
            <ol className="activity-pages">
                {pages.map(({ page, ms, sessions: read }) => {
                    // Its own sessions' parts, then the earlier ones' as one.
                    const own = read.filter(({ id }) => indexOf.get(id)! < SESSION_COLORS);
                    const earlier = read
                        .filter(({ id }) => indexOf.get(id)! >= SESSION_COLORS)
                        .reduce((sum, each) => sum + each.ms, 0);
                    return (
                        <PageRow key={page} thumbnails={thumbnails} unit={unit} page={page} value={formatDuration(ms)}>
                            {ms > 0 && (
                                <span className="page-time-bar" style={{ width: `${(ms / longest) * 100}%` }}>
                                    {own.map(({ id, ms: part }) => {
                                        const index = indexOf.get(id)!;
                                        return (
                                            <span
                                                key={id}
                                                className="page-time-part"
                                                style={{ flexGrow: part, background: sessionColor(index) }}
                                                {...marked(formatDuration(part), sessionLabel(sessions[index]))}
                                            />
                                        );
                                    })}
                                    {earlier > 0 && (
                                        <span
                                            className="page-time-part"
                                            style={{ flexGrow: earlier, background: sessionColor(SESSION_COLORS) }}
                                            {...marked(formatDuration(earlier), "Earlier sessions")}
                                        />
                                    )}
                                </span>
                            )}
                        </PageRow>
                    );
                })}
            </ol>
            {tooltip}
        </>
    );
}

/** `ms` since an opening, as a clock reads it: "0:45", "12:05", "1:02:30". */
function clockOf(ms: number): string {
    const seconds = Math.round(ms / 1000);
    const two = (value: number) => String(value).padStart(2, "0");
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds % 60)}` : `${minutes}:${two(seconds % 60)}`;
}

/** The steps a timeline's axis is marked in, in milliseconds: the first that gives it at most six marks. */
const STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200].map((seconds) => seconds * 1000);

/**
 * Each page with when it was on screen in one session: a timeline from the opening
 * to the end of its last page view, a block for each view, in one color, under an
 * axis of the time since the opening, its marks carried down as hairlines.
 */
export function PageTimeline({
    length,
    views,
    pageCount,
    thumbnails,
    unit,
}: {
    length: number;
    views: PageView[];
    pageCount: number;
    thumbnails: Thumbnails | null;
    unit: string;
}) {
    const { marked, tooltip } = useTooltip();
    const span = Math.max(length, 1000);
    const step = STEPS.find((each) => span / each <= 6) ?? STEPS[STEPS.length - 1];
    const marks = Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => index * step);
    const at = (ms: number) => `${(ms / span) * 100}%`;
    const gridlines = marks.map((mark) => <span key={mark} className="timeline-gridline" style={{ left: at(mark) }} />);
    return (
        <>
            <div className="activity-page activity-axis" aria-hidden="true">
                <span />
                <span />
                <div className="activity-page-chart timeline-axis">
                    {marks.map((mark) => (
                        <span key={mark} className="timeline-mark" style={{ left: at(mark) }}>
                            {clockOf(mark)}
                        </span>
                    ))}
                </div>
                <span />
            </div>
            <ol className="activity-pages">
                {Array.from({ length: pageCount }, (_, page) => {
                    const its = views.filter((view) => view.page === page);
                    const ms = its.reduce((sum, { from, to }) => sum + to - from, 0);
                    return (
                        <PageRow key={page} thumbnails={thumbnails} unit={unit} page={page} value={formatDuration(ms)}>
                            <span className="timeline-track">
                                {gridlines}
                                {its.map(({ from, to }) => (
                                    <span
                                        key={from}
                                        className="timeline-view"
                                        style={{ left: at(from), width: `${((to - from) / span) * 100}%` }}
                                        {...marked(
                                            formatDuration(to - from),
                                            `${unit} ${page + 1} · ${clockOf(from)} – ${clockOf(to)}`,
                                        )}
                                    />
                                ))}
                            </span>
                        </PageRow>
                    );
                })}
            </ol>
            {tooltip}
        </>
    );
}
