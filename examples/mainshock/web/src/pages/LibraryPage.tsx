// The library: a folder's folders and files, or the top's, under the path to
// it. Everyone reads it; an admin makes folders, uploads files, picking one or
// dropping it on the list, and renames and deletes them.
import { Fragment, useEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { managesLibrary } from "../../../shared/api.ts";
import type { FolderListing } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { FileBadge, formatDate, formatSize, typeLabel } from "../files";
import { ChevronRightIcon, FolderIcon, FolderPlusIcon, UploadIcon } from "../icons";
import { useUser } from "../session";
import { ActionsMenu, Dialog, EmptyState, useDocumentTitle } from "../ui";
import { UploadDialog } from "../UploadDialog";
import { NotFoundPage } from "./PlaceholderPage";

/** A row of the list: a folder or a file. */
interface Item {
    kind: "folder" | "file";
    id: string;
    name: string;
}

/** What a dialog is open for. */
type Task =
    | { kind: "newFolder" }
    | { kind: "upload"; file: File }
    | { kind: "rename"; item: Item }
    | { kind: "delete"; item: Item };

export function LibraryPage() {
    const { folderId } = useParams();
    const user = useUser();
    const manages = managesLibrary(user.role);
    const navigate = useNavigate();
    const [listing, setListing] = useState<FolderListing>();
    const [failure, setFailure] = useState<"notFound" | "failed">();
    const [loads, setLoads] = useState(0);
    const [task, setTask] = useState<Task>();
    const [dropping, setDropping] = useState(false);
    const picker = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let gone = false;
        api.library(folderId).then(
            (found) => {
                if (gone) return;
                setListing(found);
                setFailure(undefined);
            },
            (error: unknown) => {
                if (gone) return;
                setFailure(error instanceof ApiError && error.status === 404 ? "notFound" : "failed");
            },
        );
        return () => {
            gone = true;
        };
    }, [folderId, loads]);

    const current = listing?.path.at(-1);
    useDocumentTitle(current?.name ?? "Library");
    if (failure === "notFound") return <NotFoundPage />;

    /** Done with a dialog: closed, and the list loaded again. */
    function done() {
        setTask(undefined);
        setLoads(loads + 1);
    }

    function upload(file: File | undefined) {
        if (file) setTask({ kind: "upload", file });
    }

    function dragOver(event: DragEvent) {
        if (!manages || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDropping(true);
    }

    function drop(event: DragEvent) {
        if (!manages) return;
        event.preventDefault();
        setDropping(false);
        upload(event.dataTransfer.files[0]);
    }

    const folders = listing?.folders ?? [];
    const assets = listing?.assets ?? [];
    const itemMenu = (item: Item) => (
        <ActionsMenu
            label={`Actions for ${item.name}`}
            items={[
                { label: "Rename", onSelect: () => setTask({ kind: "rename", item }) },
                { label: "Delete", onSelect: () => setTask({ kind: "delete", item }) },
            ]}
        />
    );

    return (
        <div className="page">
            <header className="page-header page-header-actions">
                <div>
                    {listing && listing.path.length > 0 && (
                        <nav className="breadcrumb" aria-label="Folders">
                            <Link to="/library">Library</Link>
                            {listing.path.slice(0, -1).map((folder) => (
                                <Fragment key={folder.id}>
                                    <ChevronRightIcon />
                                    <Link to={`/library/folders/${folder.id}`}>{folder.name}</Link>
                                </Fragment>
                            ))}
                        </nav>
                    )}
                    <h1>{current?.name ?? "Library"}</h1>
                </div>
                {manages && (
                    <div className="page-actions">
                        <button className="button" onClick={() => setTask({ kind: "newFolder" })}>
                            <FolderPlusIcon />
                            New folder
                        </button>
                        <button className="button primary" onClick={() => picker.current?.click()}>
                            <UploadIcon />
                            Upload
                        </button>
                        <input
                            ref={picker}
                            type="file"
                            hidden
                            onChange={(event) => {
                                upload(event.target.files?.[0]);
                                event.target.value = "";
                            }}
                        />
                    </div>
                )}
            </header>
            {failure === "failed" && (
                <p className="error" role="alert">
                    The library didn't load. Try again.
                </p>
            )}
            {listing && (
                <div
                    className={dropping ? "card file-list file-list-dropping" : "card file-list"}
                    onDragOver={dragOver}
                    onDragLeave={(event) =>
                        event.currentTarget.contains(event.relatedTarget as Node) || setDropping(false)
                    }
                    onDrop={drop}
                >
                    {folders.length + assets.length === 0 ? (
                        <EmptyState title={current ? "This folder is empty" : "The library is empty"}>
                            {manages && "Upload a file, or drop one here."}
                        </EmptyState>
                    ) : (
                        <table className="file-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Uploaded by</th>
                                    <th>Uploaded</th>
                                    <th className="numeric">Size</th>
                                    {manages && (
                                        <th>
                                            <span className="visually-hidden">Actions</span>
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {folders.map((folder) => (
                                    <tr key={folder.id} onClick={() => navigate(`/library/folders/${folder.id}`)}>
                                        <td>
                                            <Link className="file-name" to={`/library/folders/${folder.id}`}>
                                                <FolderIcon />
                                                <span>{folder.name}</span>
                                            </Link>
                                        </td>
                                        <td>Folder</td>
                                        <td />
                                        <td />
                                        <td />
                                        {manages && (
                                            <td className="row-actions" onClick={(event) => event.stopPropagation()}>
                                                {itemMenu({ kind: "folder", id: folder.id, name: folder.name })}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {assets.map((asset) => (
                                    <tr key={asset.id} onClick={() => navigate(`/library/files/${asset.id}`)}>
                                        <td>
                                            <Link className="file-name" to={`/library/files/${asset.id}`}>
                                                <FileBadge format={asset.format} />
                                                <span>{asset.name}</span>
                                            </Link>
                                        </td>
                                        <td>{typeLabel(asset.format)}</td>
                                        <td>{asset.uploadedBy.name}</td>
                                        <td>{formatDate(asset.uploadedAt)}</td>
                                        <td className="numeric">{formatSize(asset.size)}</td>
                                        {manages && (
                                            <td className="row-actions" onClick={(event) => event.stopPropagation()}>
                                                {itemMenu({ kind: "file", id: asset.id, name: asset.name })}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
            {task?.kind === "upload" && listing && (
                <UploadDialog
                    file={task.file}
                    path={listing.path}
                    onClose={() => setTask(undefined)}
                    onUploaded={done}
                />
            )}
            {task?.kind === "newFolder" && (
                <NameDialog
                    title="New folder"
                    action="Create"
                    initial=""
                    onClose={() => setTask(undefined)}
                    onSubmit={async (name) => {
                        await api.createFolder(name, current?.id ?? null);
                        done();
                    }}
                />
            )}
            {task?.kind === "rename" && (
                <NameDialog
                    title={task.item.kind === "folder" ? "Rename folder" : "Rename file"}
                    action="Rename"
                    initial={task.item.name}
                    onClose={() => setTask(undefined)}
                    onSubmit={async (name) => {
                        if (task.item.kind === "folder") await api.renameFolder(task.item.id, name);
                        else await api.renameAsset(task.item.id, name);
                        done();
                    }}
                />
            )}
            {task?.kind === "delete" && (
                <DeleteDialog item={task.item} onClose={() => setTask(undefined)} onDeleted={done} />
            )}
        </div>
    );
}

/** Naming a folder or a file: a new folder's name, or a new name for one. */
function NameDialog({
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
                    <span>Name</span>
                    <input
                        value={name}
                        maxLength={200}
                        required
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
                    <button type="button" className="button" onClick={onClose}>
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
function DeleteDialog({ item, onClose, onDeleted }: { item: Item; onClose: () => void; onDeleted: () => void }) {
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
                    <button type="button" className="button" onClick={onClose}>
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
