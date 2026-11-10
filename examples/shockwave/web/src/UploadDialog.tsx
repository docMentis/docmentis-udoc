// Uploading a file into the library: picked or dropped, it opens in the viewer
// from its own bytes, in the browser, before anything is sent, a moment the
// app announces; then it's named, and uploaded into the folder the user is in.
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import type { Asset, Folder } from "../../shared/api.ts";
import { ApiError, api } from "./api";
import { DocumentViewer } from "./DocumentViewer";
import { baseName, formatSize } from "./files";
import { announceMoment } from "./moments";
import { Dialog } from "./ui";

/** The largest upload, the backend's limit. */
const MAX_BYTES = 256 * 1024 * 1024;

export function UploadDialog({
    file,
    path,
    onClose,
    onUploaded,
}: {
    file: File;
    /** The folders from the top down to the one it goes in; empty for the top. */
    path: Folder[];
    onClose: () => void;
    onUploaded: (asset: Asset) => void;
}) {
    const [name, setName] = useState(() => baseName(file.name));
    const [unreadable, setUnreadable] = useState(false);
    const [uploading, setUploading] = useState(false);
    // Sending, at once: a second press before the button disables sends nothing.
    const sending = useRef(false);
    const [error, setError] = useState<string>();
    const tooLarge = file.size > MAX_BYTES;

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (sending.current) return;
        sending.current = true;
        setUploading(true);
        setError(undefined);
        try {
            onUploaded(await api.uploadAsset(file, name.trim(), path.at(-1)?.id ?? null));
        } catch (failure) {
            setError(
                failure instanceof ApiError && failure.status === 422
                    ? "Shockwave can't read this file."
                    : "The upload didn't go through. Try again.",
            );
            sending.current = false;
            setUploading(false);
        }
    }

    return (
        <Dialog title="Upload a file" className="upload-dialog" onClose={onClose}>
            <div className="upload">
                {/* Beside the form, not in it: the viewer's buttons would submit it (GAPS.md). */}
                <div className="upload-preview">
                    <DocumentViewer
                        file={file}
                        showToolbar={false}
                        showLeftPanel={false}
                        showRightPanel={false}
                        onOpened={({ format, ms }) =>
                            announceMoment({ kind: "document:opened", where: "upload", format, ms })
                        }
                        onClosed={() => announceMoment({ kind: "document:closed", where: "upload" })}
                        onFailed={() => setUnreadable(true)}
                    />
                </div>
                <form className="upload-details" onSubmit={(event) => void submit(event)}>
                    <label className="field">
                        <span className="visually-hidden">Name</span>
                        <input
                            value={name}
                            maxLength={200}
                            required
                            placeholder="Name"
                            data-autofocus
                            onChange={(event) => setName(event.target.value)}
                        />
                    </label>
                    <div className="detail">
                        <span>Location</span>
                        <p>{["Library", ...path.map((folder) => folder.name)].join(" / ")}</p>
                    </div>
                    <div className="detail">
                        <span>File</span>
                        <p>
                            {file.name} · {formatSize(file.size)}
                        </p>
                    </div>
                    {tooLarge && (
                        <p className="error" role="alert">
                            The file is too large: a file is at most 256 MB.
                        </p>
                    )}
                    {unreadable && !tooLarge && (
                        <p className="error" role="alert">
                            This file doesn't open, so it can't be uploaded.
                        </p>
                    )}
                    {error && (
                        <p className="error" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="dialog-actions">
                        <button type="button" className="button text" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="button primary"
                            disabled={uploading || unreadable || tooLarge || !name.trim()}
                        >
                            {uploading ? "Uploading…" : "Upload"}
                        </button>
                    </div>
                </form>
            </div>
        </Dialog>
    );
}
