// The library's dialogs for a folder or a file: naming one, and deleting one.
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError, api } from "./api";
import type { Item } from "./LibraryViews";
import { Dialog } from "./ui";

/** Naming a folder or a file: a new folder's name, or a new name for one. */
export function NameDialog({
    title,
    action,
    initial,
    onClose,
    onSubmit,
}: {
    title: string;
    action: string;
    initial: string;
    onClose: () => void;
    onSubmit: (name: string) => Promise<void>;
}) {
    const [name, setName] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
            await onSubmit(name.trim());
        } catch (failure) {
            setError(
                failure instanceof ApiError && failure.status === 409
                    ? "A folder here already has that name."
                    : "That didn't go through. Try again.",
            );
            setBusy(false);
        }
    }

    return (
        <Dialog title={title} onClose={onClose}>
            <form className="dialog-body" onSubmit={(event) => void submit(event)}>
                <label className="field">
                    <span className="visually-hidden">Name</span>
                    <input
                        value={name}
                        maxLength={200}
                        required
                        placeholder="Name"
                        data-autofocus
                        onFocus={(event) => event.target.select()}
                        onChange={(event) => setName(event.target.value)}
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
                    <button type="submit" className="button primary" disabled={busy || !name.trim()}>
                        {action}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}

/** Deleting a folder or a file, once the user says so. */
export function DeleteDialog({ item, onClose, onDeleted }: { item: Item; onClose: () => void; onDeleted: () => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    async function remove() {
        setBusy(true);
        setError(undefined);
        try {
            if (item.kind === "folder") await api.deleteFolder(item.id);
            else await api.deleteAsset(item.id);
            onDeleted();
        } catch (failure) {
            setError(
                failure instanceof ApiError && failure.status === 409
                    ? "Only an empty folder can be deleted. Delete what's in it first."
                    : "That didn't go through. Try again.",
            );
            setBusy(false);
        }
    }

    return (
        <Dialog title={item.kind === "folder" ? "Delete folder" : "Delete file"} onClose={onClose}>
            <div className="dialog-body">
                <p>“{item.name}” will be deleted for everyone. This can't be undone.</p>
                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
                <div className="dialog-actions">
                    <button type="button" className="button text" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="button" className="button danger" disabled={busy} onClick={() => void remove()}>
                        Delete
                    </button>
                </div>
            </div>
        </Dialog>
    );
}
