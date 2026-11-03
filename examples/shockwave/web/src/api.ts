// The backend's API, as the pages call it.
import type { Asset, Failure, Folder, FolderListing, User } from "../../shared/api.ts";

/** A request the backend refused: its status, and its failure. */
export class ApiError extends Error {
    readonly status: number;
    readonly error: string;

    constructor(status: number, failure: Failure) {
        super(failure.message);
        this.status = status;
        this.error = failure.error;
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, init);
    if (response.status === 204) return undefined as T;
    const body = await response.json();
    if (!response.ok) throw new ApiError(response.status, body as Failure);
    return body as T;
}

/** A request sending `body` as JSON. */
function withJson(method: string, body: unknown): RequestInit {
    return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export const api = {
    /** The user signed in, or `null` for no one. */
    async session(): Promise<User | null> {
        try {
            return (await request<{ user: User }>("/api/session")).user;
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) return null;
            throw error;
        }
    },
    /** Sign in as `email`, with `password`; an `ApiError` with status `401` when either is wrong. */
    async signIn(email: string, password: string): Promise<User> {
        return (await request<{ user: User }>("/api/session", withJson("POST", { email, password }))).user;
    },
    signOut: () => request<void>("/api/session", { method: "DELETE" }),

    /** What folder `folderId` holds, or with none, the library's top. */
    library: (folderId?: string) =>
        request<FolderListing>(folderId ? `/api/library?folder=${encodeURIComponent(folderId)}` : "/api/library"),
    /** The files uploaded last, in any folder, newest first. */
    async recentAssets(): Promise<Asset[]> {
        return (await request<{ assets: Asset[] }>("/api/library/recent")).assets;
    },
    /** Make folder `name` in `parentId`, or at the top for `null`; an `ApiError` `409` when the name's taken there. */
    async createFolder(name: string, parentId: string | null): Promise<Folder> {
        return (await request<{ folder: Folder }>("/api/folders", withJson("POST", { name, parentId }))).folder;
    },
    async renameFolder(id: string, name: string): Promise<Folder> {
        return (await request<{ folder: Folder }>(`/api/folders/${id}`, withJson("PATCH", { name }))).folder;
    },
    /** Delete an empty folder; an `ApiError` `409` for one that isn't. */
    deleteFolder: (id: string) => request<void>(`/api/folders/${id}`, { method: "DELETE" }),
    /** Upload `file` into folder `folderId`, or at the top for `null`, as `name`. */
    async uploadAsset(file: Blob, name: string, folderId: string | null): Promise<Asset> {
        const query = new URLSearchParams({ name });
        if (folderId) query.set("folder", folderId);
        const init = { method: "POST", headers: { "content-type": "application/octet-stream" }, body: file };
        return (await request<{ asset: Asset }>(`/api/assets?${query}`, init)).asset;
    },
    /** A file, and the folders from the top down to the one it's in. */
    asset: (id: string) => request<{ asset: Asset; path: Folder[] }>(`/api/assets/${id}`),
    async renameAsset(id: string, name: string): Promise<Asset> {
        return (await request<{ asset: Asset }>(`/api/assets/${id}`, withJson("PATCH", { name }))).asset;
    },
    deleteAsset: (id: string) => request<void>(`/api/assets/${id}`, { method: "DELETE" }),
};
