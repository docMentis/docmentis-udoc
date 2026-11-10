// Arrange: the Shape and Object tabs' arrangement commands — the Order, Align
// and Rotate dropdowns and Group / Ungroup — and the edits they make of the
// selection.
import { allowsEdit, ICON_ROTATE_LEFT, ICON_ROTATE_RIGHT, profileFor } from "@docmentis/udoc-ui/internal";
import type {
    AlignEdge,
    CommandDef,
    EditAxis,
    EnabledWhen,
    MenuItem,
    SelectionEdit,
    UIShellHost,
    ZOrder,
} from "@docmentis/udoc-ui/internal";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_ALIGN_BOTTOM,
    ICON_ALIGN_CENTER_H,
    ICON_ALIGN_LEFT,
    ICON_ALIGN_MIDDLE_V,
    ICON_ALIGN_RIGHT,
    ICON_ALIGN_TOP,
    ICON_BRING_FORWARD,
    ICON_BRING_TO_FRONT,
    ICON_DISTRIBUTE_H,
    ICON_DISTRIBUTE_V,
    ICON_FLIP,
    ICON_GROUP,
    ICON_SEND_BACKWARD,
    ICON_SEND_TO_BACK,
    ICON_UNGROUP,
} from "./icons.js";
import { editAction } from "./menu-action.js";
import { editState, editStateOf } from "./state.js";

/** A quarter turn in radians — the Rotate dropdown's 90° steps. Document space is
 *  y-down, so a positive angle reads as clockwise on screen. */
const QUARTER_TURN = Math.PI / 2;

/** Flip Vertical's glyph: Material Symbols draws the mirror about an upright
 *  axis only, so the horizontal one is {@link ICON_FLIP} given a quarter turn. */
export const ICON_FLIP_VERTICAL = ICON_FLIP.replace("<svg ", '<svg style="transform: rotate(90deg)" ');

/** True when any item in `items` is enabled — the enablement of a dropdown,
 *  which lights up exactly when it has a live row to offer. */
const anyEnabled =
    (items: readonly MenuItem<MessageKey>[]): EnabledWhen =>
    (c) =>
        items.some((i) => i.enabledWhen(c));

/**
 * The Shape tab's Order dropdown: z-order moves ordered front→back (top of
 * menu = top of the stack).
 */
const SHAPE_ORDER_MENU: readonly MenuItem<MessageKey>[] = [
    // All four moves share one precondition (`reorderShapes`): the engine reports it
    // live when the selection isn't already the contiguous front-and-back block,
    // so if no move would change anything the whole dropdown greys out together.
    {
        action: editAction({ kind: "reorder", order: "front" }),
        label: "arrange.bringToFront",
        icon: ICON_BRING_TO_FRONT,
        enabledWhen: (c) => allowsEdit(c.selection, "reorderShapes"),
    },
    {
        action: editAction({ kind: "reorder", order: "forward" }),
        label: "arrange.bringForward",
        icon: ICON_BRING_FORWARD,
        enabledWhen: (c) => allowsEdit(c.selection, "reorderShapes"),
    },
    {
        action: editAction({ kind: "reorder", order: "backward" }),
        label: "arrange.sendBackward",
        icon: ICON_SEND_BACKWARD,
        enabledWhen: (c) => allowsEdit(c.selection, "reorderShapes"),
    },
    {
        action: editAction({ kind: "reorder", order: "back" }),
        label: "arrange.sendToBack",
        icon: ICON_SEND_TO_BACK,
        enabledWhen: (c) => allowsEdit(c.selection, "reorderShapes"),
    },
];

/** Whether the selected shapes can be aligned to `edge`: aligning to the slide
 *  needs one shape, aligning to the selection's own bounds needs two (a lone box
 *  is already its own union). Both need the shapes to be movable. */
const canAlignShapes: EnabledWhen = (c) =>
    allowsEdit(c.selection, "translateShapes") && c.selection.count >= (editStateOf(c).alignToPage ? 1 : 2);

/**
 * The Align dropdown: the six edge/center alignments, the two distributions
 * below a divider, then the page/slide reference toggle. The toggle flips
 * whether the edges align to the page or to the selection's own bounds.
 */
const SHAPE_ALIGN_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "align", edge: "left" }),
        label: "arrange.alignLeft",
        icon: ICON_ALIGN_LEFT,
        enabledWhen: canAlignShapes,
    },
    {
        action: editAction({ kind: "align", edge: "centerX" }),
        label: "arrange.alignCenter",
        icon: ICON_ALIGN_CENTER_H,
        enabledWhen: canAlignShapes,
    },
    {
        action: editAction({ kind: "align", edge: "right" }),
        label: "arrange.alignRight",
        icon: ICON_ALIGN_RIGHT,
        enabledWhen: canAlignShapes,
    },
    {
        action: editAction({ kind: "align", edge: "top" }),
        label: "arrange.alignTop",
        icon: ICON_ALIGN_TOP,
        enabledWhen: canAlignShapes,
    },
    {
        action: editAction({ kind: "align", edge: "centerY" }),
        label: "arrange.alignMiddle",
        icon: ICON_ALIGN_MIDDLE_V,
        enabledWhen: canAlignShapes,
    },
    {
        action: editAction({ kind: "align", edge: "bottom" }),
        label: "arrange.alignBottom",
        icon: ICON_ALIGN_BOTTOM,
        enabledWhen: canAlignShapes,
    },
    // Distribute equalizes gaps, so it needs three boxes to have an inner one to move.
    {
        action: editAction({ kind: "distribute", axis: "horizontal" }),
        label: "arrange.distributeHorizontally",
        icon: ICON_DISTRIBUTE_H,
        enabledWhen: (c) => allowsEdit(c.selection, "translateShapes") && c.selection.count >= 3,
        separatorBefore: true,
    },
    {
        action: editAction({ kind: "distribute", axis: "vertical" }),
        label: "arrange.distributeVertically",
        icon: ICON_DISTRIBUTE_V,
        enabledWhen: (c) => allowsEdit(c.selection, "translateShapes") && c.selection.count >= 3,
    },
    {
        action: editAction({ kind: "alignToPage" }),
        label: "arrange.alignToPage",
        enabledWhen: (c) => c.ready,
        separatorBefore: true,
        checked: (c) => editStateOf(c).alignToPage,
        keepsOpen: true,
    },
];

/**
 * The Rotate dropdown: quarter-turn rotations, then the two mirror flips below a
 * divider. Each acts on every selected object in place (about its own center).
 */
const SHAPE_ROTATE_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "rotate", angle: QUARTER_TURN }),
        label: "arrange.rotateRight",
        icon: ICON_ROTATE_RIGHT,
        enabledWhen: (c) => allowsEdit(c.selection, "rotateEachShape"),
    },
    {
        action: editAction({ kind: "rotate", angle: -QUARTER_TURN }),
        label: "arrange.rotateLeft",
        icon: ICON_ROTATE_LEFT,
        enabledWhen: (c) => allowsEdit(c.selection, "rotateEachShape"),
    },
    {
        action: editAction({ kind: "flip", axis: "horizontal" }),
        label: "arrange.flipHorizontal",
        icon: ICON_FLIP,
        enabledWhen: (c) => allowsEdit(c.selection, "scaleEachShape"),
        separatorBefore: true,
    },
    {
        action: editAction({ kind: "flip", axis: "vertical" }),
        label: "arrange.flipVertical",
        icon: ICON_FLIP_VERTICAL,
        enabledWhen: (c) => allowsEdit(c.selection, "scaleEachShape"),
    },
];

/**
 * The Object tab's Order dropdown: z-order moves ordered front→back (top of
 * menu = top of the stack).
 */
const OBJECT_ORDER_MENU: readonly MenuItem<MessageKey>[] = [
    // All four moves share one precondition (`reorderObjects`, or
    // `reorderAnnotations` for selected annotations): the engine reports it live
    // when the selection isn't already the contiguous front-and-back block, so if
    // no move would change anything the whole dropdown greys out together.
    {
        action: editAction({ kind: "reorder", order: "front" }),
        label: "arrange.bringToFront",
        icon: ICON_BRING_TO_FRONT,
        enabledWhen: (c) => allowsEdit(c.selection, "reorderObjects", "reorderAnnotations"),
    },
    {
        action: editAction({ kind: "reorder", order: "forward" }),
        label: "arrange.bringForward",
        icon: ICON_BRING_FORWARD,
        enabledWhen: (c) => allowsEdit(c.selection, "reorderObjects", "reorderAnnotations"),
    },
    {
        action: editAction({ kind: "reorder", order: "backward" }),
        label: "arrange.sendBackward",
        icon: ICON_SEND_BACKWARD,
        enabledWhen: (c) => allowsEdit(c.selection, "reorderObjects", "reorderAnnotations"),
    },
    {
        action: editAction({ kind: "reorder", order: "back" }),
        label: "arrange.sendToBack",
        icon: ICON_SEND_TO_BACK,
        enabledWhen: (c) => allowsEdit(c.selection, "reorderObjects", "reorderAnnotations"),
    },
];

/** Whether the selected objects can be aligned to `edge`: aligning to the page
 *  needs one object, aligning to the selection's own bounds needs two (a lone
 *  box is already its own union). Both need the objects to be movable. */
const canAlignObjects: EnabledWhen = (c) =>
    allowsEdit(c.selection, "translateObjects") && c.selection.count >= (editStateOf(c).alignToPage ? 1 : 2);

/**
 * The Align dropdown: the six edge/center alignments, the two distributions
 * below a divider, then the page/slide reference toggle. The toggle flips
 * whether the edges align to the page or to the selection's own bounds.
 */
const OBJECT_ALIGN_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "align", edge: "left" }),
        label: "arrange.alignLeft",
        icon: ICON_ALIGN_LEFT,
        enabledWhen: canAlignObjects,
    },
    {
        action: editAction({ kind: "align", edge: "centerX" }),
        label: "arrange.alignCenter",
        icon: ICON_ALIGN_CENTER_H,
        enabledWhen: canAlignObjects,
    },
    {
        action: editAction({ kind: "align", edge: "right" }),
        label: "arrange.alignRight",
        icon: ICON_ALIGN_RIGHT,
        enabledWhen: canAlignObjects,
    },
    {
        action: editAction({ kind: "align", edge: "top" }),
        label: "arrange.alignTop",
        icon: ICON_ALIGN_TOP,
        enabledWhen: canAlignObjects,
    },
    {
        action: editAction({ kind: "align", edge: "centerY" }),
        label: "arrange.alignMiddle",
        icon: ICON_ALIGN_MIDDLE_V,
        enabledWhen: canAlignObjects,
    },
    {
        action: editAction({ kind: "align", edge: "bottom" }),
        label: "arrange.alignBottom",
        icon: ICON_ALIGN_BOTTOM,
        enabledWhen: canAlignObjects,
    },
    // Distribute equalizes gaps, so it needs three boxes to have an inner one to move.
    {
        action: editAction({ kind: "distribute", axis: "horizontal" }),
        label: "arrange.distributeHorizontally",
        icon: ICON_DISTRIBUTE_H,
        enabledWhen: (c) => allowsEdit(c.selection, "translateObjects") && c.selection.count >= 3,
        separatorBefore: true,
    },
    {
        action: editAction({ kind: "distribute", axis: "vertical" }),
        label: "arrange.distributeVertically",
        icon: ICON_DISTRIBUTE_V,
        enabledWhen: (c) => allowsEdit(c.selection, "translateObjects") && c.selection.count >= 3,
    },
    {
        action: editAction({ kind: "alignToPage" }),
        label: "arrange.alignToPage",
        enabledWhen: (c) => c.ready,
        separatorBefore: true,
        checked: (c) => editStateOf(c).alignToPage,
        keepsOpen: true,
    },
];

/**
 * The Rotate dropdown: quarter-turn rotations, then the two mirror flips below a
 * divider. Each acts on every selected object in place (about its own center).
 */
const OBJECT_ROTATE_MENU: readonly MenuItem<MessageKey>[] = [
    {
        action: editAction({ kind: "rotate", angle: QUARTER_TURN }),
        label: "arrange.rotateRight",
        icon: ICON_ROTATE_RIGHT,
        enabledWhen: (c) => allowsEdit(c.selection, "rotateEachObject"),
    },
    {
        action: editAction({ kind: "rotate", angle: -QUARTER_TURN }),
        label: "arrange.rotateLeft",
        icon: ICON_ROTATE_LEFT,
        enabledWhen: (c) => allowsEdit(c.selection, "rotateEachObject"),
    },
    {
        action: editAction({ kind: "flip", axis: "horizontal" }),
        label: "arrange.flipHorizontal",
        icon: ICON_FLIP,
        enabledWhen: (c) => allowsEdit(c.selection, "scaleEachObject"),
        separatorBefore: true,
    },
    {
        action: editAction({ kind: "flip", axis: "vertical" }),
        label: "arrange.flipVertical",
        icon: ICON_FLIP_VERTICAL,
        enabledWhen: (c) => allowsEdit(c.selection, "scaleEachObject"),
    },
];

/**
 * The Shape and Object tabs' arrangement commands, over the {@link ArrangeEdits}
 * once edit mode is mounted: the Order, Align and Rotate dropdowns bunched into
 * one button group, then Group and Ungroup into another past a divider. The
 * Shape tab's are gated on a drawing's shape edits, the Object tab's on a PDF's
 * page object edits.
 *
 * Align greys on {@link canAlignShapes} / {@link canAlignObjects} rather than
 * on any of its rows being live, because its always-on "Align to page" toggle
 * would otherwise light it up with nothing to align.
 */
export function arrangeCommands(arrange: () => ArrangeEdits | null): Readonly<Record<string, CommandDef<MessageKey>>> {
    const dropdown = (
        id: string,
        label: MessageKey,
        icon: string,
        menu: readonly MenuItem<MessageKey>[],
        enabledWhen: EnabledWhen,
    ): CommandDef<MessageKey> => ({
        id,
        label,
        icon,
        group: "arrange",
        run: { kind: "menu", menu, cluster: "arrange" },
        enabledWhen,
    });
    const button = (
        id: string,
        label: MessageKey,
        icon: string,
        press: () => void,
        enabledWhen: EnabledWhen,
    ): CommandDef<MessageKey> => ({
        id,
        label,
        icon,
        group: "grouping",
        run: { kind: "action", cluster: "arrange", press },
        enabledWhen,
    });
    const group = () => void arrange()?.groupSelection();
    const ungroup = () => void arrange()?.ungroupSelection();
    return {
        shapeOrder: dropdown(
            "shapeOrder",
            "arrange.order",
            ICON_BRING_FORWARD,
            SHAPE_ORDER_MENU,
            anyEnabled(SHAPE_ORDER_MENU),
        ),
        shapeAlign: dropdown("shapeAlign", "arrange.align", ICON_ALIGN_LEFT, SHAPE_ALIGN_MENU, canAlignShapes),
        shapeRotate: dropdown(
            "shapeRotate",
            "arrange.rotate",
            ICON_ROTATE_RIGHT,
            SHAPE_ROTATE_MENU,
            anyEnabled(SHAPE_ROTATE_MENU),
        ),
        shapeGroup: button("shapeGroup", "arrange.group", ICON_GROUP, group, (c) =>
            allowsEdit(c.selection, "groupShapes"),
        ),
        shapeUngroup: button("shapeUngroup", "arrange.ungroup", ICON_UNGROUP, ungroup, (c) =>
            allowsEdit(c.selection, "ungroupShapes"),
        ),
        objectOrder: dropdown(
            "objectOrder",
            "arrange.order",
            ICON_BRING_FORWARD,
            OBJECT_ORDER_MENU,
            anyEnabled(OBJECT_ORDER_MENU),
        ),
        objectAlign: dropdown("objectAlign", "arrange.align", ICON_ALIGN_LEFT, OBJECT_ALIGN_MENU, canAlignObjects),
        objectRotate: dropdown(
            "objectRotate",
            "arrange.rotate",
            ICON_ROTATE_RIGHT,
            OBJECT_ROTATE_MENU,
            anyEnabled(OBJECT_ROTATE_MENU),
        ),
        objectGroup: button("objectGroup", "arrange.group", ICON_GROUP, group, (c) =>
            allowsEdit(c.selection, "groupObjects"),
        ),
        objectUngroup: button("objectUngroup", "arrange.ungroup", ICON_UNGROUP, ungroup, (c) =>
            allowsEdit(c.selection, "ungroupObjects"),
        ),
    };
}

/** The arrangement edits of the selection, on the shell `host` lends. */
export function createArrangeEdits(host: UIShellHost) {
    const { store, client, commit } = host;
    const annotationsSelected = () => host.annotationsSelected();

    // Each edit names what it acts on, as its command does: a drawing's shapes
    // — in the doc types embedding the drawing families, a slide's shapes, a
    // docx drawing's or those drawn over an image — or a PDF's page objects or
    // annotations.
    function shapeDocType(): boolean {
        return profileFor(store.getState().docType).drawingShapes;
    }

    function reorderSelection(order: ZOrder): Promise<void> {
        let edit: SelectionEdit;
        if (shapeDocType()) edit = { kind: "reorderShapes", order };
        else if (annotationsSelected()) edit = { kind: "annotation", edit: { kind: "reorderAnnotations", order } };
        else edit = { kind: "object", edit: { kind: "reorderObjects", order } };
        return commit(() => client.executeOnSelection(edit));
    }

    // Align reads the live `alignToPage` flag to pick its reference (the
    // selection's own bounds vs. the page/slide); distribute and flip carry only
    // their axis. All ride the agnostic `executeOnSelection` seam.
    function alignSelection(edge: AlignEdge): Promise<void> {
        const toPage = editState(store.getState()).alignToPage;
        const edit: SelectionEdit = shapeDocType()
            ? { kind: "alignShapes", edge, toPage }
            : { kind: "object", edit: { kind: "alignObjects", edge, toPage } };
        return commit(() => client.executeOnSelection(edit));
    }

    function distributeSelection(axis: EditAxis): Promise<void> {
        const edit: SelectionEdit = shapeDocType()
            ? { kind: "distributeShapes", axis }
            : { kind: "object", edit: { kind: "distributeObjects", axis } };
        return commit(() => client.executeOnSelection(edit));
    }

    function flipSelection(axis: EditAxis): Promise<void> {
        const edit: SelectionEdit = shapeDocType()
            ? { kind: "flipShapes", axis }
            : { kind: "object", edit: { kind: "flipObjects", axis } };
        return commit(() => client.executeOnSelection(edit));
    }

    function groupSelection(): Promise<void> {
        const edit: SelectionEdit = shapeDocType()
            ? { kind: "groupShapes" }
            : { kind: "object", edit: { kind: "groupObjects" } };
        return commit(() => client.executeOnSelection(edit));
    }

    function ungroupSelection(): Promise<void> {
        const edit: SelectionEdit = shapeDocType()
            ? { kind: "ungroupShapes" }
            : { kind: "object", edit: { kind: "ungroupObjects" } };
        return commit(() => client.executeOnSelection(edit));
    }

    // Turn each selected object by `angle` about its own center — the Rotate
    // dropdown's quarter turns, and the rotation grip's drag.
    function rotateSelectionEach(angle: number): Promise<void> {
        const edit: SelectionEdit = shapeDocType()
            ? { kind: "rotateEachShape", angle }
            : { kind: "object", edit: { kind: "rotateEachObject", angle } };
        return commit(() => client.executeOnSelection(edit));
    }

    return {
        reorderSelection,
        alignSelection,
        distributeSelection,
        flipSelection,
        groupSelection,
        ungroupSelection,
        rotateSelectionEach,
    };
}

/** The arrangement edits {@link createArrangeEdits} makes. */
export type ArrangeEdits = ReturnType<typeof createArrangeEdits>;
