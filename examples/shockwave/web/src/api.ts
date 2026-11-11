// The backend's API, as the pages call it.
import type {
    Asset,
    Collection,
    DealRoom,
    DealRoomActivity,
    DealRoomFileDetail,
    DealRoomNews,
    DocumentActivity,
    Failure,
    Folder,
    FolderListing,
    Frontstage,
    Person,
    PublishedFile,
    Reviewer,
    Seller,
    SessionActivity,
    Tenant,
    User,
    Version,
    VersionStep,
    VersionedAsset,
    ViewerColors,
    WaitingVersion,
} from "../../shared/api.ts";

/** What a collection says of itself, as a person gives it: empty for a description or instructions it hasn't. */
export interface CollectionFields {
    name: string;
    description: string;
    instructions: string;
}

/** What a deal room says of itself, as a person gives it: an empty description for none, `null` for the tenant's color. */
export interface DealRoomFields {
    title: string;
    description: string;
    bannerColor: string | null;
}

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
    /** The versions waiting on the user: to review, or returned or approved, to act on. */
    async waitingVersions(): Promise<WaitingVersion[]> {
        return (await request<{ versions: WaitingVersion[] }>("/api/library/attention")).versions;
    },
    /** Those a version can be sent to for review, by name. */
    async reviewers(): Promise<Reviewer[]> {
        return (await request<{ reviewers: Reviewer[] }>("/api/library/reviewers")).reviewers;
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
    /** A file's versions, newest first. */
    async versions(assetId: string): Promise<Version[]> {
        return (await request<{ versions: Version[] }>(`/api/assets/${assetId}/versions`)).versions;
    },
    /** Save a file's document as it is now as a new version, with `note`. */
    saveVersion: (assetId: string, note: string) =>
        request<VersionedAsset>(`/api/assets/${assetId}/versions`, withJson("POST", { note })),
    /**
     * Take `step` with version `number` of a file, with `note`, and for a step
     * that sends it to someone, `reviewerId`; an `ApiError` `409` for a version
     * not ready for it, and `403` for one not the user's to take it with.
     */
    takeVersionStep: (assetId: string, number: number, step: VersionStep, note: string, reviewerId?: string) =>
        request<VersionedAsset>(
            `/api/assets/${assetId}/versions/${number}/${step}`,
            withJson("POST", { note, reviewerId }),
        ),

    /** The collections of the user's tenant, by name. */
    async collections(): Promise<Collection[]> {
        return (await request<{ collections: Collection[] }>("/api/collections")).collections;
    },
    /** Collection `id`, with its files; an `ApiError` `404` for none. */
    async collection(id: string): Promise<Collection> {
        return (await request<{ collection: Collection }>(`/api/collections/${id}`)).collection;
    },
    /** Make a collection; an `ApiError` `409` when the name's taken. */
    async createCollection(fields: CollectionFields): Promise<Collection> {
        return (await request<{ collection: Collection }>("/api/collections", withJson("POST", fields))).collection;
    },
    /** Change a collection; an `ApiError` `409` when the name's taken. */
    async updateCollection(id: string, fields: CollectionFields): Promise<Collection> {
        return (await request<{ collection: Collection }>(`/api/collections/${id}`, withJson("PATCH", fields)))
            .collection;
    },
    deleteCollection: (id: string) => request<void>(`/api/collections/${id}`, { method: "DELETE" }),
    /** What can go in a collection: the tenant's published files, by name. */
    async publishedFiles(): Promise<PublishedFile[]> {
        return (await request<{ files: PublishedFile[] }>("/api/published-files")).files;
    },
    /** Add files to a collection's end. */
    async addToCollection(id: string, assetIds: string[]): Promise<Collection> {
        const init = withJson("POST", { assetIds });
        return (await request<{ collection: Collection }>(`/api/collections/${id}/items`, init)).collection;
    },
    /** Say how to use a file in a collection. */
    async setFileInstructions(id: string, assetId: string, instructions: string): Promise<Collection> {
        const init = withJson("PATCH", { instructions });
        return (await request<{ collection: Collection }>(`/api/collections/${id}/items/${assetId}`, init)).collection;
    },
    /** Take a file out of a collection. */
    async removeFromCollection(id: string, assetId: string): Promise<Collection> {
        const init = { method: "DELETE" };
        return (await request<{ collection: Collection }>(`/api/collections/${id}/items/${assetId}`, init)).collection;
    },
    /** Put a collection's files in order: all of them, first first; an `ApiError` `409` if they've changed. */
    async orderCollection(id: string, assetIds: string[]): Promise<Collection> {
        const init = withJson("PUT", { assetIds });
        return (await request<{ collection: Collection }>(`/api/collections/${id}/order`, init)).collection;
    },

    /** The deal rooms the user enters, changed last first. */
    async dealRooms(): Promise<DealRoom[]> {
        return (await request<{ rooms: DealRoom[] }>("/api/deal-rooms")).rooms;
    },
    /** Deal room `id`, backstage; an `ApiError` `404` for one the user doesn't enter. */
    async dealRoom(id: string): Promise<DealRoom> {
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}`)).room;
    },
    /** Make a deal room, with the user on it. */
    async createDealRoom(title: string, description: string): Promise<DealRoom> {
        return (await request<{ room: DealRoom }>("/api/deal-rooms", withJson("POST", { title, description }))).room;
    },
    /** Change what a deal room says of itself; what's on its frontstage stays as it is. */
    async updateDealRoom(id: string, fields: DealRoomFields): Promise<DealRoom> {
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}`, withJson("PATCH", fields))).room;
    },
    /** Delete a deal room, its files, and its frontstage. */
    deleteDealRoom: (id: string) => request<void>(`/api/deal-rooms/${id}`, { method: "DELETE" }),
    /** Replace a deal room's banner image with `image`: a PNG, JPEG, WebP or SVG; an `ApiError` `415` for another. */
    async uploadDealRoomBanner(id: string, image: Blob): Promise<DealRoom> {
        const init = { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: image };
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}/banner`, init)).room;
    },
    async removeDealRoomBanner(id: string): Promise<DealRoom> {
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}/banner`, { method: "DELETE" })).room;
    },
    /** Those at the user's tenant who can be on a deal room, by name. */
    async sellers(): Promise<Seller[]> {
        return (await request<{ sellers: Seller[] }>("/api/deal-rooms/sellers")).sellers;
    },
    /** Say who's on a deal room: all of them. */
    async setDealRoomPeople(id: string, userIds: string[]): Promise<DealRoom> {
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}/people`, withJson("PUT", { userIds }))).room;
    },
    /** Add copies of files in collections, at the version the library publishes, to a deal room's end. */
    async addToDealRoom(id: string, assetIds: string[]): Promise<DealRoom> {
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}/files`, withJson("POST", { assetIds }))).room;
    },
    /** A deal room's file, with its versions; an `ApiError` `404` for one that isn't the user's to see. */
    dealRoomFile: (id: string, assetId: string) =>
        request<DealRoomFileDetail>(`/api/deal-rooms/${id}/files/${assetId}`),
    /** Change what a deal room's file says. */
    async updateDealRoomFile(id: string, assetId: string, name: string, description: string): Promise<DealRoom> {
        const init = withJson("PATCH", { name, description });
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}/files/${assetId}`, init)).room;
    },
    /** Take a file out of a deal room and off its frontstage, and delete it. */
    async removeFromDealRoom(id: string, assetId: string): Promise<DealRoom> {
        const init = { method: "DELETE" };
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}/files/${assetId}`, init)).room;
    },
    /** Put a deal room's files in order: all of them, first first; an `ApiError` `409` if they've changed. */
    async orderDealRoom(id: string, assetIds: string[]): Promise<DealRoom> {
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}/order`, withJson("PUT", { assetIds }))).room;
    },
    /** Put a deal room on its frontstage as it stands, showing `assetIds`, or update what's there. */
    async putOnFrontstage(id: string, assetIds: string[]): Promise<DealRoom> {
        const init = withJson("PUT", { assetIds });
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}/frontstage`, init)).room;
    },
    /** Take a deal room off its frontstage; its link stops working. */
    async takeOffFrontstage(id: string): Promise<DealRoom> {
        return (await request<{ room: DealRoom }>(`/api/deal-rooms/${id}/frontstage`, { method: "DELETE" })).room;
    },
    /** How buyers read a deal room's frontstage. */
    dealRoomActivity: (id: string) => request<DealRoomActivity>(`/api/deal-rooms/${id}/activity`),
    /** How buyers read a file of a deal room, a session at a time. */
    documentActivity: (id: string, assetId: string) =>
        request<DocumentActivity>(`/api/deal-rooms/${id}/activity/files/${assetId}`),
    /** One session of a file of a deal room, as it happened. */
    sessionActivity: (id: string, sessionId: string) =>
        request<SessionActivity>(`/api/deal-rooms/${id}/activity/sessions/${sessionId}`),
    /** Note that the user has looked at what buyers did in a deal room. */
    markDealRoomActivitySeen: (id: string) => request<void>(`/api/deal-rooms/${id}/activity/seen`, { method: "POST" }),
    /** The deal rooms the user is on, with visitors since they last looked, those who came last first. */
    async dealRoomNews(): Promise<DealRoomNews[]> {
        return (await request<{ rooms: DealRoomNews[] }>("/api/deal-rooms/news")).rooms;
    },
    /** The frontstage at `token`, as a buyer sees it; an `ApiError` `404` for none. */
    frontstage: (token: string) => request<Frontstage>(`/api/frontstage/${encodeURIComponent(token)}`),

    /** Replace tenant `id`'s logo with `image`: a PNG, JPEG, WebP or SVG; an `ApiError` `415` for another. */
    async uploadLogo(id: string, image: Blob): Promise<Tenant> {
        const init = { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: image };
        return (await request<{ tenant: Tenant }>(`/api/tenants/${id}/logo`, init)).tenant;
    },
    async removeLogo(id: string): Promise<Tenant> {
        return (await request<{ tenant: Tenant }>(`/api/tenants/${id}/logo`, { method: "DELETE" })).tenant;
    },
    /** Set tenant `id`'s brand color, `#rrggbb`, or none for `null`. */
    async setBrandColor(id: string, brandColor: string | null): Promise<Tenant> {
        return (await request<{ tenant: Tenant }>(`/api/tenants/${id}`, withJson("PATCH", { brandColor }))).tenant;
    },
    /** Set tenant `id`'s document viewer colors. */
    async setViewerColors(id: string, viewerColors: ViewerColors): Promise<Tenant> {
        return (await request<{ tenant: Tenant }>(`/api/tenants/${id}`, withJson("PATCH", { viewerColors }))).tenant;
    },
    /** Tenant `id`'s users, by name. */
    async users(id: string): Promise<Person[]> {
        return (await request<{ users: Person[] }>(`/api/tenants/${id}/users`)).users;
    },
};
