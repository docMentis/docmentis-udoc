// Sample document catalog. Files live in `public/` (copied from the viewer
// demo — NASA material, credited at the sidebar's foot by `SAMPLE_CREDIT`).
// Editing modes favor the editable formats (DOCX/PPTX), but every type is here
// so the type-rail has full cover. The videos are NASA's own, on its YouTube
// and Vimeo channels, which the viewer and the editor stream from the sites:
// the demo hosts none of them.

export type DocType = "pdf" | "docx" | "pptx" | "xlsx" | "img" | "video";

export interface SampleDoc {
    name: string;
    /** Its file in `public/`, which the demo fetches; or an online video's address on its site. */
    path: string;
    /**
     * An online video's name in the demo's address (`?sample=`), as its
     * address names no file. Set for an online video alone, which the viewer
     * or the editor streams from its address, and which is only viewed.
     */
    slug?: string;
}

export interface SampleCategory {
    type: DocType;
    /** Short uppercase label shown in the sidebar / type-rail. */
    label: string;
    documents: SampleDoc[];
}

// Resolve a `public/` file against Vite's base URL so the paths work both when
// served at the site root (dev, `BASE_URL === "/"`) and from a subdirectory
// (the built demo is embedded in an iframe at /demo/, `BASE_URL === "./"`).
const asset = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

export const SAMPLE_CATEGORIES: SampleCategory[] = [
    {
        type: "pdf",
        label: "PDF",
        documents: [
            {
                name: "Hubble Fact Sheet: Mission Operations",
                path: asset("pdf/nasa-hubble-fact-sheet-mission-operations.pdf"),
            },
            { name: "Hubble Focus: Black Holes", path: asset("pdf/nasa-hubble-focus-black-holes-ebook.pdf") },
            { name: "Earth Art", path: asset("pdf/nasa-earth-art.pdf") },
        ],
    },
    {
        type: "docx",
        label: "DOCX",
        documents: [{ name: "NASA Artemis Status Report", path: asset("docx/nasa-artemis-status-report.docx") }],
    },
    {
        type: "pptx",
        label: "PPTX",
        documents: [{ name: "James Webb Space Telescope", path: asset("pptx/james-webb-space-telescope.pptx") }],
    },
    {
        type: "xlsx",
        label: "XLSX",
        documents: [{ name: "NASA Airborne Science Program", path: asset("xlsx/nasa_asp_schedule_2026_01.xlsx") }],
    },
    {
        type: "img",
        label: "Image",
        documents: [
            { name: "Cosmic Cliffs in Carina Nebula", path: asset("image/cosmic-cliffs-carina-nebula.png") },
            { name: "Pillars of Creation", path: asset("image/pillars-of-creation.png") },
            { name: "Stephan's Quintet", path: asset("image/stephans-quintet.png") },
        ],
    },
    {
        type: "video",
        label: "Video",
        documents: [
            {
                name: "Webb's First Images (YouTube)",
                path: "https://www.youtube.com/watch?v=1C_zuHf6lP4",
                slug: "webb-first-images-youtube",
            },
            {
                name: "Parker Solar Probe (Vimeo)",
                path: "https://vimeo.com/283977617",
                slug: "parker-solar-probe-vimeo",
            },
        ],
    },
];

/**
 * The samples' credit, at the sidebar's foot: NASA's media guidelines ask for credit
 * and rule out implying NASA endorses a product, and the Webb images are
 * ESA's, CSA's and STScI's as well as NASA's.
 */
export const SAMPLE_CREDIT =
    "Samples courtesy of NASA; Webb images NASA, ESA, CSA, STScI. NASA does not endorse docMentis.";

/** What the demo opens on first load. */
export const DEFAULT_SAMPLE: SampleDoc = SAMPLE_CATEGORIES.find((c) => c.type === "pdf")!.documents[0]!;

/**
 * A sample's file name — an online video's slug — what names it in the demo's
 * address (`?sample=`), and what a download saves.
 */
export function sampleFile(doc: SampleDoc): string {
    return doc.slug ?? doc.path.slice(doc.path.lastIndexOf("/") + 1);
}

/** The sample whose file is named `file`; `undefined` for none. */
export function findSample(file: string | null): SampleDoc | undefined {
    return SAMPLE_CATEGORIES.flatMap((c) => c.documents).find((doc) => sampleFile(doc) === file);
}

export const FILE_ACCEPT =
    ".pdf,.pptx,.pptm,.potx,.potm,.ppsx,.ppsm,.docx,.docm,.dotx,.dotm,.txt,.md,.markdown,.html,.htm,.eml,.xlsx,.xlsm,.xltx,.xltm,.csv,.tsv,.tab,.psv,.svg,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif,.webp,.ico," +
    // The media document's files.
    ".mp4,.m4v,.mov,.webm,.mp3,.m4a,.aac,.wav,.ogg,.oga,.ogv,.opus,.flac";
