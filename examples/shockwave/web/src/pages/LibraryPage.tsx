// The library: a folder's folders and files, or the top's, under the path to
// it, in a table or a grid, which this browser remembers, narrowed by the
// filters over it. Everyone reads it; an admin makes folders, uploads files,
// picking one or dropping it on the list, and renames and deletes them.
import { Fragment, useEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { managesLibrary } from "../../../shared/api.ts";
import type { FolderListing } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { ChevronRightIcon, FolderPlusIcon, GridIcon, ListIcon, UploadIcon } from "../icons";
import { FilterBar, NO_FILTERS, applyFilters, filtersOf, paramsOf } from "../LibraryFilters";
import type { Filters } from "../LibraryFilters";
import { FileGrid, FileTable } from "../LibraryViews";
import type { Item } from "../LibraryViews";
import { useUser } from "../session";
import { ActionsMenu, Dialog, EmptyState, useDocumentTitle } from "../ui";
import { UploadDialog } from "../UploadDialog";
import { NotFoundPage } from "./PlaceholderPage";

type View = "list" | "grid";

const VIEW_KEY = "shockwave.library.view";

function savedView(): View {
    try {
        return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
    } catch {
        return "list";
    }
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
    const [params, setParams] = useSearchParams();
    // The name typed is the page's own, which each key sets at once, and the
    // address catches up with it, in a transition: a name read from the
    // address would lose the keys typed meanwhile. Another folder starts with
    // its own address's.
    const [name, setName] = useState(params.get("name"));
    const [nameFolder, setNameFolder] = useState(folderId);
    if (nameFolder !== folderId) {
        setNameFolder(folderId);
        setName(params.get("name"));
    }
    const filters = { ...filtersOf(params), name };
    const [view, setView] = useState(savedView);
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

    function filter(next: Filters) {
        setName(next.name);
        setParams(paramsOf(next), { replace: true });
    }

    function show(chosen: View) {
        setView(chosen);
        try {
            localStorage.setItem(VIEW_KEY, chosen);
        } catch {
            // Kept for this visit alone.
        }
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
    const shown = applyFilters(folders, assets, filters);
    const menu = manages
        ? (item: Item) => (
              <ActionsMenu
                  label={`Actions for ${item.name}`}
                  items={[
                      { label: "Rename", onSelect: () => setTask({ kind: "rename", item }) },
                      { label: "Delete", onSelect: () => setTask({ kind: "delete", item }) },
                  ]}
              />
          )
        : undefined;

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
                <section className="library">
                    {folders.length + assets.length > 0 && (
                        <div className="library-toolbar">
                            <FilterBar folders={folders} assets={assets} filters={filters} onChange={filter} />
                            <div className="segmented" role="radiogroup" aria-label="View">
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={view === "list"}
                                    aria-label="List"
                                    title="List"
                                    onClick={() => show("list")}
                                >
                                    <ListIcon />
                                </button>
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={view === "grid"}
                                    aria-label="Grid"
                                    title="Grid"
                                    onClick={() => show("grid")}
                                >
                                    <GridIcon />
                                </button>
                            </div>
                        </div>
                    )}
                    <div
                        className={dropping ? "file-drop file-drop-active" : "file-drop"}
                        onDragOver={dragOver}
                        onDragLeave={(event) =>
                            event.currentTarget.contains(event.relatedTarget as Node) || setDropping(false)
                        }
                        onDrop={drop}
                    >
                        {folders.length + assets.length === 0 ? (
                            <div className="card">
                                <EmptyState title={current ? "This folder is empty" : "The library is empty"}>
                                    {manages && "Upload a file, or drop one here."}
                                </EmptyState>
                            </div>
                        ) : shown.folders.length + shown.assets.length === 0 ? (
                            <div className="card">
                                <EmptyState title="Nothing here matches these filters">
                                    <button type="button" className="text-button" onClick={() => filter(NO_FILTERS)}>
                                        Clear filters
                                    </button>
                                </EmptyState>
                            </div>
                        ) : view === "list" ? (
                            <div className="card file-list">
                                <FileTable folders={shown.folders} assets={shown.assets} menu={menu} />
                            </div>
                        ) : (
                            <FileGrid folders={shown.folders} assets={shown.assets} menu={menu} />
                        )}
                    </div>
                </section>
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
