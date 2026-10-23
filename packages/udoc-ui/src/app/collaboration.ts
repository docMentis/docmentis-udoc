/**
 * A collaboration message's first byte, saying what the rest of it is —
 * udoc-server's protocol (docs/design/node-collaboration.md), which a local
 * collaboration service speaks too.
 */
export const JOIN = 1;
export const PATCH = 2;
export const PRESENCE = 3;
/**
 * The content of opaque parts — an inserted picture's image — whose ids the
 * CRDT carries but not their content (the core design's opaque parts): a client's
 * goes ahead of the patch that names them, and a local collaboration service
 * sends them on.
 */
export const OPAQUE_PARTS = 4;

/**
 * The close codes a collaboration once joined over a WebSocket is rejoined
 * after: the server closing, the connection lost without a close, the
 * document's session ended. Any other ends it.
 */
const REJOIN_CODES: ReadonlySet<number> = new Set([1001, 1006, 1011]);

/** The wait before the first rejoin, doubled for each one after up to {@link REJOIN_MAX_DELAY_MS}. */
const REJOIN_DELAY_MS = 1000;
const REJOIN_MAX_DELAY_MS = 30_000;

/**
 * How often a client refreshes its presence: well inside the engine's presence
 * timeout (30 s), so its own entries never age out at a peer while it is here,
 * and a peer that vanished without leaving drops out within the timeout and
 * one period.
 */
const PRESENCE_REFRESH_MS = 10_000;

/** What happens to a collaboration — each the public `collaboration:*` event of its `type`. */
export type CollaborationEvent =
    | { type: "joined" }
    | { type: "interrupted"; code: number; reason: string }
    | { type: "failed"; code: number; reason: string }
    | { type: "left" };

/** The open document's sync surface and local-change cues, which a collaboration drives: the shell's own. */
export interface CollaborationSync {
    versionVector(): Promise<Uint8Array>;
    patchSince(peer: Uint8Array): Promise<Uint8Array>;
    merge(data: Uint8Array): Promise<void>;
    opaquePartsSince(peer: Uint8Array): Promise<Uint8Array>;
    mergeOpaqueParts(data: Uint8Array): Promise<void>;
    presence(): Promise<Uint8Array>;
    mergePresence(data: Uint8Array): Promise<void>;
    refreshPresence(): Promise<void>;
    withdrawPresence(): Promise<Uint8Array>;
    onEdit(listener: () => void): () => void;
    onSelectionEdit(listener: () => void): () => void;
    /** Hears the pointer's own presence blob, each time it moves or is cleared. */
    onPointer(listener: (presence: Uint8Array) => void): () => void;
}

/** A collaboration joined: {@link Collaboration.leave} ends it. */
export interface Collaboration {
    /**
     * Leave it — announced as `left`. Resolves once the withdrawal of this
     * client's presence has been sent and the channel closed. Does nothing
     * more once it has ended.
     */
    leave(): Promise<void>;
}

/** What a connection's channel hears from the collaboration's far side. */
export interface ChannelEvents {
    /** The channel is open: the join can be sent. */
    opened(): void;
    /** A message arrived: its kind's byte, then its payload. */
    received(message: Uint8Array): void;
    /**
     * The channel closed from the far side, or was lost, with a WebSocket
     * close's `code` and `reason`; `rejoin` is whether a collaboration once
     * joined connects again.
     */
    closed(code: number, reason: string, rejoin: boolean): void;
}

/** One connection's channel: a WebSocket to udoc-server, or a port to a local collaboration service. */
export interface Channel {
    /** Send `message` — its kind's byte, then its payload — if the channel is open. */
    send(message: Uint8Array): void;
    /** Close it from this side. */
    close(): void;
}

/**
 * Open a channel to a collaboration, reporting to `events`. It reports
 * nothing until it has returned.
 */
export type OpenChannel = (events: ChannelEvents) => Channel;

/**
 * The channel to the collaboration at `url` — udoc-server's
 * `/documents/{id}/collaboration`, over `http(s)` or `ws(s)` — each a
 * WebSocket of its own. A close with a code in {@link REJOIN_CODES} is
 * rejoined.
 */
export function webSocketChannel(url: URL): OpenChannel {
    const socketUrl = url.href.replace(/^http/, "ws");
    return (events) => {
        const socket = new WebSocket(socketUrl);
        socket.binaryType = "arraybuffer";
        socket.addEventListener("open", () => events.opened());
        socket.addEventListener("message", (event) => events.received(new Uint8Array(event.data as ArrayBuffer)));
        socket.addEventListener("close", ({ code, reason }) => events.closed(code, reason, REJOIN_CODES.has(code)));
        return {
            send: (message) => {
                if (socket.readyState === WebSocket.OPEN) socket.send(message);
            },
            close: () => socket.close(),
        };
    };
}

/** One connection to the collaboration: its channel, and the far side's version vector once it answers the join. */
interface Connection {
    channel: Channel;
    /** The far side's version vector as far as this client knows it: unknown until the join is answered. */
    held: Uint8Array | undefined;
}

/**
 * Join `sync` to the collaboration `openChannel` connects to — udoc-server's,
 * or a local collaboration service's — so its local edits and presence reach
 * everyone else editing the document, and theirs reach it.
 *
 * - **Joining.** Each connection sends the client's version vector; the far
 *   side answers with its own, the edits the client lacks, and every peer's
 *   presence. The client then sends the edits the far side lacks — any made
 *   before the answer, or while no connection was joined.
 * - **Document** (`onEdit`): the edits made since those the far side is known
 *   to hold, preceded by the content of any opaque part they name — so the far
 *   side has an inserted picture's image before it learns of it. Merges never
 *   fire it, so nothing received is sent back.
 * - **Opaque parts**: what the far side sends is created in the model, to pass
 *   on in turn (the core design's opaque parts).
 * - **Presence** (`onSelectionEdit`): the client's presence, whole — and
 *   refreshed on each join and every {@link PRESENCE_REFRESH_MS}, so the far
 *   side keeps it while the client is here, and the client drops the peers that
 *   vanished.
 * - **Pointer** (`onPointer`): its own entry, alone, as it moves.
 * - **Leaving.** Any end withdraws the client's presence, so it forgets every
 *   peer's; a joined connection sends the withdrawal before it closes, so every
 *   peer drops this one's at once.
 * - **Rejoining.** A joined connection closed with `rejoin` is `interrupted`,
 *   and the client connects again, waiting longer after each attempt that
 *   fails. Any other close — or any close before the first join is answered —
 *   has `failed` it.
 *
 * `onEvent` hears each of those.
 */
export function joinCollaboration(
    sync: CollaborationSync,
    openChannel: OpenChannel,
    onEvent: (event: CollaborationEvent) => void,
): Collaboration {
    let connection: Connection | undefined;
    /** Whether the far side has answered a join: only a collaboration once joined is rejoined. */
    let joined = false;
    /** Rejoins attempted since the last answered join, which set how long the next one waits. */
    let rejoins = 0;
    let rejoinTimer: ReturnType<typeof setTimeout> | undefined;
    let ended = false;
    /** Edits are sent one batch at a time, each reading what the one before it left in `held`. */
    let sending = Promise.resolve();
    /** Whether a batch is queued and not yet begun: what asks for one meanwhile is taken in by it. */
    let editsQueued = false;
    /** The leave under way once it has ended: the withdrawal sent and the channel closed. */
    let leaving: Promise<void> = Promise.resolve();

    const failed = (what: string) => (err: unknown) => console.error(`udoc collaboration: ${what} failed`, err);

    const sendEdits = (): void => {
        if (editsQueued) return;
        editsQueued = true;
        sending = sending
            .then(async () => {
                editsQueued = false;
                const current = connection;
                if (!current?.held) return;
                // Read before the patch, so an edit landing between the two is
                // sent again next time rather than never. The opaque parts are
                // read after it, so they hold every part the patch names, and
                // are sent ahead of it.
                const next = await sync.versionVector();
                const patch = await sync.patchSince(current.held);
                const parts = await sync.opaquePartsSince(current.held);
                current.held = next;
                if (parts.byteLength > 0) send(current.channel, OPAQUE_PARTS, parts);
                send(current.channel, PATCH, patch);
            })
            .catch(failed("sending edits"));
    };
    const sendPresence = (): void => {
        // Not before the join is answered: the far side ends a client whose
        // first message isn't its join.
        const current = connection;
        if (!current?.held) return;
        void sync.presence().then((presence) => send(current.channel, PRESENCE, presence), failed("sending presence"));
    };
    const sendPointer = (presence: Uint8Array): void => {
        const current = connection;
        if (!current?.held) return;
        send(current.channel, PRESENCE, presence);
    };
    // Refreshed before it is sent, so its entries are newer than any
    // withdrawal of them the far side holds from a leave before this join.
    const refreshPresence = (): void => {
        void sync.refreshPresence().then(sendPresence, failed("refreshing presence"));
    };

    const offs = [sync.onEdit(sendEdits), sync.onSelectionEdit(sendPresence), sync.onPointer(sendPointer)];
    const refreshTimer = setInterval(refreshPresence, PRESENCE_REFRESH_MS);

    const end = (event: CollaborationEvent): void => {
        if (ended) return;
        ended = true;
        clearTimeout(rejoinTimer);
        clearInterval(refreshTimer);
        for (const off of offs) off();
        const current = connection;
        connection = undefined;
        leaving = sync
            .withdrawPresence()
            .then((withdrawal) => {
                if (current?.held) send(current.channel, PRESENCE, withdrawal);
            }, failed("withdrawing presence"))
            .finally(() => current?.channel.close());
        onEvent(event);
    };

    const receive = (current: Connection, message: Uint8Array): void => {
        // A connection left stays open until its withdrawal is sent: what the
        // far side sends meanwhile is not taken, or a peer forgotten would
        // come back.
        if (connection !== current) return;
        const payload = message.slice(1);
        switch (message[0]) {
            case JOIN:
                current.held = payload;
                joined = true;
                rejoins = 0;
                onEvent({ type: "joined" });
                sendEdits();
                refreshPresence();
                break;
            case PATCH:
                void sync.merge(payload).catch(failed("merging edits"));
                break;
            case PRESENCE:
                void sync.mergePresence(payload).catch(failed("merging presence"));
                break;
            case OPAQUE_PARTS:
                void sync.mergeOpaqueParts(payload).catch(failed("merging opaque parts"));
                break;
        }
    };

    const closed = (current: Connection, code: number, reason: string, rejoin: boolean): void => {
        if (ended || connection !== current) return;
        connection = undefined;
        if (!joined || !rejoin) {
            end({ type: "failed", code, reason });
            return;
        }
        // Announced once per connection lost, not again for each attempt that fails.
        if (current.held) onEvent({ type: "interrupted", code, reason });
        const delay = Math.min(REJOIN_DELAY_MS * 2 ** rejoins, REJOIN_MAX_DELAY_MS);
        rejoins++;
        rejoinTimer = setTimeout(connect, delay);
    };

    function connect(): void {
        const current: Connection = {
            channel: openChannel({
                opened: () => {
                    void sync.versionVector().then((ours) => send(current.channel, JOIN, ours), failed("joining"));
                },
                received: (message) => receive(current, message),
                closed: (code, reason, rejoin) => closed(current, code, reason, rejoin),
            }),
            held: undefined,
        };
        connection = current;
    }

    connect();
    return {
        leave: () => {
            end({ type: "left" });
            return leaving;
        },
    };
}

/** Send `payload` on `channel` as a message of `kind`. */
function send(channel: Channel, kind: number, payload: Uint8Array): void {
    const message = new Uint8Array(payload.byteLength + 1);
    message[0] = kind;
    message.set(payload, 1);
    channel.send(message);
}
