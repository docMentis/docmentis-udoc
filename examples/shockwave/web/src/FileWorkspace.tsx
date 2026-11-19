// A file's page, wherever it's kept, in the library or a deal room: under the path
// to it, a card, its title bar the file's name, what the app knows of it and what
// can be done with what's shown, over what's shown from udoc-server: the working
// copy, in the viewer or being edited, or a version, read-only, as the address says.
// Those who don't edit it see the version sent to them to review, or the latest. A
// version is reviewed in a branch of its own, its review: its reviewer writes there
// while it waits on them, in the editor, in review mode where the document's open to
// it and view mode where it isn't, never edit mode; until they decide, anyone else
// sees the version as it was submitted. Once they've decided, the version shows its
// review, which those who edit the file take up there, as they choose: they edit it
// and save a version from it to submit, or bring it into the working copy.
// Inside the card, beside what's shown, a panel of the app's own on the file, its
// tabs each what a feature knows of it, which the title bar's button shows or hides.
import { useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";

import { reviewsLibrary } from "../../shared/api.ts";
import type { Asset, Reviewer, Version, VersionStep, VersionedAsset } from "../../shared/api.ts";
import { api } from "./api";
import { DocumentEditor, REVIEW_MODES } from "./DocumentEditor";
import type { EditingState } from "./DocumentEditor";
import { DocumentViewer } from "./DocumentViewer";
import { announceMoment } from "./moments";
import { useUser } from "./session";
import { useSidePanel } from "./sidePanel";
import { ActionsMenu } from "./ui";
import { VersionDialog, VersionList, publishedLabelOf } from "./Versions";

/** What a dialog is open for. */
type Task = "save" | { step: VersionStep; version: Version };

/** What the dialog for each step with a version says: its title, unless `title` says otherwise, the verb and the version. */
const STEPS: Record<
    VersionStep,
    { verb: string; title?: (number: number) => string; action: string; placeholder: string; text?: string }
> = {
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
    merge: {
        verb: "Bring in",
        title: (number) => `Bring version ${number}'s review into the working copy`,
        action: "Bring in",
        placeholder: "A note (optional)",
        text: "Brings what's in this review, what its reviewer wrote and what's been changed in it since, into the working copy, which then opens to edit. The review stays as it is, to go on with here or bring in again.",
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
    const [reviewingState, setReviewingState] = useState<EditingState>();

    // What's shown: the version the address names; or the working copy, for
    // those who edit it; or, for anyone else, what's waiting on them.
    const named = versions.find((version) => String(version.number) === params.get("version"));
    const sentToMe = versions.find((version) => version.status === "submitted" && version.reviewer?.id === user.id);
    const shown = named ?? (edits ? undefined : (sentToMe ?? versions[0]));
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
    // The branch it's reviewed in, its review: for its reviewer, and for everyone
    // once they've decided; and whether they're reviewing in it now.
    const decided = shown?.status === "approved" || shown?.status === "returned";
    const review = shown?.reviewBranch && (isReviewer || decided) ? shown.reviewBranch : undefined;
    const reviewing = review !== undefined && mayReview && shown?.status === "submitted";
    // A decided version, whose review those who edit the file take up; and what
    // they edit, the working copy or that review, and whether they're editing it.
    const takenUp = edits && decided && review !== undefined ? shown : undefined;
    const editable = edits && (!shown || takenUp !== undefined);
    const editing = editable && params.has("edit");
    // Where what's shown is, with or without its being edited.
    const here: Record<string, string> = shown ? { version: String(shown.number) } : {};
    // A step taken while what's written can't reach the server would leave it out:
    // of the review decided, or of the version saved or the review brought in.
    const reviewUnsaved = reviewing && reviewingState !== "joined";
    const editsUnsaved = editing && editingState !== "joined";
    const connection = editing ? editingState : reviewing ? reviewingState : undefined;
    const kept = editing ? "Your edits" : "Your comments and changes";

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
            <section className="document-card">
                <header className="document-title-bar">
                    <div className="document-title">
                        <h1>{asset.name}</h1>
                        <p>
                            {!shown
                                ? "Working copy"
                                : decided && review
                                  ? `Version ${shown.number}, with ${shown.reviewer?.name ?? "its reviewer"}'s review`
                                  : `Version ${shown.number}`}{" "}
                            · {about}
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
                        {editable && (
                            <>
                                <button
                                    type="button"
                                    className="button"
                                    onClick={() => setParams(editing ? here : { ...here, edit: "1" })}
                                >
                                    {editing ? "Done" : "Edit"}
                                </button>
                                <button
                                    type="button"
                                    className={!shown || editing ? "button primary" : "button"}
                                    disabled={editsUnsaved}
                                    onClick={() => setTask("save")}
                                >
                                    Save version
                                </button>
                            </>
                        )}
                        {takenUp && (
                            <button
                                type="button"
                                className="button"
                                disabled={editsUnsaved}
                                onClick={() => setTask({ step: "merge", version: takenUp })}
                            >
                                Bring into working copy
                            </button>
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
                                    disabled={reviewUnsaved}
                                    onClick={() => setTask({ step: "return", version: shown })}
                                >
                                    Return
                                </button>
                                <button
                                    type="button"
                                    className="button primary"
                                    disabled={reviewUnsaved}
                                    onClick={() => setTask({ step: "approve", version: shown })}
                                >
                                    Approve
                                </button>
                            </>
                        )}
                        {edits && submitter && shown && shown.status !== "submitted" && !dealtWith && !editing && (
                            <button
                                type="button"
                                className="button"
                                onClick={() => setTask({ step: "dismiss", version: shown })}
                            >
                                Dismiss
                            </button>
                        )}
                        {edits && publishes && shown?.status === "approved" && !isPublished && !editing && (
                            <button
                                type="button"
                                className="button primary"
                                onClick={() => setTask({ step: "publish", version: shown })}
                            >
                                Publish
                            </button>
                        )}
                        {menu && <ActionsMenu label={`Actions for ${asset.name}`} items={menu} />}
                        {panelToggle}
                    </div>
                </header>
                <div className={panel ? "document-body document-body-panel" : "document-body"}>
                    <div className="document-viewer">
                        {editing ? (
                            <DocumentEditor
                                documentId={asset.documentId}
                                branch={takenUp ? review : undefined}
                                userName={user.name}
                                onState={setEditingState}
                            />
                        ) : reviewing ? (
                            <DocumentEditor
                                documentId={asset.documentId}
                                branch={review}
                                userName={user.name}
                                modes={REVIEW_MODES}
                                onState={setReviewingState}
                            />
                        ) : (
                            <DocumentViewer
                                documentId={asset.documentId}
                                {...(review ? { branch: review } : { version: shown?.checkpoint })}
                                onOpened={({ format, ms }) =>
                                    announceMoment({ kind: "document:opened", where: "file", format, ms })
                                }
                                onClosed={() => announceMoment({ kind: "document:closed", where: "file" })}
                            />
                        )}
                    </div>
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
                                        onShow={(number) =>
                                            setParams(number === null ? {} : { version: String(number) })
                                        }
                                    />
                                )}
                                {tab === "details" && details}
                            </div>
                        </aside>
                    )}
                </div>
            </section>
            {children}
            {task === "save" && (
                <VersionDialog
                    title="Save version"
                    text={
                        takenUp
                            ? `Saves version ${takenUp.number} as it is here, with its review and what's been changed since, as version ${asset.latestVersion.number + 1}, to submit. Editing can go on, here and in the working copy: that version won't change.`
                            : `Saves the working copy as it is now as version ${asset.latestVersion.number + 1}. Editing can go on: that version won't change.`
                    }
                    action="Save"
                    placeholder="What changed (optional)"
                    onClose={() => setTask(undefined)}
                    onSubmit={async (note) => changed(await api.saveVersion(asset.id, note, takenUp?.number))}
                />
            )}
            {typeof task === "object" && (
                <VersionDialog
                    title={
                        STEPS[task.step].title?.(task.version.number) ??
                        `${STEPS[task.step].verb} version ${task.version.number}`
                    }
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
                    onSubmit={async (note, reviewerId) => {
                        changed(await api.takeVersionStep(asset.id, task.version.number, task.step, note, reviewerId));
                        // Brought in, the review's worked on in the working copy.
                        if (task.step === "merge") setParams({ edit: "1" });
                    }}
                />
            )}
        </div>
    );
}
