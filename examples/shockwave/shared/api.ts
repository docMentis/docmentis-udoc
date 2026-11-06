// What the backend's API answers and the frontend reads: the one definition
// of each, imported by both.

/**
 * What a user may do at their tenant: an admin keeps the library and the
 * workspace's settings, a reviewer approves what's submitted to the library, a
 * manager arranges collections of what's published, and a member sells with
 * them.
 */
export type Role = "admin" | "reviewer" | "manager" | "member";

/**
 * Whether a user in `role` changes the library: makes its folders, uploads its
 * files, edits, renames and deletes them, saves their versions, submits them
 * for review and publishes those approved.
 */
export function managesLibrary(role: Role): boolean {
    return role === "admin";
}

/** Whether a user in `role` can be sent a version to review, and approve or return one sent to them. */
export function reviewsLibrary(role: Role): boolean {
    return role === "reviewer";
}

/** Whether a user in `role` reads the library: drafts and all. Anyone else reads only a file's published version. */
export function readsLibrary(role: Role): boolean {
    return managesLibrary(role) || reviewsLibrary(role);
}

/** Whether a user in `role` arranges collections: makes them, chooses what's in them, and says how to use it. */
export function arrangesCollections(role: Role): boolean {
    return role === "manager";
}

/** Whether a user in `role` sells: makes deal rooms, and works in those they can enter. */
export function sellsDeals(role: Role): boolean {
    return role === "manager" || role === "member";
}

/** Whether a user in `role` enters every deal room at their tenant, whether they're on it or not. */
export function entersAllDealRooms(role: Role): boolean {
    return role === "manager";
}

/** Whether a user in `role` keeps the workspace's settings: its brand, and who's in it. */
export function managesWorkspace(role: Role): boolean {
    return role === "admin";
}

/** A tenant's user, as a list of them shows one. */
export interface Person {
    id: string;
    /** Their work email, which they sign in with. */
    email: string;
    name: string;
    /** Their job title. */
    title: string;
    role: Role;
}

/** A tenant's user, as the API shows the one signed in. */
export interface User extends Person {
    tenant: Tenant;
}

/**
 * A surface the document viewer takes: its own, or one of the surface
 * containers Material 3 makes from the brand's color, low to highest.
 */
export type ViewerSurface =
    | "default"
    | "surface-container-low"
    | "surface-container"
    | "surface-container-high"
    | "surface-container-highest";

export const VIEWER_SURFACES: readonly ViewerSurface[] = [
    "default",
    "surface-container-low",
    "surface-container",
    "surface-container-high",
    "surface-container-highest",
];

/** The document viewer's primary: its own, or the brand's, the app's. */
export type ViewerPrimary = "default" | "brand";

export const VIEWER_PRIMARIES: readonly ViewerPrimary[] = ["default", "brand"];

/** The document viewer's colors, wherever the app shows it: its toolbar, the background under its pages, its primary. */
export interface ViewerColors {
    /** Its toolbar, ribbon, panels and status bar. */
    toolbar: ViewerSurface;
    /** The background around its pages. */
    background: ViewerSurface;
    /** Its primary, `--udoc-color-primary`: focus, selection, switches and filled buttons. */
    primary: ViewerPrimary;
}

export const DEFAULT_VIEWER_COLORS: ViewerColors = { toolbar: "default", background: "default", primary: "default" };

/** Whether `value` is a `ViewerColors`. */
export function isViewerColors(value: unknown): value is ViewerColors {
    if (typeof value !== "object" || value === null) return false;
    const { toolbar, background, primary } = value as Record<string, unknown>;
    const surface = (s: unknown) => VIEWER_SURFACES.includes(s as ViewerSurface);
    return surface(toolbar) && surface(background) && VIEWER_PRIMARIES.includes(primary as ViewerPrimary);
}

/** A company using Shockwave, whose brand its users see the app in. */
export interface Tenant {
    id: string;
    name: string;
    /** Where its logo is, a square icon, for an `<img>`; `null` when it has none. */
    logo: string | null;
    /** Its brand's color, `#rrggbb`, which seeds the app's colors; `null` for Shockwave's own. */
    brandColor: string | null;
    viewerColors: ViewerColors;
}

/** A folder in a tenant's library. */
export interface Folder {
    id: string;
    name: string;
    /** The folder it's in; `null` at the library's top. */
    parentId: string | null;
}

/**
 * Pixels to a point a file's card shows its pages at, the first kept and the
 * others rendered as they're flipped to: a letter page 306 pixels wide, a 16:9
 * slide 480, sharp on a card at twice the pixels.
 */
export const CARD_PAGE_SCALE = 0.5;

/** A file in a tenant's library: an asset, its document kept by udoc-server. */
export interface Asset {
    id: string;
    name: string;
    /** The folder it's in; `null` at the library's top. */
    folderId: string | null;
    /** What it was read as, udoc's name for its format: `pdf`, `pptx`, … */
    format: string;
    /** Its upload's size, in bytes. */
    size: number;
    /** The document udoc-server keeps it as, opened from `/udoc/documents/:documentId/package`. */
    documentId: string;
    /** Where its first page is, for an `<img>`; `null` when it has none, as a workbook. */
    thumbnail: string | null;
    uploadedBy: { id: string; name: string };
    /** When it was uploaded, in milliseconds since the epoch. */
    uploadedAt: number;
    /** The version saved last. */
    latestVersion: { number: number; status: VersionStatus };
    /** The number of the version published, or for a deal room's file, the one on its frontstage; `null` when none is. */
    publishedVersion: number | null;
    /** The deal room it's a copy for; `null` for a file in the library. */
    dealRoomId: string | null;
}

/**
 * Where a version stands in review: saved, submitted, then approved or
 * returned. Publishing is apart from it: an approved version stays approved
 * whether or not it's the one its file publishes.
 */
export type VersionStatus = "draft" | "submitted" | "approved" | "returned";

/** What's done to a version: `POST /api/assets/:id/versions/:number/:step`. */
export type VersionStep = "submit" | "approve" | "return" | "publish" | "reassign" | "dismiss";

/** Someone a version can be sent to for review. */
export interface Reviewer {
    id: string;
    name: string;
    /** Their job title. */
    title: string;
}

/** Something that happened to a version. */
export interface VersionEvent {
    kind: "saved" | "submitted" | "approved" | "returned" | "published" | "reassigned" | "dismissed";
    by: { id: string; name: string };
    /** Who it was sent to, for one submitted or reassigned; otherwise `null`. */
    to: { id: string; name: string } | null;
    /** When, in milliseconds since the epoch. */
    at: number;
    note: string | null;
}

/**
 * A version of a file: a checkpoint of its document, which never changes,
 * whatever happens to the document after it.
 */
export interface Version {
    /** 1, 2, 3 for its file, in the order they were saved. */
    number: number;
    /** The checkpoint it is, opened from `/udoc/documents/:documentId/checkpoints/:checkpoint/package`. */
    checkpoint: number;
    status: VersionStatus;
    /** Who reviews it, or reviewed it; `null` before it's submitted. */
    reviewer: { id: string; name: string } | null;
    /** What happened to it, oldest first; the first, its being saved. */
    events: VersionEvent[];
}

/** A version waiting on the user, with its file: `status` says what for. */
export interface WaitingVersion {
    asset: Asset;
    number: number;
    /** `submitted`, to review; `returned`, to act on; `approved`, to publish. */
    status: VersionStatus;
}

/** What a change to a file's versions answers: the file as it now is, and its versions, newest first. */
export interface VersionedAsset {
    asset: Asset;
    versions: Version[];
}

/**
 * A file as those who sell with it see it: its published version, and nothing
 * of the working copy or the other versions around it.
 */
export interface PublishedFile {
    /** The file's id. */
    id: string;
    name: string;
    /** What it was read as, udoc's name for its format: `pdf`, `pptx`, … */
    format: string;
    /** The document udoc-server keeps it as. */
    documentId: string;
    /** The number of the version published. */
    version: number;
    /** The checkpoint that version is, opened from `/udoc/documents/:documentId/checkpoints/:checkpoint/package`. */
    checkpoint: number;
    /** Where that version's first page is, for an `<img>`; `null` when it has none. */
    thumbnail: string | null;
    /** When that version was published, in milliseconds since the epoch. */
    publishedAt: number;
}

/** A file in a collection, which shows whichever version the file publishes. */
export interface CollectionItem {
    file: PublishedFile;
    /** How to use this file. */
    instructions: string | null;
}

/** Published files a tenant's manager arranged for its sales team, in the order they chose. */
export interface Collection {
    id: string;
    name: string;
    /** What it's for. */
    description: string | null;
    /** How to use it. */
    instructions: string | null;
    /** When it last changed, in milliseconds since the epoch. */
    updatedAt: number;
    items: CollectionItem[];
}

/** Someone at a tenant who sells, whom a deal room can have on it. */
export interface Seller {
    id: string;
    name: string;
    /** Their job title. */
    title: string;
}

/** A deal room's banner, over its frontstage. */
export interface DealRoomBanner {
    /** Its color, `#rrggbb`; `null` for the tenant's primary. */
    color: string | null;
    /** Where its image is, for an `<img>`; `null` when it has none. */
    image: string | null;
}

/** The file a deal room's file was copied from, as it stood then and as the library has it now. */
export interface DealRoomFileSource {
    /** The library's file, for adding it again; `null` once it's deleted. */
    id: string | null;
    name: string;
    /** The version copied. */
    version: number;
    /** The version the library publishes now, where that isn't the one copied; otherwise `null`. */
    publishedInstead: number | null;
}

/**
 * A file in a deal room: its own copy of a published version, edited apart from
 * the file it came from, with what buyers read beside it.
 */
export interface DealRoomFile {
    asset: Asset;
    /** What it says to buyers, beside the document on the frontstage. */
    description: string | null;
    source: DealRoomFileSource;
    /** The latest approved version, which is what goes on the frontstage. */
    approvedVersion: number;
    /** Whether it's on the frontstage: at `asset.publishedVersion`. */
    onFrontstage: boolean;
}

/** How a deal room's frontstage stands, for those backstage. */
export interface FrontstageStatus {
    /** What the link buyers open names: `/rooms/:token`. */
    token: string;
    /** When it was last put on, in milliseconds since the epoch. */
    at: number;
    by: { id: string; name: string };
    /** Whether anything changed backstage since that buyers can't see yet. */
    behind: boolean;
}

/** A deal room, backstage: what sales prepare for one deal. */
export interface DealRoom {
    id: string;
    title: string;
    description: string | null;
    banner: DealRoomBanner;
    /** When it last changed, in milliseconds since the epoch. */
    updatedAt: number;
    /** Who's on it, by name. */
    people: Seller[];
    /** Its files, in the order they show on the frontstage. */
    files: DealRoomFile[];
    /** Its frontstage; `null` when it's not on one. */
    frontstage: FrontstageStatus | null;
}

/** What `GET /api/deal-rooms/:id/files/:assetId` answers: a file, in its room, with its versions. */
export interface DealRoomFileDetail {
    room: { id: string; title: string };
    file: DealRoomFile;
    /** Its versions, newest first: for a reviewer who isn't on the room, those sent to them. */
    versions: Version[];
}

/** A file as a buyer sees it, on a deal room's frontstage: what was put there, and nothing around it. */
export interface FrontstageFile {
    id: string;
    name: string;
    description: string | null;
    /** What it was read as, udoc's name for its format: `pdf`, `pptx`, … */
    format: string;
    /** Where its first page is, for an `<img>`; `null` when it has none. */
    thumbnail: string | null;
    /** Where the viewer opens it from. */
    package: string;
}

/** A deal room as a buyer sees it, at its link, with no account: only what was last put on the frontstage. */
export interface Frontstage {
    /** The tenant it's from, in its brand. */
    from: {
        name: string;
        /** Where its logo is, for an `<img>`; `null` when it has none. */
        logo: string | null;
        brandColor: string | null;
        viewerColors: ViewerColors;
    };
    title: string;
    description: string | null;
    banner: DealRoomBanner;
    files: FrontstageFile[];
}

/** What a folder holds, or the library's top. */
export interface FolderListing {
    /** The folders from the top down to this one, this one last; empty at the top. */
    path: Folder[];
    folders: Folder[];
    assets: Asset[];
}

/** What a request that fails answers. */
export interface Failure {
    error: string;
    message: string;
}
