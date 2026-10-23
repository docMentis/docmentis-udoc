// A partial annotation a host patches one with (`patchPageAnnotation`), and how
// it merges in. Kept free of other UI imports so a test loads it alone.

import type { Annotation } from "@docmentis/udoc-wasm";

/** Any of an annotation's fields, and any of theirs, all the way down; an array
 *  whole. `undefined` stands for a field left as it is. */
export type AnnotationPatch = DeepPartial<Annotation>;

type DeepPartial<T> = T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> | undefined }
      : T;

/**
 * `existing` with `patch` merged in: each field the patch gives replaces the
 * annotation's, and an object field merges into the annotation's, all the way
 * down — so `{ kind: { highlight: { markup: { author } } } }` keeps the quads
 * and every other markup entry. An array is replaced whole; `undefined` is
 * skipped, where `null` clears. `id` and `name` stay the annotation's, and a
 * `kind` of another subtype replaces the kind whole.
 */
export function applyAnnotationPatch(existing: Annotation, patch: AnnotationPatch): Annotation {
    const fields = Object.fromEntries(
        Object.entries(patch).filter(([key]) => key !== "id" && key !== "name" && key !== "kind"),
    );
    const result = merge(existing, fields) as unknown as Annotation;
    const kind = patch.kind;
    if (kind !== undefined) {
        const sameSubtype =
            isRecord(kind) && isRecord(existing.kind) && Object.keys(kind)[0] === Object.keys(existing.kind)[0];
        result.kind = (sameSubtype ? merge(existing.kind, kind) : kind) as Annotation["kind"];
    }
    return result;
}

/** `base` with `patch`'s defined fields merged in, objects all the way down. */
function merge(base: unknown, patch: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = isRecord(base) ? { ...base } : {};
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        result[key] = isRecord(value) && isRecord(result[key]) ? merge(result[key], value) : value;
    }
    return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
