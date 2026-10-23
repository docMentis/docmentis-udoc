export { UDocNode } from "./node.js";
export type { UDocNodeOptions } from "./node.js";
// The session is a type only: `UDocNode.open` is the way to get one.
export type { RemoteCheckpointResponse, UDocSession } from "./session.js";
// The error every failure is reported as.
export { UDocError } from "@docmentis/udoc-wasm/error";
export type { UDocErrorCode, UDocErrorDetail } from "@docmentis/udoc-wasm/error";
// A document in and out: what it opened as, and the formats it saves and
// exports to.
export type { ExportFormat, FileFormat, PageExportFormat, SaveStrategy, UDocType } from "@docmentis/udoc-wasm";
// What a session is entitled to, and the features a call can need.
export type { Entitlements, Feature } from "@docmentis/udoc-wasm";
export { isFileFormat } from "./format.js";
