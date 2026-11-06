// A file in the library, under the path to its folder: a card, its title bar
// the file's name, what the app knows of it and what can be done with what's
// shown, with a menu to rename or delete it for those who manage the library,
// over what's shown from udoc-server: the working copy, in the viewer or being
// edited, or a version, read-only, as the address says. Those who don't edit it
// see the version waiting for review, or the latest. Beside the card, a card of
// the app's own on the file, its tabs each what a feature knows of it, folded to
// a strip with the button that unfolds it.
import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { managesLibrary, readsLibrary, reviewsLibrary } from "../../../shared/api.ts";
import type { Asset, Folder, Version, VersionStep, VersionedAsset } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { DocumentEditor } from "../DocumentEditor";
import type { EditingState } from "../DocumentEditor";
import { DocumentViewer } from "../DocumentViewer";
import { formatDate, formatDateTime, formatSize, typeLabel } from "../files";
import { ChevronRightIcon, PanelRightIcon } from "../icons";
import { DeleteDialog, NameDialog } from "../LibraryDialogs";
import { announceMoment } from "../moments";
import { useUser } from "../session";
import { ActionsMenu, useDocumentTitle } from "../ui";
import { VersionDialog, VersionList } from "../Versions";
import { NotFoundPage } from "./PlaceholderPage";

const PANEL_KEY = "shockwave.file.panel";

/** Whether the side panel is open: unless this browser folded it. */
function savedPanel(): boolean {
    try {
        return localStorage.getItem(PANEL_KEY) !== "folded";
    } catch {
        return true;
    }
}

/** What a dialog is open for. */
type Task = "rename" | "delete" | "save" | { step: VersionStep; version: Version };

/** What the dialog for each step with a version says. */
const STEPS: Record<VersionStep, { verb: string; action: string; placeholder: string; text?: string }> = {
    submit: {
        verb: "Submit",
        action: "Submit",
        placeholder: "A note for the reviewer (optional)",
        text: "Sends this version for review. Editing can go on: what changes after this goes in a later version.",
    },
    approve: {
        verb: "Approve",
        action: "Approve",
        placeholder: "A note (optional)",
        text: "Approves this version as it stands, ready to publish.",
    },
    return: {
        verb: "Return",
        action: "Return",
        placeholder: "What needs to change",
        text: "Sends this version back. What changes goes in a new version, which is reviewed in its turn.",
    },
    publish: {
        verb: "Publish",
        action: "Publish",
        placeholder: "A note (optional)",
    },
};

export function FilePage() {
    const { assetId } = useParams();
    const navigate = useNavigate();
    const user = useUser();
    const manages = managesLibrary(user.role);
    const reviews = reviewsLibrary(user.role);
    const reads = readsLibrary(user.role);
    const [params, setParams] = useSearchParams();
    const [found, setFound] = useState<{ asset: Asset; path: Folder[]; versions: Version[] } | null>();
    const [failed, setFailed] = useState(false);
    const [task, setTask] = useState<Task>();
    const [panel, setPanel] = useState(savedPanel);
    const [tab, setTab] = useState<"versions" | "details">("versions");
    const [editingState, setEditingState] = useState<EditingState>();

    useEffect(() => {
        if (!reads) return;
        let gone = false;
        Promise.all([api.asset(assetId!), api.versions(assetId!)]).then(
            ([{ asset, path }, versions]) => gone || setFound({ asset, path, versions }),
            (error: unknown) => {
                if (gone) return;
                if (error instanceof ApiError && error.status === 404) setFound(null);
                else setFailed(true);
            },
        );
        return () => {
            gone = true;
        };
    }, [assetId, reads]);

    useDocumentTitle(found?.asset.name ?? "Library");
    if (found === null || !reads) return <NotFoundPage />;
    if (failed)
        return (
            <div className="page">
                <p className="error" role="alert">
                    The file didn't load. Try again.
                </p>
            </div>
        );
    if (!found) return null;
    const { asset, path, versions } = found;
    const parent = path.at(-1);

    // What's shown: the version the address names; or the working copy, for
    // those who edit it; or, for anyone else, what's waiting to be read.
    const named = versions.find((version) => String(version.number) === params.get("version"));
    const waiting = versions.find((version) => version.status === "submitted") ?? versions[0];
    const shown = named ?? (manages ? undefined : waiting);
    const editing = manages && !shown && params.has("edit");
    const isPublished = shown !== undefined && asset.publishedVersion === shown.number;

    // Folding and unfolding the side panel, at its top right, open or folded.
    const panelToggle = (
        <button
            type="button"
            className="icon-button"
            aria-label={panel ? "Fold the side panel" : "Unfold the side panel"}
            aria-expanded={panel}
            aria-controls="document-panel"
            onClick={() => showPanel(!panel)}
        >
            <PanelRightIcon />
        </button>
    );

    function showPanel(open: boolean) {
        setPanel(open);
        try {
            localStorage.setItem(PANEL_KEY, open ? "open" : "folded");
        } catch {
            // Kept for this visit alone.
        }
    }

    /** The file as a change to its versions left it, with the side panel showing them. */
    function changed({ asset: changedAsset, versions: changedVersions }: VersionedAsset) {
        setFound({ asset: changedAsset, path, versions: changedVersions });
        setTask(undefined);
        setTab("versions");
        showPanel(true);
    }

    const item = { kind: "file" as const, id: asset.id, name: asset.name };
    const about = `${typeLabel(asset.format)} · ${formatSize(asset.size)} · Uploaded by ${asset.uploadedBy.name} on ${formatDate(asset.uploadedAt)}`;

    return (
        <div className="page file-page">
            <nav className="breadcrumb" aria-label="Folders">
                <Link to="/library">Library</Link>
                {path.map((folder) => (
                    <Fragment key={folder.id}>
                        <ChevronRightIcon />
                        <Link to={`/library/folders/${folder.id}`}>{folder.name}</Link>
                    </Fragment>
                ))}
            </nav>
            <div className={panel ? "file-columns file-columns-panel" : "file-columns file-columns-rail"}>
                <section className="document-card">
                    <header className="document-title-bar">
                        <div className="document-title">
                            <h1>{asset.name}</h1>
                            <p>
                                {shown ? `Version ${shown.number}` : "Working copy"} · {about}
                            </p>
                            {editing && editingState === "interrupted" && (
                                <p className="error" role="status">
                                    Connection lost. Your edits are kept here until it's back.
                                </p>
                            )}
                            {editing && editingState === "failed" && (
                                <p className="error" role="alert">
                                    Your edits aren't being saved. Reload the page to try again.
                                </p>
                            )}
                        </div>
                        <div className="document-actions">
                            {manages && !shown && (
                                <>
                                    <button
                                        type="button"
                                        className="button"
                                        onClick={() => setParams(editing ? {} : { edit: "1" })}
                                    >
                                        {editing ? "Done" : "Edit"}
                                    </button>
                                    {/* A version saved while edits can't reach the server would lack them. */}
                                    <button
                                        type="button"
                                        className="button primary"
                                        disabled={editing && editingState !== "joined"}
                                        onClick={() => setTask("save")}
                                    >
                                        Save version
                                    </button>
                                </>
                            )}
                            {manages && shown?.status === "draft" && (
                                <button
                                    type="button"
                                    className="button primary"
                                    onClick={() => setTask({ step: "submit", version: shown })}
                                >
                                    Submit for review
                                </button>
                            )}
                            {reviews && shown?.status === "submitted" && (
                                <>
                                    <button
                                        type="button"
                                        className="button"
                                        onClick={() => setTask({ step: "return", version: shown })}
                                    >
                                        Return
                                    </button>
                                    <button
                                        type="button"
                                        className="button primary"
                                        onClick={() => setTask({ step: "approve", version: shown })}
                                    >
                                        Approve
                                    </button>
                                </>
                            )}
                            {manages && shown?.status === "approved" && !isPublished && (
                                <button
                                    type="button"
                                    className="button primary"
                                    onClick={() => setTask({ step: "publish", version: shown })}
                                >
                                    Publish
                                </button>
                            )}
                            {manages && (
                                <ActionsMenu
                                    label={`Actions for ${asset.name}`}
                                    items={[
                                        { label: "Rename", onSelect: () => setTask("rename") },
                                        { label: "Delete", onSelect: () => setTask("delete") },
                                    ]}
                                />
                            )}
                        </div>
                    </header>
                    <div className="document-viewer">
                        {editing ? (
                            <DocumentEditor
                                documentId={asset.documentId}
                                userName={user.name}
                                onState={setEditingState}
                            />
                        ) : (
                            <DocumentViewer
                                documentId={asset.documentId}
                                version={shown?.checkpoint}
                                onOpened={({ format, ms }) =>
                                    announceMoment({ kind: "document:opened", where: "file", format, ms })
                                }
                                onClosed={() => announceMoment({ kind: "document:closed", where: "file" })}
                            />
                        )}
                    </div>
                </section>
                {!panel && (
                    <aside className="document-panel" aria-label="Side panel">
                        <div className="document-tabs">{panelToggle}</div>
                    </aside>
                )}
                {panel && (
                    <aside id="document-panel" className="document-panel" aria-label="Side panel">
                        <div className="document-tabs">
                            <div className="document-tablist" role="tablist">
                                <button
                                    type="button"
                                    role="tab"
                                    id="document-tab-versions"
                                    aria-selected={tab === "versions"}
                                    aria-controls="document-tab-panel"
                                    onClick={() => setTab("versions")}
                                >
                                    Versions
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    id="document-tab-details"
                                    aria-selected={tab === "details"}
                                    aria-controls="document-tab-panel"
                                    onClick={() => setTab("details")}
                                >
                                    Details
                                </button>
                            </div>
                            {panelToggle}
                        </div>
                        <div
                            id="document-tab-panel"
                            className="document-tab-panel"
                            role="tabpanel"
                            aria-labelledby={`document-tab-${tab}`}
                        >
                            {tab === "versions" && (
                                <VersionList
                                    versions={versions}
                                    publishedVersion={asset.publishedVersion}
                                    shown={shown?.number ?? null}
                                    workingCopy={manages}
                                    onShow={(number) => setParams(number === null ? {} : { version: String(number) })}
                                />
                            )}
                            {tab === "details" && (
                                <>
                                    <div className="detail">
                                        <span>Type</span>
                                        <p>{typeLabel(asset.format)}</p>
                                    </div>
                                    <div className="detail">
                                        <span>Size</span>
                                        <p>{formatSize(asset.size)}</p>
                                    </div>
                                    <div className="detail">
                                        <span>Location</span>
                                        <p>{["Library", ...path.map((folder) => folder.name)].join(" / ")}</p>
                                    </div>
                                    <div className="detail">
                                        <span>Uploaded by</span>
                                        <p>{asset.uploadedBy.name}</p>
                                    </div>
                                    <div className="detail">
                                        <span>Uploaded</span>
                                        <p>{formatDateTime(asset.uploadedAt)}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </aside>
                )}
            </div>
            {task === "rename" && (
                <NameDialog
                    title="Rename file"
                    action="Rename"
                    initial={asset.name}
                    onClose={() => setTask(undefined)}
                    onSubmit={async (name) => {
                        const renamed = await api.renameAsset(asset.id, name);
                        setFound({ asset: renamed, path, versions });
                        setTask(undefined);
                    }}
                />
            )}
            {task === "delete" && (
                <DeleteDialog
                    item={item}
                    onClose={() => setTask(undefined)}
                    onDeleted={() => navigate(parent ? `/library/folders/${parent.id}` : "/library")}
                />
            )}
            {task === "save" && (
                <VersionDialog
                    title="Save version"
                    text={`Saves the working copy as it is now as version ${asset.latestVersion.number + 1}. Editing can go on: that version won't change.`}
                    action="Save"
                    placeholder="What changed (optional)"
                    onClose={() => setTask(undefined)}
                    onSubmit={async (note) => changed(await api.saveVersion(asset.id, note))}
                />
            )}
            {typeof task === "object" && (
                <VersionDialog
                    title={`${STEPS[task.step].verb} version ${task.version.number}`}
                    text={
                        task.step === "publish"
                            ? asset.publishedVersion === null
                                ? "Makes this the file's published version."
                                : `Makes this the file's published version, in place of version ${asset.publishedVersion}.`
                            : STEPS[task.step].text
                    }
                    action={STEPS[task.step].action}
                    placeholder={STEPS[task.step].placeholder}
                    needsNote={task.step === "return"}
                    onClose={() => setTask(undefined)}
                    onSubmit={async (note) =>
                        changed(await api.takeVersionStep(asset.id, task.version.number, task.step, note))
                    }
                />
            )}
        </div>
    );
}
