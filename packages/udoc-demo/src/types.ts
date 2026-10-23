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
 * A document the demo can open, plus a display name: in-memory bytes, or a
 * document a udoc server keeps — its package resource, opened part by part,
 * and the collaboration its editors join.
 */
export type OpenDoc = { name: string; bytes: Uint8Array } | { name: string; remote: string; collaboration: string };
