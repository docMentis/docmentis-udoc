import type { EditMessages } from "./messages.js";

/** Spanish. */
export const es: EditMessages = {
    // Modes
    "mode.view": "Visualización",
    "mode.edit": "Edición",

    // Mode switcher
    "modeSwitch.label": "Modo del editor",

    // Page controls
    "pageControls.label": "Controles de la página {page}",
    "pageControls.moveUp": "Mover página hacia arriba",
    "pageControls.moveUpLabel": "Mover la página {page} hacia arriba",
    "pageControls.moveDown": "Mover página hacia abajo",
    "pageControls.moveDownLabel": "Mover la página {page} hacia abajo",
    "pageControls.rotate": "Girar página a la derecha",
    "pageControls.rotateLabel": "Girar la página {page} a la derecha",
    "pageControls.settings": "Configuración de página",
    "pageControls.settingsLabel": "Configuración de la página {page}",
    "pageControls.delete": "Eliminar página",
    "pageControls.deleteLabel": "Eliminar la página {page}",
    "pageControls.insert": "Insertar página aquí",
    "pageControls.insertAtEnd": "Insertar página al final",
    "pageControls.insertBefore": "Insertar página antes de la página {page}",

    // Page settings dialog
    "pageSettings.title": "Página {page}",
    "pageSettings.label": "Configuración de la página {page}",
    "pageSettings.pageSize": "Tamaño de página",
    "pageSettings.preset": "Tamaño de página predefinido",
    "pageSettings.width": "Ancho",
    "pageSettings.height": "Alto",
    "pageSettings.pageWidth": "Ancho de página",
    "pageSettings.pageHeight": "Alto de página",
    "pageSettings.units": "Unidades",
    "pageSettings.inches": "pulg.",
    "pageSettings.millimeters": "mm",
    "pageSettings.points": "pto",
    "pageSettings.portrait": "Vertical",
    "pageSettings.landscape": "Horizontal",
    "pageSettings.rotation": "Rotación",
    "pageSettings.rotateLeft": "Girar a la izquierda",
    "pageSettings.rotatePageLeft": "Girar página a la izquierda",
    "pageSettings.rotateRight": "Girar a la derecha",
    "pageSettings.rotatePageRight": "Girar página a la derecha",
    "pageSettings.applySize": "Aplicar tamaño",

    // Page sizes
    "pageSize.letter": "Carta",
    "pageSize.legal": "Legal",
    "pageSize.tabloid": "Tabloide",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "Personalizado",

    // Ribbon tabs
    "ribbon.home": "Inicio",
    "ribbon.insert": "Insertar",
    "ribbon.text": "Texto",
    "ribbon.shape": "Forma",
    "ribbon.object": "Objeto",

    // Commands
    "command.formattingMarks": "Mostrar marcas de formato",
    "command.createSlide": "Nueva diapositiva",
    "command.insertImage": "Imagen",
    "command.insertShape": "Formas",
    "command.fontFamily": "Fuente",
    "command.fontSize": "Tamaño",
    "command.bold": "Negrita",
    "command.italic": "Cursiva",
    "command.underline": "Subrayado",
    "command.strikethrough": "Tachado",
    "command.superscript": "Superíndice",
    "command.subscript": "Subíndice",
    "command.widthScale": "Escala",
    "command.textFill": "Color de texto",
    "command.textHighlight": "Resaltado",
    "command.paragraphAlign": "Alineación y sangría",
    "command.lineSpacing": "Espaciado entre líneas y párrafos",
    "command.bulletList": "Lista con viñetas",
    "command.numberList": "Lista numerada",
    "command.shapeFillColor": "Relleno",
    "command.shapeStrokeColor": "Línea",
    "command.shapeArrange": "Organizar",
    "command.objectFillColor": "Relleno",
    "command.objectStrokeColor": "Línea",
    "command.objectArrange": "Organizar",

    // New Slide dialog
    "newSlide.label": "Diseño de nueva diapositiva",
    "newSlide.layouts": "Diseños de diapositiva",
    "newSlide.layout": "Diseño {index}",

    // Shared
    "common.done": "Listo",

    // Ribbon
    "ribbon.noMatchingFonts": "No hay fuentes que coincidan",
    "ribbon.listOptions": "Opciones de {label}",
    "ribbon.listStyles": "Estilos de {label}",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "Alinear a la izquierda",
    "paragraph.center": "Centrar",
    "paragraph.alignRight": "Alinear a la derecha",
    "paragraph.justify": "Justificar",
    "paragraph.increaseIndent": "Aumentar sangría",
    "paragraph.decreaseIndent": "Disminuir sangría",
    "paragraph.lineSpacingSingle": "Sencillo",
    "paragraph.lineSpacingDouble": "Doble",
    "paragraph.lineSpacingLines": "{lines}",
    "paragraph.spaceBefore": "Espacio antes del párrafo",
    "paragraph.spaceAfter": "Espacio después del párrafo",

    // Bullet and numbering galleries, by style id
    "list.disc": "Viñetas redondas rellenas",
    "list.circle": "Viñetas redondas huecas",
    "list.square": "Viñetas cuadradas rellenas",
    "list.diamond": "Viñetas de rombos",
    "list.arrow": "Viñetas de flechas",
    "list.dash": "Viñetas de guiones",
    "list.decimal": "Números seguidos de un punto",
    "list.decimalParen": "Números seguidos de un paréntesis",
    "list.lowerLetter": "Letras minúsculas",
    "list.upperLetter": "Letras mayúsculas",
    "list.lowerRoman": "Números romanos en minúscula",
    "list.upperRoman": "Números romanos en mayúscula",

    // Arrange
    "arrange.bringToFront": "Traer al frente",
    "arrange.bringForward": "Traer adelante",
    "arrange.sendBackward": "Enviar atrás",
    "arrange.sendToBack": "Enviar al fondo",
    "arrange.alignLeft": "Alinear a la izquierda",
    "arrange.alignCenter": "Alinear al centro",
    "arrange.alignRight": "Alinear a la derecha",
    "arrange.alignTop": "Alinear en la parte superior",
    "arrange.alignMiddle": "Alinear en el medio",
    "arrange.alignBottom": "Alinear en la parte inferior",
    "arrange.distributeHorizontally": "Distribuir horizontalmente",
    "arrange.distributeVertically": "Distribuir verticalmente",
    "arrange.alignToPage": "Alinear a la página",
    "arrange.rotateRight": "Girar 90° a la derecha",
    "arrange.rotateLeft": "Girar 90° a la izquierda",
    "arrange.flipHorizontal": "Voltear horizontalmente",
    "arrange.flipVertical": "Voltear verticalmente",
    "arrange.order": "Ordenar",
    "arrange.align": "Alinear",
    "arrange.rotate": "Girar",
    "arrange.group": "Agrupar",
    "arrange.ungroup": "Desagrupar",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "Opciones de relleno",
    "paintOptions.lineTitle": "Opciones de línea",
    "paintOptions.textColorTitle": "Opciones de color de texto",
    "paintOptions.highlightTitle": "Opciones de resaltado",
    "paintOptions.fillBlurb":
        "Aquí estarán los colores personalizados y los rellenos de degradado, de trama y de imagen.",
    "paintOptions.lineBlurb":
        "Aquí estarán los colores personalizados, las líneas compuestas, los remates y combinaciones, y los extremos de flecha.",
    "paintOptions.textColorBlurb": "Aquí estarán los colores personalizados y más opciones de color de texto.",
    "paintOptions.highlightBlurb": "Aquí estarán los colores personalizados y más opciones de resaltado.",

    // Busy hold
    "busy.loadingFont": "Cargando {font}…",

    // Context menu
    "contextMenu.cut": "Cortar",
    "contextMenu.paste": "Pegar",
    "contextMenu.delete": "Eliminar",

    // Context menu over a table
    "table.selectRow": "Fila",
    "table.selectColumn": "Columna",
    "table.selectTable": "Tabla",
    "table.rowAbove": "Fila encima",
    "table.rowBelow": "Fila debajo",
    "table.columnLeft": "Columna a la izquierda",
    "table.columnRight": "Columna a la derecha",
    "table.deleteRows": "Filas",
    "table.deleteColumns": "Columnas",
    "table.select": "Seleccionar",
    "table.insert": "Insertar",
    "table.delete": "Eliminar",
    "table.mergeCells": "Combinar celdas",
    "table.unmergeCells": "Separar celdas",

    // Toolbar
    "toolbar.label": "Barra de herramientas del editor",
};
