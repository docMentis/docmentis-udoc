import type { Messages } from "./messages.js";

/** Russian. */
export const ru: Messages = {
    // Shared
    "common.cancel": "Отмена",
    "common.save": "Сохранить",
    "common.close": "Закрыть",
    "common.delete": "Удалить",

    // Numbers
    "format.percent": "{percent} %",
    "format.points": "{points} пт",

    // A key that runs a command, as a tooltip names it off a Mac
    "shortcut.control": "Ctrl+{key}",
    "shortcut.controlShift": "Ctrl+Shift+{key}",
    "shortcut.tooltip": "{label} ({shortcut})",

    // Regions
    "shell.skipToDocument": "Перейти к документу",
    "shell.regionToolbar": "Панель инструментов",
    "shell.regionSidePanel": "Боковая панель",
    "shell.regionDocument": "Документ",
    "shell.regionSearchComments": "Поиск и комментарии",

    // Toolbar
    "toolbar.label": "Панель инструментов документа",
    "toolbar.menu": "Меню",
    "toolbar.more": "Ещё",
    "toolbar.search": "Поиск",
    "toolbar.comments": "Комментарии",
    "toolbar.print": "Печать",
    "toolbar.download": "Скачать",
    "toolbar.darkMode": "Тёмная тема",
    "toolbar.systemTheme": "Системная тема",
    "toolbar.lightMode": "Светлая тема",
    "toolbar.fullscreen": "Во весь экран",
    "toolbar.exitFullscreen": "Выйти из полноэкранного режима",
    "toolbar.developer": "Разработчик",

    // The people button: the collaboration the document is in
    "collaboration.label": "Совместное редактирование",
    "collaboration.paused": "Совместное редактирование приостановлено",
    "collaboration.reconnecting": "Повторное подключение…",
    "collaboration.you": "{name} (вы)",
    "collaboration.sharePointer": "Показывать мой указатель",
    "collaboration.pause": "Приостановить совместное редактирование",
    "collaboration.resume": "Возобновить совместное редактирование",

    // Pointer tools
    "pointerTool.select": "Выбор",
    "pointerTool.pan": "Панорамирование",
    "pointerTool.zoom": "Масштаб",
    "pointerTool.options": "Параметры инструмента указателя",
    "pointerTool.menu": "Инструменты указателя",
    "pointerTool.tooltip": "Инструмент: {tool}",
    "pointerTool.label": "Инструмент указателя: {tool}",

    // Ribbon tabs
    "ribbon.annotate": "Аннотации",

    // Ribbon
    "ribbon.label": "Параметры инструмента",
    "ribbon.tabs": "Вкладки инструментов",
    "ribbon.more": "Другие инструменты",
    "ribbon.moreTabs": "Другие вкладки",
    "ribbon.paintOptions": "Параметры: {label}",

    // Ribbon commands, by command id
    "command.undo": "Отменить",
    "command.redo": "Вернуть",
    "command.annotateHighlight": "Выделение",
    "command.annotateUnderline": "Подчёркивание",
    "command.annotateStrikeOut": "Зачёркивание",
    "command.annotateSquiggly": "Волнистая линия",
    "command.annotateNote": "Записка",
    "command.annotateTextBox": "Текстовое поле",
    "command.annotateStamp": "Штамп",
    "command.annotatePen": "Перо",
    "command.annotateShape": "Фигуры",
    "command.annotationColor": "Цвет",
    "command.annotationFill": "Заливка",
    "command.annotationOpacity": "Непрозрачность",

    // Shape pickers
    "shape.rectangle": "Прямоугольник",
    "shape.ellipse": "Эллипс",
    "shape.line": "Линия",
    "shape.arrow": "Стрелка",
    "shape.polygon": "Многоугольник",
    "shape.polyline": "Полилиния",
    "shape.cloud": "Облако",

    // Standard stamps
    "stamp.approved": "Утверждено",
    "stamp.experimental": "Экспериментальный",
    "stamp.notApproved": "Не утверждено",
    "stamp.asIs": "Как есть",
    "stamp.expired": "Просрочено",
    "stamp.notForPublicRelease": "Не для публикации",
    "stamp.confidential": "Конфиденциально",
    "stamp.final": "Окончательный вариант",
    "stamp.sold": "Продано",
    "stamp.departmental": "Ведомственный",
    "stamp.forComment": "Для комментариев",
    "stamp.topSecret": "Совершенно секретно",
    "stamp.draft": "Черновик",
    "stamp.forPublicRelease": "Для публикации",

    // Color and line panel
    "paint.noFill": "Нет заливки",
    "paint.noLine": "Нет контура",
    "paint.noColor": "Нет цвета",
    "paint.moreFillOptions": "Другие параметры заливки…",
    "paint.moreLineOptions": "Другие параметры контура…",
    "paint.moreColorOptions": "Другие параметры цвета…",
    "paint.themeColors": "Цвета темы",
    "paint.standardColors": "Стандартные цвета",
    "paint.recentColors": "Последние цвета",
    "paint.text1": "Текст 1",
    "paint.background1": "Фон 1",
    "paint.text2": "Текст 2",
    "paint.background2": "Фон 2",
    "paint.accent1": "Акцент 1",
    "paint.accent2": "Акцент 2",
    "paint.accent3": "Акцент 3",
    "paint.accent4": "Акцент 4",
    "paint.accent5": "Акцент 5",
    "paint.accent6": "Акцент 6",
    "paint.lighter": "Более светлый оттенок {percent} %",
    "paint.darker": "Более тёмный оттенок {percent} %",
    "paint.themeVariant": "{color}, {variant}",
    "paint.weight": "Толщина",
    "paint.dashes": "Штрихи",
    "paint.solid": "Сплошная",
    "paint.dashed": "Штриховая",
    "paint.dotted": "Точечная",
    "paint.dashDot": "Штрихпунктирная",
    "paint.start": "Начало",
    "paint.end": "Конец",

    // Standard colors
    "color.darkRed": "Тёмно-красный",
    "color.red": "Красный",
    "color.orange": "Оранжевый",
    "color.yellow": "Жёлтый",
    "color.lightGreen": "Светло-зелёный",
    "color.green": "Зелёный",
    "color.lightBlue": "Голубой",
    "color.blue": "Синий",
    "color.darkBlue": "Тёмно-синий",
    "color.purple": "Фиолетовый",

    // Line endings
    "lineEnding.none": "Нет",
    "lineEnding.openArrow": "Открытая стрелка",
    "lineEnding.closedArrow": "Закрытая стрелка",
    "lineEnding.circle": "Круг",
    "lineEnding.square": "Квадрат",
    "lineEnding.diamond": "Ромб",

    // Page navigation
    "viewControls.pageNavigation": "Навигация по страницам и масштаб",
    "viewControls.slideNavigation": "Навигация по слайдам и масштаб",
    "viewControls.previousPage": "Предыдущая страница",
    "viewControls.nextPage": "Следующая страница",
    "viewControls.pageNumber": "Номер страницы",
    "viewControls.previousSlide": "Предыдущий слайд",
    "viewControls.nextSlide": "Следующий слайд",
    "viewControls.slideNumber": "Номер слайда",

    // Zoom
    "zoom.label": "Масштаб",
    "zoom.zoomIn": "Увеличить",
    "zoom.zoomOut": "Уменьшить",
    "zoom.level": "Уровень масштаба",
    "zoom.options": "Параметры масштаба",
    "zoom.levels": "Уровни масштаба",
    "zoom.fitWidth": "По ширине",
    "zoom.fitHeight": "По высоте",
    "zoom.fitPage": "По размеру страницы",
    "zoom.fitSlide": "По размеру слайда",

    // View settings
    "viewMode.label": "Настройки отображения",
    "viewMode.scroll": "Прокрутка",
    "viewMode.spread": "Разворот",
    "viewMode.continuous": "Непрерывный",
    "viewMode.layout": "Макет",
    "viewMode.single": "Одна страница",
    "viewMode.double": "Две страницы",
    "viewMode.coverRight": "Обложка справа",
    "viewMode.coverLeft": "Обложка слева",
    "viewMode.rotation": "Поворот",
    "viewMode.degrees": "{degrees}°",
    "viewMode.pageGap": "Интервал между страницами",
    "viewMode.on": "Вкл.",
    "viewMode.off": "Выкл.",

    // Status bar
    "statusBar.label": "Строка состояния",

    // Sheets
    "sheet.tabs": "Листы",
    "sheet.all": "Все листы",
    "sheet.scrollLeft": "Прокрутить вкладки влево",
    "sheet.scrollRight": "Прокрутить вкладки вправо",
    "sheet.unnamed": "Лист {sheet}",

    // Left panel
    "leftPanel.tabs": "Вкладки панели",
    "leftPanel.thumbnails": "Миниатюры",
    "leftPanel.outline": "Оглавление",
    "leftPanel.layers": "Слои",
    "leftPanel.attachments": "Вложения",
    "leftPanel.resizeHandle": "Изменить размер боковой панели",
    "leftPanel.placeholder": "{panel} — здесь пока ничего нет",

    // Thumbnails
    "thumbnails.pages": "Миниатюры страниц",
    "thumbnails.slides": "Миниатюры слайдов",
    "thumbnails.page": "Страница {page}",
    "thumbnails.slide": "Слайд {page}",
    "thumbnails.hiddenSlide": "Слайд {page}, скрыт",
    "thumbnails.insertPage": "Вставить страницу",
    "thumbnails.duplicatePage": "Дублировать страницу",
    "thumbnails.rotateRight": "Повернуть вправо",
    "thumbnails.rotateLeft": "Повернуть влево",
    "thumbnails.deletePage": "Удалить страницу",
    "thumbnails.newSlide": "Создать слайд",
    "thumbnails.duplicateSlide": "Дублировать слайд",
    "thumbnails.hideSlide": "Скрыть слайд",
    "thumbnails.deleteSlide": "Удалить слайд",
    "thumbnails.section": "Раздел {name}",
    "thumbnails.collapseSection": "Свернуть раздел",
    "thumbnails.expandSection": "Развернуть раздел",
    "thumbnails.sectionName": "Имя раздела",
    "thumbnails.addSection": "Добавить раздел",
    "thumbnails.untitledSection": "Раздел без заголовка",
    "thumbnails.renameSection": "Переименовать раздел",
    "thumbnails.moveSectionUp": "Переместить раздел вверх",
    "thumbnails.moveSectionDown": "Переместить раздел вниз",
    "thumbnails.collapseAll": "Свернуть все",
    "thumbnails.expandAll": "Развернуть все",
    "thumbnails.removeSection": "Удалить раздел",
    "thumbnails.removeSectionAndSlides": "Удалить раздел и слайды",
    "thumbnails.removeAllSections": "Удалить все разделы",

    // Outline panel
    "outline.loading": "Загрузка оглавления…",
    "outline.readFailed": "Не удалось прочитать оглавление",
    "outline.empty": "В этом документе нет оглавления",

    // Layers panel
    "layers.loading": "Загрузка слоёв…",
    "layers.readFailed": "Не удалось прочитать слои",
    "layers.empty": "В этом документе нет слоёв",
    "layers.locked": "Заблокирован",
    "layers.hide": "Скрыть слой",
    "layers.show": "Показать слой",

    // Right panel
    "rightPanel.search": "Поиск",
    "rightPanel.comments": "Комментарии",
    "rightPanel.resizeHandle": "Изменить размер панели",
    "rightPanel.close": "Закрыть панель",

    // Search panel
    "search.placeholder": "Поиск в документе",
    "search.label": "Текст для поиска",
    "search.clear": "Очистить поиск",
    "search.matchCase": "Учитывать регистр",
    "search.fuzzyMatch": "Нечёткое совпадение",
    "search.previousMatch": "Предыдущее совпадение",
    "search.previousMatchTooltip": "Предыдущее совпадение (Shift+Enter)",
    "search.nextMatch": "Следующее совпадение",
    "search.nextMatchTooltip": "Следующее совпадение (Enter)",
    "search.results": "Результаты поиска",
    "search.status": "{current} из {total}",
    "search.statusRunning": "{current} из {total}+",
    "search.searching": "Поиск…",
    "search.noResults": "Нет результатов",
    "search.page": "Страница {page}",
    "search.slide": "Слайд {page}",

    // Comments panel
    "comments.page": "Страница {page}",
    "comments.empty": "В этом документе нет комментариев",
    "comments.loading": "Загрузка комментариев…",

    // A comment thread
    "comment.label": "Комментарий",
    "comment.placeholder": "Добавьте комментарий",
    "comment.reply": "Ответить",
    "comment.edit": "Изменить",
    "comment.cancelEditing": "Отменить редактирование",
    "comment.save": "Сохранить комментарий",
    "comment.replyField": "Ответ",
    "comment.cancelReply": "Отменить ответ",
    "comment.saveReply": "Сохранить ответ",
    "comment.replies.one": "{count} ответ",
    "comment.replies.few": "{count} ответа",
    "comment.replies.many": "{count} ответов",
    "comment.replies.other": "{count} ответа",
    "comment.locked": "Заблокировано: нельзя удалить или переместить",
    "comment.lockedContents": "Заблокировано: текст нельзя изменить",
    "comment.lockedBoth": "Заблокировано: нельзя удалить, переместить или изменить",

    // An annotation's kind, as a comment names it
    "annotationKind.note": "Записка",
    "annotationKind.textBox": "Текстовое поле",
    "annotationKind.line": "Линия",
    "annotationKind.rectangle": "Прямоугольник",
    "annotationKind.ellipse": "Эллипс",
    "annotationKind.polygon": "Многоугольник",
    "annotationKind.polyline": "Полилиния",
    "annotationKind.highlight": "Выделение",
    "annotationKind.underline": "Подчёркивание",
    "annotationKind.squiggly": "Волнистая линия",
    "annotationKind.strikethrough": "Зачёркивание",
    "annotationKind.stamp": "Штамп",
    "annotationKind.pen": "Перо",
    "annotationKind.attachment": "Вложение",
    "annotationKind.caret": "Знак вставки",
    "annotationKind.sound": "Звук",
    "annotationKind.redaction": "Скрытие данных",

    // Annotation bar
    "annotationBar.label": "Аннотация",

    // Print dialog
    "print.title": "Печать",
    "print.print": "Печать",
    "print.pages": "Страницы",
    "print.slides": "Слайды",
    "print.allPages": "Все страницы",
    "print.allSlides": "Все слайды",
    "print.currentPage": "Текущая страница ({page})",
    "print.currentSlide": "Текущий слайд ({page})",
    "print.to": "по",
    "print.firstPage": "Первая страница",
    "print.firstSlide": "Первый слайд",
    "print.lastPage": "Последняя страница",
    "print.lastSlide": "Последний слайд",
    "print.custom": "Произвольный",
    "print.customPlaceholder": "напр. 1,3,5-8",
    "print.customPages": "Произвольные страницы",
    "print.customSlides": "Произвольные слайды",
    "print.quality": "Качество",
    "print.qualityDraft": "Черновое (150 DPI)",
    "print.qualityStandard": "Стандартное (300 DPI)",
    "print.qualityHigh": "Высокое (600 DPI)",
    "print.pagesFromToInvalid": "Введите номера страниц от 1 до {count}.",
    "print.slidesFromToInvalid": "Введите номера слайдов от 1 до {count}.",
    "print.pagesFromAfterTo": "Первая страница не может идти после последней.",
    "print.slidesFromAfterTo": "Первый слайд не может идти после последнего.",
    "print.pagesCustomInvalid": "Введите номера страниц и диапазоны от 1 до {count}, например 1,3,5-8.",
    "print.slidesCustomInvalid": "Введите номера слайдов и диапазоны от 1 до {count}, например 1,3,5-8.",

    // Password dialog
    "password.title": "Требуется пароль",
    "password.message": "Этот документ защищён. Введите пароль, чтобы открыть его.",
    "password.placeholder": "Введите пароль",
    "password.label": "Пароль",
    "password.show": "Показать пароль",
    "password.hide": "Скрыть пароль",
    "password.unlock": "Разблокировать",
    "password.incorrect": "Неверный пароль",

    // Busy hold
    "busy.preparingPrint": "Подготовка к печати…",
    "busy.preparingPage": "Подготовка страницы {page} из {count}…",
    "busy.preparingSlide": "Подготовка слайда {page} из {count}…",

    // Loading overlay
    "loading.opening": "Открытие…",
    "loading.downloading": "Загрузка…",
    "loading.progress": "{loaded} / {total} МБ",

    // License notice
    "license.invalidLicense": "Недействительная лицензия",
    "license.permitRefused": "Бесплатное использование недоступно",
    "license.cannotVerify": "Не удаётся проверить бесплатное использование",
    "license.contactOwner": "Обратитесь к владельцу сайта.",

    // The docMentis decal's link
    "branding.title": "Работает на docMentis",
    "branding.label": "Работает на docMentis — открывает docmentis.com",

    // The text input that takes typing
    "textInput.label": "Текст документа",

    // Context menu
    "contextMenu.label": "Действия с документом",
    "contextMenu.copy": "Копировать",
};
