import type { Messages } from "./messages.js";

/** Brazilian Portuguese. */
export const ptBR: Messages = {
    // Shared
    "common.cancel": "Cancelar",
    "common.save": "Salvar",
    "common.close": "Fechar",
    "common.delete": "Excluir",

    // Numbers
    "format.percent": "{percent}%",
    "format.points": "{points} pt",

    // A key that runs a command, as a tooltip names it off a Mac
    "shortcut.control": "Ctrl+{key}",
    "shortcut.controlShift": "Ctrl+Shift+{key}",
    "shortcut.tooltip": "{label} ({shortcut})",

    // Regions
    "shell.skipToDocument": "Ir para o documento",
    "shell.regionToolbar": "Barra de ferramentas",
    "shell.regionSidePanel": "Painel lateral",
    "shell.regionDocument": "Documento",
    "shell.regionSearchComments": "Pesquisa e comentários",
    "shell.regionNotes": "Anotações do orador",

    // Toolbar
    "toolbar.label": "Barra de ferramentas do documento",
    "toolbar.menu": "Menu",
    "toolbar.more": "Mais",
    "toolbar.search": "Pesquisar",
    "toolbar.comments": "Comentários",
    "toolbar.print": "Imprimir",
    "toolbar.download": "Baixar",
    "toolbar.darkMode": "Modo Escuro",
    "toolbar.systemTheme": "Tema do Sistema",
    "toolbar.lightMode": "Modo Claro",
    "toolbar.fullscreen": "Tela Inteira",
    "toolbar.exitFullscreen": "Sair da Tela Inteira",
    "toolbar.developer": "Desenvolvedor",

    // The people button: the collaboration the document is in
    "collaboration.label": "Coedição",
    "collaboration.paused": "Coedição Pausada",
    "collaboration.reconnecting": "Reconectando…",
    "collaboration.you": "{name} (você)",
    "collaboration.sharePointer": "Compartilhar Meu Ponteiro",
    "collaboration.pause": "Pausar Coedição",
    "collaboration.resume": "Retomar Coedição",

    // Pointer tools
    "pointerTool.select": "Selecionar",
    "pointerTool.pan": "Mão",
    "pointerTool.zoom": "Zoom",
    "pointerTool.options": "Opções da Ferramenta de Ponteiro",
    "pointerTool.menu": "Ferramentas de ponteiro",
    "pointerTool.tooltip": "Ferramenta: {tool}",
    "pointerTool.label": "Ferramenta de Ponteiro: {tool}",

    // Ribbon tabs
    "ribbon.annotate": "Anotar",
    "ribbon.view": "Exibir",

    // Ribbon
    "ribbon.label": "Opções de ferramenta",
    "ribbon.tabs": "Guias de ferramentas",
    "ribbon.more": "Mais ferramentas",
    "ribbon.moreTabs": "Mais guias",
    "ribbon.paintOptions": "Opções de {label}",

    // Ribbon commands, by command id
    "command.undo": "Desfazer",
    "command.redo": "Refazer",
    "command.annotateHighlight": "Realçar",
    "command.annotateUnderline": "Sublinhado",
    "command.annotateStrikeOut": "Tachado",
    "command.annotateSquiggly": "Ondulado",
    "command.annotateNote": "Nota",
    "command.annotateTextBox": "Caixa de Texto",
    "command.annotateStamp": "Carimbo",
    "command.annotatePen": "Caneta",
    "command.annotateShape": "Formas",
    "command.annotationColor": "Cor",
    "command.annotationFill": "Preenchimento",
    "command.annotationOpacity": "Opacidade",
    "command.normalView": "Normal",
    "command.notesPageView": "Página de anotações",
    "command.notes": "Anotações",

    // Shape pickers
    "shape.rectangle": "Retângulo",
    "shape.ellipse": "Elipse",
    "shape.line": "Linha",
    "shape.arrow": "Seta",
    "shape.polygon": "Polígono",
    "shape.polyline": "Polilinha",
    "shape.cloud": "Nuvem",

    // Standard stamps
    "stamp.approved": "Aprovado",
    "stamp.experimental": "Experimental",
    "stamp.notApproved": "Não Aprovado",
    "stamp.asIs": "Como Está",
    "stamp.expired": "Expirado",
    "stamp.notForPublicRelease": "Não para Divulgação Pública",
    "stamp.confidential": "Confidencial",
    "stamp.final": "Final",
    "stamp.sold": "Vendido",
    "stamp.departmental": "Departamental",
    "stamp.forComment": "Para Comentário",
    "stamp.topSecret": "Ultrassecreto",
    "stamp.draft": "Rascunho",
    "stamp.forPublicRelease": "Para Divulgação Pública",

    // Color and line panel
    "paint.noFill": "Sem Preenchimento",
    "paint.noLine": "Sem Contorno",
    "paint.noColor": "Sem Cor",
    "paint.moreFillOptions": "Mais Opções de Preenchimento…",
    "paint.moreLineOptions": "Mais Opções de Contorno…",
    "paint.moreColorOptions": "Mais Opções de Cor…",
    "paint.themeColors": "Cores do Tema",
    "paint.standardColors": "Cores Padrão",
    "paint.recentColors": "Cores Recentes",
    "paint.text1": "Texto 1",
    "paint.background1": "Plano de Fundo 1",
    "paint.text2": "Texto 2",
    "paint.background2": "Plano de Fundo 2",
    "paint.accent1": "Ênfase 1",
    "paint.accent2": "Ênfase 2",
    "paint.accent3": "Ênfase 3",
    "paint.accent4": "Ênfase 4",
    "paint.accent5": "Ênfase 5",
    "paint.accent6": "Ênfase 6",
    "paint.lighter": "Mais Claro {percent}%",
    "paint.darker": "Mais Escuro {percent}%",
    "paint.themeVariant": "{color}, {variant}",
    "paint.weight": "Espessura",
    "paint.dashes": "Traços",
    "paint.solid": "Sólido",
    "paint.dashed": "Tracejado",
    "paint.dotted": "Pontilhado",
    "paint.dashDot": "Traço Ponto",
    "paint.start": "Início",
    "paint.end": "Final",

    // Standard colors
    "color.darkRed": "Vermelho Escuro",
    "color.red": "Vermelho",
    "color.orange": "Laranja",
    "color.yellow": "Amarelo",
    "color.lightGreen": "Verde Claro",
    "color.green": "Verde",
    "color.lightBlue": "Azul Claro",
    "color.blue": "Azul",
    "color.darkBlue": "Azul Escuro",
    "color.purple": "Roxo",

    // Line endings
    "lineEnding.none": "Nenhum",
    "lineEnding.openArrow": "Seta Aberta",
    "lineEnding.closedArrow": "Seta Fechada",
    "lineEnding.circle": "Círculo",
    "lineEnding.square": "Quadrado",
    "lineEnding.diamond": "Losango",

    // Page navigation
    "viewControls.pageNavigation": "Navegação de páginas e zoom",
    "viewControls.slideNavigation": "Navegação de slides e zoom",
    "viewControls.previousPage": "Página Anterior",
    "viewControls.nextPage": "Próxima Página",
    "viewControls.pageNumber": "Número da página",
    "viewControls.previousSlide": "Slide Anterior",
    "viewControls.nextSlide": "Próximo Slide",
    "viewControls.slideNumber": "Número do slide",

    // Zoom
    "zoom.label": "Zoom",
    "zoom.zoomIn": "Ampliar",
    "zoom.zoomOut": "Reduzir",
    "zoom.level": "Nível de Zoom",
    "zoom.options": "Opções de Zoom",
    "zoom.levels": "Níveis de zoom",
    "zoom.fitWidth": "Ajustar à Largura",
    "zoom.fitHeight": "Ajustar à Altura",
    "zoom.fitPage": "Ajustar à Página",
    "zoom.fitSlide": "Ajustar ao Slide",

    // View settings
    "viewMode.label": "Configurações de Exibição",
    "viewMode.scroll": "Rolagem",
    "viewMode.spread": "Paginado",
    "viewMode.continuous": "Contínuo",
    "viewMode.layout": "Layout",
    "viewMode.single": "Simples",
    "viewMode.double": "Duplo",
    "viewMode.coverRight": "Capa à Direita",
    "viewMode.coverLeft": "Capa à Esquerda",
    "viewMode.rotation": "Rotação",
    "viewMode.degrees": "{degrees}°",
    "viewMode.pageGap": "Espaço entre Páginas",
    "viewMode.on": "Ativado",
    "viewMode.off": "Desativado",

    // Status bar
    "statusBar.label": "Barra de status",

    // Sheets
    "sheet.tabs": "Planilhas",
    "sheet.all": "Todas as planilhas",
    "sheet.scrollLeft": "Rolar guias para a esquerda",
    "sheet.scrollRight": "Rolar guias para a direita",
    "sheet.unnamed": "Planilha {sheet}",

    // Left panel
    "leftPanel.tabs": "Guias do painel",
    "leftPanel.thumbnails": "Miniaturas",
    "leftPanel.outline": "Sumário",
    "leftPanel.layers": "Camadas",
    "leftPanel.attachments": "Anexos",
    "leftPanel.resizeHandle": "Redimensionar painel lateral",
    "leftPanel.placeholder": "{panel} — ainda não há nada aqui",

    // Notes pane
    "notes.resizeHandle": "Redimensionar anotações",

    // Thumbnails
    "thumbnails.pages": "Miniaturas das páginas",
    "thumbnails.slides": "Miniaturas dos slides",
    "thumbnails.page": "Página {page}",
    "thumbnails.slide": "Slide {page}",
    "thumbnails.hiddenSlide": "Slide {page}, oculto",
    "thumbnails.insertPage": "Inserir Página",
    "thumbnails.duplicatePage": "Duplicar Página",
    "thumbnails.rotateRight": "Girar para a Direita",
    "thumbnails.rotateLeft": "Girar para a Esquerda",
    "thumbnails.deletePage": "Excluir Página",
    "thumbnails.newSlide": "Novo Slide",
    "thumbnails.duplicateSlide": "Duplicar Slide",
    "thumbnails.hideSlide": "Ocultar Slide",
    "thumbnails.deleteSlide": "Excluir Slide",
    "thumbnails.section": "Seção {name}",
    "thumbnails.collapseSection": "Recolher Seção",
    "thumbnails.expandSection": "Expandir Seção",
    "thumbnails.sectionName": "Nome da seção",
    "thumbnails.addSection": "Adicionar Seção",
    "thumbnails.untitledSection": "Seção sem Título",
    "thumbnails.renameSection": "Renomear Seção",
    "thumbnails.moveSectionUp": "Mover Seção para Cima",
    "thumbnails.moveSectionDown": "Mover Seção para Baixo",
    "thumbnails.collapseAll": "Recolher Tudo",
    "thumbnails.expandAll": "Expandir Tudo",
    "thumbnails.removeSection": "Remover Seção",
    "thumbnails.removeSectionAndSlides": "Remover Seção e Slides",
    "thumbnails.removeAllSections": "Remover Todas as Seções",

    // Outline panel
    "outline.loading": "Carregando sumário…",
    "outline.readFailed": "Não foi possível ler o sumário",
    "outline.empty": "Nenhum sumário neste documento",

    // Layers panel
    "layers.loading": "Carregando camadas…",
    "layers.readFailed": "Não foi possível ler as camadas",
    "layers.empty": "Nenhuma camada neste documento",
    "layers.locked": "Bloqueada",
    "layers.hide": "Ocultar Camada",
    "layers.show": "Mostrar Camada",

    // Right panel
    "rightPanel.search": "Pesquisar",
    "rightPanel.comments": "Comentários",
    "rightPanel.resizeHandle": "Redimensionar painel",
    "rightPanel.close": "Fechar Painel",

    // Search panel
    "search.placeholder": "Pesquisar no documento",
    "search.label": "Texto de pesquisa",
    "search.clear": "Limpar Pesquisa",
    "search.matchCase": "Diferenciar Maiúsculas e Minúsculas",
    "search.fuzzyMatch": "Correspondência Aproximada",
    "search.previousMatch": "Resultado Anterior",
    "search.previousMatchTooltip": "Resultado Anterior (Shift+Enter)",
    "search.nextMatch": "Próximo Resultado",
    "search.nextMatchTooltip": "Próximo Resultado (Enter)",
    "search.results": "Resultados da pesquisa",
    "search.status": "{current} de {total}",
    "search.statusRunning": "{current} de {total}+",
    "search.searching": "Pesquisando…",
    "search.noResults": "Nenhum resultado",
    "search.page": "Página {page}",
    "search.slide": "Slide {page}",

    // Comments panel
    "comments.page": "Página {page}",
    "comments.empty": "Nenhum comentário neste documento",
    "comments.loading": "Carregando comentários…",

    // A comment thread
    "comment.label": "Comentário",
    "comment.placeholder": "Adicionar um comentário",
    "comment.reply": "Responder",
    "comment.edit": "Editar",
    "comment.cancelEditing": "Cancelar Edição",
    "comment.save": "Salvar Comentário",
    "comment.replyField": "Responder",
    "comment.cancelReply": "Cancelar Resposta",
    "comment.saveReply": "Salvar Resposta",
    "comment.replies.one": "{count} resposta",
    "comment.replies.many": "{count} de respostas",
    "comment.replies.other": "{count} respostas",
    "comment.locked": "Bloqueado: não pode ser excluído nem movido",
    "comment.lockedContents": "Bloqueado: o texto não pode ser editado",
    "comment.lockedBoth": "Bloqueado: não pode ser excluído, movido nem editado",

    // An annotation's kind, as a comment names it
    "annotationKind.note": "Nota",
    "annotationKind.textBox": "Caixa de Texto",
    "annotationKind.line": "Linha",
    "annotationKind.rectangle": "Retângulo",
    "annotationKind.ellipse": "Elipse",
    "annotationKind.polygon": "Polígono",
    "annotationKind.polyline": "Polilinha",
    "annotationKind.highlight": "Realce",
    "annotationKind.underline": "Sublinhado",
    "annotationKind.squiggly": "Ondulado",
    "annotationKind.strikethrough": "Tachado",
    "annotationKind.stamp": "Carimbo",
    "annotationKind.pen": "Caneta",
    "annotationKind.attachment": "Anexo",
    "annotationKind.caret": "Sinal de Inserção",
    "annotationKind.sound": "Som",
    "annotationKind.redaction": "Redação",

    // Annotation bar
    "annotationBar.label": "Anotação",

    // Print dialog
    "print.title": "Imprimir",
    "print.print": "Imprimir",
    "print.pages": "Páginas",
    "print.slides": "Slides",
    "print.allPages": "Todas as Páginas",
    "print.allSlides": "Todos os Slides",
    "print.currentPage": "Página Atual ({page})",
    "print.currentSlide": "Slide Atual ({page})",
    "print.to": "até",
    "print.firstPage": "Primeira página",
    "print.firstSlide": "Primeiro slide",
    "print.lastPage": "Última página",
    "print.lastSlide": "Último slide",
    "print.custom": "Personalizado",
    "print.customPlaceholder": "ex.: 1,3,5-8",
    "print.customPages": "Páginas personalizadas",
    "print.customSlides": "Slides personalizados",
    "print.quality": "Qualidade",
    "print.qualityDraft": "Rascunho (150 DPI)",
    "print.qualityStandard": "Padrão (300 DPI)",
    "print.qualityHigh": "Alta (600 DPI)",
    "print.pagesFromToInvalid": "Digite páginas de 1 a {count}.",
    "print.slidesFromToInvalid": "Digite slides de 1 a {count}.",
    "print.pagesFromAfterTo": "A primeira página não pode vir depois da última.",
    "print.slidesFromAfterTo": "O primeiro slide não pode vir depois do último.",
    "print.pagesCustomInvalid": "Digite páginas e intervalos de 1 a {count}, como 1,3,5-8.",
    "print.slidesCustomInvalid": "Digite slides e intervalos de 1 a {count}, como 1,3,5-8.",

    // Password dialog
    "password.title": "Senha Necessária",
    "password.message": "Este documento está protegido. Digite a senha para abri-lo.",
    "password.placeholder": "Digite a senha",
    "password.label": "Senha",
    "password.show": "Mostrar Senha",
    "password.hide": "Ocultar Senha",
    "password.unlock": "Desbloquear",
    "password.incorrect": "Senha incorreta",

    // Busy hold
    "busy.preparingPrint": "Preparando para imprimir…",
    "busy.preparingPage": "Preparando página {page} de {count}…",
    "busy.preparingSlide": "Preparando slide {page} de {count}…",

    // Loading overlay
    "loading.opening": "Abrindo…",
    "loading.downloading": "Baixando…",
    "loading.progress": "{loaded} / {total} MB",

    // License notice
    "license.invalidLicense": "Licença Inválida",
    "license.permitRefused": "Uso Gratuito Indisponível",
    "license.cannotVerify": "Não Foi Possível Verificar o Uso Gratuito",
    "license.contactOwner": "Entre em contato com o proprietário do site.",

    // The docMentis decal's link
    "branding.title": "Com tecnologia docMentis",
    "branding.label": "Com tecnologia docMentis — abre docmentis.com",

    // The text input that takes typing
    "textInput.label": "Texto do documento",

    // Context menu
    "contextMenu.label": "Ações do documento",
    "contextMenu.copy": "Copiar",
};
