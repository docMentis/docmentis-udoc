// A file in the library, open in the viewer from udoc-server, under the path
// to its folder.
import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import type { Asset, Folder } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { DocumentViewer } from "../DocumentViewer";
import { formatDate, formatSize, typeLabel } from "../files";
import { ChevronRightIcon } from "../icons";
import { useDocumentTitle } from "../ui";
import { NotFoundPage } from "./PlaceholderPage";

export function FilePage() {
    const { assetId } = useParams();
    const [found, setFound] = useState<{ asset: Asset; path: Folder[] } | null>();
    const [failed, setFailed] = useState(false);

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
    return (
        <div className="page file-page">
            <header className="page-header">
                <nav className="breadcrumb" aria-label="Folders">
                    <Link to="/library">Library</Link>
                    {path.map((folder) => (
                        <Fragment key={folder.id}>
                            <ChevronRightIcon />
                            <Link to={`/library/folders/${folder.id}`}>{folder.name}</Link>
                        </Fragment>
                    ))}
                </nav>
                <h1>{asset.name}</h1>
                <p className="page-subtitle">
                    {typeLabel(asset.format)} · {formatSize(asset.size)} · Uploaded by {asset.uploadedBy.name} on{" "}
                    {formatDate(asset.uploadedAt)}
                </p>
            </header>
            <div className="file-viewer">
                <DocumentViewer documentId={asset.documentId} />
            </div>
        </div>
    );
}
