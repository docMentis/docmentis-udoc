// What scripts/e2e-browser.mjs runs in the browser: real editors, in their real
// workers, against the real server, with the server's own cuts. Nothing here
// reaches past the editor's public API.
/* global location, window */
import { UDocEditor } from "@docmentis/udoc-editor";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition, ms = 20_000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (await condition()) return true;
        await sleep(50);
    }
    return false;
}

/** What each edit changes: a workbook's sheets, anything else's pages. */
const count = (ui) => (ui.docType === "spreadsheet" ? ui.sheetCount : ui.pageCount);

const rendersAPage = async (ui) => (await ui.exportPageToBytes(0, { png: { scale: 0.25 } })).length > 100;

let sheets = 0;

async function scenario(id, command) {
    // A sheet each its own name: two offline editors picking one name is another question.
    const insert = () =>
        command.spreadsheet
            ? { spreadsheet: { editWorkbook: { command: { insertWorksheet: { index: 0, name: `S${sheets++}` } } } } }
            : command;
    const packageUrl = `/documents/${id}/package`;
    const collaboration = `${location.origin.replace(/^http/, "ws")}/documents/${id}/collaboration`;
    const cuts = async () => (await (await fetch(`${packageUrl}/cuts`)).json()).versions;
    const failures = [];

    async function editor(name) {
        const ui = await UDocEditor.create(null);
        ui.on("collaboration:failed", ({ code, reason }) => failures.push(`${name}: ${code} ${reason}`));
        await ui.openRemote(packageUrl);
        return ui;
    }
    /** Resolves with whether `start` led to the far side answering a join. */
    const answered = (ui, start, ms = 20_000) => {
        const joined = new Promise((resolve) => {
            const off = ui.on("collaboration:joined", () => {
                off();
                resolve(true);
            });
        });
        start();
        return Promise.race([joined, sleep(ms).then(() => false)]);
    };
    const join = (ui, name) => answered(ui, () => ui.joinRemoteCollaboration(collaboration, name));
    const resume = (ui) => answered(ui, () => ui.resumeCollaboration());

    const one = await editor("one");
    const two = await editor("two");
    check("two editors joined", (await join(one, "One")) && (await join(two, "Two")));
    const n = count(one);
    await one.execute(insert());
    check("an edit reaches the other editor", await until(() => count(two) === n + 1), `${count(two)}, from ${n}`);
    await sleep(200);

    one.pauseCollaboration();
    two.pauseCollaboration();
    check(
        "both paused, the server's idle session cuts the log",
        await until(async () => (await cuts()).length === 1),
        JSON.stringify(await cuts()),
    );

    await two.execute(insert());
    check("a paused editor edits on: this edit is unsent", count(two) === n + 2, count(two));

    check("the editor with nothing unsent resumes, catches up and joins", await resume(one), failures.join("; "));
    check("and still holds the document", count(one) === n + 1, count(one));
    check("and renders", await rendersAPage(one));

    const three = await editor("three");
    check("a fresh editor opens on the cut", count(three) === n + 1, count(three));
    check("and joins", await join(three, "Three"));
    await three.execute(insert());
    check("its first edit reaches the editor that came back", await until(() => count(one) === n + 2), count(one));

    check("the editor with an unsent edit resumes, catches up and joins", await resume(two), failures.join("; "));
    const everyone = (want) => until(() => count(one) === want && count(two) === want && count(three) === want);
    const counts = () => [count(one), count(two), count(three)];
    check("its unsent edit reaches everyone, and it takes theirs", await everyone(n + 3), counts());
    check("it renders", await rendersAPage(two));

    await one.undo();
    check(
        "the editor with nothing unsent undoes its edit from before the cut, for everyone",
        await everyone(n + 2),
        counts(),
    );

    await two.execute(insert());
    check("the editor that was rebased edits on, for everyone", await everyone(n + 3), counts());
    check("nobody's collaboration failed", failures.length === 0, failures.join("; "));

    await sleep(200);
    one.pauseCollaboration();
    two.leaveCollaboration();
    three.leaveCollaboration();
    check(
        "a second idle close cuts again",
        await until(async () => (await cuts()).length === 2),
        JSON.stringify(await cuts()),
    );
    check("the editor behind the second cut resumes, catches up and joins", await resume(one), failures.join("; "));
    const four = await editor("four");
    check(
        "a fresh editor opened on the second cut holds the same pages",
        count(four) === n + 3 && count(one) === n + 3,
        [count(four), count(one)],
    );
    check("and renders", await rendersAPage(four));
    for (const ui of [one, two, three, four]) ui.destroy();
}

window.runCut = async (id, command) => {
    try {
        await scenario(id, command);
    } catch (error) {
        check("the scenario ran to its end", false, error?.stack ?? error);
    }
    return results;
};
window.cutReady = true;
