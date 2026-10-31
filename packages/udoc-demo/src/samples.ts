// Sample document catalog. Files live in `public/` (copied from the viewer
// demo — public-domain NASA material). Editing modes favor the editable
// formats (DOCX/PPTX), but every type is here so the type-rail has full cover.

export type DocType = "pdf" | "docx" | "pptx" | "xlsx" | "img";

export interface SampleDoc {
    name: string;
    path: string;
}

export interface SampleCategory {
    type: DocType;
    /** Short uppercase label shown in the sidebar / type-rail. */
    label: string;
    description?: string;
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
        description: "NASA documents are public-domain.",
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
        description: "Editable word-processing documents.",
        documents: [{ name: "NASA Artemis Status Report", path: asset("docx/nasa-artemis-status-report.docx") }],
    },
    {
        type: "pptx",
        label: "PPTX",
        description: "Editable presentations.",
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
        description: "Public-domain NASA/JWST images.",
        documents: [
            { name: "Cosmic Cliffs in Carina Nebula", path: asset("image/cosmic-cliffs-carina-nebula.png") },
            { name: "Pillars of Creation", path: asset("image/pillars-of-creation.png") },
            { name: "Stephan's Quintet", path: asset("image/stephans-quintet.png") },
        ],
    },
];

/** What the demo opens on first load. */
export const DEFAULT_SAMPLE: SampleDoc = SAMPLE_CATEGORIES.find((c) => c.type === "pdf")!.documents[0]!;

/** A sample's file name: what names it in the demo's address (`?sample=`), and what a download saves. */
export function sampleFile(doc: SampleDoc): string {
    return doc.path.slice(doc.path.lastIndexOf("/") + 1);
}

/** The sample whose file is named `file`; `undefined` for none. */
export function findSample(file: string | null): SampleDoc | undefined {
    return SAMPLE_CATEGORIES.flatMap((c) => c.documents).find((doc) => sampleFile(doc) === file);
}

export const FILE_ACCEPT =
    ".pdf,.pptx,.pptm,.potx,.potm,.ppsx,.ppsm,.docx,.docm,.dotx,.dotm,.txt,.md,.markdown,.html,.htm,.xlsx,.xlsm,.xltx,.xltm,.csv,.tsv,.tab,.psv,.svg,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif,.webp,.ico";
