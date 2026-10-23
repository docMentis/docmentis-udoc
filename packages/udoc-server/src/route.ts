// A route: a method and a path pattern, and what answers a request for both —
// and how a request or a WebSocket upgrade reaches the route its path names.
//
// The server's routes come in families, each a table of its own file's — the
// document routes in `document.ts` — and are matched in turn: the first route
// whose pattern matches the path and whose method is the request's answers it.
// A path no route has is a 404; one some route has, but for another method, a
// 405. The routes sit beneath a base path, and a request whose path no route
// has there is not the server's: it is left untouched, for whatever the server
// is embedded in to answer.
//
// A pattern is a path whose segments may hold parameters: `:name` is a segment,
// or the part of one between literal text (`:index.png`, `file.:format`), and
// `*name` the rest of the path. A parameter matches any text but a `/`, unless
// its route gives it a grammar. A path is compared by its segments, so a
// doubled or trailing `/` changes nothing.

import type { IncomingMessage, ServerResponse } from "node:http";

import { HttpFailure, failureOf, failureReply, notFound, refuseUpgrade, writeReply } from "./http.ts";
import type { Reply, Upgrade } from "./http.ts";

/** A path's parameters, by name. */
export type Params = Record<string, string>;

/** What a route's handler is given: its path's parameters, its query, and the request. */
export interface RouteRequest {
    params: Params;
    query: URLSearchParams;
    incoming: IncomingMessage;
}

/** What answers a request for a route. */
export type Handler = (request: RouteRequest) => Promise<Reply>;

/**
 * What takes a WebSocket upgrade for a route — or, refusing it, answers the
 * refusal itself: a browser can't read the answer to an upgrade it isn't given.
 */
export type UpgradeHandler = (request: RouteRequest, upgrade: Upgrade) => Promise<void>;

/** A request of `method` whose path matches `pattern` is answered by `handle`, a WebSocket upgrade by `upgrade`. */
export interface Route<H = Handler> {
    readonly method: string;
    readonly pattern: RegExp;
    readonly handle: H;
    readonly upgrade?: UpgradeHandler;
}

export interface RouteOptions {
    /** The grammar of each parameter that has one: a path whose parameter doesn't match it names no route. */
    params?: Record<string, RegExp>;
    /** Takes a WebSocket upgrade for the route's path. */
    upgrade?: UpgradeHandler;
}

/** A `:name` or `*name` parameter in a pattern. */
const PARAMETER = /:(\w+)|\*(\w+)/g;

/** A request of `method` at a path matching `path`, answered by `handle`. */
export function route<H>(method: string, path: string, handle: H, options: RouteOptions = {}): Route<H> {
    const grammar = options.params ?? {};
    const pattern = segmentsOf(path);
    let source = "";
    let literal = 0;
    for (const parameter of pattern.matchAll(PARAMETER)) {
        source += escape(pattern.slice(literal, parameter.index));
        const [whole, one, rest] = parameter;
        source += one !== undefined ? `(?<${one}>${grammar[one]?.source ?? "[^/]+"})` : `(?<${rest}>.+)`;
        literal = parameter.index + whole.length;
    }
    source += escape(pattern.slice(literal));
    return {
        method,
        pattern: new RegExp(`^${source}$`),
        handle,
        ...(options.upgrade ? { upgrade: options.upgrade } : {}),
    };
}

/**
 * The route of `table` for `method` at `path`, and the path's parameters: the
 * first whose pattern matches and whose method is `method`. None has the path:
 * a 404; one has it, for another method: a 405.
 */
export function match<H>(table: readonly Route<H>[], method: string, path: string): [Route<H>, Params] {
    const segments = segmentsOf(path);
    const allowed: string[] = [];
    for (const route of table) {
        const matched = route.pattern.exec(segments);
        if (!matched) continue;
        if (route.method === method) return [route, { ...matched.groups }];
        allowed.push(route.method);
    }
    if (allowed.length === 0) throw notFound();
    throw new HttpFailure(405, "methodNotAllowed", `${method} is not allowed here; use ${allowed.join(" or ")}`);
}

/** Where a request is: its path beneath the server's base path, and its query. */
export interface Target {
    path: string;
    query: URLSearchParams;
}

/** Where `request` is beneath `base`, a path; `undefined` if its path isn't beneath it. */
export function targetOf(request: IncomingMessage, base: string): Target | undefined {
    let url: URL;
    try {
        url = new URL(request.url ?? "/", "http://localhost");
    } catch {
        return undefined;
    }
    const prefix = segmentsOf(base);
    const path = segmentsOf(url.pathname);
    if (prefix === "") return { path, query: url.searchParams };
    if (path === prefix) return { path: "", query: url.searchParams };
    if (!path.startsWith(`${prefix}/`)) return undefined;
    return { path: path.slice(prefix.length + 1), query: url.searchParams };
}

/** Whether some route of `table` has `path`, for any method. */
export function has(table: readonly Route[], path: string): boolean {
    const segments = segmentsOf(path);
    return table.some((route) => route.pattern.test(segments));
}

/** Answer `request`, at `target`, by the route of `table` it names; failing, with the failure. */
export async function answerRequest(
    table: readonly Route[],
    { path, query }: Target,
    request: IncomingMessage,
    response: ServerResponse,
): Promise<void> {
    try {
        const [route, params] = match(table, request.method ?? "GET", path);
        writeReply(response, await route.handle({ params, query, incoming: request }));
    } catch (error) {
        const failure = failureOf(error);
        if (response.headersSent) {
            response.destroy();
            return;
        }
        if (failure.status === 413) response.setHeader("connection", "close");
        writeReply(response, failureReply(failure));
    }
}

/**
 * Answer `upgrade`, at `target`, by the route of `table` that takes upgrades
 * at its path, which answers its refusals itself. A path no such route has is
 * answered as a request would be, and hung up.
 */
export async function answerUpgrade(table: readonly Route[], { path, query }: Target, upgrade: Upgrade): Promise<void> {
    const { request, socket } = upgrade;
    let matched: [Route, Params];
    try {
        matched = match(
            table.filter((route) => route.upgrade !== undefined),
            request.method ?? "GET",
            path,
        );
    } catch (error) {
        refuseUpgrade(socket, error instanceof HttpFailure ? error : notFound());
        return;
    }
    const [route, params] = matched;
    await route.upgrade!({ params, query, incoming: request }, upgrade);
}

/** `path`'s segments, joined: no leading, trailing or doubled `/`. */
function segmentsOf(path: string): string {
    return path.split("/").filter(Boolean).join("/");
}

function escape(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
