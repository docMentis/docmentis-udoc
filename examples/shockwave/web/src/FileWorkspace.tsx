// A file's page, wherever it's kept, in the library or a deal room: under the path
// to it, a card, its title bar the file's name, what the app knows of it and what
// can be done with what's shown, over what's shown from udoc-server: the working
// copy, in the viewer or being edited, or a version, read-only, as the address says.
// Those who don't edit it see the version sent to them to review, or the latest. A
// version is reviewed in a branch of its own: its reviewer comments there while it
// waits on them, and once they decide, it shows what they wrote; until then, anyone
// else sees the version as it was submitted.
// Beside the card, a card of the app's own on the file, its tabs each what a feature
// knows of it, folded to a strip with the button that unfolds it.
import { useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";

import { reviewsLibrary } from "../../shared/api.ts";
import type { Asset, Reviewer, Version, VersionStep, VersionedAsset } from "../../shared/api.ts";
import { api } from "./api";
import { DocumentEditor } from "./DocumentEditor";
import type { EditingState } from "./DocumentEditor";
import { DocumentViewer } from "./DocumentViewer";
import type { CollaborationState } from "./DocumentViewer";
import { announceMoment } from "./moments";
import { useUser } from "./session";
import { useSidePanel } from "./sidePanel";
import { ActionsMenu } from "./ui";
import { VersionDialog, VersionList, publishedLabelOf } from "./Versions";

/** What a dialog is open for. */
type Task = "save" | { step: VersionStep; version: Version };

/** What the dialog for each step with a version says. */
const STEPS: Record<VersionStep, { verb: string; action: string; placeholder: string; text?: string }> = {
    submit: {
        verb: "Submit",
        action: "Submit",
        placeholder: "A note for the reviewer (optional)",
        text: "Sends this version to the reviewer you choose, who alone can approve or return it. Editing can go on: what changes after this goes in a later version.",
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
    reassign: {
        verb: "Reassign",
        action: "Reassign",
        placeholder: "A note (optional)",
        text: "Sends this version to another reviewer, who alone can then approve or return it.",
    },
    dismiss: {
        verb: "Dismiss",
        action: "Dismiss",
        placeholder: "Why (optional)",
        text: "Takes this version off what's waiting on you. It stays as it is, and its history keeps this.",
    },
};

/** What the dialog for `step` says of it, for a file in the library or a deal room. */
function stepText(step: VersionStep, asset: Asset): string | undefined {
    if (step === "approve" && asset.dealRoomId !== null)
        return "Approves this version as it stands, ready to go on the frontstage.";
    if (step !== "publish") return STEPS[step].text;
    return asset.publishedVersion === null
        ? "Makes this the file's published version."
        : `Makes this the file's published version, in place of version ${asset.publishedVersion}.`;
}

export function FileWorkspace({
    asset,
    versions,
    reviewers,
    edits,
    breadcrumb,
    about,
    details,
    menu,
    onChanged,
    children,
}: {
    asset: Asset;
    versions: Version[];
    /** Those a version can be sent to for review. */
    reviewers: Reviewer[];
    /** Whether the user edits this file, and takes its versions through review. */
    edits: boolean;
    /** The path to it, over the card. */
    breadcrumb: ReactNode;
    /** What's known of it, under its name. */
    about: string;
    /** The side panel's Details tab. */
    details: ReactNode;
    /** Its menu, for those who may rename or delete it. */
    menu?: { label: string; onSelect: () => void }[];
    onChanged: (changed: VersionedAsset) => void;
    /** Dialogs of the page's own. */
    children?: ReactNode;
}) {
    const user = useUser();
    const reviews = reviewsLibrary(user.role);
    const [params, setParams] = useSearchParams();
    const [task, setTask] = useState<Task>();
    const { open: panel, show: showPanel, toggle: panelToggle } = useSidePanel();
    const [tab, setTab] = useState<"versions" | "details">("versions");
    const [editingState, setEditingState] = useState<EditingState>();
    const [reviewingState, setReviewingState] = useState<CollaborationState>();

    // What's shown: the version the address names; or the working copy, for
    // those who edit it; or, for anyone else, what's waiting on them.
    const named = versions.find((version) => String(version.number) === params.get("version"));
    const sentToMe = versions.find((version) => version.status === "submitted" && version.reviewer?.id === user.id);
    const shown = named ?? (edits ? undefined : (sentToMe ?? versions[0]));
    const editing = edits && !shown && params.has("edit");
    const isPublished = shown !== undefined && asset.publishedVersion === shown.number;
    // What publishes a deal room's file is putting its room on the frontstage.
    const publishes = asset.dealRoomId === null;

    // Who may do what with it, as the backend also rules: the one it was sent
    // to reviews it, and no one reviews what they submitted themselves.
    const submitter = shown?.events.find((event) => event.kind === "submitted")?.by.id;
    const isReviewer = shown?.reviewer?.id === user.id;
    const mayReview = reviews && isReviewer && submitter !== user.id;
    const reassignable = reviewers.filter(({ id }) => id !== shown?.reviewer?.id && id !== submitter);
    const dealtWith = shown?.events.some((event) => event.kind === "dismissed" || event.kind === "published");
    // The branch it's reviewed in, for its reviewer, and for everyone once they've
    // decided; and whether they're commenting in it now.
    const decided = shown?.status === "approved" || shown?.status === "returned";
    const review = shown?.reviewBranch && (isReviewer || decided) ? shown.reviewBranch : undefined;
    const commenting = review !== undefined && mayReview && shown?.status === "submitted";
    // A step taken while comments can't reach the server would leave them out of the merge.
    const unsaved = commenting && reviewingState !== "joined";
    const connection = editing ? editingState : commenting ? reviewingState : undefined;
    const kept = editing ? "Your edits" : "Your comments";

    /** The file as a change to its versions left it, with the side panel showing them. */
    function changed(versioned: VersionedAsset) {
        onChanged(versioned);
        setTask(undefined);
        setTab("versions");
        showPanel(true);
    }

    return (
        <div className="page file-page">
            {breadcrumb}
            <div className={panel ? "file-columns file-columns-panel" : "file-columns file-columns-rail"}>
                <section className="document-card">
                    <header className="document-title-bar">
                        <div className="document-title">
                            <h1>{asset.name}</h1>
                            <p>
                                {shown ? `Version ${shown.number}` : "Working copy"} · {about}
                            </p>
                            {connection === "interrupted" && (
                                <p className="error" role="status">
                                    Connection lost. {kept} are kept here until it's back.
                                </p>
                            )}
                            {connection === "failed" && (
                                <p className="error" role="alert">
                                    {kept} aren't being saved. Reload the page to try again.
                                </p>
                            )}
                        </div>
                        <div className="document-actions">
                            {edits && !shown && (
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
                            {edits && shown?.status === "draft" && (
                                <button
                                    type="button"
                                    className="button primary"
                                    onClick={() => setTask({ step: "submit", version: shown })}
                                >
                                    Submit for review
                                </button>
                            )}
                            {(edits || isReviewer) && shown?.status === "submitted" && reassignable.length > 0 && (
                                <button
                                    type="button"
                                    className="button"
                                    onClick={() => setTask({ step: "reassign", version: shown })}
                                >
                                    Reassign
                                </button>
                            )}
                            {mayReview && shown?.status === "submitted" && (
                                <>
                                    <button
                                        type="button"
                                        className="button"
                                        disabled={unsaved}
                                        onClick={() => setTask({ step: "return", version: shown })}
                                    >
                                        Return
                                    </button>
                                    <button
                                        type="button"
                                        className="button primary"
                                        disabled={unsaved}
                                        onClick={() => setTask({ step: "approve", version: shown })}
                                    >
                                        Approve
                                    </button>
                                </>
                            )}
                            {edits && submitter && shown && shown.status !== "submitted" && !dealtWith && (
                                <button
                                    type="button"
                                    className="button"
                                    onClick={() => setTask({ step: "dismiss", version: shown })}
                                >
                                    Dismiss
                                </button>
                            )}
                            {edits && publishes && shown?.status === "approved" && !isPublished && (
                                <button
                                    type="button"
                                    className="button primary"
                                    onClick={() => setTask({ step: "publish", version: shown })}
                                >
                                    Publish
                                </button>
                            )}
                            {menu && <ActionsMenu label={`Actions for ${asset.name}`} items={menu} />}
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
                                {...(review ? { branch: review } : { version: shown?.checkpoint })}
                                {...(commenting && { collaborateAs: user.name, onState: setReviewingState })}
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
                                    publishedLabel={publishedLabelOf(asset)}
                                    shown={shown?.number ?? null}
                                    workingCopy={edits}
                                    onShow={(number) => setParams(number === null ? {} : { version: String(number) })}
                                />
                            )}
                            {tab === "details" && details}
                        </div>
                    </aside>
                )}
            </div>
            {children}
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
                    text={stepText(task.step, asset)}
                    action={STEPS[task.step].action}
                    placeholder={STEPS[task.step].placeholder}
                    needsNote={task.step === "return"}
                    reviewers={
                        task.step === "submit"
                            ? reviewers.filter(({ id }) => id !== user.id)
                            : task.step === "reassign"
                              ? reassignable
                              : undefined
                    }
                    onClose={() => setTask(undefined)}
                    onSubmit={async (note, reviewerId) =>
                        changed(await api.takeVersionStep(asset.id, task.version.number, task.step, note, reviewerId))
                    }
                />
            )}
        </div>
    );
}
