import type { Messages } from "./messages.js";

/** Spanish. */
export const es: Messages = {
    // Shared
    "common.cancel": "Cancelar",
    "common.save": "Guardar",
    "common.close": "Cerrar",
    "common.delete": "Eliminar",

    // Numbers
    "format.percent": "{percent} %",
    "format.points": "{points} pto",

    // A key that runs a command, as a tooltip names it off a Mac
    "shortcut.control": "Ctrl+{key}",
    "shortcut.controlShift": "Ctrl+Mayús+{key}",
    "shortcut.tooltip": "{label} ({shortcut})",

    // Regions
    "shell.skipToDocument": "Ir al documento",
    "shell.regionToolbar": "Barra de herramientas",
    "shell.regionSidePanel": "Panel lateral",
    "shell.regionDocument": "Documento",
    "shell.regionSearchComments": "Búsqueda y comentarios",
    "shell.regionNotes": "Notas del orador",

    // Toolbar
    "toolbar.label": "Barra de herramientas del documento",
    "toolbar.menu": "Menú",
    "toolbar.more": "Más",
    "toolbar.search": "Buscar",
    "toolbar.comments": "Comentarios",
    "toolbar.print": "Imprimir",
    "toolbar.download": "Descargar",
    "toolbar.darkMode": "Modo oscuro",
    "toolbar.systemTheme": "Tema del sistema",
    "toolbar.lightMode": "Modo claro",
    "toolbar.fullscreen": "Pantalla completa",
    "toolbar.exitFullscreen": "Salir de pantalla completa",
    "toolbar.developer": "Desarrollador",

    // The people button: the collaboration the document is in
    "collaboration.label": "Coedición",
    "collaboration.paused": "Coedición en pausa",
    "collaboration.reconnecting": "Reconectando…",
    "collaboration.you": "{name} (tú)",
    "collaboration.sharePointer": "Compartir mi puntero",
    "collaboration.pause": "Pausar coedición",
    "collaboration.resume": "Reanudar coedición",

    // Pointer tools
    "pointerTool.select": "Seleccionar",
    "pointerTool.pan": "Desplazar",
    "pointerTool.zoom": "Zoom",
    "pointerTool.options": "Opciones de herramienta de puntero",
    "pointerTool.menu": "Herramientas de puntero",
    "pointerTool.tooltip": "Herramienta: {tool}",
    "pointerTool.label": "Herramienta de puntero: {tool}",

    // Ribbon tabs
    "ribbon.annotate": "Anotar",
    "ribbon.view": "Vista",

    // Ribbon
    "ribbon.label": "Opciones de herramienta",
    "ribbon.tabs": "Pestañas de herramientas",
    "ribbon.more": "Más herramientas",
    "ribbon.moreTabs": "Más pestañas",
    "ribbon.paintOptions": "Opciones de {label}",

    // Ribbon commands, by command id
    "command.undo": "Deshacer",
    "command.redo": "Rehacer",
    "command.annotateHighlight": "Resaltar",
    "command.annotateUnderline": "Subrayar",
    "command.annotateStrikeOut": "Tachar",
    "command.annotateSquiggly": "Ondulado",
    "command.annotateNote": "Nota",
    "command.annotateTextBox": "Cuadro de texto",
    "command.annotateStamp": "Sello",
    "command.annotatePen": "Bolígrafo",
    "command.annotateShape": "Formas",
    "command.annotationColor": "Color",
    "command.annotationFill": "Relleno",
    "command.annotationOpacity": "Opacidad",
    "command.normalView": "Normal",
    "command.notesPageView": "Página de notas",
    "command.notes": "Notas",

    // Shape pickers
    "shape.rectangle": "Rectángulo",
    "shape.ellipse": "Elipse",
    "shape.line": "Línea",
    "shape.arrow": "Flecha",
    "shape.polygon": "Polígono",
    "shape.polyline": "Polilínea",
    "shape.cloud": "Nube",

    // Standard stamps
    "stamp.approved": "Aprobado",
    "stamp.experimental": "Experimental",
    "stamp.notApproved": "No aprobado",
    "stamp.asIs": "Tal cual",
    "stamp.expired": "Caducado",
    "stamp.notForPublicRelease": "No apto para divulgación pública",
    "stamp.confidential": "Confidencial",
    "stamp.final": "Final",
    "stamp.sold": "Vendido",
    "stamp.departmental": "Departamental",
    "stamp.forComment": "Para comentarios",
    "stamp.topSecret": "Alto secreto",
    "stamp.draft": "Borrador",
    "stamp.forPublicRelease": "Para divulgación pública",

    // Color and line panel
    "paint.noFill": "Sin relleno",
    "paint.noLine": "Sin línea",
    "paint.noColor": "Sin color",
    "paint.moreFillOptions": "Más opciones de relleno…",
    "paint.moreLineOptions": "Más opciones de línea…",
    "paint.moreColorOptions": "Más opciones de color…",
    "paint.themeColors": "Colores del tema",
    "paint.standardColors": "Colores estándar",
    "paint.recentColors": "Colores recientes",
    "paint.text1": "Texto 1",
    "paint.background1": "Fondo 1",
    "paint.text2": "Texto 2",
    "paint.background2": "Fondo 2",
    "paint.accent1": "Énfasis 1",
    "paint.accent2": "Énfasis 2",
    "paint.accent3": "Énfasis 3",
    "paint.accent4": "Énfasis 4",
    "paint.accent5": "Énfasis 5",
    "paint.accent6": "Énfasis 6",
    "paint.lighter": "Más claro {percent} %",
    "paint.darker": "Más oscuro {percent} %",
    "paint.themeVariant": "{color}, {variant}",
    "paint.weight": "Grosor",
    "paint.dashes": "Guiones",
    "paint.solid": "Sólido",
    "paint.dashed": "Discontinuo",
    "paint.dotted": "Punteado",
    "paint.dashDot": "Guion y punto",
    "paint.start": "Inicio",
    "paint.end": "Final",

    // Standard colors
    "color.darkRed": "Rojo oscuro",
    "color.red": "Rojo",
    "color.orange": "Naranja",
    "color.yellow": "Amarillo",
    "color.lightGreen": "Verde claro",
    "color.green": "Verde",
    "color.lightBlue": "Azul claro",
    "color.blue": "Azul",
    "color.darkBlue": "Azul oscuro",
    "color.purple": "Púrpura",

    // Line endings
    "lineEnding.none": "Ninguno",
    "lineEnding.openArrow": "Flecha abierta",
    "lineEnding.closedArrow": "Flecha cerrada",
    "lineEnding.circle": "Círculo",
    "lineEnding.square": "Cuadrado",
    "lineEnding.diamond": "Rombo",

    // Page navigation
    "viewControls.pageNavigation": "Navegación de páginas y zoom",
    "viewControls.slideNavigation": "Navegación de diapositivas y zoom",
    "viewControls.previousPage": "Página anterior",
    "viewControls.nextPage": "Página siguiente",
    "viewControls.pageNumber": "Número de página",
    "viewControls.previousSlide": "Diapositiva anterior",
    "viewControls.nextSlide": "Diapositiva siguiente",
    "viewControls.slideNumber": "Número de diapositiva",

    // Zoom
    "zoom.label": "Zoom",
    "zoom.zoomIn": "Acercar",
    "zoom.zoomOut": "Alejar",
    "zoom.level": "Nivel de zoom",
    "zoom.options": "Opciones de zoom",
    "zoom.levels": "Niveles de zoom",
    "zoom.fitWidth": "Ajustar al ancho",
    "zoom.fitHeight": "Ajustar al alto",
    "zoom.fitPage": "Ajustar a la página",
    "zoom.fitSlide": "Ajustar a la diapositiva",

    // View settings
    "viewMode.label": "Configuración de vista",
    "viewMode.scroll": "Desplazamiento",
    "viewMode.spread": "Paginado",
    "viewMode.continuous": "Continuo",
    "viewMode.layout": "Diseño",
    "viewMode.single": "Simple",
    "viewMode.double": "Doble",
    "viewMode.coverRight": "Portada a la derecha",
    "viewMode.coverLeft": "Portada a la izquierda",
    "viewMode.rotation": "Rotación",
    "viewMode.degrees": "{degrees}°",
    "viewMode.pageGap": "Espacio entre páginas",
    "viewMode.on": "Activado",
    "viewMode.off": "Desactivado",

    // Status bar
    "statusBar.label": "Barra de estado",

    // Sheets
    "sheet.tabs": "Hojas",
    "sheet.all": "Todas las hojas",
    "sheet.scrollLeft": "Desplazar pestañas a la izquierda",
    "sheet.scrollRight": "Desplazar pestañas a la derecha",
    "sheet.unnamed": "Hoja {sheet}",

    // Left panel
    "leftPanel.tabs": "Pestañas del panel",
    "leftPanel.thumbnails": "Miniaturas",
    "leftPanel.outline": "Índice",
    "leftPanel.layers": "Capas",
    "leftPanel.attachments": "Adjuntos",
    "leftPanel.resizeHandle": "Cambiar el tamaño del panel lateral",
    "leftPanel.placeholder": "{panel} — aún no hay nada aquí",

    // Notes pane
    "notes.resizeHandle": "Cambiar el tamaño de las notas",

    // Thumbnails
    "thumbnails.pages": "Miniaturas de páginas",
    "thumbnails.slides": "Miniaturas de diapositivas",
    "thumbnails.page": "Página {page}",
    "thumbnails.slide": "Diapositiva {page}",
    "thumbnails.hiddenSlide": "Diapositiva {page}, oculta",
    "thumbnails.insertPage": "Insertar página",
    "thumbnails.duplicatePage": "Duplicar página",
    "thumbnails.rotateRight": "Girar a la derecha",
    "thumbnails.rotateLeft": "Girar a la izquierda",
    "thumbnails.deletePage": "Eliminar página",
    "thumbnails.newSlide": "Nueva diapositiva",
    "thumbnails.duplicateSlide": "Duplicar diapositiva",
    "thumbnails.hideSlide": "Ocultar diapositiva",
    "thumbnails.deleteSlide": "Eliminar diapositiva",
    "thumbnails.section": "Sección {name}",
    "thumbnails.collapseSection": "Contraer sección",
    "thumbnails.expandSection": "Expandir sección",
    "thumbnails.sectionName": "Nombre de la sección",
    "thumbnails.addSection": "Agregar sección",
    "thumbnails.untitledSection": "Sección sin título",
    "thumbnails.renameSection": "Cambiar nombre de sección",
    "thumbnails.moveSectionUp": "Subir sección",
    "thumbnails.moveSectionDown": "Bajar sección",
    "thumbnails.collapseAll": "Contraer todo",
    "thumbnails.expandAll": "Expandir todo",
    "thumbnails.removeSection": "Quitar sección",
    "thumbnails.removeSectionAndSlides": "Quitar sección y diapositivas",
    "thumbnails.removeAllSections": "Quitar todas las secciones",

    // Outline panel
    "outline.loading": "Cargando índice…",
    "outline.readFailed": "No se pudo leer el índice",
    "outline.empty": "No hay índice en este documento",

    // Layers panel
    "layers.loading": "Cargando capas…",
    "layers.readFailed": "No se pudieron leer las capas",
    "layers.empty": "No hay capas en este documento",
    "layers.locked": "Bloqueada",
    "layers.hide": "Ocultar capa",
    "layers.show": "Mostrar capa",

    // Right panel
    "rightPanel.search": "Búsqueda",
    "rightPanel.comments": "Comentarios",
    "rightPanel.resizeHandle": "Cambiar el tamaño del panel",
    "rightPanel.close": "Cerrar panel",

    // Search panel
    "search.placeholder": "Buscar en el documento",
    "search.label": "Texto de búsqueda",
    "search.clear": "Borrar búsqueda",
    "search.matchCase": "Coincidir mayúsculas y minúsculas",
    "search.fuzzyMatch": "Coincidencia aproximada",
    "search.previousMatch": "Coincidencia anterior",
    "search.previousMatchTooltip": "Coincidencia anterior (Mayús+Entrar)",
    "search.nextMatch": "Siguiente coincidencia",
    "search.nextMatchTooltip": "Siguiente coincidencia (Entrar)",
    "search.results": "Resultados de búsqueda",
    "search.status": "{current} de {total}",
    "search.statusRunning": "{current} de {total}+",
    "search.searching": "Buscando…",
    "search.noResults": "Sin resultados",
    "search.page": "Página {page}",
    "search.slide": "Diapositiva {page}",

    // Comments panel
    "comments.page": "Página {page}",
    "comments.empty": "No hay comentarios en este documento",
    "comments.loading": "Cargando comentarios…",

    // A comment thread
    "comment.label": "Comentario",
    "comment.placeholder": "Agregar un comentario",
    "comment.reply": "Responder",
    "comment.edit": "Editar",
    "comment.cancelEditing": "Cancelar edición",
    "comment.save": "Guardar comentario",
    "comment.replyField": "Respuesta",
    "comment.cancelReply": "Cancelar respuesta",
    "comment.saveReply": "Guardar respuesta",
    "comment.replies.one": "{count} respuesta",
    "comment.replies.many": "{count} de respuestas",
    "comment.replies.other": "{count} respuestas",
    "comment.locked": "Bloqueado: no se puede eliminar ni mover",
    "comment.lockedContents": "Bloqueado: el texto no se puede editar",
    "comment.lockedBoth": "Bloqueado: no se puede eliminar, mover ni editar",

    // An annotation's kind, as a comment names it
    "annotationKind.note": "Nota",
    "annotationKind.textBox": "Cuadro de texto",
    "annotationKind.line": "Línea",
    "annotationKind.rectangle": "Rectángulo",
    "annotationKind.ellipse": "Elipse",
    "annotationKind.polygon": "Polígono",
    "annotationKind.polyline": "Polilínea",
    "annotationKind.highlight": "Resaltado",
    "annotationKind.underline": "Subrayado",
    "annotationKind.squiggly": "Ondulado",
    "annotationKind.strikethrough": "Tachado",
    "annotationKind.stamp": "Sello",
    "annotationKind.pen": "Bolígrafo",
    "annotationKind.attachment": "Archivo adjunto",
    "annotationKind.caret": "Signo de intercalación",
    "annotationKind.sound": "Sonido",
    "annotationKind.redaction": "Redacción",

    // Annotation bar
    "annotationBar.label": "Anotación",

    // Print dialog
    "print.title": "Imprimir",
    "print.print": "Imprimir",
    "print.pages": "Páginas",
    "print.slides": "Diapositivas",
    "print.allPages": "Todas las páginas",
    "print.allSlides": "Todas las diapositivas",
    "print.currentPage": "Página actual ({page})",
    "print.currentSlide": "Diapositiva actual ({page})",
    "print.to": "a",
    "print.firstPage": "Primera página",
    "print.firstSlide": "Primera diapositiva",
    "print.lastPage": "Última página",
    "print.lastSlide": "Última diapositiva",
    "print.custom": "Personalizado",
    "print.customPlaceholder": "p. ej. 1,3,5-8",
    "print.customPages": "Páginas personalizadas",
    "print.customSlides": "Diapositivas personalizadas",
    "print.quality": "Calidad",
    "print.qualityDraft": "Borrador (150 ppp)",
    "print.qualityStandard": "Estándar (300 ppp)",
    "print.qualityHigh": "Alta (600 ppp)",
    "print.pagesFromToInvalid": "Introduzca páginas del 1 al {count}.",
    "print.slidesFromToInvalid": "Introduzca diapositivas del 1 al {count}.",
    "print.pagesFromAfterTo": "La primera página no puede ser posterior a la última.",
    "print.slidesFromAfterTo": "La primera diapositiva no puede ser posterior a la última.",
    "print.pagesCustomInvalid": "Introduzca páginas e intervalos del 1 al {count}, como 1,3,5-8.",
    "print.slidesCustomInvalid": "Introduzca diapositivas e intervalos del 1 al {count}, como 1,3,5-8.",

    // Password dialog
    "password.title": "Contraseña requerida",
    "password.message": "Este documento está protegido. Introduzca la contraseña para abrirlo.",
    "password.placeholder": "Introducir contraseña",
    "password.label": "Contraseña",
    "password.show": "Mostrar contraseña",
    "password.hide": "Ocultar contraseña",
    "password.unlock": "Desbloquear",
    "password.incorrect": "Contraseña incorrecta",

    // Busy hold
    "busy.preparingPrint": "Preparando la impresión…",
    "busy.preparingPage": "Preparando la página {page} de {count}…",
    "busy.preparingSlide": "Preparando la diapositiva {page} de {count}…",

    // Loading overlay
    "loading.opening": "Abriendo…",
    "loading.downloading": "Descargando…",
    "loading.progress": "{loaded} / {total} MB",

    // License notice
    "license.invalidLicense": "Licencia no válida",
    "license.permitRefused": "Uso gratuito no disponible",
    "license.cannotVerify": "No se puede verificar el uso gratuito",
    "license.contactOwner": "Póngase en contacto con el propietario del sitio.",

    // The docMentis decal's link
    "branding.title": "Con tecnología de docMentis",
    "branding.label": "Con tecnología de docMentis — abre docmentis.com",

    // The text input that takes typing
    "textInput.label": "Texto del documento",

    // Context menu
    "contextMenu.label": "Acciones del documento",
    "contextMenu.copy": "Copiar",
};
