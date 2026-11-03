// The four demo modes. They reshape the stage body:
//   edit   — a single editor host
//   view   — a single viewer host (no authoring)
//   coedit — two editor hosts, CRDT-synced, 50/50
//   ai     — editor (left) + the AI panel, coming soon (right), 50/50
export type Mode = "edit" | "view" | "ai" | "coedit";

export const MODES: { id: Mode; label: string; icon: "edit" | "view" | "sparkle" | "coedit" }[] = [
    { id: "view", label: "View", icon: "view" },
    { id: "edit", label: "Edit", icon: "edit" },
    { id: "coedit", label: "Co-edit", icon: "coedit" },
    { id: "ai", label: "Co-edit with AI", icon: "sparkle" },
];

/**
 * A document the demo can open, as `open` takes it — its bytes in memory, a
 * picked file, or a URL the viewer or the editor fetches or streams itself —
 * and a display name.
 */
export type OpenDoc = { name: string; source: Uint8Array | Blob | string };
