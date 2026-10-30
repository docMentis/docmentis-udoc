import type { EditMessages } from "./messages.js";

/** Brazilian Portuguese. */
export const ptBR: EditMessages = {
    // Modes
    "mode.view": "Visualização",
    "mode.edit": "Edição",

    // Mode switcher
    "modeSwitch.label": "Modo do Editor",

    // Page controls
    "pageControls.label": "Controles da página {page}",
    "pageControls.moveUp": "Mover Página para Cima",
    "pageControls.moveUpLabel": "Mover Página {page} para Cima",
    "pageControls.moveDown": "Mover Página para Baixo",
    "pageControls.moveDownLabel": "Mover Página {page} para Baixo",
    "pageControls.rotate": "Girar Página para a Direita",
    "pageControls.rotateLabel": "Girar Página {page} para a Direita",
    "pageControls.settings": "Configurações da Página",
    "pageControls.settingsLabel": "Configurações da Página {page}",
    "pageControls.delete": "Excluir Página",
    "pageControls.deleteLabel": "Excluir Página {page}",
    "pageControls.insert": "Inserir Página Aqui",
    "pageControls.insertAtEnd": "Inserir Página no Final",
    "pageControls.insertBefore": "Inserir Página Antes da Página {page}",

    // Page settings dialog
    "pageSettings.title": "Página {page}",
    "pageSettings.label": "Configurações da página {page}",
    "pageSettings.pageSize": "Tamanho da Página",
    "pageSettings.preset": "Predefinição de tamanho da página",
    "pageSettings.width": "Largura",
    "pageSettings.height": "Altura",
    "pageSettings.pageWidth": "Largura da página",
    "pageSettings.pageHeight": "Altura da página",
    "pageSettings.units": "Unidades",
    "pageSettings.inches": "pol",
    "pageSettings.millimeters": "mm",
    "pageSettings.points": "pt",
    "pageSettings.portrait": "Retrato",
    "pageSettings.landscape": "Paisagem",
    "pageSettings.rotation": "Rotação",
    "pageSettings.rotateLeft": "Girar para a Esquerda",
    "pageSettings.rotatePageLeft": "Girar Página para a Esquerda",
    "pageSettings.rotateRight": "Girar para a Direita",
    "pageSettings.rotatePageRight": "Girar Página para a Direita",
    "pageSettings.applySize": "Aplicar Tamanho",

    // Page sizes
    "pageSize.letter": "Carta",
    "pageSize.legal": "Ofício",
    "pageSize.tabloid": "Tabloide",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "Personalizado",

    // Ribbon tabs
    "ribbon.home": "Página Inicial",
    "ribbon.insert": "Inserir",
    "ribbon.text": "Texto",
    "ribbon.shape": "Forma",
    "ribbon.object": "Objeto",

    // Commands
    "command.formattingMarks": "Mostrar Marcas de Formatação",
    "command.createSlide": "Novo Slide",
    "command.insertImage": "Imagem",
    "command.insertShape": "Formas",
    "command.cropPage": "Cortar",
    "command.resizePage": "Tamanho da imagem",
    "command.fontFamily": "Fonte",
    "command.fontSize": "Tamanho",
    "command.bold": "Negrito",
    "command.italic": "Itálico",
    "command.underline": "Sublinhado",
    "command.strikethrough": "Tachado",
    "command.superscript": "Sobrescrito",
    "command.subscript": "Subscrito",
    "command.widthScale": "Escala",
    "command.textFill": "Cor do Texto",
    "command.textHighlight": "Realce",
    "command.paragraphAlign": "Alinhamento e Recuo",
    "command.lineSpacing": "Espaçamento de Linha e Parágrafo",
    "command.bulletList": "Lista com Marcadores",
    "command.numberList": "Lista Numerada",
    "command.shapeFillColor": "Preenchimento",
    "command.shapeStrokeColor": "Contorno",
    "command.shapeArrange": "Organizar",
    "command.objectFillColor": "Preenchimento",
    "command.objectStrokeColor": "Contorno",
    "command.objectArrange": "Organizar",

    // New Slide dialog
    "newSlide.label": "Layout do novo slide",
    "newSlide.layouts": "Layouts de slide",
    "newSlide.layout": "Layout {index}",

    // Shared
    "common.done": "Concluído",

    // Ribbon
    "ribbon.noMatchingFonts": "Nenhuma fonte correspondente",
    "ribbon.listOptions": "Opções de {label}",
    "ribbon.listStyles": "Estilos de {label}",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "Alinhar à Esquerda",
    "paragraph.center": "Centralizar",
    "paragraph.alignRight": "Alinhar à Direita",
    "paragraph.justify": "Justificar",
    "paragraph.increaseIndent": "Aumentar Recuo",
    "paragraph.decreaseIndent": "Diminuir Recuo",
    "paragraph.lineSpacingSingle": "Simples",
    "paragraph.lineSpacingDouble": "Duplo",
    "paragraph.lineSpacingLines": "{lines}",
    "paragraph.spaceBefore": "Espaço Antes do Parágrafo",
    "paragraph.spaceAfter": "Espaço Depois do Parágrafo",

    // Bullet and numbering galleries, by style id
    "list.disc": "Marcadores Redondos Preenchidos",
    "list.circle": "Marcadores Redondos Vazados",
    "list.square": "Marcadores Quadrados Preenchidos",
    "list.diamond": "Marcadores em Losango",
    "list.arrow": "Marcadores de Seta",
    "list.dash": "Marcadores de Traço",
    "list.decimal": "Números Seguidos de Ponto",
    "list.decimalParen": "Números Seguidos de Parêntese",
    "list.lowerLetter": "Letras Minúsculas",
    "list.upperLetter": "Letras Maiúsculas",
    "list.lowerRoman": "Algarismos Romanos Minúsculos",
    "list.upperRoman": "Algarismos Romanos Maiúsculos",

    // Arrange
    "arrange.bringToFront": "Trazer para a Frente",
    "arrange.bringForward": "Avançar",
    "arrange.sendBackward": "Recuar",
    "arrange.sendToBack": "Enviar para Trás",
    "arrange.alignLeft": "Alinhar à Esquerda",
    "arrange.alignCenter": "Alinhar no Centro",
    "arrange.alignRight": "Alinhar à Direita",
    "arrange.alignTop": "Alinhar em Cima",
    "arrange.alignMiddle": "Alinhar no Meio",
    "arrange.alignBottom": "Alinhar Embaixo",
    "arrange.distributeHorizontally": "Distribuir Horizontalmente",
    "arrange.distributeVertically": "Distribuir Verticalmente",
    "arrange.alignToPage": "Alinhar à Página",
    "arrange.rotateRight": "Girar 90° para a Direita",
    "arrange.rotateLeft": "Girar 90° para a Esquerda",
    "arrange.flipHorizontal": "Inverter Horizontalmente",
    "arrange.flipVertical": "Inverter Verticalmente",
    "arrange.order": "Ordenar",
    "arrange.align": "Alinhar",
    "arrange.rotate": "Girar",
    "arrange.group": "Agrupar",
    "arrange.ungroup": "Desagrupar",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "Opções de Preenchimento",
    "paintOptions.lineTitle": "Opções de Contorno",
    "paintOptions.textColorTitle": "Opções de Cor do Texto",
    "paintOptions.highlightTitle": "Opções de Realce",
    "paintOptions.fillBlurb": "Cores personalizadas e preenchimentos com gradiente, padrão e imagem ficarão aqui.",
    "paintOptions.lineBlurb": "Cores personalizadas, linhas compostas, remates, junções e pontas de seta ficarão aqui.",
    "paintOptions.textColorBlurb": "Cores personalizadas e mais opções de cor do texto ficarão aqui.",
    "paintOptions.highlightBlurb": "Cores personalizadas e mais opções de realce ficarão aqui.",

    // Busy hold
    "busy.loadingFont": "Carregando {font}…",

    // Context menu
    "contextMenu.cut": "Recortar",
    "contextMenu.paste": "Colar",
    "contextMenu.delete": "Excluir",

    // Context menu over a table
    "table.selectRow": "Linha",
    "table.selectColumn": "Coluna",
    "table.selectTable": "Tabela",
    "table.rowAbove": "Linha Acima",
    "table.rowBelow": "Linha Abaixo",
    "table.columnLeft": "Coluna à Esquerda",
    "table.columnRight": "Coluna à Direita",
    "table.deleteRows": "Linhas",
    "table.deleteColumns": "Colunas",
    "table.select": "Selecionar",
    "table.insert": "Inserir",
    "table.delete": "Excluir",
    "table.mergeCells": "Mesclar Células",
    "table.unmergeCells": "Desfazer Mesclagem de Células",

    // Crop mode and the Image Size dialog
    "image.aspectRatio": "Proporção",
    "image.free": "Livre",
    "image.original": "Original",
    "image.square": "Quadrado",
    "image.ratio": "{ratio}",
    "image.cropSize": "{width} × {height} px",
    "image.reset": "Redefinir",
    "image.apply": "Aplicar",
    "image.keepRatio": "Manter proporção",
    "image.originalSize": "Original: {width} × {height} px",
    "image.pixels": "px",

    // Toolbar
    "toolbar.label": "Barra de ferramentas do editor",
};
