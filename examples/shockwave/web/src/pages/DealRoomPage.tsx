// A deal room, backstage: how its frontstage stands, with its link; its settings,
// what it says of itself and how its banner looks, beside a preview of the banner as
// they change; and its files, in a table or a grid, which this browser remembers.
// Nothing here reaches a buyer until someone puts it on the frontstage.
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { sellsDeals } from "../../../shared/api.ts";
import type { DealRoom, DealRoomFile } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { AddDealFilesDialog, ConfirmDialog, DealFileDialog, FrontstageDialog, PeopleDialog } from "../DealRoomDialogs";
import { DealBanner, DealFileCard, DealFileTable } from "../DealRoomViews";
import { formatDateTime } from "../files";
import { GridIcon, ListIcon, PlusIcon } from "../icons";
import { useUser } from "../session";
import { ActionsMenu, EmptyState, useDocumentTitle } from "../ui";
import { NotFoundPage } from "./PlaceholderPage";

type View = "list" | "grid";

const VIEW_KEY = "shockwave.dealRoom.view";

function savedView(): View {
    try {
        return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
    } catch {
        return "grid";
    }
}

/** What a dialog is open for. */
type Task =
    | "add"
    | "people"
    | "frontstage"
    | "takeOff"
    | "delete"
    | { editing: DealRoomFile }
    | { removing: DealRoomFile };

export function DealRoomPage() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const sells = sellsDeals(useUser().role);
    const [room, setRoom] = useState<DealRoom | null>();
    const [failure, setFailure] = useState<string>();
    const [task, setTask] = useState<Task>();
    const [view, setView] = useState(savedView);

    useEffect(() => {
        if (!sells) return;
        let gone = false;
        api.dealRoom(roomId!).then(
            (found) => gone || setRoom(found),
            (error: unknown) => {
                if (gone) return;
                if (error instanceof ApiError && error.status === 404) setRoom(null);
                else setFailure("The deal room didn't load. Try again.");
            },
        );
        return () => {
            gone = true;
        };
    }, [roomId, sells]);

    useDocumentTitle(room?.title ?? "Deal Rooms");
    if (room === null || !sells) return <NotFoundPage />;

    /** Done with a dialog: the room as it left it. */
    function changed(next: DealRoom) {
        setRoom(next);
        setTask(undefined);
    }

    /** Change the room from its page, with no dialog: what went wrong, if it did, over its files. */
    async function change(request: Promise<DealRoom>) {
        setFailure(undefined);
        try {
            setRoom(await request);
        } catch {
            setFailure("That didn't go through. Reload the page, and try again.");
        }
    }

    /** Move the file at `index` by one place, earlier or later. */
    function move(current: DealRoom, index: number, by: -1 | 1) {
        const order = current.files.map((file) => file.asset.id);
        [order[index], order[index + by]] = [order[index + by], order[index]];
        void change(api.orderDealRoom(current.id, order));
    }

    function show(chosen: View) {
        setView(chosen);
        try {
            localStorage.setItem(VIEW_KEY, chosen);
        } catch {
            // Kept for this visit alone.
        }
    }

    const menu = (file: DealRoomFile, index: number) =>
        room && (
            <ActionsMenu
                label={`Actions for ${file.asset.name}`}
                items={[
                    { label: "Edit details", onSelect: () => setTask({ editing: file }) },
                    ...(index > 0 ? [{ label: "Move earlier", onSelect: () => move(room, index, -1) }] : []),
                    ...(index < room.files.length - 1
                        ? [{ label: "Move later", onSelect: () => move(room, index, 1) }]
                        : []),
                    { label: "Remove from room", onSelect: () => setTask({ removing: file }) },
                ]}
            />
        );

    return (
        <div className="page">
            <header className="page-header page-header-actions">
                <div>
                    <nav className="breadcrumb" aria-label="Deal Rooms">
                        <Link to="/deal-rooms">Deal Rooms</Link>
                    </nav>
                    <h1>{room?.title}</h1>
                </div>
                {room && (
                    <div className="page-actions">
                        <button className="button" onClick={() => setTask("people")}>
                            People · {room.people.length}
                        </button>
                        <button
                            className="button primary"
                            disabled={room.files.length === 0}
                            title={room.files.length === 0 ? "Add a file first" : undefined}
                            onClick={() => setTask("frontstage")}
                        >
                            {room.frontstage ? "Update frontstage" : "Put on frontstage"}
                        </button>
                        <ActionsMenu
                            label={`Actions for ${room.title}`}
                            items={[
                                ...(room.frontstage
                                    ? [{ label: "Take off frontstage", onSelect: () => setTask("takeOff") }]
                                    : []),
                                { label: "Delete", onSelect: () => setTask("delete") },
                            ]}
                        />
                    </div>
                )}
            </header>
            {failure && (
                <p className="error" role="alert">
                    {failure}
                </p>
            )}
            {room && <FrontstageBar room={room} />}
            {room && <RoomSettings key={room.id} room={room} onChanged={setRoom} />}
            {room && (
                <section className="deal-files">
                    <header className="home-section-header">
                        <h2>Documents</h2>
                        <div className="page-actions">
                            {room.files.length > 0 && (
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
                            )}
                            <button className="button" onClick={() => setTask("add")}>
                                <PlusIcon />
                                Add files
                            </button>
                        </div>
                    </header>
                    {room.files.length === 0 && (
                        <div className="card">
                            <EmptyState title="No documents yet">
                                Add files from your collections to prepare.
                            </EmptyState>
                        </div>
                    )}
                    {room.files.length > 0 &&
                        (view === "list" ? (
                            <div className="card file-list">
                                <DealFileTable room={room} menu={menu} />
                            </div>
                        ) : (
                            <div className="file-grid">
                                {room.files.map((file, index) => (
                                    <DealFileCard
                                        key={file.asset.id}
                                        roomId={room.id}
                                        file={file}
                                        menu={menu(file, index)}
                                    />
                                ))}
                            </div>
                        ))}
                </section>
            )}
            {room && task === "add" && (
                <AddDealFilesDialog room={room} onClose={() => setTask(undefined)} onAdded={changed} />
            )}
            {room && task === "people" && (
                <PeopleDialog room={room} onClose={() => setTask(undefined)} onChanged={changed} />
            )}
            {room && task === "frontstage" && (
                <FrontstageDialog room={room} onClose={() => setTask(undefined)} onDone={changed} />
            )}
            {room && task === "takeOff" && (
                <ConfirmDialog
                    title="Take off frontstage"
                    action="Take off"
                    onClose={() => setTask(undefined)}
                    onConfirm={async () => changed(await api.takeOffFrontstage(room.id))}
                >
                    The link buyers have stops working, for good. Everything stays here backstage, and putting this room
                    on the frontstage again makes a new link.
                </ConfirmDialog>
            )}
            {room && task === "delete" && (
                <ConfirmDialog
                    title="Delete deal room"
                    action="Delete"
                    onClose={() => setTask(undefined)}
                    onConfirm={async () => {
                        await api.deleteDealRoom(room.id);
                        navigate("/deal-rooms");
                    }}
                >
                    “{room.title}” and its copies of its files will be deleted for everyone, with what's been edited in
                    them.{room.frontstage && " The link buyers have stops working."} The library's files stay as they
                    are.
                </ConfirmDialog>
            )}
            {room && typeof task === "object" && "editing" in task && (
                <DealFileDialog
                    file={task.editing}
                    onClose={() => setTask(undefined)}
                    onSubmit={async (name, description) =>
                        changed(await api.updateDealRoomFile(room.id, task.editing.asset.id, name, description))
                    }
                />
            )}
            {room && typeof task === "object" && "removing" in task && (
                <ConfirmDialog
                    title="Remove from room"
                    action="Remove"
                    onClose={() => setTask(undefined)}
                    onConfirm={async () => changed(await api.removeFromDealRoom(room.id, task.removing.asset.id))}
                >
                    This room's copy of “{task.removing.asset.name}” will be deleted, with what's been edited in it.
                    {task.removing.onFrontstage && " Buyers stop seeing it at once."} The library's file stays as it is.
                </ConfirmDialog>
            )}
        </div>
    );
}

/** How the room's frontstage stands: not on one; or on one, since when, whether it's behind, and its link. */
function FrontstageBar({ room }: { room: DealRoom }) {
    const [copied, setCopied] = useState(false);
    const field = useRef<HTMLInputElement>(null);
    const stage = room.frontstage;

    if (!stage)
        return (
            <section className="card frontstage-bar">
                <div className="frontstage-bar-text">
                    <h2>Backstage only</h2>
                    <p>Buyers see nothing until you put this room on the frontstage.</p>
                </div>
            </section>
        );

    const path = `/rooms/${stage.token}`;
    const link = new URL(path, location.href).href;

    /** The link on the clipboard, or, where the browser won't, selected for the user to copy. */
    async function copy() {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            field.current?.select();
        }
    }

    return (
        <section className="card frontstage-bar">
            <div className="frontstage-bar-text">
                <h2>
                    <span className="status-label status-published">On frontstage</span>
                </h2>
                <p>
                    Updated {formatDateTime(stage.at)} by {stage.by.name}.{" "}
                    {stage.behind
                        ? "Changes made since stay backstage until you update it."
                        : "Buyers see it as it is here."}
                </p>
            </div>
            <div className="frontstage-link">
                <label className="field">
                    <span className="visually-hidden">Link for buyers</span>
                    <input ref={field} readOnly value={link} onFocus={(event) => event.target.select()} />
                </label>
                <button type="button" className="button" onClick={() => void copy()}>
                    {copied ? "Copied" : "Copy link"}
                </button>
                <a className="button text" href={path} target="_blank" rel="noreferrer">
                    Open
                </a>
            </div>
        </section>
    );
}

/** A banner's color, as it's typed: `#rrggbb`. */
const COLOR = /^#[0-9a-f]{6}$/i;

/** The largest banner image, in bytes: the backend's limit. */
const MAX_BANNER_BYTES = 5 * 1024 * 1024;

/**
 * The room's settings: its title, its description and its banner's color and image,
 * beside a preview of the banner, which shows them as they change; the image is kept
 * as it's chosen, and the rest as they're saved.
 */
function RoomSettings({ room, onChanged }: { room: DealRoom; onChanged: (changed: DealRoom) => void }) {
    const { tenant } = useUser();
    const [title, setTitle] = useState(room.title);
    const [description, setDescription] = useState(room.description ?? "");
    const [color, setColor] = useState(room.banner.color ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();
    const picker = useRef<HTMLInputElement>(null);
    const valid = color === "" || COLOR.test(color);
    const dirty =
        title.trim() !== room.title ||
        description.trim() !== (room.description ?? "") ||
        color.toLowerCase() !== (room.banner.color ?? "");

    async function save(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
            onChanged(
                await api.updateDealRoom(room.id, {
                    title: title.trim(),
                    description: description.trim(),
                    bannerColor: color === "" ? null : color.toLowerCase(),
                }),
            );
        } catch {
            setError("That didn't go through. Try again.");
        }
        setBusy(false);
    }

    /** Do `request`, which changes the banner's image, and show the room as it leaves it. */
    async function changeImage(request: Promise<DealRoom>, failure = "That didn't go through. Try again.") {
        setBusy(true);
        setError(undefined);
        try {
            onChanged(await request);
        } catch (thrown) {
            setError(
                thrown instanceof ApiError && thrown.status === 415
                    ? "A banner image is a PNG, a JPEG, a WebP or an SVG."
                    : failure,
            );
        }
        setBusy(false);
    }

    function upload(file: File | undefined) {
        if (!file) return;
        if (file.size > MAX_BANNER_BYTES) {
            setError("A banner image is at most 5 MB.");
            return;
        }
        void changeImage(api.uploadDealRoomBanner(room.id, file));
    }

    return (
        <section className="card deal-settings">
            <h2>Settings</h2>
            <div className="deal-settings-body">
                <form className="deal-settings-form" onSubmit={(event) => void save(event)}>
                    <label className="field">
                        <span className="visually-hidden">Title</span>
                        <input
                            value={title}
                            maxLength={200}
                            required
                            placeholder="Title"
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </label>
                    <label className="field">
                        <span className="visually-hidden">Description</span>
                        <textarea
                            value={description}
                            rows={3}
                            maxLength={2000}
                            placeholder="Description (optional)"
                            onChange={(event) => setDescription(event.target.value)}
                        />
                    </label>
                    <span className="deal-settings-label">Banner</span>
                    <div className="brand-color">
                        <input
                            type="color"
                            aria-label="Banner color"
                            value={valid && color !== "" ? color.toLowerCase() : (tenant.brandColor ?? "#000000")}
                            onChange={(event) => setColor(event.target.value)}
                        />
                        <label className="field brand-hex">
                            <span className="visually-hidden">Banner color, as hex</span>
                            <input
                                value={color}
                                placeholder="Brand color"
                                maxLength={7}
                                spellCheck={false}
                                onChange={(event) => setColor(event.target.value.trim())}
                            />
                        </label>
                        {color !== "" && (
                            <button type="button" className="button text" onClick={() => setColor("")}>
                                Use brand color
                            </button>
                        )}
                    </div>
                    {!valid && <p className="settings-help">A color is # and six hex digits.</p>}
                    <div className="logo-setting">
                        <button
                            type="button"
                            className="button"
                            disabled={busy}
                            onClick={() => picker.current?.click()}
                        >
                            {room.banner.image ? "Replace image" : "Upload image"}
                        </button>
                        {room.banner.image && (
                            <button
                                type="button"
                                className="button"
                                disabled={busy}
                                onClick={() => void changeImage(api.removeDealRoomBanner(room.id))}
                            >
                                Remove image
                            </button>
                        )}
                        <input
                            ref={picker}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            hidden
                            aria-label="Banner image"
                            onChange={(event) => {
                                upload(event.target.files?.[0]);
                                event.target.value = "";
                            }}
                        />
                    </div>
                    {error && (
                        <p className="error" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="dialog-actions">
                        <button
                            type="submit"
                            className="button primary"
                            disabled={busy || !dirty || !valid || !title.trim()}
                        >
                            Save
                        </button>
                    </div>
                </form>
                <DealBanner
                    banner={{ color: valid && color !== "" ? color : null, image: room.banner.image }}
                    title={title.trim() || "Title"}
                    description={description.trim() || null}
                    from={tenant}
                />
            </div>
        </section>
    );
}
