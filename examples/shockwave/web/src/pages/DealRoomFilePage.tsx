// A deal room's file, on its workspace: those on the room edit it together, in the
// editor, and take its versions through review. A reviewer isn't on any room, and
// sees the versions sent to them, in the same place, with a way back to Home.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { sellsDeals } from "../../../shared/api.ts";
import type { DealRoomFile, DealRoomFileDetail, Reviewer } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { ConfirmDialog, DealFileDialog } from "../DealRoomDialogs";
import { dealRoomPath } from "../DealRoomViews";
import { formatDate, formatDateTime, formatSize, typeLabel } from "../files";
import { FileWorkspace } from "../FileWorkspace";
import { ChevronRightIcon } from "../icons";
import { useUser } from "../session";
import { useDocumentTitle } from "../ui";
import { publishedLabelOf } from "../Versions";
import { NotFoundPage } from "./PlaceholderPage";

export function DealRoomFilePage() {
    const { roomId, assetId } = useParams();
    const navigate = useNavigate();
    // The backend answers only those who enter the room, and the reviewer sent a version.
    const edits = sellsDeals(useUser().role);
    const [found, setFound] = useState<(DealRoomFileDetail & { reviewers: Reviewer[] }) | null>();
    const [failed, setFailed] = useState(false);
    const [task, setTask] = useState<"edit" | "remove">();

    useEffect(() => {
        let gone = false;
        Promise.all([api.dealRoomFile(roomId!, assetId!), api.reviewers()]).then(
            ([detail, reviewers]) => gone || setFound({ ...detail, reviewers }),
            (error: unknown) => {
                if (gone) return;
                if (error instanceof ApiError && error.status === 404) setFound(null);
                else setFailed(true);
            },
        );
        return () => {
            gone = true;
        };
    }, [roomId, assetId]);

    useDocumentTitle(found?.file.asset.name ?? "Deal Rooms");
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
    const { room, file, versions, reviewers } = found;
    const { asset, description, source } = file;

    return (
        <FileWorkspace
            asset={asset}
            versions={versions}
            reviewers={reviewers}
            edits={edits}
            breadcrumb={
                <nav className="breadcrumb" aria-label="Deal Rooms">
                    {edits ? <Link to="/deal-rooms">Deal Rooms</Link> : <Link to="/">Home</Link>}
                    <ChevronRightIcon />
                    {edits ? <Link to={dealRoomPath(room.id)}>{room.title}</Link> : <span>{room.title}</span>}
                </nav>
            }
            about={`${typeLabel(asset.format)} · ${formatSize(asset.size)} · Added by ${asset.uploadedBy.name} on ${formatDate(asset.uploadedAt)}`}
            details={<DealFileDetails file={file} room={room.title} description={description} />}
            menu={
                edits
                    ? [
                          { label: "Edit details", onSelect: () => setTask("edit") },
                          { label: "Remove from room", onSelect: () => setTask("remove") },
                      ]
                    : undefined
            }
            onChanged={({ asset: changedAsset, versions: changedVersions }) =>
                setFound({ ...found, file: { ...file, asset: changedAsset }, versions: changedVersions })
            }
        >
            {task === "edit" && (
                <DealFileDialog
                    file={file}
                    onClose={() => setTask(undefined)}
                    onSubmit={async (name, changedDescription) => {
                        const changed = await api.updateDealRoomFile(room.id, asset.id, name, changedDescription);
                        const next = changed.files.find((each) => each.asset.id === asset.id);
                        if (next) setFound({ ...found, file: next });
                        setTask(undefined);
                    }}
                />
            )}
            {task === "remove" && (
                <ConfirmDialog
                    title="Remove from room"
                    action="Remove"
                    onClose={() => setTask(undefined)}
                    onConfirm={async () => {
                        await api.removeFromDealRoom(room.id, asset.id);
                        navigate(dealRoomPath(room.id));
                    }}
                >
                    This room's copy of “{asset.name}” will be deleted, with what's been edited in it.
                    {file.onFrontstage && " Buyers stop seeing it at once."}
                    {source.id && " The library's file stays as it is."}
                </ConfirmDialog>
            )}
        </FileWorkspace>
    );
}

/** What's known of a room's file: what it says to buyers, where it came from, and whose it is. */
function DealFileDetails({
    file: { asset, source },
    room,
    description,
}: {
    file: DealRoomFile;
    room: string;
    description: string | null;
}) {
    return (
        <>
            {description && (
                <div className="detail">
                    <span>Description, for buyers</span>
                    <p>{description}</p>
                </div>
            )}
            {asset.publishedVersion !== null && (
                <div className="detail">
                    <span>{publishedLabelOf(asset)}</span>
                    <p>Version {asset.publishedVersion}</p>
                </div>
            )}
            <div className="detail">
                <span>Deal room</span>
                <p>{room}</p>
            </div>
            <div className="detail">
                <span>Copied from</span>
                <p>
                    {source.name}, version {source.version}
                </p>
            </div>
            {source.publishedInstead !== null && (
                <div className="detail">
                    <span>In the library now</span>
                    <p>Version {source.publishedInstead} is published. This copy stays as it is.</p>
                </div>
            )}
            <div className="detail">
                <span>Type</span>
                <p>{typeLabel(asset.format)}</p>
            </div>
            <div className="detail">
                <span>Size</span>
                <p>{formatSize(asset.size)}</p>
            </div>
            <div className="detail">
                <span>Added by</span>
                <p>{asset.uploadedBy.name}</p>
            </div>
            <div className="detail">
                <span>Added</span>
                <p>{formatDateTime(asset.uploadedAt)}</p>
            </div>
        </>
    );
}
