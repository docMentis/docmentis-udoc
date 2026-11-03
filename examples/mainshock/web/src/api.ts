// The backend's API, as the pages call it.
import type { Failure, User } from "../../shared/api.ts";

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
        const init = {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password }),
        };
        return (await request<{ user: User }>("/api/session", init)).user;
    },
    signOut: () => request<void>("/api/session", { method: "DELETE" }),
};
