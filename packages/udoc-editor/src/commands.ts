// The Text, Shape and Object tabs' commands: character and paragraph formatting
// over the text selection, Change Shape over a drawing's shapes, and the Fill /
// Line controls over those or a PDF's page objects (their arrangement commands
// are `arrange.ts`'s).
import { allowsEdit, ICON_FILL, ICON_OPACITY, ICON_STROKE, ICON_TEXT_HIGHLIGHT } from "@docmentis/udoc-ui/internal";
import type { CommandDef } from "@docmentis/udoc-ui/internal";
import {
    fontFamilyControl,
    fontSizeControl,
    listControl,
    paragraphStyleControl,
    textFormatControl,
} from "./components/TextControls.js";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_BOLD,
    ICON_CHANGE_SHAPE,
    ICON_FONT_SIZE,
    ICON_FONTS,
    ICON_ITALIC,
    ICON_LINE_SPACING,
    ICON_LIST_BULLET,
    ICON_LIST_NUMBER,
    ICON_PARAGRAPH_LEFT,
    ICON_PARAGRAPH_STYLE,
    ICON_STRIKETHROUGH,
    ICON_SUBSCRIPT,
    ICON_SUPERSCRIPT,
    ICON_TEXT_FILL,
    ICON_UNDERLINE,
    ICON_WIDTH_SCALE,
} from "./icons.js";
import { objectOpacityControl, paintControl, selectionOpacity } from "./paint.js";
import { editStateOf } from "./state.js";
import { CHANGE_SHAPE_GALLERY, galleryShape } from "./shape-gallery.js";
import {
    LINE_SPACING_MENU,
    PARAGRAPH_ALIGN_MENU,
    whenParagraphFormat,
    whenParagraphStyle,
    whenTextFormat,
    whenWidthScale,
    WIDTH_SCALE_MENU,
} from "./text-format.js";
import type { TextFormatProperty } from "./text-format.js";
import type { EditTools } from "./tools.js";

type Def = CommandDef<MessageKey>;

/**
 * The format commands, their controls built over `tools` — read when the ribbon
 * builds a control, which it does only on an open document's strip, so after
 * edit mode is mounted.
 */
export function formatCommands(tools: () => EditTools): Readonly<Record<string, Def>> {
    // A character toggle: lit while the selection carries `property`.
    const textFormat = (id: string, label: MessageKey, icon: string, property: TextFormatProperty): Def => ({
        id,
        label,
        icon,
        group: "textStyle",
        run: {
            kind: "control",
            cluster: "toggle",
            create: (env) => textFormatControl(env, { id, icon, property }, tools()),
        },
        enabledWhen: whenTextFormat,
    });
    return {
        // Text tab — first the style picker, the paragraph style the touched
        // paragraphs are in, a value field of its own group: the broadest
        // control, which the rest refine. A word document's alone, gated on the
        // engine's `applyParagraphStyle`, which only a document with styles
        // grants.
        paragraphStyle: {
            id: "paragraphStyle",
            label: "command.paragraphStyle",
            icon: ICON_PARAGRAPH_STYLE,
            group: "paragraphStyle",
            run: { kind: "control", create: (env) => paragraphStyleControl(env, "paragraphStyle", tools()) },
            enabledWhen: whenParagraphStyle,
        },
        // Then the font picker, the point-size field, then the Bold /
        // Italic toggles. Each mirrors the selection's resolved format and
        // lowers to a character-property text edit, so all gate on the engine's
        // text `setCharacterProperties` capability (`whenTextFormat`): live over
        // a non-empty text range, greyed on a bare caret or a non-text selection.
        fontFamily: {
            id: "fontFamily",
            label: "command.fontFamily",
            icon: ICON_FONTS,
            group: "font",
            run: { kind: "control", create: (env) => fontFamilyControl(env, "fontFamily", tools()) },
            enabledWhen: whenTextFormat,
        },
        fontSize: {
            id: "fontSize",
            label: "command.fontSize",
            icon: ICON_FONT_SIZE,
            group: "font",
            run: { kind: "control", create: (env) => fontSizeControl(env, "fontSize", tools()) },
            enabledWhen: whenTextFormat,
        },
        // The character-format toggles are their own group ("textStyle"), split
        // from the font fields above so a divider fences the toggle cluster off
        // from the value-fields — the fields hold a value (bordered), the toggles
        // don't (flat), and the divider is what marks that boundary now that
        // neither wears a box.
        bold: textFormat("bold", "command.bold", ICON_BOLD, "bold"),
        italic: textFormat("italic", "command.italic", ICON_ITALIC, "italic"),
        underline: textFormat("underline", "command.underline", ICON_UNDERLINE, "underline"),
        strikethrough: textFormat("strikethrough", "command.strikethrough", ICON_STRIKETHROUGH, "strikethrough"),
        superscript: textFormat("superscript", "command.superscript", ICON_SUPERSCRIPT, "superscript"),
        subscript: textFormat("subscript", "command.subscript", ICON_SUBSCRIPT, "subscript"),
        // Scale — the horizontal glyph stretch (`w:w`), as a dropdown of Word's
        // presets. Word keeps it in its Font dialog; with no dialog here it rides
        // the band beside the toggles.
        widthScale: {
            id: "widthScale",
            label: "command.widthScale",
            icon: ICON_WIDTH_SCALE,
            group: "textStyle",
            run: { kind: "menu", menu: WIDTH_SCALE_MENU },
            enabledWhen: whenWidthScale,
        },
        // Text color + highlight — dropdowns mirroring the selection's span color
        // over the shared color picker (the Fill / Line machinery, `text` /
        // `highlight` channels). A span color is a character property, so they
        // gate with the sibling text controls on `setCharacterProperties`
        // (`whenTextFormat`).
        textFill: {
            id: "textFill",
            label: "command.textFill",
            icon: ICON_TEXT_FILL,
            group: "font",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) => paintControl(env, { id: "textFill", icon: ICON_TEXT_FILL, channel: "text" }, tools()),
            },
            enabledWhen: whenTextFormat,
        },
        textHighlight: {
            id: "textHighlight",
            label: "command.textHighlight",
            icon: ICON_TEXT_HIGHLIGHT,
            group: "font",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) =>
                    paintControl(
                        env,
                        { id: "textHighlight", icon: ICON_TEXT_HIGHLIGHT, channel: "highlight" },
                        tools(),
                    ),
            },
            enabledWhen: whenTextFormat,
        },

        // The paragraph half of the Text tab — its own group ("paragraph"), so a
        // divider fences it off from the character controls above: those act on
        // the spans a selection *covers*, these on the paragraphs it *touches*,
        // and a bare caret lights the second set while greying the first. Four
        // controls butted into one cluster, each with its long tail inside its
        // own menu.
        paragraphAlign: {
            id: "paragraphAlign",
            label: "command.paragraphAlign",
            icon: ICON_PARAGRAPH_LEFT,
            group: "paragraph",
            run: { kind: "menu", menu: PARAGRAPH_ALIGN_MENU, cluster: "paragraph" },
            enabledWhen: whenParagraphFormat,
        },
        lineSpacing: {
            id: "lineSpacing",
            label: "command.lineSpacing",
            icon: ICON_LINE_SPACING,
            group: "paragraph",
            run: { kind: "menu", menu: LINE_SPACING_MENU, cluster: "paragraph" },
            enabledWhen: whenParagraphFormat,
        },
        bulletList: {
            id: "bulletList",
            label: "command.bulletList",
            icon: ICON_LIST_BULLET,
            group: "paragraph",
            run: {
                kind: "control",
                cluster: "paragraph",
                create: (env) =>
                    listControl(env, { id: "bulletList", icon: ICON_LIST_BULLET, list: "bulleted" }, tools()),
            },
            enabledWhen: whenParagraphFormat,
        },
        numberList: {
            id: "numberList",
            label: "command.numberList",
            icon: ICON_LIST_NUMBER,
            group: "paragraph",
            run: {
                kind: "control",
                cluster: "paragraph",
                create: (env) =>
                    listControl(env, { id: "numberList", icon: ICON_LIST_NUMBER, list: "numbered" }, tools()),
            },
            enabledWhen: whenParagraphFormat,
        },

        // Shape tab — first Change Shape, the outline the rest paint and arrange:
        // a cell gives the selection that preset, with its adjust values at their
        // defaults, as PowerPoint and Word do. Enabled where the selection holds a
        // shape or a picture to change, which a connector alone doesn't.
        changeShape: {
            id: "changeShape",
            label: "command.changeShape",
            icon: ICON_CHANGE_SHAPE,
            group: "shapeGeometry",
            run: {
                kind: "gallery",
                sections: CHANGE_SHAPE_GALLERY,
                press: ({ tool }) => {
                    const shape = galleryShape(tool);
                    if (!shape) return;
                    const { host } = tools();
                    void host.commit(() =>
                        host.client.executeOnSelection({
                            kind: "setShapeGeometry",
                            geometry: { preset: { preset: shape.preset, adjustValues: [] } },
                        }),
                    );
                },
            },
            enabledWhen: (c) => allowsEdit(c.selection, "setShapeGeometry"),
        },

        // Then the Fill / Line dropdowns. The color bar reflects the selection's
        // color; the caret opens the picker. Enabled when the selection accepts
        // the paint edit — a drawing shape's `setShapeFill` / `setShapeLine`.
        shapeFillColor: {
            id: "shapeFillColor",
            label: "command.shapeFillColor",
            icon: ICON_FILL,
            group: "paint",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) => paintControl(env, { id: "shapeFillColor", icon: ICON_FILL, channel: "fill" }, tools()),
            },
            enabledWhen: (c) => allowsEdit(c.selection, "setShapeFill"),
        },
        shapeStrokeColor: {
            id: "shapeStrokeColor",
            label: "command.shapeStrokeColor",
            icon: ICON_STROKE,
            group: "paint",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) =>
                    paintControl(env, { id: "shapeStrokeColor", icon: ICON_STROKE, channel: "stroke" }, tools()),
            },
            enabledWhen: (c) => allowsEdit(c.selection, "setShapeLine"),
        },

        // Object tab — the PDF twins of the Shape tab's Fill / Line, gated on a
        // page object's `setNonstrokingStyle` / `setStrokingStyle`.
        objectFillColor: {
            id: "objectFillColor",
            label: "command.objectFillColor",
            icon: ICON_FILL,
            group: "paint",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) =>
                    paintControl(env, { id: "objectFillColor", icon: ICON_FILL, channel: "fill" }, tools()),
            },
            enabledWhen: (c) => allowsEdit(c.selection, "setNonstrokingStyle"),
        },
        objectStrokeColor: {
            id: "objectStrokeColor",
            label: "command.objectStrokeColor",
            icon: ICON_STROKE,
            group: "paint",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) =>
                    paintControl(env, { id: "objectStrokeColor", icon: ICON_STROKE, channel: "stroke" }, tools()),
            },
            enabledWhen: (c) => allowsEdit(c.selection, "setStrokingStyle"),
        },
        objectOpacity: {
            id: "objectOpacity",
            label: "command.annotationOpacity",
            icon: ICON_OPACITY,
            group: "paint",
            run: {
                kind: "control",
                cluster: "paint",
                create: (env) => objectOpacityControl(env, { id: "objectOpacity", icon: ICON_OPACITY }, tools()),
            },
            // Live where the selection agrees on a style to carry the opacity: not
            // on a fill turned off, a group, a form, or differing paint.
            enabledWhen: (c) =>
                allowsEdit(c.selection, "setNonstrokingStyle") &&
                selectionOpacity(editStateOf(c).selectionProperties, "fill") !== null,
        },
    };
}
