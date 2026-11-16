// An empty placeholder's dashed frame, which the engine draws and the UI's boxes
// trace: shared by the stylesheet and the render worker, so it imports nothing
// — a worker that bundles it bundles none of the UI.

/** The CSS px of each dash, and of each gap, of an empty placeholder's dashed
 *  frame, which the engine draws (the editor hands it this, see
 *  `setPlaceholderFrameLine`). The box you are typing in and a peer's box dash
 *  in it too, so where one traces the frame, their dashes start together at its
 *  top-left corner and the box covers the frame. Not a host's to restyle for
 *  that reason. */
export const PLACEHOLDER_FRAME_DASH = 4;
/** The CSS px width of an empty placeholder's dashed frame: thinner than the
 *  boxes that trace it, so they cover it. */
export const PLACEHOLDER_FRAME_WIDTH = 1;
