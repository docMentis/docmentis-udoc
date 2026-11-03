// A file in the library, under the path to its folder: a card, its title bar
// the file's name and what the app knows of it, with a menu to rename or
// delete it for those who manage the library, over the file open in the
// viewer from udoc-server, and beside it, unless folded, the app's own panel
// on the file, its tabs each what a feature knows of it.
import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { managesLibrary } from "../../../shared/api.ts";
import type { Asset, Folder } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { DocumentViewer } from "../DocumentViewer";
import { formatDate, formatDateTime, formatSize, typeLabel } from "../files";
import { ChevronRightIcon, PanelRightIcon } from "../icons";
import { DeleteDialog, NameDialog } from "../LibraryDialogs";
import { useUser } from "../session";
import { ActionsMenu, useDocumentTitle } from "../ui";
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

export function FilePage() {
    const { assetId } = useParams();
    const navigate = useNavigate();
    const manages = managesLibrary(useUser().role);
    const [found, setFound] = useState<{ asset: Asset; path: Folder[] } | null>();
    const [failed, setFailed] = useState(false);
    const [task, setTask] = useState<"rename" | "delete">();
    const [panel, setPanel] = useState(savedPanel);

    useEffect(() => {
        let gone = false;
        api.asset(assetId!).then(
            (file) => gone || setFound(file),
            (error: unknown) => {
                if (gone) return;
                if (error instanceof ApiError && error.status === 404) setFound(null);
                else setFailed(true);
            },
        );
        return () => {
            gone = true;
        };
    }, [assetId]);

    useDocumentTitle(found?.asset.name ?? "Library");
    if (found === null) return <NotFoundPage />;
    if (failed)
        return (
            <div className="page">
                <p className="error" role="alert">
                    The file didn't load. Try again.
                </p>
            </div>
        );
    if (!found) return null;
    const { asset, path } = found;
    const parent = path.at(-1);

    function togglePanel() {
        setPanel(!panel);
        try {
            localStorage.setItem(PANEL_KEY, panel ? "folded" : "open");
        } catch {
            // Kept for this visit alone.
        }
    }
    const item = { kind: "file" as const, id: asset.id, name: asset.name };

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
            <section className="document-card">
                <header className="document-title-bar">
                    <div className="document-title">
                        <h1>{asset.name}</h1>
                        <p>
                            {typeLabel(asset.format)} · {formatSize(asset.size)} · Uploaded by {asset.uploadedBy.name}{" "}
                            on {formatDate(asset.uploadedAt)}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="icon-button"
                        aria-label="Side panel"
                        aria-expanded={panel}
                        aria-controls="document-panel"
                        onClick={togglePanel}
                    >
                        <PanelRightIcon />
                    </button>
                    {manages && (
                        <ActionsMenu
                            label={`Actions for ${asset.name}`}
                            items={[
                                { label: "Rename", onSelect: () => setTask("rename") },
                                { label: "Delete", onSelect: () => setTask("delete") },
                            ]}
                        />
                    )}
                </header>
                <div className={panel ? "document-body document-body-panel" : "document-body"}>
                    <div className="document-viewer">
                        <DocumentViewer documentId={asset.documentId} />
                    </div>
                    {panel && (
                        <aside id="document-panel" className="document-panel" aria-label="Side panel">
                            <div className="document-tabs" role="tablist">
                                <button
                                    type="button"
                                    role="tab"
                                    id="document-tab-details"
                                    aria-selected="true"
                                    aria-controls="document-tab-panel"
                                >
                                    Details
                                </button>
                            </div>
                            <div
                                id="document-tab-panel"
                                className="document-tab-panel"
                                role="tabpanel"
                                aria-labelledby="document-tab-details"
                            >
                                <div className="field">
                                    <span>Type</span>
                                    <p className="field-value">{typeLabel(asset.format)}</p>
                                </div>
                                <div className="field">
                                    <span>Size</span>
                                    <p className="field-value">{formatSize(asset.size)}</p>
                                </div>
                                <div className="field">
                                    <span>Location</span>
                                    <p className="field-value">
                                        {["Library", ...path.map((folder) => folder.name)].join(" / ")}
                                    </p>
                                </div>
                                <div className="field">
                                    <span>Uploaded by</span>
                                    <p className="field-value">{asset.uploadedBy.name}</p>
                                </div>
                                <div className="field">
                                    <span>Uploaded</span>
                                    <p className="field-value">{formatDateTime(asset.uploadedAt)}</p>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </section>
            {task === "rename" && (
                <NameDialog
                    title="Rename file"
                    action="Rename"
                    initial={asset.name}
                    onClose={() => setTask(undefined)}
                    onSubmit={async (name) => {
                        const renamed = await api.renameAsset(asset.id, name);
                        setFound({ asset: renamed, path });
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
        </div>
    );
}
