// The dialogs for a deal room, backstage: making one, the files to add from the
// collections, what a file says to buyers, who's on it, what goes on its frontstage,
// and those that confirm what can't be undone.
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { entersAllDealRooms } from "../../shared/api.ts";
import type { Collection, DealRoom, DealRoomFile, PublishedFile, Seller } from "../../shared/api.ts";
import { api } from "./api";
import { FileBadge, formatDate, typeLabel } from "./files";
import { SearchIcon } from "./icons";
import { useUser } from "./session";
import { Dialog, EmptyState } from "./ui";

const TRY_AGAIN = "That didn't go through. Try again.";

/** Doing `action` and telling the dialog how it went: whether it's busy, and what went wrong. */
function useAttempt(): { busy: boolean; error?: string; attempt: (action: () => Promise<void>) => Promise<void> } {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();
    return {
        busy,
        error,
        async attempt(action) {
            setBusy(true);
            setError(undefined);
            try {
                await action();
            } catch {
                setError(TRY_AGAIN);
                setBusy(false);
            }
        },
    };
}

/** What went wrong, if something did, and a dialog's buttons. */
function DialogFoot({ error, onClose, children }: { error?: string; onClose: () => void; children: ReactNode }) {
    return (
        <>
            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
            <div className="dialog-actions">
                <button type="button" className="button text" onClick={onClose}>
                    Cancel
                </button>
                {children}
            </div>
        </>
    );
}

/** Making a deal room. */
export function NewDealRoomDialog({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: (room: DealRoom) => void;
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const { busy, error, attempt } = useAttempt();

    function submit(event: FormEvent) {
        event.preventDefault();
        void attempt(async () => onCreated(await api.createDealRoom(title.trim(), description.trim())));
    }

    return (
        <Dialog title="New deal room" onClose={onClose}>
            <form className="dialog-body" onSubmit={submit}>
                <label className="field">
                    <span className="visually-hidden">Title</span>
                    <input
                        value={title}
                        maxLength={200}
                        required
                        placeholder="Title, which buyers see"
                        data-autofocus
                        onChange={(event) => setTitle(event.target.value)}
                    />
                </label>
                <label className="field">
                    <span className="visually-hidden">Description</span>
                    <textarea
                        value={description}
                        rows={3}
                        maxLength={2000}
                        placeholder="Description, which buyers see (optional)"
                        onChange={(event) => setDescription(event.target.value)}
                    />
                </label>
                <DialogFoot error={error} onClose={onClose}>
                    <button type="submit" className="button primary" disabled={busy || !title.trim()}>
                        Create
                    </button>
                </DialogFoot>
            </form>
        </Dialog>
    );
}

/** Choosing files to copy into `room`, from each collection, those not copied yet, narrowed by what's typed. */
export function AddDealFilesDialog({
    room,
    onClose,
    onAdded,
}: {
    room: DealRoom;
    onClose: () => void;
    onAdded: (changed: DealRoom) => void;
}) {
    const [collections, setCollections] = useState<Collection[]>();
    const [typed, setTyped] = useState("");
    const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
    const [failed, setFailed] = useState(false);
    const { busy, error, attempt } = useAttempt();

    useEffect(() => {
        let gone = false;
        api.collections().then(
            (found) => gone || setCollections(found),
            () => gone || setFailed(true),
        );
        return () => {
            gone = true;
        };
    }, []);

    const held = new Set(room.files.map(({ source }) => source.id));
    const needle = typed.trim().toLowerCase();
    const available = collections
        ?.map(({ id, name, items }) => ({
            id,
            name,
            files: items.map(({ file }) => file).filter((file) => !held.has(file.id)),
        }))
        .filter(({ files }) => files.length > 0);
    const shown = available
        ?.map((collection) => ({
            ...collection,
            files: collection.files.filter((file) => file.name.toLowerCase().includes(needle)),
        }))
        .filter(({ files }) => files.length > 0);

    function choose({ id }: PublishedFile, on: boolean) {
        const next = new Set(chosen);
        if (on) next.add(id);
        else next.delete(id);
        setChosen(next);
    }

    return (
        <Dialog title="Add files" onClose={onClose}>
            <div className="dialog-body">
                <p>
                    Each file comes in as this room's own copy of the version published now, to edit here. The library's
                    stays as it is.
                </p>
                {collections?.length === 0 && (
                    <EmptyState title="No collections yet">Files your sales manager arranges show here.</EmptyState>
                )}
                {collections && collections.length > 0 && available?.length === 0 && (
                    <EmptyState title="Every file in your collections is in this room" />
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
                        <div className="pick-list">
                            {shown?.map((collection) => (
                                <section key={collection.id} className="pick-group" aria-label={collection.name}>
                                    <h3 className="pick-heading">{collection.name}</h3>
                                    {collection.files.map((file) => (
                                        <label key={file.id} className="pick-row">
                                            <input
                                                type="checkbox"
                                                className="checkbox"
                                                checked={chosen.has(file.id)}
                                                onChange={(event) => choose(file, event.target.checked)}
                                            />
                                            <FileBadge format={file.format} />
                                            <span className="pick-row-text">
                                                <span className="pick-row-name">{file.name}</span>
                                                <span className="pick-row-meta">
                                                    {typeLabel(file.format)} · Published {formatDate(file.publishedAt)}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </section>
                            ))}
                        </div>
                        {shown?.length === 0 && <EmptyState title="No file has that name" />}
                    </>
                )}
                <DialogFoot error={failed ? "The collections didn't load. Try again." : error} onClose={onClose}>
                    <button
                        type="button"
                        className="button primary"
                        disabled={busy || chosen.size === 0}
                        onClick={() => void attempt(async () => onAdded(await api.addToDealRoom(room.id, [...chosen])))}
                    >
                        {busy ? "Adding…" : "Add"}
                    </button>
                </DialogFoot>
            </div>
        </Dialog>
    );
}

/** Changing what `file`, in a deal room, says to buyers: its name, and what shows beside it. */
export function DealFileDialog({
    file,
    onClose,
    onSubmit,
}: {
    file: DealRoomFile;
    onClose: () => void;
    onSubmit: (name: string, description: string) => Promise<void>;
}) {
    const [name, setName] = useState(file.asset.name);
    const [description, setDescription] = useState(file.description ?? "");
    const { busy, error, attempt } = useAttempt();

    function submit(event: FormEvent) {
        event.preventDefault();
        void attempt(() => onSubmit(name.trim(), description.trim()));
    }

    return (
        <Dialog title="Edit details" onClose={onClose}>
            <form className="dialog-body" onSubmit={submit}>
                <p>What buyers read of this file on the frontstage, beside the document.</p>
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
                        rows={5}
                        maxLength={2000}
                        placeholder="Description (optional)"
                        onChange={(event) => setDescription(event.target.value)}
                    />
                </label>
                <DialogFoot error={error} onClose={onClose}>
                    <button type="submit" className="button primary" disabled={busy || !name.trim()}>
                        Save
                    </button>
                </DialogFoot>
            </form>
        </Dialog>
    );
}

/** Saying who's on `room`: of those who sell at the tenant. A member can't take themselves off. */
export function PeopleDialog({
    room,
    onClose,
    onChanged,
}: {
    room: DealRoom;
    onClose: () => void;
    onChanged: (changed: DealRoom) => void;
}) {
    const user = useUser();
    const [sellers, setSellers] = useState<Seller[]>();
    const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set(room.people.map(({ id }) => id)));
    const [failed, setFailed] = useState(false);
    const { busy, error, attempt } = useAttempt();
    const staysOn = !entersAllDealRooms(user.role);

    useEffect(() => {
        let gone = false;
        api.sellers().then(
            (found) => gone || setSellers(found),
            () => gone || setFailed(true),
        );
        return () => {
            gone = true;
        };
    }, []);

    function choose(id: string, on: boolean) {
        const next = new Set(chosen);
        if (on) next.add(id);
        else next.delete(id);
        setChosen(next);
    }

    return (
        <Dialog title="People" onClose={onClose}>
            <div className="dialog-body">
                <p>
                    Those on this room edit its files together and put it on the frontstage. Managers can open every
                    room.
                </p>
                <div className="pick-list" role="group" aria-label="People">
                    {sellers?.map(({ id, name, title }) => (
                        <label key={id} className="pick-row">
                            <input
                                type="checkbox"
                                className="checkbox"
                                checked={chosen.has(id)}
                                disabled={staysOn && id === user.id}
                                onChange={(event) => choose(id, event.target.checked)}
                            />
                            <span className="pick-row-text">
                                <span className="pick-row-name">{name}</span>
                                <span className="pick-row-meta">{title}</span>
                            </span>
                        </label>
                    ))}
                </div>
                <DialogFoot error={failed ? "The people didn't load. Try again." : error} onClose={onClose}>
                    <button
                        type="button"
                        className="button primary"
                        disabled={busy || !sellers}
                        onClick={() =>
                            void attempt(async () => onChanged(await api.setDealRoomPeople(room.id, [...chosen])))
                        }
                    >
                        Save
                    </button>
                </DialogFoot>
            </div>
        </Dialog>
    );
}

/**
 * Choosing what goes on `room`'s frontstage: on it already and added since, to
 * start with, for a room that's on one; and for one that isn't, all of its files.
 */
export function FrontstageDialog({
    room,
    onClose,
    onDone,
}: {
    room: DealRoom;
    onClose: () => void;
    onDone: (changed: DealRoom) => void;
}) {
    const staged = room.frontstage;
    const [chosen, setChosen] = useState<ReadonlySet<string>>(
        () =>
            new Set(
                room.files
                    .filter((file) => !staged || file.onFrontstage || file.asset.uploadedAt > staged.at)
                    .map(({ asset }) => asset.id),
            ),
    );
    const { busy, error, attempt } = useAttempt();

    function choose(id: string, on: boolean) {
        const next = new Set(chosen);
        if (on) next.add(id);
        else next.delete(id);
        setChosen(next);
    }

    return (
        <Dialog title={staged ? "Update frontstage" : "Put on frontstage"} onClose={onClose}>
            <div className="dialog-body">
                <p>
                    Anyone with the link can read this, with no account. It shows the title, description and banner as
                    they are now, and each file you choose at its latest approved version. Everything else stays
                    backstage.
                </p>
                <div className="pick-list" role="group" aria-label="Files to show">
                    {room.files.map(({ asset, approvedVersion }) => (
                        <label key={asset.id} className="pick-row">
                            <input
                                type="checkbox"
                                className="checkbox"
                                checked={chosen.has(asset.id)}
                                onChange={(event) => choose(asset.id, event.target.checked)}
                            />
                            <FileBadge format={asset.format} />
                            <span className="pick-row-text">
                                <span className="pick-row-name">{asset.name}</span>
                                <span className="pick-row-meta">
                                    Shows version {approvedVersion}
                                    {asset.latestVersion.number > approvedVersion &&
                                        `; version ${asset.latestVersion.number} isn't approved, and stays backstage`}
                                </span>
                            </span>
                        </label>
                    ))}
                </div>
                <DialogFoot error={error} onClose={onClose}>
                    <button
                        type="button"
                        className="button primary"
                        disabled={busy || chosen.size === 0}
                        onClick={() =>
                            void attempt(async () => onDone(await api.putOnFrontstage(room.id, [...chosen])))
                        }
                    >
                        {staged ? "Update" : "Put on frontstage"}
                    </button>
                </DialogFoot>
            </div>
        </Dialog>
    );
}

/** Doing what can't be undone, once the user says so. */
export function ConfirmDialog({
    title,
    action,
    onClose,
    onConfirm,
    children,
}: {
    title: string;
    action: string;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    /** What it does. */
    children: ReactNode;
}) {
    const { busy, error, attempt } = useAttempt();
    return (
        <Dialog title={title} onClose={onClose}>
            <div className="dialog-body">
                <p>{children}</p>
                <DialogFoot error={error} onClose={onClose}>
                    <button
                        type="button"
                        className="button danger"
                        disabled={busy}
                        onClick={() => void attempt(onConfirm)}
                    >
                        {action}
                    </button>
                </DialogFoot>
            </div>
        </Dialog>
    );
}
