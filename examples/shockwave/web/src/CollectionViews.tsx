// How a collection shows: as a card, among the others and on Home, with its
// first file's first page on its tray; and its files as cards, each with how to
// use it, flipping through the pages of the version published, and opening it.
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import type { Collection, CollectionItem } from "../../shared/api.ts";
import { FileBadge, Thumbnail, formatDate } from "./files";
import { CollectionsIcon } from "./icons";

export const collectionPath = (id: string) => `/collections/${id}`;

export const collectionFilePath = (id: string, assetId: string) => `/collections/${id}/files/${assetId}`;

/** A collection as a card: its first file's first page, its name, how many files it holds, and what it's for. */
export function CollectionCard({ collection }: { collection: Collection }) {
    const navigate = useNavigate();
    const path = collectionPath(collection.id);
    const first = collection.items[0]?.file;
    const files = collection.items.length === 1 ? "1 file" : `${collection.items.length} files`;
    return (
        <div className="file-card" onClick={() => navigate(path)}>
            {first ? (
                <Thumbnail file={first} flips={false} />
            ) : (
                <div className="thumbnail">
                    <CollectionsIcon />
                </div>
            )}
            <div className="file-card-body">
                <div className="file-card-title">
                    <Link className="file-name" to={path}>
                        <span>{collection.name}</span>
                    </Link>
                </div>
                <p className="file-card-meta">
                    {files} · Updated {formatDate(collection.updatedAt)}
                </p>
                {collection.description && <p className="file-card-note">{collection.description}</p>}
            </div>
        </div>
    );
}

/** A file in a collection as a card: the published version's pages, its name, and how to use it. */
export function CollectionFileCard({
    collectionId,
    item: { file, instructions },
    menu,
}: {
    collectionId: string;
    item: CollectionItem;
    /** Its menu, for those who arrange the collection. */
    menu?: ReactNode;
}) {
    const navigate = useNavigate();
    const path = collectionFilePath(collectionId, file.id);
    return (
        <div className="file-card" onClick={() => navigate(path)}>
            <Thumbnail file={file} />
            <div className="file-card-body">
                <div className="file-card-title">
                    <Link className="file-name" to={path}>
                        <FileBadge format={file.format} />
                        <span>{file.name}</span>
                    </Link>
                    {menu && <div onClick={(event) => event.stopPropagation()}>{menu}</div>}
                </div>
                <p className="file-card-meta">Published {formatDate(file.publishedAt)}</p>
                {instructions && <p className="file-card-note">{instructions}</p>}
            </div>
        </div>
    );
}
