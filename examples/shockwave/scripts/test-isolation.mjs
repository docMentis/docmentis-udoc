// `npm run test:isolation`: whether each tenant is alone in shockwave
// (docs/design/examples-shockwave.md). It runs the real backend, on data of its own
// in a temporary folder, with a second tenant beside Larchmere, and has each attack
// the other: through every route and the gate, with the other's ids, and by holding
// rows with the very ids the other's rows have, so that a statement that forgets its
// tenant answers with the wrong row or changes the wrong one.
//
// It fails for what it doesn't cover as well: a route with no probe, a foreign key
// with no attempt, a table with no rows to attack. So something new has to say how
// it's attacked here, in `PROBES`, `ELSEWHERE`, `CROSSINGS` or `buildTenant`.
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const home = join(import.meta.dirname, "..");
const samples = join(home, "..", "..", "packages", "udoc-demo", "public");
const serverDir = join(home, "server");

if (!existsSync(join(home, "..", "..", "packages", "udoc-server", "dist", "index.js"))) {
    console.error("[isolation] the packages aren't built: run `npm run build` from the repo's root, first");
    process.exit(1);
}

/** A 1×1 PNG, for what takes an image. */
const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/7yMK/gAAAABJRU5ErkJggg==",
    "base64",
);

// ── The results ─────────────────────────────────────────────────────────────────

let passed = 0;
const failures = [];

function check(label, ok, detail) {
    if (ok) {
        passed++;
        return;
    }
    failures.push(label);
    console.log(`FAIL  ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail).slice(0, 300)}`}`);
}

// ── The backend ─────────────────────────────────────────────────────────────────

function freePort() {
    return new Promise((resolve, reject) => {
        const probe = createServer();
        probe.once("error", reject);
        probe.listen(0, "127.0.0.1", () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
    });
}

const dataDir = mkdtempSync(join(tmpdir(), "shockwave-isolation-"));
const dbFile = join(dataDir, "shockwave.db");
const port = await freePort();
const BASE = `http://127.0.0.1:${port}`;
let backendOutput = "";
const backend = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server/main.ts"], {
    cwd: home,
    env: { ...process.env, SHOCKWAVE_PORT: String(port), SHOCKWAVE_DATA: dataDir },
    stdio: ["ignore", "pipe", "pipe"],
});
backend.stdout.on("data", (chunk) => (backendOutput += chunk));
backend.stderr.on("data", (chunk) => (backendOutput += chunk));

/** Stop the backend, and delete its data. */
async function stopBackend() {
    await new Promise((resolve) => {
        if (backend.exitCode !== null) return resolve();
        backend.once("exit", resolve);
        backend.kill("SIGTERM");
    });
    rmSync(dataDir, { recursive: true, force: true });
}

// Whatever goes wrong, it's said, and nothing's left behind: a crash here isn't a pass.
async function giveUp(error) {
    process.removeAllListeners("uncaughtException");
    console.error(`\n[isolation] stopped before it finished: ${error?.stack ?? error}`);
    if (backendOutput) console.error(`\nThe backend said:\n${backendOutput.slice(-2000)}`);
    await stopBackend();
    process.exit(1);
}
process.on("uncaughtException", giveUp);
process.on("unhandledRejection", giveUp);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void stopBackend().then(() => process.exit(130)));

for (let attempt = 0; ; attempt++) {
    const up = await fetch(`${BASE}/api/session`).then(
        () => true,
        () => false,
    );
    if (up) break;
    if (attempt > 120 || backend.exitCode !== null) {
        console.error(`[isolation] the backend didn't start:\n${backendOutput}`);
        await stopBackend();
        process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
}

// ── Talking to it ───────────────────────────────────────────────────────────────

/** A client with `cookie`: a request's status, its body as text, and its body as JSON where it is. */
function clientWith(cookie) {
    return async (method, path, body, raw) => {
        const headers = cookie ? { cookie } : {};
        let payload;
        if (raw) {
            headers["content-type"] = "application/octet-stream";
            payload = raw;
        } else if (body !== undefined) {
            headers["content-type"] = "application/json";
            payload = JSON.stringify(body);
        }
        const response = await fetch(BASE + path, { method, headers, body: payload });
        const isJson = (response.headers.get("content-type") ?? "").includes("json");
        const text = isJson ? await response.text() : `${(await response.arrayBuffer()).byteLength} bytes`;
        return { status: response.status, text, data: isJson && text ? JSON.parse(text) : undefined };
    };
}

/** A request as it's written, unlike `fetch`, which tidies its path first: its status and its body. */
function rawRequest(path, { method = "GET", cookie, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
        const request = http.request({
            host: "127.0.0.1",
            port,
            method,
            path,
            headers: { ...(cookie ? { cookie } : {}), ...headers },
        });
        request.on("upgrade", (response, socket) => {
            socket.destroy();
            resolve({ status: response.statusCode, text: "" });
        });
        request.on("response", (response) => {
            let text = "";
            response.on("data", (chunk) => (text += chunk.toString("latin1").slice(0, 4000)));
            response.on("end", () => resolve({ status: response.statusCode, text }));
        });
        request.on("error", reject);
        request.setTimeout(20000, () => {
            request.destroy();
            resolve({ status: "timeout", text: "" });
        });
        request.end();
    });
}

const cookies = {};

async function signIn(email) {
    const response = await fetch(`${BASE}/api/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "shockwave" }),
    });
    if (!response.ok) throw new Error(`signing in as ${email}: ${response.status}`);
    cookies[email] = response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
    return clientWith(cookies[email]);
}

// ── Two tenants ─────────────────────────────────────────────────────────────────

const larchmereEmails = {
    admin: "maya.patel@larchmere.example",
    reviewer: "colin.okafor@larchmere.example",
    manager: "sam.hughes@larchmere.example",
    member: "ryan.brooks@larchmere.example",
};
const northwindEmails = {
    admin: "ada@northwind.example",
    reviewer: "rita@northwind.example",
    manager: "mark@northwind.example",
    member: "nina@northwind.example",
};

// The app can't make a tenant, so the second is written straight into its tables.
const setup = new DatabaseSync(dbFile);
setup.exec("PRAGMA foreign_keys = ON");
const { password_hash: hash, tenant_id: tenantA } = setup
    .prepare("SELECT password_hash, tenant_id FROM users WHERE email = ?")
    .get(larchmereEmails.admin);
const tenantB = randomUUID();
setup
    .prepare(
        `INSERT INTO tenants (id, name, brand_color, logo, logo_type, logo_changed_at)
        VALUES (?, 'Northwind', '#7a1f1f', ?, 'image/png', 1)`,
    )
    .run(tenantB, PNG);
const northwindIds = {};
for (const [role, email] of Object.entries(northwindEmails)) {
    northwindIds[role] = randomUUID();
    setup
        .prepare(
            `INSERT INTO users (tenant_id, id, email, password_hash, name, title, role)
            VALUES (?, ?, ?, ?, ?, 'Northwind title', ?)`,
        )
        .run(tenantB, northwindIds[role], email, hash, `Northwind ${role}`, role);
}
setup.close();

const larchmere = {};
for (const [role, email] of Object.entries(larchmereEmails)) larchmere[role] = await signIn(email);
const northwind = {};
for (const [role, email] of Object.entries(northwindEmails)) northwind[role] = await signIn(email);

const idOfSelf = async (client) => (await client("GET", "/api/session")).data.user.id;
const larchmereIds = {};
for (const [role, client] of Object.entries(larchmere)) larchmereIds[role] = await idOfSelf(client);

/** Everything a tenant can hold, so that every table has rows to attack: what's made, by id. */
async function buildTenant(people, ids, marker) {
    const { admin, reviewer, manager, member } = people;
    const folder = (await admin("POST", "/api/folders", { name: `${marker} folder`, parentId: null })).data.folder;
    const upload = async (name, file) => {
        const path = `/api/assets?name=${encodeURIComponent(name)}&folder=${folder.id}`;
        const answer = await admin("POST", path, undefined, readFileSync(join(samples, file)));
        if (answer.status !== 201) throw new Error(`uploading ${name}: ${answer.text}`);
        return answer.data.asset;
    };
    const deck = await upload(`${marker} deck`, "pptx/james-webb-space-telescope.pptx");
    const draft = await upload(`${marker} draft`, "docx/nasa-artemis-status-report.docx");
    await admin("POST", `/api/assets/${deck.id}/versions/1/submit`, { reviewerId: ids.reviewer });
    await reviewer("POST", `/api/assets/${deck.id}/versions/1/approve`, {});
    await admin("POST", `/api/assets/${deck.id}/versions/1/publish`, {});
    await admin("POST", `/api/assets/${draft.id}/versions/1/submit`, { reviewerId: ids.reviewer });
    const collection = (await manager("POST", "/api/collections", { name: `${marker} collection` })).data.collection;
    await manager("POST", `/api/collections/${collection.id}/items`, { assetIds: [deck.id] });
    let room = (await member("POST", "/api/deal-rooms", { title: `${marker} room`, description: marker })).data.room;
    await member("PUT", `/api/deal-rooms/${room.id}/banner`, undefined, PNG);
    room = (await member("POST", `/api/deal-rooms/${room.id}/files`, { assetIds: [deck.id] })).data.room;
    const copy = room.files[0].asset;
    room = (await member("PUT", `/api/deal-rooms/${room.id}/frontstage`, { assetIds: [copy.id] })).data.room;
    const token = room.frontstage.token;
    // A buyer, who comes and reads: known by the cookie the first report answers with.
    const reported = await fetch(`${BASE}/api/frontstage/${token}/activity`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "opened", fileId: copy.id }),
    });
    const visitorCookie = reported.headers.getSetCookie()[0].split(";")[0];
    const { session } = await reported.json();
    const buyer = clientWith(visitorCookie);
    // Two pages on screen together, from the same moment.
    const read = await buyer("POST", `/api/frontstage/${token}/activity`, {
        kind: "read",
        session,
        views: [
            { page: 0, from: 0, to: 1000 },
            { page: 1, from: 0, to: 1000 },
        ],
    });
    check(`${marker}: a buyer's pages on screen together are kept`, read.status === 204, read.status);
    return { folder, deck, draft, collection, room, copy, token, visitorCookie, session };
}

console.log("Building two tenants…");
const A = await buildTenant(larchmere, larchmereIds, "LARCHMERE-OWN");
const B = await buildTenant(northwind, northwindIds, "NORTHWIND-SECRET");

const made = () => randomUUID();

/** Every table's rows of `tenant`, and its documents' files: what mustn't move as the other acts. */
function fingerprintOf(tenant) {
    const db = new DatabaseSync(dbFile, { readOnly: true });
    const rows = { tenants: db.prepare("SELECT * FROM tenants WHERE id = ?").all(tenant) };
    for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()) {
        if (["tenants", "sessions"].includes(name) || name.startsWith("sqlite_")) continue;
        rows[name] = db.prepare(`SELECT * FROM ${name} WHERE tenant_id = ? ORDER BY 1, 2, 3`).all(tenant);
    }
    db.close();
    const walk = (dir) =>
        existsSync(dir)
            ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
                  entry.isDirectory()
                      ? walk(join(dir, entry.name))
                      : [`${join(dir, entry.name)}:${statSync(join(dir, entry.name)).size}`],
              )
            : [];
    // An edit log is rewritten as a document's session closes, whoever's asking.
    const files = walk(join(dataDir, "udoc", tenant))
        .filter((file) => !file.includes("crdt_delta"))
        .sort();
    const plain = (_key, value) =>
        value instanceof Uint8Array
            ? createHash("sha1").update(value).digest("hex")
            : typeof value === "bigint"
              ? String(value)
              : value;
    return createHash("sha1").update(JSON.stringify(rows, plain)).update(JSON.stringify(files)).digest("hex");
}

const northwindBefore = fingerprintOf(tenantB);
const secrets = [
    "NORTHWIND",
    "Northwind",
    "northwind.example",
    tenantB,
    B.folder.id,
    B.deck.id,
    B.draft.id,
    B.collection.id,
    B.room.id,
    B.copy.id,
    B.deck.documentId,
    B.draft.documentId,
    B.copy.documentId,
    B.token,
    B.session,
    ...Object.values(northwindIds),
];
const leaked = (text) => secrets.filter((secret) => text.includes(secret));

// ── 1. Every route ──────────────────────────────────────────────────────────────

/** A route with another tenant's ids in it: `ids` fills in its `:names`, from `x`, the ids to use. */
const probe = (method, route, ids, extra = {}) => ({ method, route, ids, ...extra });

const versionProbes = (file) => [
    probe("GET", "/api/assets/:id", (x) => ({ id: x[file] })),
    probe("GET", "/api/assets/:id/versions", (x) => ({ id: x[file] })),
    probe("POST", "/api/assets/:id/versions", (x) => ({ id: x[file] }), { body: { note: "taken" } }),
    probe("GET", "/api/thumbnails/:assetId/:number/:page", (x) => ({ assetId: x[file], number: 1, page: 0 })),
    ...["submit", "approve", "return", "publish", "reassign", "dismiss"].map((step) =>
        probe("POST", `/api/assets/:id/versions/:number/${step}`, (x) => ({ id: x[file], number: 1 }), {
            body: { note: "taken", reviewerId: larchmereIds.reviewer },
        }),
    ),
];

const PROBES = [
    probe("GET", "/api/tenants/:id/logo", (x) => ({ id: x.tenant })),
    probe("PUT", "/api/tenants/:id/logo", (x) => ({ id: x.tenant }), { raw: PNG }),
    probe("DELETE", "/api/tenants/:id/logo", (x) => ({ id: x.tenant })),
    probe("GET", "/api/tenants/:id/users", (x) => ({ id: x.tenant })),
    probe("PATCH", "/api/tenants/:id", (x) => ({ id: x.tenant }), { body: { brandColor: "#000000" } }),
    probe("GET", "/api/library", () => ({}), { query: (x) => `folder=${x.folder}` }),
    probe("PATCH", "/api/folders/:id", (x) => ({ id: x.folder }), { body: { name: "taken" } }),
    probe("DELETE", "/api/folders/:id", (x) => ({ id: x.folder })),
    probe("POST", "/api/assets", () => ({}), { query: (x) => `name=taken&folder=${x.folder}`, raw: PNG }),
    probe("PATCH", "/api/assets/:id", (x) => ({ id: x.asset }), { body: { name: "taken" } }),
    probe("DELETE", "/api/assets/:id", (x) => ({ id: x.asset })),
    ...versionProbes("asset"),
    ...versionProbes("copy"),
    probe("GET", "/api/collections/:id", (x) => ({ id: x.collection })),
    probe("PATCH", "/api/collections/:id", (x) => ({ id: x.collection }), { body: { name: "taken" } }),
    probe("DELETE", "/api/collections/:id", (x) => ({ id: x.collection })),
    probe("POST", "/api/collections/:id/items", (x) => ({ id: x.collection }), { body: { assetIds: [] } }),
    probe("PATCH", "/api/collections/:id/items/:assetId", (x) => ({ id: x.collection, assetId: x.asset }), {
        body: { instructions: "taken" },
    }),
    probe("DELETE", "/api/collections/:id/items/:assetId", (x) => ({ id: x.collection, assetId: x.asset })),
    probe("PUT", "/api/collections/:id/order", (x) => ({ id: x.collection }), { body: { assetIds: [] } }),
    probe("GET", "/api/deal-rooms/:id", (x) => ({ id: x.room })),
    probe("PATCH", "/api/deal-rooms/:id", (x) => ({ id: x.room }), { body: { title: "taken" } }),
    probe("DELETE", "/api/deal-rooms/:id", (x) => ({ id: x.room })),
    probe("GET", "/api/deal-rooms/:id/banner", (x) => ({ id: x.room })),
    probe("PUT", "/api/deal-rooms/:id/banner", (x) => ({ id: x.room }), { raw: PNG }),
    probe("DELETE", "/api/deal-rooms/:id/banner", (x) => ({ id: x.room })),
    probe("PUT", "/api/deal-rooms/:id/people", (x) => ({ id: x.room }), { body: { userIds: [] } }),
    probe("POST", "/api/deal-rooms/:id/files", (x) => ({ id: x.room }), { body: { assetIds: [] } }),
    probe("GET", "/api/deal-rooms/:id/files/:assetId", (x) => ({ id: x.room, assetId: x.copy })),
    probe("PATCH", "/api/deal-rooms/:id/files/:assetId", (x) => ({ id: x.room, assetId: x.copy }), {
        body: { name: "taken" },
    }),
    probe("DELETE", "/api/deal-rooms/:id/files/:assetId", (x) => ({ id: x.room, assetId: x.copy })),
    probe("PUT", "/api/deal-rooms/:id/order", (x) => ({ id: x.room }), { body: { assetIds: [] } }),
    probe("PUT", "/api/deal-rooms/:id/frontstage", (x) => ({ id: x.room }), { body: { assetIds: [made()] } }),
    probe("DELETE", "/api/deal-rooms/:id/frontstage", (x) => ({ id: x.room })),
    probe("GET", "/api/deal-rooms/:id/activity", (x) => ({ id: x.room })),
    probe("GET", "/api/deal-rooms/:id/activity/files/:assetId", (x) => ({ id: x.room, assetId: x.copy })),
    // Larchmere's own room, naming Northwind's file and session.
    probe("GET", "/api/deal-rooms/:id/activity/files/:assetId", (x) => ({ id: A.room.id, assetId: x.copy })),
    probe("GET", "/api/deal-rooms/:id/activity/sessions/:sessionId", (x) => ({ id: x.room, sessionId: x.session })),
    probe("GET", "/api/deal-rooms/:id/activity/sessions/:sessionId", (x) => ({
        id: A.room.id,
        sessionId: x.session,
    })),
    probe("POST", "/api/deal-rooms/:id/activity/seen", (x) => ({ id: x.room })),
    // Larchmere's own link, naming what's Northwind's.
    probe("GET", "/api/frontstage/:token/thumbnails/:assetId/:number/:page", (x) => ({
        token: A.token,
        assetId: x.copy,
        number: 1,
        page: 0,
    })),
    probe("POST", "/api/frontstage/:token/activity", () => ({ token: A.token }), {
        body: (x) => ({ kind: "opened", fileId: x.copy }),
    }),
    probe("POST", "/api/frontstage/:token/activity", () => ({ token: A.token }), {
        body: (x) => ({ kind: "read", session: x.session, views: [{ page: 0, from: 0, to: 1000 }] }),
    }),
];

/** The routes no id of another tenant goes in, or that a part of their own below attacks. */
const ELSEWHERE = {
    "GET /api/session": "a list, in part 3",
    "POST /api/session": "what gives a tenant away, in part 6",
    "DELETE /api/session": "ends the session it's given, and no other",
    "GET /api/library/recent": "a list, in part 3",
    "GET /api/library/attention": "a list, in part 3",
    "GET /api/library/reviewers": "a list, in part 3",
    "GET /api/collections": "a list, in part 3",
    "GET /api/published-files": "a list, in part 3",
    "GET /api/deal-rooms": "a list, in part 3",
    "GET /api/deal-rooms/sellers": "a list, in part 3",
    "GET /api/deal-rooms/news": "a list, in part 3",
    "POST /api/folders": "takes a parent, in part 2",
    "POST /api/collections": "makes one, and the names of two tenants' are apart, in part 6",
    "POST /api/deal-rooms": "makes one, of the signed-in user's tenant",
    "GET /api/frontstage/:token": "a link's, which answers its own tenant's, in part 5",
    "GET /api/frontstage/:token/banner": "a link's, which answers its own tenant's, in part 5",
    "GET /api/frontstage/:token/logo": "a link's, which answers its own tenant's, in part 5",
};

const fill = (route, ids) =>
    route.replace(/:(\w+)/g, (_match, name) => {
        if (!(name in ids)) throw new Error(`${route} has no value for :${name}`);
        return ids[name];
    });

const ROLES = Object.keys(larchmere);

console.log("1. Every route, with Northwind's ids, as each of Larchmere's roles");
{
    // What the server's source declares has to be probed here.
    const declared = [];
    for (const name of readdirSync(join(serverDir, "routes"))) {
        const source = readFileSync(join(serverDir, "routes", name), "utf8");
        const steps = [...source.matchAll(/^\s+(\w+): \{ taker:/gm)].map((match) => match[1]);
        for (const [, method, route] of source.matchAll(
            /app\.(get|post|put|patch|delete)(?:<[\s\S]*?>)?\(\s*[`"]([^`"]+)[`"]/g,
        ))
            for (const each of route.includes("${step}")
                ? steps.map((step) => route.replace("${step}", step))
                : [route])
                declared.push(`${method.toUpperCase()} ${each}`);
    }
    const probed = new Set(PROBES.map(({ method, route }) => `${method} ${route}`));
    check("the server's source declares routes, as this reads it", declared.length > 40, declared.length);
    for (const route of declared)
        check(
            `${route} is attacked here: add it to PROBES, or say why not in ELSEWHERE`,
            probed.has(route) || route in ELSEWHERE,
        );
    for (const route of [...probed, ...Object.keys(ELSEWHERE)])
        check(`${route} is still a route`, declared.includes(route));

    const northwindIdsFor = () => ({
        tenant: tenantB,
        folder: B.folder.id,
        asset: B.deck.id,
        copy: B.copy.id,
        collection: B.collection.id,
        room: B.room.id,
        session: B.session,
    });
    const madeUpIds = () => ({
        tenant: made(),
        folder: made(),
        asset: made(),
        copy: made(),
        collection: made(),
        room: made(),
        session: made(),
    });
    let probes = 0;
    for (const role of ROLES) {
        const client = larchmere[role];
        for (const { method, route, ids, query, body, raw } of PROBES) {
            const pathFor = (x) => fill(route, ids(x)) + (query ? `?${query(x)}` : "");
            const bodyFor = (x) => (typeof body === "function" ? body(x) : body);
            const [real, none] = [
                await client(method, pathFor(northwindIdsFor()), bodyFor(northwindIdsFor()), raw),
                await (() => {
                    const x = madeUpIds();
                    return client(method, pathFor(x), bodyFor(x), raw);
                })(),
            ];
            probes++;
            const label = `${role}: ${method} ${route}${query ? "?…" : ""}`;
            check(
                `${label} answers as for an id that isn't there`,
                real.status === none.status && real.text === none.text,
                {
                    real: [real.status, real.text.slice(0, 100)],
                    none: [none.status, none.text.slice(0, 100)],
                },
            );
            check(`${label} shows nothing of Northwind`, leaked(real.text).length === 0, leaked(real.text));
        }
    }
    console.log(`   ${probes} probes`);
    check("Northwind hasn't moved", fingerprintOf(tenantB) === northwindBefore);
}

// ── 2. The other's ids in one's own requests ────────────────────────────────────

console.log("2. Northwind's ids inside Larchmere's own requests");
{
    const { admin, manager, member } = larchmere;
    const attempts = [
        ["a folder in Northwind's folder", admin, "POST", "/api/folders", { name: "x", parentId: B.folder.id }],
        [
            "a version to Northwind's reviewer",
            admin,
            "POST",
            `/api/assets/${A.draft.id}/versions/1/reassign`,
            {
                reviewerId: northwindIds.reviewer,
            },
        ],
        [
            "Northwind's file in a collection",
            manager,
            "POST",
            `/api/collections/${A.collection.id}/items`,
            {
                assetIds: [B.deck.id],
            },
        ],
        [
            "Northwind's file in a collection's order",
            manager,
            "PUT",
            `/api/collections/${A.collection.id}/order`,
            {
                assetIds: [B.deck.id],
            },
        ],
        [
            "changing Northwind's file through a collection",
            manager,
            "PATCH",
            `/api/collections/${A.collection.id}/items/${B.deck.id}`,
            { instructions: "x" },
        ],
        [
            "removing Northwind's file through a collection",
            manager,
            "DELETE",
            `/api/collections/${A.collection.id}/items/${B.deck.id}`,
        ],
        ["Northwind's file in a room", member, "POST", `/api/deal-rooms/${A.room.id}/files`, { assetIds: [B.deck.id] }],
        [
            "Northwind's seller on a room",
            member,
            "PUT",
            `/api/deal-rooms/${A.room.id}/people`,
            {
                userIds: [larchmereIds.member, northwindIds.member],
            },
        ],
        ["reading Northwind's copy through a room", member, "GET", `/api/deal-rooms/${A.room.id}/files/${B.copy.id}`],
        [
            "changing Northwind's copy through a room",
            member,
            "PATCH",
            `/api/deal-rooms/${A.room.id}/files/${B.copy.id}`,
            {
                name: "x",
            },
        ],
        [
            "deleting Northwind's copy through a room",
            member,
            "DELETE",
            `/api/deal-rooms/${A.room.id}/files/${B.copy.id}`,
        ],
        [
            "Northwind's copy in a room's order",
            member,
            "PUT",
            `/api/deal-rooms/${A.room.id}/order`,
            { assetIds: [B.copy.id] },
        ],
        [
            "Northwind's copy on a frontstage",
            member,
            "PUT",
            `/api/deal-rooms/${A.room.id}/frontstage`,
            {
                assetIds: [B.copy.id],
            },
        ],
    ];
    for (const [label, client, method, path, body] of attempts) {
        const answer = await client(method, path, body);
        check(`refused: ${label}`, answer.status >= 400, [answer.status, answer.text.slice(0, 120)]);
        check(`nothing of Northwind in the answer: ${label}`, leaked(answer.text).length === 0, leaked(answer.text));
    }
    const room = (await member("GET", `/api/deal-rooms/${A.room.id}`)).data.room;
    check(
        "Larchmere's room is as it was",
        room.people.every(({ id }) => id !== northwindIds.member),
    );
    check("Northwind hasn't moved", fingerprintOf(tenantB) === northwindBefore);
}

// ── 3. Every list ───────────────────────────────────────────────────────────────

console.log("3. Every list Larchmere can read");
{
    const lists = [
        "/api/session",
        "/api/library",
        "/api/library/recent",
        "/api/library/attention",
        "/api/library/reviewers",
        "/api/collections",
        "/api/published-files",
        "/api/deal-rooms",
        "/api/deal-rooms/sellers",
        "/api/deal-rooms/news",
        `/api/deal-rooms/${A.room.id}/activity`,
        `/api/deal-rooms/${A.room.id}/activity/files/${A.copy.id}`,
        `/api/deal-rooms/${A.room.id}/activity/sessions/${A.session}`,
        `/api/tenants/${tenantA}/users`,
    ];
    for (const role of ROLES)
        for (const path of lists) {
            const answer = await larchmere[role]("GET", path);
            check(`${role}: ${path} shows nothing of Northwind`, leaked(answer.text).length === 0, leaked(answer.text));
        }
}

// ── 4. The gate ─────────────────────────────────────────────────────────────────

console.log("4. The gate");
{
    const suffixes = [
        "",
        "/original",
        "/layout/page-count",
        "/layout/pages.pdf",
        "/layout/pages/0.png",
        "/layout/pages/0.svg",
        "/file.pptx",
        "/file.pdf",
        "/file.udoc",
        "/checkpoints",
        "/checkpoints/0/package",
        "/checkpoints/0/package/crdt",
        "/checkpoints/0/file.pptx",
        "/package",
        "/package/crdt",
        "/package/cuts",
        "/package/batch",
    ];
    const upgrade = {
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": "13",
        "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
    };
    for (const role of ROLES) {
        const cookie = cookies[larchmereEmails[role]];
        for (const document of [B.deck.documentId, B.copy.documentId, B.draft.documentId]) {
            for (const suffix of suffixes) {
                const real = await rawRequest(`/udoc/documents/${document}${suffix}`, { cookie });
                const none = await rawRequest(`/udoc/documents/${made()}${suffix}`, { cookie });
                check(
                    `${role}: GET Northwind's document${suffix} answers as for none`,
                    real.status === none.status && real.text === none.text,
                    [real.status, none.status],
                );
            }
            for (const [method, suffix] of [
                ["DELETE", ""],
                ["POST", "/checkpoints"],
            ]) {
                const answer = await rawRequest(`/udoc/documents/${document}${suffix}`, { method, cookie });
                check(
                    `${role}: ${method} Northwind's document${suffix} is refused`,
                    answer.status >= 400,
                    answer.status,
                );
            }
            const joined = await rawRequest(`/udoc/documents/${document}/collaboration`, { cookie, headers: upgrade });
            check(`${role}: joining Northwind's collaboration is refused`, joined.status === 403, joined.status);
        }
    }
    const buyerJoined = await rawRequest(`/udoc/documents/${B.deck.documentId}/collaboration`, { headers: upgrade });
    check("no one signed in joins Northwind's collaboration", buyerJoined.status === 403, buyerJoined.status);

    // The gate and the server each parse a path: neither may be led to read another's document.
    const a = A.deck.documentId;
    const b = B.deck.documentId;
    const stage = `/udoc/frontstage/${A.token}/files/${A.copy.id}/versions/1/package`;
    const tricks = [
        `/udoc/documents/${a}/../${b}/package`,
        `/udoc/documents/${a}/%2e%2e/${b}/package`,
        `/udoc/documents/${a}/.%2e/${b}/package`,
        `/udoc/documents/${a}/%2E%2E/${b}/package`,
        `/udoc/documents/${a}%2f..%2f${b}/package`,
        `/udoc/documents/${a}/..%2f${b}/package`,
        `/udoc/documents/${a}%2F..%2F${b}/package`,
        `/udoc/documents/${a}\\..\\${b}/package`,
        `/udoc/documents/${a}/..\\${b}/package`,
        `/udoc//documents/${b}/package`,
        `/udoc/documents//${b}/package`,
        `//udoc/documents/${b}/package`,
        `/udoc/./documents/${b}/package`,
        `/udoc/documents/./${b}/package`,
        `/udoc/documents/${b};a=${a}/package`,
        `/udoc/documents/${a};/../${b}/package`,
        `/udoc/documents/${b}%00/package`,
        `/UDOC/documents/${b}/package`,
        `/udoc/DOCUMENTS/${b}/package`,
        `/udoc/documents/${a}/package/../../${b}/package`,
        `/udoc/documents/${a}/package/..%2f..%2f${b}%2fpackage`,
        `/udoc/documents/${a}/checkpoints/0/../../../${b}/package`,
        `/udoc/frontstage/${A.token}/files/${B.copy.id}/versions/1/package`,
        `/udoc/frontstage/${B.token}x/files/${B.copy.id}/versions/1/package`,
        `${stage}/../../../../../../documents/${b}/package`,
        `${stage}/..%2f..%2f..%2f..%2f${b}%2fpackage`,
        `${stage}/%2e%2e/%2e%2e/%2e%2e/%2e%2e/${b}/package`,
    ];
    const name = (path) =>
        path
            .replaceAll(a, "<A>")
            .replaceAll(b, "<B>")
            .replaceAll(A.token, "<tokenA>")
            .replaceAll(B.token, "<tokenB>")
            .replaceAll(B.copy.id, "<copyB>")
            .replaceAll(A.copy.id, "<copyA>");
    const asWho = [
        ["admin", cookies[larchmereEmails.admin]],
        ["manager", cookies[larchmereEmails.manager]],
        ["no one", undefined],
    ];
    for (const trick of tricks)
        for (const [who, cookie] of asWho) {
            const answer = await rawRequest(trick, { cookie });
            check(`${who}: ${name(trick)} doesn't read Northwind's`, answer.status !== 200, [
                answer.status,
                answer.text.slice(0, 80),
            ]);
        }
    check("Northwind hasn't moved", fingerprintOf(tenantB) === northwindBefore);
}

// ── 5. A frontstage's link ──────────────────────────────────────────────────────

console.log("5. Frontstages");
{
    const buyer = clientWith();
    const own = await buyer("GET", `/api/frontstage/${A.token}`);
    check(
        "Larchmere's frontstage shows nothing of Northwind",
        own.status === 200 && leaked(own.text).length === 0,
        leaked(own.text),
    );
    const theirs = await buyer("GET", `/api/frontstage/${B.token}`);
    check(
        "Northwind's frontstage works, so that these mean something",
        theirs.status === 200 && theirs.data.from.name === "Northwind",
    );
    const larchmereSecrets = [
        "LARCHMERE",
        "Larchmere",
        "larchmere.example",
        tenantA,
        A.deck.id,
        A.copy.id,
        A.deck.documentId,
        A.copy.documentId,
    ];
    const seen = larchmereSecrets.filter((secret) => theirs.text.includes(secret));
    check("and shows nothing of Larchmere", seen.length === 0, seen);
    const asLarchmere = await larchmere.admin("GET", `/api/frontstage/${B.token}`);
    check("a Larchmere user at Northwind's link sees just what a buyer does", asLarchmere.text === theirs.text);
    for (const part of ["banner", "logo"]) {
        const answer = await buyer("GET", `/api/frontstage/${made()}/${part}`);
        check(`no link, no ${part}`, answer.status === 404, answer.status);
    }
}

// ── 6. What gives a tenant away ─────────────────────────────────────────────────

console.log("6. What gives a tenant away");
{
    const folder = await larchmere.admin("POST", "/api/folders", { name: "NORTHWIND-SECRET folder", parentId: null });
    check("a folder can take a name Northwind's has", folder.status === 201, folder.text.slice(0, 100));
    const collection = await larchmere.manager("POST", "/api/collections", { name: "NORTHWIND-SECRET collection" });
    check("a collection can take a name Northwind's has", collection.status === 201, collection.text.slice(0, 100));

    const signInTime = async (email) => {
        const times = [];
        for (let i = 0; i < 12; i++) {
            const started = performance.now();
            await fetch(`${BASE}/api/session`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, password: "not-the-password" }),
            });
            times.push(performance.now() - started);
        }
        return times.sort((x, y) => x - y)[6];
    };
    const known = await signInTime(northwindEmails.admin);
    const unknown = await signInTime("nobody@nowhere.example");
    console.log(
        `   signing in with a wrong password: ${known.toFixed(1)} ms with an email that exists, ${unknown.toFixed(1)} ms with one that doesn't`,
    );
    check(
        "signing in takes as long for an email no one has",
        Math.abs(known - unknown) < Math.max(known, unknown) * 0.3,
        { known, unknown },
    );
    const anyone = clientWith();
    const wrong = await anyone("POST", "/api/session", { email: northwindEmails.admin, password: "x" });
    const noOne = await anyone("POST", "/api/session", { email: "nobody@nowhere.example", password: "x" });
    check("and answers the same", wrong.status === noOne.status && wrong.text === noOne.text);

    // A browser keeps an image, and asks each time whether it still may.
    const thumbnail = `/api/thumbnails/${B.deck.id}/1/0`;
    const kept = await fetch(BASE + thumbnail, { headers: { cookie: cookies[northwindEmails.admin] } });
    await kept.arrayBuffer();
    const etag = kept.headers.get("etag");
    check(
        "an image is kept only to be asked about",
        kept.headers.get("cache-control") === "private, no-cache" && etag,
        kept.headers.get("cache-control"),
    );
    const again = await fetch(BASE + thumbnail, {
        headers: { cookie: cookies[northwindEmails.admin], "if-none-match": etag },
    });
    check("its own tenant hears it's unchanged", again.status === 304, again.status);
    const other = await fetch(BASE + thumbnail, {
        headers: { cookie: cookies[larchmereEmails.admin], "if-none-match": etag },
    });
    check("the other, on that browser, is refused", other.status === 404, other.status);
}

// ── 7. What the schema refuses ──────────────────────────────────────────────────

/** A row of Larchmere's that refers to something of Northwind's, for each reference there is. */
const CROSSINGS = {
    "sessions.user_id": `INSERT INTO sessions (id, tenant_id, user_id, expires_at) VALUES ('${made()}', '${tenantA}', '${northwindIds.admin}', 1)`,
    "folders.parent_id": `INSERT INTO folders (tenant_id, id, parent_id, name, created_at) VALUES ('${tenantA}', '${made()}', '${B.folder.id}', 'x', 1)`,
    "assets.folder_id": `UPDATE assets SET folder_id = '${B.folder.id}' WHERE tenant_id = '${tenantA}' AND id = '${A.deck.id}'`,
    "assets.uploaded_by": `UPDATE assets SET uploaded_by = '${northwindIds.admin}' WHERE tenant_id = '${tenantA}' AND id = '${A.deck.id}'`,
    "versions.asset_id": `INSERT INTO versions (tenant_id, asset_id, number, checkpoint, status) VALUES ('${tenantA}', '${B.deck.id}', 99, 0, 'draft')`,
    "versions.reviewer_id": `UPDATE versions SET reviewer_id = '${northwindIds.reviewer}' WHERE tenant_id = '${tenantA}' AND asset_id = '${A.deck.id}'`,
    "version_events.asset_id": `INSERT INTO version_events (tenant_id, asset_id, number, kind, user_id, at) VALUES ('${tenantA}', '${B.deck.id}', 1, 'saved', '${larchmereIds.admin}', 1)`,
    "version_events.user_id": `INSERT INTO version_events (tenant_id, asset_id, number, kind, user_id, at) VALUES ('${tenantA}', '${A.deck.id}', 1, 'saved', '${northwindIds.admin}', 1)`,
    "version_events.to_user_id": `INSERT INTO version_events (tenant_id, asset_id, number, kind, user_id, to_user_id, at) VALUES ('${tenantA}', '${A.deck.id}', 1, 'saved', '${larchmereIds.admin}', '${northwindIds.admin}', 1)`,
    "thumbnails.asset_id": `INSERT INTO thumbnails (tenant_id, asset_id, number, page, png) VALUES ('${tenantA}', '${B.deck.id}', 1, 0, x'00')`,
    "collection_items.collection_id": `INSERT INTO collection_items (tenant_id, collection_id, asset_id, position) VALUES ('${tenantA}', '${B.collection.id}', '${A.deck.id}', 9)`,
    "collection_items.asset_id": `INSERT INTO collection_items (tenant_id, collection_id, asset_id, position) VALUES ('${tenantA}', '${A.collection.id}', '${B.deck.id}', 9)`,
    "deal_room_people.room_id": `INSERT INTO deal_room_people (tenant_id, room_id, user_id) VALUES ('${tenantA}', '${B.room.id}', '${larchmereIds.admin}')`,
    "deal_room_people.user_id": `INSERT INTO deal_room_people (tenant_id, room_id, user_id) VALUES ('${tenantA}', '${A.room.id}', '${northwindIds.member}')`,
    "deal_room_files.room_id": `INSERT INTO deal_room_files (tenant_id, asset_id, room_id, position, source_name, source_version) VALUES ('${tenantA}', '${A.draft.id}', '${B.room.id}', 9, 'x', 1)`,
    "deal_room_files.asset_id": `INSERT INTO deal_room_files (tenant_id, asset_id, room_id, position, source_name, source_version) VALUES ('${tenantA}', '${B.draft.id}', '${A.room.id}', 9, 'x', 1)`,
    "deal_room_files.source_asset_id": `UPDATE deal_room_files SET source_asset_id = '${B.deck.id}' WHERE tenant_id = '${tenantA}' AND asset_id = '${A.copy.id}'`,
    "frontstages.room_id": `INSERT INTO frontstages (tenant_id, room_id, token, title, staged_by, staged_at) VALUES ('${tenantA}', '${B.room.id}', '${made()}', 'x', '${larchmereIds.member}', 1)`,
    "frontstages.staged_by": `UPDATE frontstages SET staged_by = '${northwindIds.member}' WHERE tenant_id = '${tenantA}' AND room_id = '${A.room.id}'`,
    "frontstage_files.room_id": `INSERT INTO frontstage_files (tenant_id, room_id, asset_id, name, position) VALUES ('${tenantA}', '${B.room.id}', '${A.copy.id}', 'x', 9)`,
    "frontstage_files.asset_id": `INSERT INTO frontstage_files (tenant_id, room_id, asset_id, name, position) VALUES ('${tenantA}', '${A.room.id}', '${B.copy.id}', 'x', 9)`,
    "frontstage_visitors.room_id": `INSERT INTO frontstage_visitors (tenant_id, room_id, id, first_at, last_at) VALUES ('${tenantA}', '${B.room.id}', '${made()}', 1, 1)`,
    "frontstage_sessions.room_id": `INSERT INTO frontstage_sessions (tenant_id, room_id, visitor_id, id, asset_id, version, started_at) VALUES ('${tenantA}', '${B.room.id}', '${made()}', '${made()}', '${A.copy.id}', 1, 1)`,
    "frontstage_sessions.asset_id": `UPDATE frontstage_sessions SET asset_id = '${B.copy.id}' WHERE tenant_id = '${tenantA}'`,
    "frontstage_page_views.session_id": `INSERT INTO frontstage_page_views (tenant_id, session_id, started_ms, ended_ms, page) VALUES ('${tenantA}', '${B.session}', 99, 100, 0)`,
};

/** What keys on something else than its tenant: a session's token, and an event's row number. */
const KEYED_ALONE = ["sessions", "version_events"];

console.log("7. What the schema refuses, with foreign keys on");
const tablesDb = new DatabaseSync(dbFile);
tablesDb.exec("PRAGMA foreign_keys = ON");
const tables = tablesDb
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map(({ name }) => name);
const owned = tables.filter((name) => name !== "tenants");
{
    const references = new Set();
    for (const table of owned) {
        const columns = tablesDb.prepare(`PRAGMA table_info(${table})`).all();
        const tenantColumn = columns.find(({ name }) => name === "tenant_id");
        check(`${table} names its tenant, and has to`, tenantColumn?.notnull === 1);
        const key = columns
            .filter(({ pk }) => pk > 0)
            .sort((x, y) => x.pk - y.pk)
            .map(({ name }) => name);
        if (!KEYED_ALONE.includes(table)) check(`${table}'s key starts with its tenant`, key[0] === "tenant_id", key);
        const foreignKeys = {};
        for (const key of tablesDb.prepare(`PRAGMA foreign_key_list(${table})`).all())
            (foreignKeys[key.id] ??= { target: key.table, pairs: [] }).pairs.push([key.from, key.to]);
        for (const { target, pairs } of Object.values(foreignKeys)) {
            const columnsOf = pairs.map(([from]) => from);
            if (target === "tenants") {
                check(`${table} refers to tenants by tenant_id`, columnsOf.join() === "tenant_id", pairs);
                continue;
            }
            check(
                `${table} → ${target} (${columnsOf.join(", ")}) carries the tenant`,
                pairs.some(([from, to]) => from === "tenant_id" && to === "tenant_id"),
                pairs,
            );
            // Which reference this is: the column it adds, past the tenant and a version's number.
            const column = columnsOf.find((name) => name !== "tenant_id" && name !== "number");
            references.add(`${table}.${column}`);
        }
    }
    for (const reference of references)
        check(`${reference} is attempted here: add it to CROSSINGS`, reference in CROSSINGS);
    for (const [reference, statement] of Object.entries(CROSSINGS)) {
        check(`${reference} is still a reference`, references.has(reference));
        tablesDb.exec("BEGIN");
        let refused = false;
        try {
            tablesDb.exec(statement);
        } catch {
            refused = true;
        }
        tablesDb.exec("ROLLBACK");
        check(`the schema refuses ${reference} to another tenant`, refused);
    }
    console.log(`   ${owned.length} tables, ${references.size} references`);
}

// ── 8. What the source reads ────────────────────────────────────────────────────

console.log("8. The source");
{
    const fileNames = [
        ...readdirSync(serverDir)
            .filter((name) => name.endsWith(".ts"))
            .map((name) => join(serverDir, name)),
        ...readdirSync(join(serverDir, "routes")).map((name) => join(serverDir, "routes", name)),
    ];
    const relative = (file) => file.replace(`${serverDir}/`, "");
    const holders = fileNames.filter((file) => readFileSync(file, "utf8").includes("DatabaseSync")).map(relative);
    check(
        "only what says which tenant a request is for holds the database itself",
        holders.sort().join() === "auth.ts,db.ts,scope.ts,seed.ts,udoc.ts",
        holders,
    );

    const { TenantDb } = await import(join(serverDir, "db.ts"));
    const memory = new DatabaseSync(":memory:");
    memory.exec("CREATE TABLE t (tenant_id TEXT, x TEXT); INSERT INTO t VALUES ('a', '1'), ('b', '2')");
    const scoped = new TenantDb(memory, "a");
    let thrown = false;
    try {
        scoped.prepare("SELECT * FROM t");
    } catch {
        thrown = true;
    }
    check("TenantDb refuses a statement that doesn't name its tenant", thrown);
    const select = "SELECT x FROM t WHERE tenant_id = :tenant";
    check(
        "and binds it for one that does",
        scoped
            .prepare(select)
            .all()
            .map(({ x }) => x)
            .join() === "1",
    );
    check(
        "alongside anonymous parameters",
        scoped.prepare(`${select} AND x = ?`).get("1")?.x === "1" &&
            scoped.prepare(`${select} AND x = ?`).get("2") === undefined,
    );
    check("and named ones", scoped.prepare(`${select} AND x = :v`).get({ v: "1" })?.x === "1");
    check(
        "and a named parameter can't change it",
        scoped
            .prepare(select)
            .all({ tenant: "b" })
            .every(({ x }) => x === "1"),
    );
    memory.close();

    // Every table a statement names is tied to its tenant, with what's built into it spelled out.
    const fragment = (file, name) =>
        readFileSync(join(serverDir, file), "utf8").match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`))[1];
    const parts = {
        ASSETS: fragment("assets.ts", "ASSETS"),
        PUBLISHED_FILES: fragment("assets.ts", "PUBLISHED_FILES"),
        PUBLISHED_FILE_COLUMNS: fragment("assets.ts", "PUBLISHED_FILE_COLUMNS"),
        ASSET_COLUMNS: "",
        FILE_COLUMNS: fragment("routes/dealRooms.ts", "FILE_COLUMNS"),
        FILES: fragment("routes/dealRooms.ts", "FILES"),
    };
    const expand = (sql) => {
        let text = sql;
        for (let depth = 0; depth < 3; depth++)
            text = text.replace(/\$\{(\w+)\}/g, (match, name) => parts[name] ?? match);
        return text;
    };
    const named = new RegExp(
        `\\b(?:FROM|JOIN|UPDATE|INTO)\\s+(?:OR \\w+ )?(${owned.join("|")})\\b(?:\\s+AS\\s+(\\w+))?`,
        "g",
    );
    let statements = 0;
    for (const file of fileNames.filter((name) => !/\/(db|auth|seed|scope)\.ts$/.test(name))) {
        for (const match of readFileSync(file, "utf8").matchAll(/prepare\(\s*(?:`([\s\S]*?)`|"([^"]*)")/g)) {
            statements++;
            const sql = expand(match[1] ?? match[2]);
            const label = `${relative(file)}: ${sql.replace(/\s+/g, " ").slice(0, 80)}`;
            check(`names :tenant — ${label}`, /:tenant\b/.test(sql));
            for (const [, table, alias] of sql.matchAll(named))
                check(
                    `${table} is tied to its tenant — ${label}`,
                    sql.includes(`${alias ?? table}.tenant_id`) || /(?<![.\w])tenant_id\b/.test(sql),
                );
        }
    }
    check("the source has statements, as this reads it", statements > 50, statements);
    console.log(`   ${statements} statements`);
}

// ── 9. The wall under the gate ──────────────────────────────────────────────────

console.log("9. The wall under the gate");
const { DirectoryDocumentStore, MAIN_BRANCH } = await import("@docmentis/udoc-server");
const MAIN = { branch: MAIN_BRANCH };
const storeA = new DirectoryDocumentStore(join(dataDir, "udoc", tenantA));
const storeB = new DirectoryDocumentStore(join(dataDir, "udoc", tenantB));
{
    check("Larchmere's store has its document", (await storeA.getDescription(A.deck.documentId, MAIN)) !== undefined);
    check("and not Northwind's", (await storeA.getDescription(B.deck.documentId, MAIN)) === undefined);
    check("Northwind's store has its document", (await storeB.getDescription(B.deck.documentId, MAIN)) !== undefined);
    check("and not Larchmere's", (await storeB.getDescription(A.deck.documentId, MAIN)) === undefined);
    const top = readdirSync(join(dataDir, "udoc"));
    check(
        "the documents' folder holds tenants' folders, and nothing else",
        top.every((name) => [tenantA, tenantB].includes(name)),
        top,
    );
}

// ── 10. What buyers report ──────────────────────────────────────────────────────

console.log("10. What buyers report");
{
    const report = (client, token, body) => client("POST", `/api/frontstage/${token}/activity`, body);
    const reads = () => {
        const db = new DatabaseSync(dbFile, { readOnly: true });
        const count = (table, tenant) =>
            db.prepare(`SELECT count(*) AS n FROM ${table} WHERE tenant_id = ?`).get(tenant).n;
        const counts = {
            a: ["frontstage_visitors", "frontstage_sessions", "frontstage_page_views"]
                .map((table) => count(table, tenantA))
                .join(),
            b: ["frontstage_visitors", "frontstage_sessions", "frontstage_page_views"]
                .map((table) => count(table, tenantB))
                .join(),
        };
        db.close();
        return counts;
    };
    const anyone = clientWith();
    const stageB = (await anyone("GET", `/api/frontstage/${B.token}`)).data;
    const fileB = stageB.files[0].id;

    // A browser known at one link is a stranger at another: its cookie says nothing there.
    const before = reads();
    const visitorB = B.visitorCookie.split("=")[1];
    const answer = await fetch(`${BASE}/api/frontstage/${A.token}/activity`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: B.visitorCookie },
        body: JSON.stringify({ kind: "visited" }),
    });
    check("reporting with another link's cookie is taken as a new browser", answer.status === 204, answer.status);
    const minted = answer.headers.getSetCookie()[0] ?? "";
    check(
        "and answered with a cookie of its own",
        minted.includes("shockwave_visitor=") && !minted.includes(visitorB),
        minted,
    );
    check("for that link alone", minted.includes(`Path=/api/frontstage/${A.token}`), minted);
    const after = reads();
    check("Northwind's visitors don't move", after.b === before.b, { before, after });

    // A file of the other tenant's, through one's own link, is no file at all.
    const beforeFile = reads();
    for (const [label, body, client] of [
        ["opened: Northwind's file", { kind: "opened", fileId: fileB }, anyone],
        [
            "read: Northwind's session, with its own browser's cookie,",
            { kind: "read", session: B.session, views: [{ page: 0, from: 0, to: 5 }] },
            clientWith(B.visitorCookie),
        ],
    ]) {
        const refused = await report(client, A.token, body);
        check(`${label} through Larchmere's link is refused`, refused.status === 404, refused.status);
    }
    check("and nothing's kept, at either tenant", JSON.stringify(reads()) === JSON.stringify(beforeFile));

    // What it can't be made to do.
    const malformed = [
        ["no kind", {}],
        ["an unknown kind", { kind: "pwned" }],
        ["no file", { kind: "opened" }],
        ["no session", { kind: "read", views: [{ page: 0, from: 0, to: 5 }] }],
        ["no views", { kind: "read", session: B.session }],
        ["empty views", { kind: "read", session: B.session, views: [] }],
        ["a negative page", { kind: "read", session: B.session, views: [{ page: -1, from: 0, to: 5 }] }],
        ["a fractional page", { kind: "read", session: B.session, views: [{ page: 1.5, from: 0, to: 5 }] }],
        ["a page too far", { kind: "read", session: B.session, views: [{ page: 100000, from: 0, to: 5 }] }],
        ["a negative start", { kind: "read", session: B.session, views: [{ page: 0, from: -5, to: 5 }] }],
        ["an end before its start", { kind: "read", session: B.session, views: [{ page: 0, from: 10, to: 5 }] }],
        ["no time", { kind: "read", session: B.session, views: [{ page: 0, from: 5, to: 5 }] }],
        ["a fractional time", { kind: "read", session: B.session, views: [{ page: 0, from: 0.5, to: 5 }] }],
        [
            "too many views",
            {
                kind: "read",
                session: B.session,
                views: Array.from({ length: 65 }, (_, page) => ({ page, from: page, to: page + 1 })),
            },
        ],
    ];
    for (const [label, body] of malformed)
        check(`${label} is refused`, (await report(anyone, B.token, body)).status === 400);
    const tooLarge = await report(anyone, B.token, { kind: "visited", padding: "x".repeat(17 * 1024) });
    check("a report too large is refused", tooLarge.status === 413, tooLarge.status);

    // A session is its own browser's, and goes no later than now.
    const beforeSession = reads();
    const view = { kind: "read", session: B.session, views: [{ page: 0, from: 2000, to: 3000 }] };
    const stranger = await report(anyone, B.token, view);
    check("another browser's session is refused", stranger.status === 404, stranger.status);
    const later = await report(clientWith(B.visitorCookie), B.token, {
        kind: "read",
        session: B.session,
        views: [{ page: 0, from: 0, to: 24 * 60 * 60 * 1000 }],
    });
    check("a view that ends after now is refused", later.status === 400, later.status);
    check("and neither is kept", JSON.stringify(reads()) === JSON.stringify(beforeSession));

    // Those at the tenant, opening their own link, aren't buyers. One from elsewhere is.
    const beforeOwn = reads();
    const own = await report(northwind.member, B.token, { kind: "opened", fileId: fileB });
    check(
        "Northwind's own, at its own link, aren't counted",
        own.status === 204 && JSON.stringify(reads()) === JSON.stringify(beforeOwn),
        own.status,
    );
    await report(larchmere.member, B.token, { kind: "visited" });
    check("Larchmere's, at Northwind's link, are as any buyer", reads().b !== beforeOwn.b);

    // Who's told: those on the room, and of their own tenant's visitors.
    const news = await northwind.member("GET", "/api/deal-rooms/news");
    check(
        "those on a room hear of its visitors",
        news.data.rooms.some(({ room }) => room.id === B.room.id),
        news.text.slice(0, 120),
    );
    check(
        "with nothing of the other tenant",
        !["LARCHMERE", "Larchmere", A.room.id].some((secret) => news.text.includes(secret)),
    );
    const seen = await northwind.member("POST", `/api/deal-rooms/${B.room.id}/activity/seen`);
    check(
        "and, having looked, don't again",
        seen.status === 204 &&
            !(await northwind.member("GET", "/api/deal-rooms/news")).data.rooms.some(
                ({ room }) => room.id === B.room.id,
            ),
    );

    // One link's flood slows no other link.
    const limit = clientWith();
    let refused = 0;
    for (let i = 0; i < 130; i++) if ((await report(limit, B.token, { kind: "visited" })).status === 429) refused++;
    check("too many reports at a link are refused", refused > 0, refused);
    const neighbour = await report(limit, A.token, { kind: "visited" });
    check("while another tenant's link isn't slowed", neighbour.status === 204, neighbour.status);
}

// ── 11. The same ids at both tenants ────────────────────────────────────────────

const q = (value) => `'${value}'`;
const assetIdsOf = `(${q(A.deck.id)}, ${q(A.draft.id)}, ${q(A.copy.id)})`;

/** Give Northwind a row with the very id of each of Larchmere's, marked `mark`, and a link at `token`. */
function cloneLarchmereInto(mark, token, documentIdOf) {
    const [a, b] = [q(tenantA), q(tenantB)];
    const db = new DatabaseSync(dbFile);
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(`
        BEGIN;
        INSERT INTO folders (tenant_id, id, parent_id, name, created_at)
            SELECT ${b}, id, NULL, ${q(mark)}, created_at FROM folders WHERE tenant_id = ${a} AND id = ${q(A.folder.id)};
        INSERT INTO assets (tenant_id, id, folder_id, name, format, size, document_id, uploaded_by, uploaded_at, published_version)
            SELECT ${b}, id, folder_id, ${q(mark)}, format, size, ${documentIdOf}, ${q(northwindIds.admin)}, uploaded_at, published_version
            FROM assets WHERE tenant_id = ${a} AND id IN ${assetIdsOf};
        INSERT INTO versions (tenant_id, asset_id, number, checkpoint, status, reviewer_id)
            SELECT ${b}, asset_id, number, checkpoint, status, ${q(northwindIds.reviewer)}
            FROM versions WHERE tenant_id = ${a} AND asset_id IN ${assetIdsOf};
        INSERT INTO version_events (tenant_id, asset_id, number, kind, user_id, at, note)
            SELECT ${b}, asset_id, number, kind, ${q(northwindIds.admin)}, at, ${q(mark)}
            FROM version_events WHERE tenant_id = ${a} AND asset_id IN ${assetIdsOf};
        INSERT INTO thumbnails (tenant_id, asset_id, number, page, png)
            SELECT ${b}, asset_id, number, page, x'89504e47' FROM thumbnails WHERE tenant_id = ${a} AND asset_id IN ${assetIdsOf};
        INSERT INTO collections (tenant_id, id, name, description, updated_at)
            SELECT ${b}, id, ${q(mark)}, ${q(mark)}, updated_at FROM collections WHERE tenant_id = ${a} AND id = ${q(A.collection.id)};
        INSERT INTO collection_items (tenant_id, collection_id, asset_id, position, instructions)
            SELECT ${b}, collection_id, asset_id, position, ${q(mark)}
            FROM collection_items WHERE tenant_id = ${a} AND collection_id = ${q(A.collection.id)};
        INSERT INTO deal_rooms (tenant_id, id, title, description, updated_at)
            SELECT ${b}, id, ${q(mark)}, ${q(mark)}, updated_at FROM deal_rooms WHERE tenant_id = ${a} AND id = ${q(A.room.id)};
        INSERT INTO deal_room_people (tenant_id, room_id, user_id) VALUES (${b}, ${q(A.room.id)}, ${q(northwindIds.member)});
        INSERT INTO deal_room_files (tenant_id, asset_id, room_id, position, description, source_asset_id, source_name, source_version)
            SELECT ${b}, asset_id, room_id, position, ${q(mark)}, source_asset_id, ${q(mark)}, source_version
            FROM deal_room_files WHERE tenant_id = ${a} AND room_id = ${q(A.room.id)};
        INSERT INTO frontstages (tenant_id, room_id, token, title, staged_by, staged_at)
            VALUES (${b}, ${q(A.room.id)}, ${q(token)}, ${q(mark)}, ${q(northwindIds.member)}, 1);
        INSERT INTO frontstage_files (tenant_id, room_id, asset_id, name, position)
            VALUES (${b}, ${q(A.room.id)}, ${q(A.copy.id)}, ${q(mark)}, 0);
        INSERT INTO frontstage_visitors (tenant_id, room_id, id, first_at, last_at)
            SELECT ${b}, room_id, id, first_at, last_at FROM frontstage_visitors WHERE tenant_id = ${a} AND room_id = ${q(A.room.id)};
        INSERT INTO frontstage_sessions (tenant_id, room_id, visitor_id, id, asset_id, version, started_at)
            SELECT ${b}, room_id, visitor_id, id, asset_id, version, started_at
            FROM frontstage_sessions WHERE tenant_id = ${a} AND room_id = ${q(A.room.id)};
        INSERT INTO frontstage_page_views (tenant_id, session_id, started_ms, ended_ms, page)
            SELECT ${b}, session_id, started_ms, started_ms + 999999, page FROM frontstage_page_views
            WHERE tenant_id = ${a} AND session_id IN (
                SELECT id FROM frontstage_sessions WHERE tenant_id = ${a} AND room_id = ${q(A.room.id)}
            );
        COMMIT;
    `);
    db.close();
}

console.log("11. Northwind holds rows with Larchmere's very ids");
{
    for (const table of owned) {
        const rows = tablesDb.prepare(`SELECT tenant_id, count(*) AS n FROM ${table} GROUP BY tenant_id`).all();
        const ofTenant = (tenant) => rows.find(({ tenant_id: id }) => id === tenant)?.n ?? 0;
        check(
            `${table} has rows of both tenants to attack: have buildTenant make some`,
            ofTenant(tenantA) > 0 && ofTenant(tenantB) > 0,
            rows,
        );
    }
    tablesDb.close();

    const reads = [
        "/api/library",
        `/api/library?folder=${A.folder.id}`,
        "/api/library/recent",
        "/api/library/attention",
        `/api/assets/${A.deck.id}`,
        `/api/assets/${A.deck.id}/versions`,
        `/api/assets/${A.draft.id}`,
        `/api/assets/${A.draft.id}/versions`,
        `/api/thumbnails/${A.deck.id}/1/0`,
        "/api/collections",
        `/api/collections/${A.collection.id}`,
        "/api/published-files",
        "/api/deal-rooms",
        `/api/deal-rooms/${A.room.id}`,
        `/api/deal-rooms/${A.room.id}/banner`,
        `/api/deal-rooms/${A.room.id}/files/${A.copy.id}`,
        `/api/deal-rooms/${A.room.id}/activity`,
        `/api/deal-rooms/${A.room.id}/activity/files/${A.copy.id}`,
        `/api/deal-rooms/${A.room.id}/activity/sessions/${A.session}`,
        "/api/deal-rooms/news",
        `/api/assets/${A.copy.id}/versions`,
        `/api/thumbnails/${A.copy.id}/1/0`,
    ];
    const readAll = async (client) => {
        const lines = [];
        for (const path of reads) {
            const answer = await client("GET", path);
            lines.push(`${path} ${answer.status} ${answer.text}`);
        }
        return lines;
    };
    const buyer = clientWith();
    const readsBefore = {};
    for (const role of ROLES) readsBefore[role] = await readAll(larchmere[role]);
    const stageBefore = (await buyer("GET", `/api/frontstage/${A.token}`)).text;

    const mark = "NORTHWIND-CLONE";
    const cloneToken = `clone${made().replaceAll("-", "")}`;
    // A row of Northwind's that names Larchmere's document, which its store hasn't got.
    cloneLarchmereInto(mark, cloneToken, "document_id");

    const sameAsBefore = async (when) => {
        for (const role of ROLES) {
            const lines = await readAll(larchmere[role]);
            lines.forEach((line, i) =>
                check(`${role} reads ${reads[i].slice(0, 40)} the same ${when}`, line === readsBefore[role][i], {
                    before: readsBefore[role][i].slice(0, 160),
                    after: line.slice(0, 160),
                }),
            );
        }
    };
    await sameAsBefore("with Northwind holding those ids");
    check(
        "Larchmere's frontstage reads the same",
        (await buyer("GET", `/api/frontstage/${A.token}`)).text === stageBefore,
    );
    const stage = await buyer("GET", `/api/frontstage/${cloneToken}`);
    check(
        "Northwind's frontstage at that room shows its own",
        stage.status === 200 &&
            stage.text.includes(mark) &&
            !stage.text.includes("LARCHMERE-OWN") &&
            stage.data.from.name === "Northwind",
        stage.text.slice(0, 200),
    );
    const own = [
        ["file", northwind.admin, `/api/assets/${A.deck.id}`],
        ["versions", northwind.admin, `/api/assets/${A.deck.id}/versions`],
        ["collection", northwind.manager, `/api/collections/${A.collection.id}`],
        ["room", northwind.member, `/api/deal-rooms/${A.room.id}`],
        ["room's file", northwind.member, `/api/deal-rooms/${A.room.id}/files/${A.copy.id}`],
        ["room's activity", northwind.member, `/api/deal-rooms/${A.room.id}/activity`, "999"],
        ["room's file's activity", northwind.member, `/api/deal-rooms/${A.room.id}/activity/files/${A.copy.id}`, "999"],
        ["room's session", northwind.member, `/api/deal-rooms/${A.room.id}/activity/sessions/${A.session}`, "999"],
        ["folder", northwind.admin, `/api/library?folder=${A.folder.id}`],
    ];
    for (const [label, client, path, marked = mark] of own) {
        const answer = await client("GET", path);
        check(
            `Northwind reads its own ${label} at that id`,
            answer.status === 200 && answer.text.includes(marked) && !answer.text.includes("LARCHMERE-OWN"),
            [answer.status, answer.text.slice(0, 160)],
        );
    }
    const cookie = cookies[northwindEmails.admin];
    for (const suffix of ["package", "original"]) {
        const answer = await rawRequest(`/udoc/documents/${A.deck.documentId}/${suffix}`, { cookie });
        check(
            `a row naming Larchmere's document gets Northwind no ${suffix}: its store hasn't got it`,
            answer.status === 404,
            [answer.status, answer.text.slice(0, 100)],
        );
    }

    /** What changes every row at those ids, by a tenant's people: each must leave the other's alone. */
    const changes = (people, ids, name) => [
        ["renames its folder", people.admin, "PATCH", `/api/folders/${A.folder.id}`, { name }],
        ["renames its file", people.admin, "PATCH", `/api/assets/${A.deck.id}`, { name }],
        [
            "changes its collection",
            people.manager,
            "PATCH",
            `/api/collections/${A.collection.id}`,
            { name, description: "x", instructions: "x" },
        ],
        [
            "changes a collection's item",
            people.manager,
            "PATCH",
            `/api/collections/${A.collection.id}/items/${A.deck.id}`,
            { instructions: name },
        ],
        [
            "orders its collection",
            people.manager,
            "PUT",
            `/api/collections/${A.collection.id}/order`,
            { assetIds: [A.deck.id] },
        ],
        [
            "changes its room",
            people.member,
            "PATCH",
            `/api/deal-rooms/${A.room.id}`,
            { title: name, description: "x", bannerColor: "#111111" },
        ],
        ["replaces its banner", people.member, "PUT", `/api/deal-rooms/${A.room.id}/banner`, undefined, PNG],
        [
            "changes who's on its room",
            people.member,
            "PUT",
            `/api/deal-rooms/${A.room.id}/people`,
            { userIds: [ids.member] },
        ],
        [
            "changes its room's file",
            people.member,
            "PATCH",
            `/api/deal-rooms/${A.room.id}/files/${A.copy.id}`,
            { name, description: "x" },
        ],
        ["orders its room", people.member, "PUT", `/api/deal-rooms/${A.room.id}/order`, { assetIds: [A.copy.id] }],
        [
            "updates its frontstage",
            people.member,
            "PUT",
            `/api/deal-rooms/${A.room.id}/frontstage`,
            { assetIds: [A.copy.id] },
        ],
        ["takes it off", people.member, "DELETE", `/api/deal-rooms/${A.room.id}/frontstage`],
        [
            "takes a file out of its collection",
            people.manager,
            "DELETE",
            `/api/collections/${A.collection.id}/items/${A.deck.id}`,
        ],
        ["deletes its collection", people.manager, "DELETE", `/api/collections/${A.collection.id}`],
        ["deletes its room's file", people.member, "DELETE", `/api/deal-rooms/${A.room.id}/files/${A.copy.id}`],
        ["deletes its room", people.member, "DELETE", `/api/deal-rooms/${A.room.id}`],
        ["deletes its file", people.admin, "DELETE", `/api/assets/${A.deck.id}`],
        ["deletes its other file", people.admin, "DELETE", `/api/assets/${A.draft.id}`],
        ["deletes its folder", people.admin, "DELETE", `/api/folders/${A.folder.id}`],
    ];
    const larchmereBefore = fingerprintOf(tenantA);
    for (const [label, client, method, path, body, raw] of changes(northwind, northwindIds, "NORTHWIND-RENAMED")) {
        const answer = await client(method, path, body, raw);
        check(`Northwind ${label}`, answer.status < 300, [answer.status, answer.text.slice(0, 160)]);
        check(`and Larchmere's row at that id doesn't move: ${label}`, fingerprintOf(tenantA) === larchmereBefore);
    }
    await sameAsBefore("after Northwind changed those ids");
    check(
        "Larchmere's documents are all there",
        (await storeA.getDescription(A.deck.documentId, MAIN)) !== undefined &&
            (await storeA.getDescription(A.copy.documentId, MAIN)) !== undefined,
    );

    const secondMark = "NORTHWIND-CLONE-AGAIN";
    cloneLarchmereInto(secondMark, `${cloneToken}again`, "'none-' || id");

    // A report goes by its own link's tenant, at the very same room and file: each has
    // a different version on show, so that reading the other's row shows in what's kept.
    {
        const db = new DatabaseSync(dbFile);
        db.prepare("UPDATE assets SET published_version = 77 WHERE tenant_id = ? AND id = ?").run(tenantB, A.copy.id);
        db.close();
        const openAt = async (token) => {
            const answer = await fetch(`${BASE}/api/frontstage/${token}/activity`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ kind: "opened", fileId: A.copy.id }),
            });
            const cookie = answer.headers.getSetCookie()[0]?.split(";")[0];
            return { status: answer.status, cookie, session: (await answer.json().catch(() => ({}))).session };
        };
        const atA = await openAt(A.token);
        const atB = await openAt(`${cloneToken}again`);
        check("a buyer opens the file at each tenant's link", atA.status === 201 && atB.status === 201, [
            atA.status,
            atB.status,
        ]);
        const kept = new DatabaseSync(dbFile, { readOnly: true });
        const rows = kept
            .prepare("SELECT tenant_id, version FROM frontstage_sessions WHERE id IN (?, ?)")
            .all(atA.session, atB.session);
        kept.close();
        const rowOf = (tenant) => rows.find((row) => row.tenant_id === tenant);
        check("Larchmere's link keeps it against Larchmere's version", rowOf(tenantA)?.version === 1, rows);
        check("Northwind's link keeps it against Northwind's version", rowOf(tenantB)?.version === 77, rows);
        check("and neither against the other", rows.length === 2, rows);
        const crossed = await clientWith(atA.cookie)("POST", `/api/frontstage/${cloneToken}again/activity`, {
            kind: "read",
            session: atA.session,
            views: [{ page: 0, from: 0, to: 1000 }],
        });
        check("a session at one tenant's link is none at the other's", crossed.status === 404, crossed.status);
    }
    const northwindNow = fingerprintOf(tenantB);
    const versions = [
        ["saves a version", larchmere.admin, "POST", `/api/assets/${A.deck.id}/versions`, { note: "x" }],
        [
            "submits it",
            larchmere.admin,
            "POST",
            `/api/assets/${A.deck.id}/versions/2/submit`,
            { reviewerId: larchmereIds.reviewer },
        ],
        ["approves it", larchmere.reviewer, "POST", `/api/assets/${A.deck.id}/versions/2/approve`, {}],
        ["publishes it", larchmere.admin, "POST", `/api/assets/${A.deck.id}/versions/2/publish`, {}],
        ["saves a copy's version", larchmere.member, "POST", `/api/assets/${A.copy.id}/versions`, { note: "x" }],
    ];
    for (const [label, client, method, path, body, raw] of [
        ...versions,
        ...changes(larchmere, larchmereIds, "Larchmere renamed"),
    ]) {
        const answer = await client(method, path, body, raw);
        check(`Larchmere ${label}`, answer.status < 300, [answer.status, answer.text.slice(0, 160)]);
        check(`and Northwind's row at that id doesn't move: ${label}`, fingerprintOf(tenantB) === northwindNow);
    }
    const kept = await northwind.manager("GET", `/api/collections/${A.collection.id}`);
    check(
        "Northwind's collection at that id is there",
        kept.status === 200 && kept.text.includes(secondMark),
        kept.status,
    );
    check(
        "and Larchmere's isn't",
        (await larchmere.manager("GET", `/api/collections/${A.collection.id}`)).status === 404,
    );
}

// ── The answer ──────────────────────────────────────────────────────────────────

await stopBackend();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
    console.log("\nFailed:");
    for (const failure of new Set(failures)) console.log(`  - ${failure}`);
    process.exit(1);
}
