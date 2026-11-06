// How the app shows a file's versions: where they stand, as a status; the list
// of them, what happened to each; and the dialog each step with one asks in.
import { useState } from "react";
import type { FormEvent } from "react";

import type { Asset, Version, VersionEvent, VersionStatus } from "../../shared/api.ts";
import { ApiError } from "./api";
import { formatDateTime } from "./files";
import { Dialog } from "./ui";

/** A status a file shows: where a version stands in review, or that it's the one published. */
export type FileStatusName = VersionStatus | "published";

/** Each status, as people read it, in the order a version reaches them. */
export const STATUS_LABELS: Record<FileStatusName, string> = {
    draft: "Draft",
    submitted: "In review",
    approved: "Approved",
    returned: "Returned",
    published: "Published",
};

/**
 * Where a file's versions stand: its latest, and the one published if that's
 * another, so that a file being revised shows both.
 */
export function fileStatuses({ latestVersion, publishedVersion }: Asset): { status: FileStatusName; number: number }[] {
    const published = { status: "published" as const, number: publishedVersion ?? 0 };
    if (publishedVersion === latestVersion.number) return [published];
    return [latestVersion, ...(publishedVersion === null ? [] : [published])];
}

/** A status: "In review", or with a version's number, "In review · v3". */
function StatusLabel({ status, number }: { status: FileStatusName; number?: number }) {
    return (
        <span className={`status-label status-${status}`}>
            {STATUS_LABELS[status]}
            {number !== undefined && ` · v${number}`}
        </span>
    );
}

/** Where a file's versions stand, as a list or a card shows it. */
export function FileStatus({ asset }: { asset: Asset }) {
    return (
        <span className="status-labels">
            {fileStatuses(asset).map(({ status, number }) => (
                <StatusLabel key={status} status={status} number={number} />
            ))}
        </span>
    );
}

/** What each event says happened. */
const EVENTS: Record<VersionEvent["kind"], string> = {
    saved: "Saved",
    submitted: "Submitted",
    approved: "Approved",
    returned: "Returned",
    published: "Published",
};

/**
 * A file's versions, newest first, under its working copy for those who edit
 * it: each opens as it's pressed. A version says who saved it, when and why;
 * the one shown, what's happened to it since.
 */
export function VersionList({
    versions,
    publishedVersion,
    shown,
    workingCopy,
    onShow,
}: {
    versions: Version[];
    publishedVersion: number | null;
    /** The version shown; `null` for the working copy. */
    shown: number | null;
    /** Whether to offer the working copy. */
    workingCopy: boolean;
    onShow: (number: number | null) => void;
}) {
    return (
        <ul className="version-list">
            {workingCopy && (
                <li>
                    <button
                        type="button"
                        className="version-row"
                        aria-current={shown === null}
                        onClick={() => onShow(null)}
                    >
                        <span className="version-row-title">Working copy</span>
                        <span className="version-row-meta">What's being edited, with any changes not saved yet</span>
                    </button>
                </li>
            )}
            {versions.map((version) => {
                const [saved, ...since] = version.events;
                return (
                    <li key={version.number}>
                        <button
                            type="button"
                            className="version-row"
                            aria-current={shown === version.number}
                            onClick={() => onShow(version.number)}
                        >
                            <span className="version-row-title">
                                Version {version.number}
                                <span className="status-labels">
                                    <StatusLabel status={version.status} />
                                    {publishedVersion === version.number && <StatusLabel status="published" />}
                                </span>
                            </span>
                            <span className="version-row-meta">
                                {saved.by.name} · {formatDateTime(saved.at)}
                            </span>
                            {saved.note && <span className="version-row-note">{saved.note}</span>}
                        </button>
                        {shown === version.number && since.length > 0 && (
                            <ol className="version-history">
                                {since.map((event) => (
                                    <li key={`${event.kind}-${event.at}`}>
                                        <span>
                                            {EVENTS[event.kind]} by {event.by.name} · {formatDateTime(event.at)}
                                        </span>
                                        {event.note && <p>{event.note}</p>}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

/** Taking a step with a version: what it does, a note on it, needed or not, and the button that takes it. */
export function VersionDialog({
    title,
    text,
    action,
    placeholder,
    needsNote = false,
    onClose,
    onSubmit,
}: {
    title: string;
    text?: string;
    action: string;
    placeholder: string;
    needsNote?: boolean;
    onClose: () => void;
    onSubmit: (note: string) => Promise<void>;
}) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
            await onSubmit(note.trim());
        } catch (failure) {
            setError(
                failure instanceof ApiError && failure.status === 409
                    ? "This version has moved on since it was opened. Reload the page to see where it stands."
                    : "That didn't go through. Try again.",
            );
            setBusy(false);
        }
    }

    return (
        <Dialog title={title} onClose={onClose}>
            <form className="dialog-body" onSubmit={(event) => void submit(event)}>
                {text && <p>{text}</p>}
                <label className="field">
                    <span className="visually-hidden">Note</span>
                    <textarea
                        value={note}
                        rows={3}
                        maxLength={2000}
                        required={needsNote}
                        placeholder={placeholder}
                        data-autofocus
                        onChange={(event) => setNote(event.target.value)}
                    />
                </label>
                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
                <div className="dialog-actions">
                    <button type="button" className="button text" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" className="button primary" disabled={busy || (needsNote && !note.trim())}>
                        {action}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
