import type { EditMessages } from "./messages.js";

/** German. */
export const de: EditMessages = {
    // Modes
    "mode.view": "Anzeigen",
    "mode.edit": "Bearbeiten",

    // Mode switcher
    "modeSwitch.label": "Editormodus",

    // Page controls
    "pageControls.label": "Steuerelemente für Seite {page}",
    "pageControls.moveUp": "Seite nach oben verschieben",
    "pageControls.moveUpLabel": "Seite {page} nach oben verschieben",
    "pageControls.moveDown": "Seite nach unten verschieben",
    "pageControls.moveDownLabel": "Seite {page} nach unten verschieben",
    "pageControls.rotate": "Seite nach rechts drehen",
    "pageControls.rotateLabel": "Seite {page} nach rechts drehen",
    "pageControls.settings": "Seiteneinstellungen",
    "pageControls.settingsLabel": "Einstellungen für Seite {page}",
    "pageControls.delete": "Seite löschen",
    "pageControls.deleteLabel": "Seite {page} löschen",
    "pageControls.insert": "Seite hier einfügen",
    "pageControls.insertAtEnd": "Seite am Ende einfügen",
    "pageControls.insertBefore": "Seite vor Seite {page} einfügen",

    // Page settings dialog
    "pageSettings.title": "Seite {page}",
    "pageSettings.label": "Einstellungen für Seite {page}",
    "pageSettings.pageSize": "Seitengröße",
    "pageSettings.preset": "Vorgabe für Seitengröße",
    "pageSettings.width": "Breite",
    "pageSettings.height": "Höhe",
    "pageSettings.pageWidth": "Seitenbreite",
    "pageSettings.pageHeight": "Seitenhöhe",
    "pageSettings.units": "Einheiten",
    "pageSettings.inches": "Zoll",
    "pageSettings.millimeters": "mm",
    "pageSettings.points": "Pt.",
    "pageSettings.portrait": "Hochformat",
    "pageSettings.landscape": "Querformat",
    "pageSettings.rotation": "Drehung",
    "pageSettings.rotateLeft": "Nach links drehen",
    "pageSettings.rotatePageLeft": "Seite nach links drehen",
    "pageSettings.rotateRight": "Nach rechts drehen",
    "pageSettings.rotatePageRight": "Seite nach rechts drehen",
    "pageSettings.applySize": "Größe übernehmen",

    // Page sizes
    "pageSize.letter": "Letter",
    "pageSize.legal": "Legal",
    "pageSize.tabloid": "Tabloid",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "Benutzerdefiniert",

    // Ribbon tabs
    "ribbon.home": "Start",
    "ribbon.insert": "Einfügen",
    "ribbon.text": "Text",
    "ribbon.shape": "Form",
    "ribbon.object": "Objekt",

    // Commands
    "command.formattingMarks": "Formatierungszeichen anzeigen",
    "command.createSlide": "Neue Folie",
    "command.insertImage": "Bild",
    "command.insertShape": "Formen",
    "command.fontFamily": "Schriftart",
    "command.fontSize": "Schriftgrad",
    "command.bold": "Fett",
    "command.italic": "Kursiv",
    "command.underline": "Unterstreichen",
    "command.strikethrough": "Durchgestrichen",
    "command.superscript": "Hochgestellt",
    "command.subscript": "Tiefgestellt",
    "command.widthScale": "Skalieren",
    "command.textFill": "Schriftfarbe",
    "command.textHighlight": "Hervorheben",
    "command.paragraphAlign": "Ausrichtung und Einzug",
    "command.lineSpacing": "Zeilen- und Absatzabstand",
    "command.bulletList": "Aufzählungszeichen",
    "command.numberList": "Nummerierung",
    "command.shapeFillColor": "Füllung",
    "command.shapeStrokeColor": "Linie",
    "command.shapeArrange": "Anordnen",
    "command.objectFillColor": "Füllung",
    "command.objectStrokeColor": "Linie",
    "command.objectArrange": "Anordnen",

    // New Slide dialog
    "newSlide.label": "Layout für neue Folie",
    "newSlide.layouts": "Folienlayouts",
    "newSlide.layout": "Layout {index}",

    // Shared
    "common.done": "Fertig",

    // Ribbon
    "ribbon.noMatchingFonts": "Keine passenden Schriftarten",
    "ribbon.listOptions": "Optionen für {label}",
    "ribbon.listStyles": "Stile für {label}",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "Linksbündig",
    "paragraph.center": "Zentriert",
    "paragraph.alignRight": "Rechtsbündig",
    "paragraph.justify": "Blocksatz",
    "paragraph.increaseIndent": "Einzug vergrößern",
    "paragraph.decreaseIndent": "Einzug verkleinern",
    "paragraph.lineSpacingSingle": "Einfach",
    "paragraph.lineSpacingDouble": "Doppelt",
    "paragraph.lineSpacingLines": "{lines}",
    "paragraph.spaceBefore": "Abstand vor Absatz",
    "paragraph.spaceAfter": "Abstand nach Absatz",

    // Bullet and numbering galleries, by style id
    "list.disc": "Gefüllte runde Aufzählungszeichen",
    "list.circle": "Hohle runde Aufzählungszeichen",
    "list.square": "Gefüllte quadratische Aufzählungszeichen",
    "list.diamond": "Rautenaufzählungszeichen",
    "list.arrow": "Pfeilaufzählungszeichen",
    "list.dash": "Strichaufzählungszeichen",
    "list.decimal": "Zahlen, gefolgt von einem Punkt",
    "list.decimalParen": "Zahlen, gefolgt von einer Klammer",
    "list.lowerLetter": "Kleinbuchstaben",
    "list.upperLetter": "Großbuchstaben",
    "list.lowerRoman": "Kleine römische Zahlen",
    "list.upperRoman": "Große römische Zahlen",

    // Arrange
    "arrange.bringToFront": "In den Vordergrund",
    "arrange.bringForward": "Eine Ebene nach vorne",
    "arrange.sendBackward": "Eine Ebene nach hinten",
    "arrange.sendToBack": "In den Hintergrund",
    "arrange.alignLeft": "Linksbündig ausrichten",
    "arrange.alignCenter": "Horizontal zentrieren",
    "arrange.alignRight": "Rechtsbündig ausrichten",
    "arrange.alignTop": "Oben ausrichten",
    "arrange.alignMiddle": "Vertikal zentrieren",
    "arrange.alignBottom": "Unten ausrichten",
    "arrange.distributeHorizontally": "Horizontal verteilen",
    "arrange.distributeVertically": "Vertikal verteilen",
    "arrange.alignToPage": "An Seite ausrichten",
    "arrange.rotateRight": "Rechtsdrehung 90°",
    "arrange.rotateLeft": "Linksdrehung 90°",
    "arrange.flipHorizontal": "Horizontal kippen",
    "arrange.flipVertical": "Vertikal kippen",
    "arrange.order": "Reihenfolge",
    "arrange.align": "Ausrichten",
    "arrange.rotate": "Drehen",
    "arrange.group": "Gruppieren",
    "arrange.ungroup": "Gruppierung aufheben",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "Fülloptionen",
    "paintOptions.lineTitle": "Linienoptionen",
    "paintOptions.textColorTitle": "Optionen für Schriftfarbe",
    "paintOptions.highlightTitle": "Optionen für Hervorhebung",
    "paintOptions.fillBlurb":
        "Hier finden Sie künftig benutzerdefinierte Farben sowie Farbverlaufs-, Muster- und Bildfüllungen.",
    "paintOptions.lineBlurb":
        "Hier finden Sie künftig benutzerdefinierte Farben, Verbundlinien, Abschluss- und Anschlusstypen sowie Pfeilenden.",
    "paintOptions.textColorBlurb":
        "Hier finden Sie künftig benutzerdefinierte Farben und weitere Optionen für die Schriftfarbe.",
    "paintOptions.highlightBlurb":
        "Hier finden Sie künftig benutzerdefinierte Farben und weitere Optionen für die Hervorhebung.",

    // Busy hold
    "busy.loadingFont": "{font} wird geladen…",

    // Context menu
    "contextMenu.cut": "Ausschneiden",
    "contextMenu.paste": "Einfügen",
    "contextMenu.delete": "Löschen",

    // Context menu over a table
    "table.selectRow": "Zeile",
    "table.selectColumn": "Spalte",
    "table.selectTable": "Tabelle",
    "table.rowAbove": "Zeile oberhalb",
    "table.rowBelow": "Zeile unterhalb",
    "table.columnLeft": "Spalte links",
    "table.columnRight": "Spalte rechts",
    "table.deleteRows": "Zeilen",
    "table.deleteColumns": "Spalten",
    "table.select": "Auswählen",
    "table.insert": "Einfügen",
    "table.delete": "Löschen",
    "table.mergeCells": "Zellen verbinden",
    "table.unmergeCells": "Zellverbund aufheben",

    // Toolbar
    "toolbar.label": "Editor-Symbolleiste",
};
