// The library's two views of a folder's folders and files: a table, a row
// each, and a grid, folders as tiles over files as cards, each card with its
// file's pages to flip through. A row, a tile or a card opens what it is; its menu, for
// those who manage the library, renames or deletes it.
import type { MouseEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import type { Asset, Folder, VersionStatus } from "../../shared/api.ts";
import { FileBadge, Thumbnail, formatDate, formatSize, typeLabel } from "./files";
import { FolderIcon } from "./icons";
import { FileStatus, WaitingStatus } from "./Versions";

/** A folder or a file, as its menu acts on it. */
export interface Item {
    kind: "folder" | "file";
    id: string;
    name: string;
}

interface ViewProps {
    folders: Folder[];
    assets: Asset[];
    /** An item's menu, for those who manage the library. */
    menu?: (item: Item) => ReactNode;
}

const folderPath = (folder: Folder) => `/library/folders/${folder.id}`;
/** Where a file opens: in the library, or for a deal room's, its room. */
const filePath = (asset: Asset) =>
    asset.dealRoomId === null ? `/library/files/${asset.id}` : `/deal-rooms/${asset.dealRoomId}/files/${asset.id}`;

/** A press on a menu, which opens it and not what it's in. */
const keep = (event: MouseEvent) => event.stopPropagation();

export function FileTable({ folders, assets, menu }: ViewProps) {
    const navigate = useNavigate();
    return (
        <table className="file-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Uploaded by</th>
                    <th>Uploaded</th>
                    <th className="numeric">Size</th>
                    {menu && (
                        <th>
                            <span className="visually-hidden">Actions</span>
                        </th>
                    )}
                </tr>
            </thead>
            <tbody>
                {folders.map((folder) => (
                    <tr key={folder.id} onClick={() => navigate(folderPath(folder))}>
                        <td>
                            <Link className="file-name" to={folderPath(folder)}>
                                <FolderIcon />
                                <span>{folder.name}</span>
                            </Link>
                        </td>
                        <td />
                        <td>Folder</td>
                        <td />
                        <td />
                        <td />
                        {menu && (
                            <td className="row-actions" onClick={keep}>
                                {menu({ kind: "folder", id: folder.id, name: folder.name })}
                            </td>
                        )}
                    </tr>
                ))}
                {assets.map((asset) => (
                    <tr key={asset.id} onClick={() => navigate(filePath(asset))}>
                        <td>
                            <Link className="file-name" to={filePath(asset)}>
                                <FileBadge format={asset.format} />
                                <span>{asset.name}</span>
                            </Link>
                        </td>
                        <td>
                            <FileStatus asset={asset} />
                        </td>
                        <td>{typeLabel(asset.format)}</td>
                        <td>{asset.uploadedBy.name}</td>
                        <td>{formatDate(asset.uploadedAt)}</td>
                        <td className="numeric">{formatSize(asset.size)}</td>
                        {menu && (
                            <td className="row-actions" onClick={keep}>
                                {menu({ kind: "file", id: asset.id, name: asset.name })}
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function FileGrid({ folders, assets, menu }: ViewProps) {
    const navigate = useNavigate();
    return (
        <div className="grid-sections">
            {folders.length > 0 && (
                <section>
                    <h2 className="grid-heading">Folders</h2>
                    <div className="folder-grid">
                        {folders.map((folder) => (
                            <div key={folder.id} className="folder-tile" onClick={() => navigate(folderPath(folder))}>
                                <Link className="file-name" to={folderPath(folder)}>
                                    <FolderIcon />
                                    <span>{folder.name}</span>
                                </Link>
                                {menu && (
                                    <div onClick={keep}>
                                        {menu({ kind: "folder", id: folder.id, name: folder.name })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}
            {assets.length > 0 && (
                <section>
                    <h2 className="grid-heading">Files</h2>
                    <div className="file-grid">
                        {assets.map((asset) => (
                            <FileCard key={asset.id} asset={asset} menu={menu} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

/**
 * A file as a card: its pages, its name, who uploaded it and when, and where its
 * versions stand; or, for a version `waiting` on the user, what it's waiting for,
 * and opening that version.
 */
export function FileCard({
    asset,
    menu,
    waiting,
}: {
    asset: Asset;
    menu?: ViewProps["menu"];
    waiting?: { number: number; status: VersionStatus };
}) {
    const navigate = useNavigate();
    const path = waiting ? `${filePath(asset)}?version=${waiting.number}` : filePath(asset);
    return (
        <div className="file-card" onClick={() => navigate(path)}>
            {/* A deal room's waiting on someone not on it: its working copy's pages aren't theirs. */}
            <Thumbnail file={asset} flips={asset.dealRoomId === null} />
            <div className="file-card-body">
                <div className="file-card-title">
                    <Link className="file-name" to={path}>
                        <FileBadge format={asset.format} />
                        <span>{asset.name}</span>
                    </Link>
                    {menu && <div onClick={keep}>{menu({ kind: "file", id: asset.id, name: asset.name })}</div>}
                </div>
                <p className="file-card-meta">
                    {asset.uploadedBy.name} · {formatDate(asset.uploadedAt)}
                </p>
                {waiting ? (
                    <WaitingStatus {...waiting} inDealRoom={asset.dealRoomId !== null} />
                ) : (
                    <FileStatus asset={asset} />
                )}
            </div>
        </div>
    );
}
