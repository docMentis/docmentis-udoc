// A file in a collection, under the path to it: a card, its title bar the file's
// name and what the app knows of its published version, over that version in the
// viewer, read-only, from udoc-server; and beside it, a card of how to use it and
// what's known of it, folded to a strip with the button that unfolds it.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import type { Collection } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { collectionPath } from "../CollectionViews";
import { DocumentViewer } from "../DocumentViewer";
import { formatDate, formatDateTime, typeLabel } from "../files";
import { ChevronRightIcon } from "../icons";
import { announceMoment } from "../moments";
import { useSidePanel } from "../sidePanel";
import { useDocumentTitle } from "../ui";
import { NotFoundPage } from "./PlaceholderPage";

export function CollectionFilePage() {
    const { collectionId, assetId } = useParams();
    const { open: panel, toggle: panelToggle } = useSidePanel();
    const [collection, setCollection] = useState<Collection | null>();
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let gone = false;
        api.collection(collectionId!).then(
            (found) => gone || setCollection(found),
            (error: unknown) => {
                if (gone) return;
                if (error instanceof ApiError && error.status === 404) setCollection(null);
                else setFailed(true);
            },
        );
        return () => {
            gone = true;
        };
    }, [collectionId]);

    const item = collection?.items.find(({ file }) => file.id === assetId);
    useDocumentTitle(item?.file.name ?? "Collections");
    if (collection === null || (collection && !item)) return <NotFoundPage />;
    if (failed)
        return (
            <div className="page">
                <p className="error" role="alert">
                    The file didn't load. Try again.
                </p>
            </div>
        );
    if (!collection || !item) return null;
    const { file, instructions } = item;

    return (
        <div className="page file-page">
            <nav className="breadcrumb" aria-label="Collections">
                <Link to="/collections">Collections</Link>
                <ChevronRightIcon />
                <Link to={collectionPath(collection.id)}>{collection.name}</Link>
            </nav>
            <section className="document-card">
                <header className="document-title-bar">
                    <div className="document-title">
                        <h1>{file.name}</h1>
                        <p>
                            Version {file.version} · {typeLabel(file.format)} · Published {formatDate(file.publishedAt)}
                        </p>
                    </div>
                    <div className="document-actions">{panelToggle}</div>
                </header>
                <div className={panel ? "document-body document-body-panel" : "document-body"}>
                    <div className="document-viewer">
                        <DocumentViewer
                            documentId={file.documentId}
                            version={file.checkpoint}
                            comments="hidden"
                            onOpened={({ format, ms }) =>
                                announceMoment({ kind: "document:opened", where: "file", format, ms })
                            }
                            onClosed={() => announceMoment({ kind: "document:closed", where: "file" })}
                        />
                    </div>
                    {panel && (
                        <aside id="document-panel" className="document-panel" aria-label="Side panel">
                            <div className="document-tabs">
                                <h2 className="document-panel-title">Details</h2>
                            </div>
                            <div className="document-tab-panel">
                                {instructions && (
                                    <div className="detail">
                                        <span>How to use it</span>
                                        <p>{instructions}</p>
                                    </div>
                                )}
                                <div className="detail">
                                    <span>Type</span>
                                    <p>{typeLabel(file.format)}</p>
                                </div>
                                <div className="detail">
                                    <span>Version</span>
                                    <p>{file.version}</p>
                                </div>
                                <div className="detail">
                                    <span>Published</span>
                                    <p>{formatDateTime(file.publishedAt)}</p>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </section>
        </div>
    );
}
