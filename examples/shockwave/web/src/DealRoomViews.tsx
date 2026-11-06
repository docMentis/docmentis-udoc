// How a deal room shows: its banner, over its frontstage and in its settings; as a
// card, among the others and on Home; and its files backstage, as a table or as
// cards, each opening its file to work on.
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import type { DealRoom, DealRoomBanner, DealRoomFile } from "../../shared/api.ts";
import { FileBadge, Thumbnail, formatDate, formatSize, typeLabel } from "./files";
import { DealRoomsIcon } from "./icons";
import { FileStatus, publishedLabelOf } from "./Versions";

export const dealRoomPath = (id: string) => `/deal-rooms/${id}`;

/** Where a room's file opens from its room: in the editor, for those on it to work on together. */
export const dealRoomFilePath = (id: string, assetId: string) => `/deal-rooms/${id}/files/${assetId}?edit=1`;

/** The relative luminance of `#rrggbb`, as WCAG has it. */
function luminanceOf(color: string): number {
    const [red, green, blue] = [1, 3, 5].map((at) => {
        const channel = Number.parseInt(color.slice(at, at + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** What reads best on `#rrggbb`: white, or the near-black Material's on-roles use. */
function readableOn(color: string): string {
    const luminance = luminanceOf(color);
    return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.0595 ? "#ffffff" : "#1a1c1a";
}

/** The custom properties that put a banner's color on an element; the tenant's primary, in app.css, for none. */
function bannerColors(color: string | null): CSSProperties | undefined {
    if (!color) return undefined;
    return { "--deal-banner": color, "--on-deal-banner": readableOn(color) } as CSSProperties;
}

/**
 * A deal room's banner: its image, if it has one, across all of it, under its
 * color, which fades up from the text so the text reads on any image; who it's
 * from; its title; and what it says.
 */
export function DealBanner({
    banner,
    title,
    description,
    from,
}: {
    banner: DealRoomBanner;
    title: string;
    description: string | null;
    /** The tenant it's from. */
    from: { name: string; logo: string | null };
}) {
    return (
        <header className="deal-banner" style={bannerColors(banner.color)}>
            {banner.image && <img className="deal-banner-image" src={banner.image} alt="" />}
            <div className={banner.image ? "deal-banner-text deal-banner-text-faded" : "deal-banner-text"}>
                <div className="deal-banner-from">
                    {from.logo && <img src={from.logo} alt="" />}
                    <span>{from.name}</span>
                </div>
                <h1>{title}</h1>
                {description && <p>{description}</p>}
            </div>
        </header>
    );
}

/** A deal room as a card: its banner for a tray, its title, how many files it holds, and whether it's on its frontstage. */
export function DealRoomCard({ room }: { room: DealRoom }) {
    const navigate = useNavigate();
    const path = dealRoomPath(room.id);
    const files = room.files.length === 1 ? "1 file" : `${room.files.length} files`;
    return (
        <div className="file-card" onClick={() => navigate(path)}>
            <div className="thumbnail deal-room-tray" style={bannerColors(room.banner.color)}>
                {room.banner.image ? (
                    <img className="deal-banner-image" src={room.banner.image} alt="" />
                ) : (
                    <DealRoomsIcon />
                )}
            </div>
            <div className="file-card-body">
                <div className="file-card-title">
                    <Link className="file-name" to={path}>
                        <span>{room.title}</span>
                    </Link>
                </div>
                <p className="file-card-meta">
                    {files} · Updated {formatDate(room.updatedAt)}
                </p>
                {room.frontstage && (
                    <span className="status-labels deal-room-status">
                        <span className="status-label status-published">
                            {publishedLabelOf({ dealRoomId: room.id })}
                        </span>
                    </span>
                )}
            </div>
        </div>
    );
}

/** A press on a menu, which opens it and not what it's in. */
const keep = (event: MouseEvent) => event.stopPropagation();

/** A room's files as a table: a row each, opening its file. */
export function DealFileTable({
    room,
    menu,
}: {
    room: DealRoom;
    /** A file's menu. */
    menu: (file: DealRoomFile, index: number) => ReactNode;
}) {
    const navigate = useNavigate();
    return (
        <table className="file-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Added by</th>
                    <th>Added</th>
                    <th className="numeric">Size</th>
                    <th>
                        <span className="visually-hidden">Actions</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                {room.files.map((file, index) => {
                    const { asset } = file;
                    const path = dealRoomFilePath(room.id, asset.id);
                    return (
                        <tr key={asset.id} onClick={() => navigate(path)}>
                            <td>
                                <Link className="file-name" to={path}>
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
                            <td className="row-actions" onClick={keep}>
                                {menu(file, index)}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/** A room's file as a card: its pages, its name, where its versions stand, what it says to buyers, and any newer source. */
export function DealFileCard({
    roomId,
    file,
    menu,
}: {
    roomId: string;
    file: DealRoomFile;
    /** Its menu. */
    menu: ReactNode;
}) {
    const navigate = useNavigate();
    const { asset, description, source } = file;
    const path = dealRoomFilePath(roomId, asset.id);
    return (
        <div className="file-card" onClick={() => navigate(path)}>
            <Thumbnail file={asset} />
            <div className="file-card-body">
                <div className="file-card-title">
                    <Link className="file-name" to={path}>
                        <FileBadge format={asset.format} />
                        <span>{asset.name}</span>
                    </Link>
                    <div onClick={keep}>{menu}</div>
                </div>
                <p className="file-card-meta">
                    {asset.uploadedBy.name} · {formatDate(asset.uploadedAt)}
                </p>
                <FileStatus asset={asset} />
                {description && <p className="file-card-note">{description}</p>}
                {source.publishedInstead !== null && (
                    <p className="file-card-note">The library now publishes version {source.publishedInstead}.</p>
                )}
            </div>
        </div>
    );
}
