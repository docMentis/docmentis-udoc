// What the backend's API answers and the frontend reads: the one definition
// of each, imported by both.

/**
 * What a user may do at their tenant: an admin keeps the library and the
 * workspace's settings, a reviewer approves what's submitted to the library,
 * and a member uses it.
 */
export type Role = "admin" | "reviewer" | "member";

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
    /** The number of the version published; `null` when none is. */
    publishedVersion: number | null;
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
