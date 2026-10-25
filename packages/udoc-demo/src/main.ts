import "./style.css";
import { h } from "./dom.js";
import { Header } from "./shell/Header.js";
import { Sidebar } from "./shell/Sidebar.js";
import { OptionsModal, type OptionGroup } from "./shell/OptionsModal.js";
import { Stage } from "./stage/Stage.js";
import { UDocEditor } from "@docmentis/udoc-editor";
import type { UDocEditorOptions, ViewControlsPlacement } from "@docmentis/udoc-editor";
import { FILE_ACCEPT, DEFAULT_SAMPLE, type SampleDoc } from "./samples.js";
import { getTheme, toggleTheme } from "./theme.js";
import { MODES, type Mode } from "./types.js";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

// --- options spec ---------------------------------------------------------
// Each item's id is the `UDocEditorOptions` key it sets, its default the
// editor's own (the Developer item's, the demo's).
const OPTION_GROUPS: OptionGroup[] = [
    {
        title: "Toolbar",
        items: [
            { kind: "toggle", id: "showToolbar", label: "Toolbar", default: true },
            { kind: "toggle", id: "showFullscreenButton", label: "Fullscreen Button", default: true },
            { kind: "toggle", id: "showDownloadButton", label: "Download Button", default: true },
            { kind: "toggle", id: "showPrintButton", label: "Print Button", default: true },
            { kind: "toggle", id: "showThemeButton", label: "Theme Button", default: true },
            { kind: "toggle", id: "showDeveloperButton", label: "Developer Button", default: true },
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
        title: "View",
        items: [
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
            {
                kind: "toggle",
                id: "enableCopy",
                label: "Copy",
                hint: "View mode",
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
            // The base color, the chrome, copy and the language: read only at
            // create.
            return stage.setOptions({ [id]: value } as UDocEditorOptions);
    }
}

const header = new Header({
    onModeChange: (mode) => void setMode(mode),
    onToggleTheme: () => {
        const theme = toggleTheme();
        header.setTheme(theme);
        stage.setTheme(theme);
    },
});

const sidebar = new Sidebar({
    onOpenFile: () => fileInput.click(),
    onOpenUrl: () => void openUrl(),
    onSelectDoc: (doc) => void openSample(doc),
    onOpenOptions: () => optionsModal.open(),
});

root.appendChild(h("div", { class: "demo-root" }, header.el, h("div", { class: "demo-body" }, sidebar.el, stage.el)));
document.body.appendChild(fileInput);

header.setTheme(getTheme());

// --- actions --------------------------------------------------------------
function defaultCollapsed(mode: Mode): boolean {
    // Expanded by default in Edit and View (room to spare); folded in the split
    // modes (AI / Co-edit), where the second pane competes for width.
    return mode !== "edit" && mode !== "view";
}

/** The mode `?mode=` names, so a link can open the demo in it; View when it names none. */
function initialMode(): Mode {
    const mode = new URLSearchParams(location.search).get("mode");
    return MODES.find((m) => m.id === mode)?.id ?? "view";
}

async function setMode(mode: Mode): Promise<void> {
    header.setMode(mode);
    sidebar.setCollapsed(defaultCollapsed(mode));
    // Keep `?mode=` in step, so the page's address reopens it in this mode.
    const url = new URL(location.href);
    url.searchParams.set("mode", mode);
    history.replaceState(history.state, "", url);
    await stage.setMode(mode);
}

async function fetchBytes(path: string): Promise<Uint8Array> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`fetch ${path} → ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
}

async function openSample(doc: SampleDoc): Promise<void> {
    sidebar.setActiveDoc(doc.path);
    try {
        // Named by its file, not its title: the name is what a download saves.
        await stage.openDoc({ name: doc.path.split("/").pop()!, bytes: await fetchBytes(doc.path) });
    } catch (err) {
        console.error("udoc: failed to open sample", err);
        showError(`Could not load "${doc.name}".`);
    }
}

async function openUrl(): Promise<void> {
    const url = prompt("Enter document URL:");
    if (!url) return;
    sidebar.setActiveDoc(null);
    try {
        await stage.openDoc({ name: url.split("/").pop() || url, bytes: await fetchBytes(url) });
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
    sidebar.setActiveDoc(null);
    void file.arrayBuffer().then((buf) => stage.openDoc({ name: file.name, bytes: new Uint8Array(buf) }));
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
    await setMode(initialMode());
    const remote = new URLSearchParams(location.search).get("document");
    await (remote ? openRemote(remote) : openSample(DEFAULT_SAMPLE));
}

void main();

// HMR: editors own workers; reload to get a clean slate.
if (import.meta.hot) {
    import.meta.hot.accept(() => window.location.reload());
}
