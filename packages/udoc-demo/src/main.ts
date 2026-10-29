import "./style.css";
import { h } from "./dom.js";
import { Header } from "./shell/Header.js";
import { Sidebar } from "./shell/Sidebar.js";
import { OptionsModal, type OptionGroup } from "./shell/OptionsModal.js";
import { Stage } from "./stage/Stage.js";
import { UDocEditor } from "@docmentis/udoc-editor";
import type { UDocEditorOptions, ViewControlsPlacement } from "@docmentis/udoc-editor";
import { FILE_ACCEPT, DEFAULT_SAMPLE, findSample, sampleFile, type SampleDoc } from "./samples.js";
import { getTheme, toggleTheme } from "./theme.js";
import { MODES, type Mode } from "./types.js";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

// --- options spec ---------------------------------------------------------
// Each item's id is the `UDocEditorOptions` key it sets, its default the
// editor's own (the Developer item's, the demo's).
const OPTION_GROUPS: OptionGroup[] = [
    {
        title: "UI",
        items: [
            { kind: "toggle", id: "showToolbar", label: "Toolbar", default: true },
            { kind: "toggle", id: "showFullscreenButton", label: "Fullscreen Button", default: true },
            { kind: "toggle", id: "showDownloadButton", label: "Download Button", default: true },
            { kind: "toggle", id: "showPrintButton", label: "Print Button", default: true },
            { kind: "toggle", id: "showThemeButton", label: "Theme Button", default: true },
            { kind: "toggle", id: "showDeveloperButton", label: "Developer Button", default: true },
            {
                kind: "select",
                id: "viewControlsPlacement",
                label: "View Controls",
                default: "floating",
                options: [
                    { value: "floating", label: "Floating Toolbar" },
                    { value: "top-toolbar", label: "Top Toolbar" },
                    { value: "status-bar", label: "Bottom Toolbar" },
                ],
            },
            {
                kind: "toggle",
                id: "showRuler",
                label: "Ruler",
                hint: "paged documents; hidden in View mode",
                default: true,
            },
            {
                kind: "toggle",
                id: "showPageControls",
                label: "Page Controls",
                hint: "Edit mode",
                default: true,
            },
        ],
    },
    {
        title: "Left Panel",
        items: [
            { kind: "toggle", id: "showLeftPanel", label: "Left Panel", default: true },
            { kind: "toggle", id: "showThumbnailPanel", label: "Thumbnail Panel", default: true },
            { kind: "toggle", id: "showOutlinePanel", label: "Outline Panel", default: true },
            { kind: "toggle", id: "showLayersPanel", label: "Layers Panel", default: true },
        ],
    },
    {
        title: "Right Panel",
        items: [
            { kind: "toggle", id: "showRightPanel", label: "Right Panel", default: true },
            { kind: "toggle", id: "showSearchPanel", label: "Search Panel", default: true },
            { kind: "toggle", id: "showCommentsPanel", label: "Comments Panel", default: true },
        ],
    },
    {
        title: "Notes",
        items: [{ kind: "toggle", id: "showNotesPanel", label: "Notes Panel", hint: "presentations", default: false }],
    },
    {
        title: "Features",
        items: [
            {
                kind: "toggle",
                id: "enableCopy",
                label: "Copy",
                hint: "View mode",
                default: true,
            },
            {
                kind: "toggle",
                id: "enableAnnotation",
                label: "Annotation",
                hint: "PDF",
                default: true,
            },
            {
                kind: "toggle",
                id: "enableFormFilling",
                label: "Form Filling",
                hint: "PDF",
                default: true,
            },
        ],
    },
    {
        title: "Fonts",
        items: [
            {
                kind: "toggle",
                id: "enableGoogleFonts",
                label: "Google Fonts",
                hint: "fetch a font the document names from Google Fonts",
                default: true,
            },
            {
                kind: "toggle",
                id: "enableCanvasFonts",
                label: "Canvas Fonts",
                hint: "allow viewer / editor to use font on this device",
                default: true,
            },
        ],
    },
    {
        title: "Locale",
        items: [
            {
                kind: "select",
                id: "locale",
                label: "Language",
                default: "en",
                options: [
                    { value: "en", label: "English" },
                    { value: "zh-CN", label: "中文 (简体)" },
                    { value: "zh-TW", label: "中文 (繁體)" },
                    { value: "ja", label: "日本語" },
                    { value: "ko", label: "한국어" },
                    { value: "es", label: "Español" },
                    { value: "fr", label: "Français" },
                    { value: "de", label: "Deutsch" },
                    { value: "pt-BR", label: "Português (Brasil)" },
                    { value: "ar", label: "العربية" },
                    { value: "ru", label: "Русский" },
                ],
            },
        ],
    },
];

// --- components -----------------------------------------------------------
const fileInput = h("input", { type: "file", accept: FILE_ACCEPT, style: "display:none" });

const stage = new Stage((message) => showError(message), getTheme());

const optionsModal = new OptionsModal(OPTION_GROUPS, (id, value) => void setOption(id, value));

/**
 * Apply an option from the dialog: live through the editor's setter where it
 * has one, else by rebuilding the editors with it.
 */
function setOption(id: string, value: boolean | string): Promise<void> {
    switch (id) {
        case "viewControlsPlacement": {
            const placement = value as ViewControlsPlacement;
            return stage.setOptions({ viewControlsPlacement: placement }, (ed) =>
                ed.setViewControlsPlacement(placement),
            );
        }
        case "showRuler": {
            const visible = value as boolean;
            return stage.setOptions({ showRuler: visible }, (ed) => {
                if (ed instanceof UDocEditor) ed.setShowRuler(visible);
            });
        }
        default:
            // The base color, the chrome, copy, annotating, form filling and
            // the language: read only at create.
            return stage.setOptions({ [id]: value } as UDocEditorOptions);
    }
}

const header = new Header({
    onModeChange: (mode) => {
        if (mode === shownMode) return;
        pushAddress({ mode });
        void setMode(mode);
    },
    onToggleTheme: () => {
        const theme = toggleTheme();
        header.setTheme(theme);
        stage.setTheme(theme);
    },
});

const sidebar = new Sidebar({
    onOpenFile: () => fileInput.click(),
    onOpenUrl: () => void openUrl(),
    onSelectDoc: (doc) => {
        pushAddress({ sample: sampleFile(doc), document: null });
        void openSample(doc);
    },
    onOpenOptions: () => optionsModal.open(),
});

root.appendChild(h("div", { class: "demo-root" }, header.el, h("div", { class: "demo-body" }, sidebar.el, stage.el)));
document.body.appendChild(fileInput);

header.setTheme(getTheme());

// --- address --------------------------------------------------------------
// The page's address names what the demo shows, so a link opens it there: the
// mode, `?mode=`, and the document, a sample by its file's name, `?sample=`, or
// one udoc-server keeps, `?document=`. Each change the user makes to them is a
// new entry in the browser's history, and going back or forward shows its
// entry's again.

/** The mode the demo is in; `null` before the first. */
let shownMode: Mode | null = null;

/**
 * The document asked for last, by a name for it: `sample=<file>` or
 * `document=<id>`, as the address names it, or `file=<name>` or `url=<url>`
 * for one it can't name. `null` before the first.
 */
let shownDoc: string | null = null;

/** The page's address with `changes` made to its parameters: a `null` removes one. */
function addressWith(changes: Record<string, string | null>): URL {
    const url = new URL(location.href);
    for (const [name, value] of Object.entries(changes)) {
        if (value === null) url.searchParams.delete(name);
        else url.searchParams.set(name, value);
    }
    return url;
}

/** Make `changes` to the address in a new history entry, unless they change nothing. */
function pushAddress(changes: Record<string, string | null>): void {
    const url = addressWith(changes);
    if (url.href !== location.href) history.pushState(null, "", url);
}

/** The mode the address names; View when it names none. */
function addressedMode(): Mode {
    const mode = new URLSearchParams(location.search).get("mode");
    return MODES.find((m) => m.id === mode)?.id ?? "view";
}

/**
 * Show what the address names, where it isn't shown already: on load, and as
 * the user goes back or forward. An entry that names no document is a file's
 * or a URL's the user opened, which it can't open again, so what is open
 * stays.
 */
async function showAddress(): Promise<void> {
    const mode = addressedMode();
    if (mode !== shownMode) await setMode(mode);
    // Read again: the address may have moved on while the mode was set.
    const params = new URLSearchParams(location.search);
    const remote = params.get("document");
    const sample = findSample(params.get("sample"));
    if (remote !== null) {
        if (shownDoc !== `document=${remote}`) await openRemote(remote);
    } else if (sample) {
        if (shownDoc !== `sample=${sampleFile(sample)}`) await openSample(sample);
    }
}

// --- actions --------------------------------------------------------------
function defaultCollapsed(mode: Mode): boolean {
    // Expanded by default in Edit and View (room to spare); folded in the split
    // modes (AI / Co-edit), where the second pane competes for width.
    return mode !== "edit" && mode !== "view";
}

async function setMode(mode: Mode): Promise<void> {
    shownMode = mode;
    header.setMode(mode);
    sidebar.setCollapsed(defaultCollapsed(mode));
    await stage.setMode(mode);
}

async function fetchBytes(path: string): Promise<Uint8Array> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`fetch ${path} → ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
}

async function openSample(doc: SampleDoc): Promise<void> {
    // Named by its file, not its title: the name is what a download saves.
    const name = sampleFile(doc);
    const asked = `sample=${name}`;
    shownDoc = asked;
    sidebar.setActiveDoc(doc.path);
    try {
        const bytes = await fetchBytes(doc.path);
        // Another document was asked for while this one downloaded.
        if (shownDoc !== asked) return;
        await stage.openDoc({ name, bytes });
    } catch (err) {
        console.error("udoc: failed to open sample", err);
        showError(`Could not load "${doc.name}".`);
    }
}

/**
 * Ask for a document the address can't name, `asked` (see `shownDoc`): a file
 * or a URL. Its entry names none, so the one open before is an entry back.
 */
function askUnnamed(asked: string): string {
    shownDoc = asked;
    sidebar.setActiveDoc(null);
    pushAddress({ sample: null, document: null });
    return asked;
}

async function openUrl(): Promise<void> {
    const url = prompt("Enter document URL:");
    if (!url) return;
    const asked = askUnnamed(`url=${url}`);
    try {
        const bytes = await fetchBytes(url);
        if (shownDoc !== asked) return;
        await stage.openDoc({ name: url.split("/").pop() || url, bytes });
    } catch (err) {
        console.error("udoc: failed to open URL", err);
        showError("Could not load that URL.");
    }
}

/**
 * Open a document udoc-server keeps, part by part, and join its collaboration:
 * `?document=<id>`, reached through the dev server's `/documents` proxy (see
 * `vite.config.ts`). The same URL open anywhere else edits the same document.
 */
async function openRemote(id: string): Promise<void> {
    shownDoc = `document=${id}`;
    sidebar.setActiveDoc(null);
    const document = `/documents/${encodeURIComponent(id)}`;
    try {
        await stage.openDoc({ name: id, remote: `${document}/package`, collaboration: `${document}/collaboration` });
    } catch (err) {
        console.error("udoc: failed to open the server's document", err);
        showError(`Could not open document "${id}" from the server.`);
    }
}

fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const asked = askUnnamed(`file=${file.name}`);
    void file.arrayBuffer().then(async (buf) => {
        if (shownDoc === asked) await stage.openDoc({ name: file.name, bytes: new Uint8Array(buf) });
    });
    fileInput.value = "";
});

let errorEl: HTMLElement | null = null;
function showError(message: string): void {
    if (!errorEl) {
        errorEl = h("div", { class: "demo-error" });
        document.body.appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.classList.add("show");
    setTimeout(() => errorEl?.classList.remove("show"), 5000);
}

// --- boot -----------------------------------------------------------------
async function main(): Promise<void> {
    document.body.appendChild(optionsModal.el);
    // The first entry names a mode and a document as every other does: View,
    // and the default sample, where the link named none.
    const params = new URLSearchParams(location.search);
    const named = params.has("document") || findSample(params.get("sample")) !== undefined;
    history.replaceState(
        history.state,
        "",
        addressWith({ mode: addressedMode(), ...(named ? {} : { sample: sampleFile(DEFAULT_SAMPLE) }) }),
    );
    window.addEventListener("popstate", () => void showAddress());
    await showAddress();
}

void main();

// HMR: editors own workers; reload to get a clean slate.
if (import.meta.hot) {
    import.meta.hot.accept(() => window.location.reload());
}
