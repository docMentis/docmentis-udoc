// Builders for the doc-type-tagged `UDocCommand`s edit mode issues by id — a
// page object's insert — beside udoc-ui's own. They return the typed command
// object, typed against the types tsify declares from the Rust source, so a
// command that drifts from the Rust serde fails to compile here instead of
// erroring at the wasm boundary at runtime.
import type { PortableCommand, UDocCommand } from "@docmentis/udoc-wasm";

/** A large insert index that clamps to "append on top" in the engine (kept well
 *  inside the safe-integer range so it serializes as a plain `usize`). */
const APPEND_INDEX = 0x7fff_ffff;

/** Wrap a portable command in the doc-type-tagged `UDocCommand`. */
function portable(command: PortableCommand): UDocCommand {
    return { portable: command };
}

/** Edit mode's command builders. */
export const EditCommand = {
    /** Insert host-built `objects` (already carrying minted ids) on top of `pageId`. */
    insertObjects: (pageId: string, objects: unknown[]): UDocCommand =>
        portable({
            editObject: {
                page: pageId,
                command: { insertObjects: { parent: null, index: APPEND_INDEX, objects } },
            },
        }),
};
