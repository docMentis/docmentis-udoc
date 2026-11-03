// What the backend's API answers and the frontend reads: the one definition
// of each, imported by both.

/**
 * What a user may do at their tenant: an admin keeps the library and the
 * workspace's settings, a reviewer approves what's submitted to the library,
 * and a member uses it.
 */
export type Role = "admin" | "reviewer" | "member";

/** Whether a user in `role` changes the library: makes its folders, uploads its files, renames and deletes them. */
export function managesLibrary(role: Role): boolean {
    return role === "admin";
}

/** A tenant's user, as the API shows one. */
export interface User {
    id: string;
    /** Their work email, which they sign in with. */
    email: string;
    name: string;
    /** Their job title. */
    title: string;
    role: Role;
    tenant: Tenant;
}

/** A company using Shockwave, whose brand its users see the app in. */
export interface Tenant {
    id: string;
    name: string;
    /** Where its logo is, a square icon, for an `<img>`; `null` when it has none. */
    logo: string | null;
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
