// The Text, Shape and Object tabs' commands: character and paragraph formatting
// over the text selection, and the Fill / Line / Arrange controls over a
// drawing's shapes or a PDF's page objects.
import { allowsEdit, ICON_FILL, ICON_STROKE, ICON_TEXT_HIGHLIGHT } from "@docmentis/udoc-ui/internal";
import type { CommandDef } from "@docmentis/udoc-ui/internal";
import { OBJECT_ARRANGE_MENU, SHAPE_ARRANGE_MENU } from "./arrange.js";
import { fontFamilyControl, fontSizeControl, listControl, textFormatControl } from "./components/TextControls.js";
import type { MessageKey } from "./i18n/index.js";
import {
    ICON_ARRANGE,
    ICON_BOLD,
    ICON_FONT_SIZE,
    ICON_FONTS,
    ICON_ITALIC,
    ICON_LINE_SPACING,
    ICON_LIST_BULLET,
    ICON_LIST_NUMBER,
    ICON_PARAGRAPH_LEFT,
    ICON_STRIKETHROUGH,
    ICON_SUBSCRIPT,
    ICON_SUPERSCRIPT,
    ICON_TEXT_FILL,
    ICON_UNDERLINE,
    ICON_WIDTH_SCALE,
} from "./icons.js";
import { paintControl } from "./paint.js";
import {
    LINE_SPACING_MENU,
    PARAGRAPH_ALIGN_MENU,
    whenParagraphFormat,
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
        // Text tab — the font picker, the point-size field, then the Bold /
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

        // Shape tab — the Fill / Line dropdowns. The color bar reflects the
        // selection's color; the caret opens the picker. Enabled when the
        // selection accepts the paint edit — a drawing shape's `setShapeFill` /
        // `setShapeLine`.
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

        // The Shape tab's one arrangement button. Its dropdown nests Order /
        // Align / Rotate submenus plus Group / Ungroup; it greys out exactly when
        // the whole menu would be dead (nothing selected, or a lone shape that
        // can't move, align, rotate, or (un)group).
        shapeArrange: {
            id: "shapeArrange",
            label: "command.shapeArrange",
            icon: ICON_ARRANGE,
            group: "arrange",
            run: { kind: "menu", menu: SHAPE_ARRANGE_MENU },
            enabledWhen: (c) => SHAPE_ARRANGE_MENU.some((i) => i.enabledWhen(c)),
        },

        // Object tab — the PDF twins of the Shape tab's three: Fill / Line gated
        // on a page object's `setNonstrokingStyle` / `setStrokingStyle`, and
        // Arrange over its own menu of object edits.
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
        objectArrange: {
            id: "objectArrange",
            label: "command.objectArrange",
            icon: ICON_ARRANGE,
            group: "arrange",
            run: { kind: "menu", menu: OBJECT_ARRANGE_MENU },
            enabledWhen: (c) => OBJECT_ARRANGE_MENU.some((i) => i.enabledWhen(c)),
        },
    };
}
