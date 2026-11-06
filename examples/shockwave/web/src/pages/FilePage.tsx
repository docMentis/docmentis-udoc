// A file in the library, under the path to its folder, on its workspace, with a
// menu to rename or delete it for those who manage the library, and in its Details
// tab, what the library knows of it.
import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { managesLibrary, readsLibrary } from "../../../shared/api.ts";
import type { Asset, Folder, Reviewer, Version } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { formatDate, formatDateTime, formatSize, typeLabel } from "../files";
import { FileWorkspace } from "../FileWorkspace";
import { ChevronRightIcon } from "../icons";
import { DeleteDialog, NameDialog } from "../LibraryDialogs";
import { useUser } from "../session";
import { useDocumentTitle } from "../ui";
import { NotFoundPage } from "./PlaceholderPage";

export function FilePage() {
    const { assetId } = useParams();
    const navigate = useNavigate();
    const user = useUser();
    const manages = managesLibrary(user.role);
    const reads = readsLibrary(user.role);
    const [found, setFound] = useState<{
        asset: Asset;
        path: Folder[];
        versions: Version[];
        reviewers: Reviewer[];
    } | null>();
    const [failed, setFailed] = useState(false);
    const [task, setTask] = useState<"rename" | "delete">();

    useEffect(() => {
        if (!reads) return;
        let gone = false;
        Promise.all([api.asset(assetId!), api.versions(assetId!), api.reviewers()]).then(
            ([{ asset, path }, versions, reviewers]) => gone || setFound({ asset, path, versions, reviewers }),
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
    const { asset, path, versions, reviewers } = found;
    const parent = path.at(-1);
    const item = { kind: "file" as const, id: asset.id, name: asset.name };

    return (
        <FileWorkspace
            asset={asset}
            versions={versions}
            reviewers={reviewers}
            edits={manages}
            breadcrumb={
                <nav className="breadcrumb" aria-label="Folders">
                    <Link to="/library">Library</Link>
                    {path.map((folder) => (
                        <Fragment key={folder.id}>
                            <ChevronRightIcon />
                            <Link to={`/library/folders/${folder.id}`}>{folder.name}</Link>
                        </Fragment>
                    ))}
                </nav>
            }
            about={`${typeLabel(asset.format)} · ${formatSize(asset.size)} · Uploaded by ${asset.uploadedBy.name} on ${formatDate(asset.uploadedAt)}`}
            details={
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
            }
            menu={
                manages
                    ? [
                          { label: "Rename", onSelect: () => setTask("rename") },
                          { label: "Delete", onSelect: () => setTask("delete") },
                      ]
                    : undefined
            }
            onChanged={({ asset: changedAsset, versions: changedVersions }) =>
                setFound({ asset: changedAsset, path, versions: changedVersions, reviewers })
            }
        >
            {task === "rename" && (
                <NameDialog
                    title="Rename file"
                    action="Rename"
                    initial={asset.name}
                    onClose={() => setTask(undefined)}
                    onSubmit={async (name) => {
                        const renamed = await api.renameAsset(asset.id, name);
                        setFound({ asset: renamed, path, versions, reviewers });
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
        </FileWorkspace>
    );
}
