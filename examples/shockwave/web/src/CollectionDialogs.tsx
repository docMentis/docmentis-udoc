// The dialogs for arranging a collection: what it says of itself, the files to
// add, how to use one of them, and deleting it.
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { Collection, CollectionItem, PublishedFile } from "../../shared/api.ts";
import { ApiError, api } from "./api";
import type { CollectionFields } from "./api";
import { FileBadge, formatDate, typeLabel } from "./files";
import { SearchIcon } from "./icons";
import { Dialog, EmptyState } from "./ui";

const TRY_AGAIN = "That didn't go through. Try again.";

/** Making a collection, or changing what it says of itself. */
export function CollectionDialog({
    title,
    action,
    collection,
    onClose,
    onSubmit,
}: {
    title: string;
    action: string;
    /** The one being changed; none for a new one. */
    collection?: Collection;
    onClose: () => void;
    onSubmit: (fields: CollectionFields) => Promise<void>;
}) {
    const [name, setName] = useState(collection?.name ?? "");
    const [description, setDescription] = useState(collection?.description ?? "");
    const [instructions, setInstructions] = useState(collection?.instructions ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
            await onSubmit({ name: name.trim(), description: description.trim(), instructions: instructions.trim() });
        } catch (failure) {
            setError(
                failure instanceof ApiError && failure.status === 409
                    ? "A collection already has that name."
                    : TRY_AGAIN,
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
                        onChange={(event) => setName(event.target.value)}
                    />
                </label>
                <label className="field">
                    <span className="visually-hidden">Description</span>
                    <textarea
                        value={description}
                        rows={2}
                        maxLength={2000}
                        placeholder="What it's for (optional)"
                        onChange={(event) => setDescription(event.target.value)}
                    />
                </label>
                <label className="field">
                    <span className="visually-hidden">Instructions</span>
                    <textarea
                        value={instructions}
                        rows={4}
                        maxLength={2000}
                        placeholder="How to use it (optional)"
                        onChange={(event) => setInstructions(event.target.value)}
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

/** Choosing published files to add to `collection`: those not in it yet, by name, narrowed by what's typed. */
export function AddFilesDialog({
    collection,
    onClose,
    onAdded,
}: {
    collection: Collection;
    onClose: () => void;
    onAdded: (changed: Collection) => void;
}) {
    const [published, setPublished] = useState<PublishedFile[]>();
    const [typed, setTyped] = useState("");
    const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        let gone = false;
        api.publishedFiles().then(
            (found) => gone || setPublished(found),
            () => gone || setError("The published files didn't load. Try again."),
        );
        return () => {
            gone = true;
        };
    }, []);

    const held = new Set(collection.items.map((item) => item.file.id));
    const available = published?.filter((file) => !held.has(file.id));
    const needle = typed.trim().toLowerCase();
    const shown = available?.filter((file) => file.name.toLowerCase().includes(needle));

    function choose(id: string, on: boolean) {
        const next = new Set(chosen);
        if (on) next.add(id);
        else next.delete(id);
        setChosen(next);
    }

    async function add() {
        setBusy(true);
        setError(undefined);
        try {
            onAdded(await api.addToCollection(collection.id, [...chosen]));
        } catch {
            setError(TRY_AGAIN);
            setBusy(false);
        }
    }

    return (
        <Dialog title="Add files" onClose={onClose}>
            <div className="dialog-body">
                {published?.length === 0 && (
                    <EmptyState title="Nothing is published yet">Files published in the Library show here.</EmptyState>
                )}
                {published && published.length > 0 && available?.length === 0 && (
                    <EmptyState title="Every published file is in this collection" />
                )}
                {available && available.length > 0 && (
                    <>
                        <label className="name-filter pick-filter">
                            <SearchIcon />
                            <input
                                type="search"
                                placeholder="Filter by name"
                                aria-label="Filter by name"
                                value={typed}
                                data-autofocus
                                onChange={(event) => setTyped(event.target.value)}
                            />
                        </label>
                        <ul className="pick-list" aria-label="Published files">
                            {shown?.map((file) => (
                                <li key={file.id}>
                                    <label className="pick-row">
                                        <input
                                            type="checkbox"
                                            className="checkbox"
                                            checked={chosen.has(file.id)}
                                            onChange={(event) => choose(file.id, event.target.checked)}
                                        />
                                        <FileBadge format={file.format} />
                                        <span className="pick-row-text">
                                            <span className="pick-row-name">{file.name}</span>
                                            <span className="pick-row-meta">
                                                {typeLabel(file.format)} · Published {formatDate(file.publishedAt)}
                                            </span>
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                        {shown?.length === 0 && <EmptyState title="No published file has that name" />}
                    </>
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
                        type="button"
                        className="button primary"
                        disabled={busy || chosen.size === 0}
                        onClick={() => void add()}
                    >
                        Add
                    </button>
                </div>
            </div>
        </Dialog>
    );
}

/** Saying how to use `item`, a file in a collection. */
export function FileInstructionsDialog({
    item,
    onClose,
    onSubmit,
}: {
    item: CollectionItem;
    onClose: () => void;
    onSubmit: (instructions: string) => Promise<void>;
}) {
    const [instructions, setInstructions] = useState(item.instructions ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
            await onSubmit(instructions.trim());
        } catch {
            setError(TRY_AGAIN);
            setBusy(false);
        }
    }

    return (
        <Dialog title="Edit instructions" onClose={onClose}>
            <form className="dialog-body" onSubmit={(event) => void submit(event)}>
                <p>How to use “{item.file.name}”, for those selling with this collection.</p>
                <label className="field">
                    <span className="visually-hidden">Instructions</span>
                    <textarea
                        value={instructions}
                        rows={4}
                        maxLength={2000}
                        placeholder="How to use it (optional)"
                        data-autofocus
                        onChange={(event) => setInstructions(event.target.value)}
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
                    <button type="submit" className="button primary" disabled={busy}>
                        Save
                    </button>
                </div>
            </form>
        </Dialog>
    );
}

/** Deleting `collection`, once the user says so. Its files stay as they are. */
export function DeleteCollectionDialog({
    collection,
    onClose,
    onDeleted,
}: {
    collection: Collection;
    onClose: () => void;
    onDeleted: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    async function remove() {
        setBusy(true);
        setError(undefined);
        try {
            await api.deleteCollection(collection.id);
            onDeleted();
        } catch {
            setError(TRY_AGAIN);
            setBusy(false);
        }
    }

    return (
        <Dialog title="Delete collection" onClose={onClose}>
            <div className="dialog-body">
                <p>“{collection.name}” will be deleted for everyone. The files in it stay in the Library.</p>
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
