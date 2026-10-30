import type { EditMessages } from "./messages.js";

/** French. */
export const fr: EditMessages = {
    // Modes
    "mode.view": "Affichage",
    "mode.edit": "Modification",

    // Mode switcher
    "modeSwitch.label": "Mode de l'éditeur",

    // Page controls
    "pageControls.label": "Commandes de la page {page}",
    "pageControls.moveUp": "Déplacer la page vers le haut",
    "pageControls.moveUpLabel": "Déplacer la page {page} vers le haut",
    "pageControls.moveDown": "Déplacer la page vers le bas",
    "pageControls.moveDownLabel": "Déplacer la page {page} vers le bas",
    "pageControls.rotate": "Faire pivoter la page à droite",
    "pageControls.rotateLabel": "Faire pivoter la page {page} à droite",
    "pageControls.settings": "Paramètres de la page",
    "pageControls.settingsLabel": "Paramètres de la page {page}",
    "pageControls.delete": "Supprimer la page",
    "pageControls.deleteLabel": "Supprimer la page {page}",
    "pageControls.insert": "Insérer une page ici",
    "pageControls.insertAtEnd": "Insérer une page à la fin",
    "pageControls.insertBefore": "Insérer une page avant la page {page}",

    // Page settings dialog
    "pageSettings.title": "Page {page}",
    "pageSettings.label": "Paramètres de la page {page}",
    "pageSettings.pageSize": "Taille de la page",
    "pageSettings.preset": "Taille de page prédéfinie",
    "pageSettings.width": "Largeur",
    "pageSettings.height": "Hauteur",
    "pageSettings.pageWidth": "Largeur de la page",
    "pageSettings.pageHeight": "Hauteur de la page",
    "pageSettings.units": "Unités",
    "pageSettings.inches": "po",
    "pageSettings.millimeters": "mm",
    "pageSettings.points": "pt",
    "pageSettings.portrait": "Portrait",
    "pageSettings.landscape": "Paysage",
    "pageSettings.rotation": "Rotation",
    "pageSettings.rotateLeft": "Faire pivoter à gauche",
    "pageSettings.rotatePageLeft": "Faire pivoter la page à gauche",
    "pageSettings.rotateRight": "Faire pivoter à droite",
    "pageSettings.rotatePageRight": "Faire pivoter la page à droite",
    "pageSettings.applySize": "Appliquer la taille",

    // Page sizes
    "pageSize.letter": "Lettre US",
    "pageSize.legal": "Légal US",
    "pageSize.tabloid": "Tabloïd",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "Personnalisé",

    // Ribbon tabs
    "ribbon.home": "Accueil",
    "ribbon.insert": "Insertion",
    "ribbon.text": "Texte",
    "ribbon.shape": "Forme",
    "ribbon.object": "Objet",

    // Commands
    "command.formattingMarks": "Afficher les marques de mise en forme",
    "command.createSlide": "Nouvelle diapositive",
    "command.insertImage": "Image",
    "command.insertShape": "Formes",
    "command.cropPage": "Rogner",
    "command.resizePage": "Taille de l'image",
    "command.fontFamily": "Police",
    "command.fontSize": "Taille",
    "command.bold": "Gras",
    "command.italic": "Italique",
    "command.underline": "Souligner",
    "command.strikethrough": "Barré",
    "command.superscript": "Exposant",
    "command.subscript": "Indice",
    "command.widthScale": "Échelle",
    "command.textFill": "Couleur du texte",
    "command.textHighlight": "Surbrillance",
    "command.paragraphAlign": "Alignement et retrait",
    "command.lineSpacing": "Interligne et espacement de paragraphe",
    "command.bulletList": "Liste à puces",
    "command.numberList": "Liste numérotée",
    "command.shapeFillColor": "Remplissage",
    "command.shapeStrokeColor": "Contour",
    "command.shapeArrange": "Organiser",
    "command.objectFillColor": "Remplissage",
    "command.objectStrokeColor": "Contour",
    "command.objectArrange": "Organiser",

    // New Slide dialog
    "newSlide.label": "Disposition de la nouvelle diapositive",
    "newSlide.layouts": "Dispositions des diapositives",
    "newSlide.layout": "Disposition {index}",

    // Shared
    "common.done": "Terminé",

    // Ribbon
    "ribbon.noMatchingFonts": "Aucune police correspondante",
    "ribbon.listOptions": "Options : {label}",
    "ribbon.listStyles": "Styles : {label}",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "Aligner à gauche",
    "paragraph.center": "Centrer",
    "paragraph.alignRight": "Aligner à droite",
    "paragraph.justify": "Justifier",
    "paragraph.increaseIndent": "Augmenter le retrait",
    "paragraph.decreaseIndent": "Diminuer le retrait",
    "paragraph.lineSpacingSingle": "Simple",
    "paragraph.lineSpacingDouble": "Double",
    "paragraph.lineSpacingLines": "{lines}",
    "paragraph.spaceBefore": "Espace avant le paragraphe",
    "paragraph.spaceAfter": "Espace après le paragraphe",

    // Bullet and numbering galleries, by style id
    "list.disc": "Puces rondes pleines",
    "list.circle": "Puces rondes vides",
    "list.square": "Puces carrées pleines",
    "list.diamond": "Puces en losange",
    "list.arrow": "Puces en flèche",
    "list.dash": "Puces en tiret",
    "list.decimal": "Nombres suivis d'un point",
    "list.decimalParen": "Nombres suivis d'une parenthèse",
    "list.lowerLetter": "Lettres minuscules",
    "list.upperLetter": "Lettres majuscules",
    "list.lowerRoman": "Chiffres romains minuscules",
    "list.upperRoman": "Chiffres romains majuscules",

    // Arrange
    "arrange.bringToFront": "Mettre au premier plan",
    "arrange.bringForward": "Avancer",
    "arrange.sendBackward": "Reculer",
    "arrange.sendToBack": "Mettre à l'arrière-plan",
    "arrange.alignLeft": "Aligner à gauche",
    "arrange.alignCenter": "Centrer",
    "arrange.alignRight": "Aligner à droite",
    "arrange.alignTop": "Aligner en haut",
    "arrange.alignMiddle": "Aligner au milieu",
    "arrange.alignBottom": "Aligner en bas",
    "arrange.distributeHorizontally": "Distribuer horizontalement",
    "arrange.distributeVertically": "Distribuer verticalement",
    "arrange.alignToPage": "Aligner sur la page",
    "arrange.rotateRight": "Faire pivoter à droite de 90°",
    "arrange.rotateLeft": "Faire pivoter à gauche de 90°",
    "arrange.flipHorizontal": "Retourner horizontalement",
    "arrange.flipVertical": "Retourner verticalement",
    "arrange.order": "Ordre",
    "arrange.align": "Aligner",
    "arrange.rotate": "Faire pivoter",
    "arrange.group": "Grouper",
    "arrange.ungroup": "Dissocier",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "Options de remplissage",
    "paintOptions.lineTitle": "Options de contour",
    "paintOptions.textColorTitle": "Options de couleur du texte",
    "paintOptions.highlightTitle": "Options de surbrillance",
    "paintOptions.fillBlurb":
        "Les couleurs personnalisées et les remplissages dégradés, à motif et avec image seront disponibles ici.",
    "paintOptions.lineBlurb":
        "Les couleurs personnalisées, les traits composés, les extrémités et jointures, ainsi que les flèches seront disponibles ici.",
    "paintOptions.textColorBlurb":
        "Les couleurs personnalisées et d'autres options de couleur du texte seront disponibles ici.",
    "paintOptions.highlightBlurb":
        "Les couleurs personnalisées et d'autres options de surbrillance seront disponibles ici.",

    // Busy hold
    "busy.loadingFont": "Chargement de la police {font}…",

    // Context menu
    "contextMenu.cut": "Couper",
    "contextMenu.paste": "Coller",
    "contextMenu.delete": "Supprimer",

    // Context menu over a table
    "table.selectRow": "Ligne",
    "table.selectColumn": "Colonne",
    "table.selectTable": "Tableau",
    "table.rowAbove": "Ligne au-dessus",
    "table.rowBelow": "Ligne en dessous",
    "table.columnLeft": "Colonne à gauche",
    "table.columnRight": "Colonne à droite",
    "table.deleteRows": "Lignes",
    "table.deleteColumns": "Colonnes",
    "table.select": "Sélectionner",
    "table.insert": "Insérer",
    "table.delete": "Supprimer",
    "table.mergeCells": "Fusionner les cellules",
    "table.unmergeCells": "Annuler la fusion des cellules",

    // Crop mode and the Image Size dialog
    "image.aspectRatio": "Proportions",
    "image.free": "Libre",
    "image.original": "Originales",
    "image.square": "Carré",
    "image.ratio": "{ratio}",
    "image.cropSize": "{width} × {height} px",
    "image.reset": "Réinitialiser",
    "image.apply": "Appliquer",
    "image.keepRatio": "Conserver les proportions",
    "image.originalSize": "Taille d'origine : {width} × {height} px",
    "image.pixels": "px",

    // Toolbar
    "toolbar.label": "Barre d'outils de l'éditeur",
};
