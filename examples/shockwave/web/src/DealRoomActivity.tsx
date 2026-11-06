// How buyers read a deal room's frontstage, backstage: a table of its files, each
// opening how long each of its pages was read. Those are a table's rows with a bar
// each, one hue, its data end rounded, as a chart's single series; every value is
// written out beside its bar, so there's no tooltip to find it in. Material has no
// chart; these are its table's rows, with a bar in the primary.
import { Fragment, useState } from "react";

import type { DealRoom, DealRoomActivity, DealRoomFileActivity } from "../../shared/api.ts";
import { FileBadge, formatDateTime, formatDuration } from "./files";
import { ChevronDownIcon, ChevronRightIcon } from "./icons";
import { EmptyState } from "./ui";

/** Whether a file of `format` is read a sheet at a time. */
const hasSheets = (format: string) => ["xlsx", "xls", "csv"].includes(format);

const visitorsLabel = (visitors: number) => (visitors === 1 ? "1 visitor" : `${visitors} visitors`);

/** How long each page of a file was read: a row for each page read, in order, its bar as long as its time. */
function PageReadings({ file, format }: { file: DealRoomFileActivity; format: string }) {
    if (file.pages.length === 0) return <p className="page-readings-none">Opened, with no time read yet.</p>;
    const longest = Math.max(...file.pages.map(({ ms }) => ms));
    const unit = hasSheets(format) ? "Sheet" : "Page";
    return (
        <table className="page-readings">
            <caption>
                Time on each {unit.toLowerCase()} of version {file.version}
            </caption>
            <thead>
                <tr>
                    <th>{unit}</th>
                    <th>Time</th>
                    <th className="numeric">Visitors</th>
                </tr>
            </thead>
            <tbody>
                {file.pages.map(({ page, ms, visitors }) => (
                    <tr key={page}>
                        <td>{page + 1}</td>
                        <td>
                            <div className="page-reading-time">
                                <span className="page-reading-track">
                                    <span className="page-reading-bar" style={{ width: `${(ms / longest) * 100}%` }} />
                                </span>
                                <span className="page-reading-value">{formatDuration(ms)}</span>
                            </div>
                        </td>
                        <td className="numeric">{visitors}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** The section: what came of the frontstage, or that nothing has yet. */
export function BuyerActivity({ room, activity }: { room: DealRoom; activity: DealRoomActivity }) {
    const [open, setOpen] = useState<string>();
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
                                <th className="numeric">Opens</th>
                                <th className="numeric">Time read</th>
                                <th>Last opened</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activity.files.map((file) => {
                                const asset = fileOf(file.assetId);
                                const isOpen = open === file.assetId;
                                const toggle = () => setOpen(isOpen ? undefined : file.assetId);
                                return (
                                    <Fragment key={file.assetId}>
                                        <tr onClick={toggle}>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="activity-toggle file-name"
                                                    aria-expanded={isOpen}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        toggle();
                                                    }}
                                                >
                                                    {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
                                                    {asset && <FileBadge format={asset.format} />}
                                                    <span>{asset?.name}</span>
                                                </button>
                                            </td>
                                            <td className="numeric">{file.visitors}</td>
                                            <td className="numeric">{file.opens}</td>
                                            <td className="numeric">{formatDuration(file.ms)}</td>
                                            <td>
                                                {file.lastOpenedAt === null
                                                    ? "Not yet"
                                                    : formatDateTime(file.lastOpenedAt)}
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="page-readings-row">
                                                <td colSpan={5}>
                                                    <PageReadings file={file} format={asset?.format ?? ""} />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
