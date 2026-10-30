import type { EditMessages } from "./messages.js";

/** Russian. */
export const ru: EditMessages = {
    // Modes
    "mode.view": "Просмотр",
    "mode.edit": "Редактирование",

    // Mode switcher
    "modeSwitch.label": "Режим редактора",

    // Page controls
    "pageControls.label": "Элементы управления страницей {page}",
    "pageControls.moveUp": "Переместить страницу вверх",
    "pageControls.moveUpLabel": "Переместить страницу {page} вверх",
    "pageControls.moveDown": "Переместить страницу вниз",
    "pageControls.moveDownLabel": "Переместить страницу {page} вниз",
    "pageControls.rotate": "Повернуть страницу вправо",
    "pageControls.rotateLabel": "Повернуть страницу {page} вправо",
    "pageControls.settings": "Параметры страницы",
    "pageControls.settingsLabel": "Параметры страницы {page}",
    "pageControls.delete": "Удалить страницу",
    "pageControls.deleteLabel": "Удалить страницу {page}",
    "pageControls.insert": "Вставить страницу здесь",
    "pageControls.insertAtEnd": "Вставить страницу в конец",
    "pageControls.insertBefore": "Вставить страницу перед страницей {page}",

    // Page settings dialog
    "pageSettings.title": "Страница {page}",
    "pageSettings.label": "Параметры страницы {page}",
    "pageSettings.pageSize": "Размер страницы",
    "pageSettings.preset": "Стандартный размер страницы",
    "pageSettings.width": "Ширина",
    "pageSettings.height": "Высота",
    "pageSettings.pageWidth": "Ширина страницы",
    "pageSettings.pageHeight": "Высота страницы",
    "pageSettings.units": "Единицы измерения",
    "pageSettings.inches": "дюйм",
    "pageSettings.millimeters": "мм",
    "pageSettings.points": "пт",
    "pageSettings.portrait": "Книжная",
    "pageSettings.landscape": "Альбомная",
    "pageSettings.rotation": "Поворот",
    "pageSettings.rotateLeft": "Повернуть влево",
    "pageSettings.rotatePageLeft": "Повернуть страницу влево",
    "pageSettings.rotateRight": "Повернуть вправо",
    "pageSettings.rotatePageRight": "Повернуть страницу вправо",
    "pageSettings.applySize": "Применить размер",

    // Page sizes
    "pageSize.letter": "Letter",
    "pageSize.legal": "Legal",
    "pageSize.tabloid": "Tabloid",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "Произвольный",

    // Ribbon tabs
    "ribbon.home": "Главная",
    "ribbon.insert": "Вставка",
    "ribbon.text": "Текст",
    "ribbon.shape": "Фигура",
    "ribbon.object": "Объект",

    // Commands
    "command.ruler": "Линейка",
    "command.createSlide": "Создать слайд",
    "command.insertImage": "Изображение",
    "command.insertShape": "Фигуры",
    "command.cropPage": "Обрезать",
    "command.resizePage": "Размер изображения",
    "command.fontFamily": "Шрифт",
    "command.fontSize": "Размер",
    "command.bold": "Полужирный",
    "command.italic": "Курсив",
    "command.underline": "Подчёркнутый",
    "command.strikethrough": "Зачёркнутый",
    "command.superscript": "Надстрочный знак",
    "command.subscript": "Подстрочный знак",
    "command.widthScale": "Масштаб",
    "command.textFill": "Цвет текста",
    "command.textHighlight": "Выделение цветом",
    "command.paragraphAlign": "Выравнивание и отступы",
    "command.lineSpacing": "Интервал между строками и абзацами",
    "command.bulletList": "Маркированный список",
    "command.numberList": "Нумерованный список",
    "command.shapeFillColor": "Заливка",
    "command.shapeStrokeColor": "Контур",
    "command.shapeArrange": "Упорядочить",
    "command.objectFillColor": "Заливка",
    "command.objectStrokeColor": "Контур",
    "command.objectArrange": "Упорядочить",

    // New Slide dialog
    "newSlide.label": "Макет нового слайда",
    "newSlide.layouts": "Макеты слайдов",
    "newSlide.layout": "Макет {index}",

    // Shared
    "common.done": "Готово",

    // Ribbon
    "ribbon.noMatchingFonts": "Нет подходящих шрифтов",
    "ribbon.listOptions": "Параметры: {label}",
    "ribbon.listStyles": "Стили: {label}",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "Выровнять по левому краю",
    "paragraph.center": "По центру",
    "paragraph.alignRight": "Выровнять по правому краю",
    "paragraph.justify": "По ширине",
    "paragraph.increaseIndent": "Увеличить отступ",
    "paragraph.decreaseIndent": "Уменьшить отступ",
    "paragraph.lineSpacingSingle": "Одинарный",
    "paragraph.lineSpacingDouble": "Двойной",
    "paragraph.lineSpacingLines": "{lines}",
    "paragraph.spaceBefore": "Интервал перед абзацем",
    "paragraph.spaceAfter": "Интервал после абзаца",

    // Bullet and numbering galleries, by style id
    "list.disc": "Заполненные круглые маркеры",
    "list.circle": "Полые круглые маркеры",
    "list.square": "Заполненные квадратные маркеры",
    "list.diamond": "Ромбовидные маркеры",
    "list.arrow": "Маркеры-стрелки",
    "list.dash": "Маркеры-тире",
    "list.decimal": "Числа с точкой",
    "list.decimalParen": "Числа со скобкой",
    "list.lowerLetter": "Строчные буквы",
    "list.upperLetter": "Прописные буквы",
    "list.lowerRoman": "Строчные римские цифры",
    "list.upperRoman": "Прописные римские цифры",

    // Arrange
    "arrange.bringToFront": "На передний план",
    "arrange.bringForward": "Переместить вперёд",
    "arrange.sendBackward": "Переместить назад",
    "arrange.sendToBack": "На задний план",
    "arrange.alignLeft": "Выровнять по левому краю",
    "arrange.alignCenter": "Выровнять по центру",
    "arrange.alignRight": "Выровнять по правому краю",
    "arrange.alignTop": "Выровнять по верхнему краю",
    "arrange.alignMiddle": "Выровнять по середине",
    "arrange.alignBottom": "Выровнять по нижнему краю",
    "arrange.distributeHorizontally": "Распределить по горизонтали",
    "arrange.distributeVertically": "Распределить по вертикали",
    "arrange.alignToPage": "Выровнять относительно страницы",
    "arrange.rotateRight": "Повернуть вправо на 90°",
    "arrange.rotateLeft": "Повернуть влево на 90°",
    "arrange.flipHorizontal": "Отразить слева направо",
    "arrange.flipVertical": "Отразить сверху вниз",
    "arrange.order": "Порядок",
    "arrange.align": "Выровнять",
    "arrange.rotate": "Повернуть",
    "arrange.group": "Группировать",
    "arrange.ungroup": "Разгруппировать",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "Параметры заливки",
    "paintOptions.lineTitle": "Параметры контура",
    "paintOptions.textColorTitle": "Параметры цвета текста",
    "paintOptions.highlightTitle": "Параметры выделения цветом",
    "paintOptions.fillBlurb": "Здесь появятся пользовательские цвета, градиентная заливка, заливка узором и рисунком.",
    "paintOptions.lineBlurb":
        "Здесь появятся пользовательские цвета, составные линии, типы окончаний и соединений, а также стрелки на концах.",
    "paintOptions.textColorBlurb": "Здесь появятся пользовательские цвета и другие параметры цвета текста.",
    "paintOptions.highlightBlurb": "Здесь появятся пользовательские цвета и другие параметры выделения цветом.",

    // Busy hold
    "busy.loadingFont": "Загрузка шрифта {font}…",

    // Context menu
    "contextMenu.cut": "Вырезать",
    "contextMenu.paste": "Вставить",
    "contextMenu.delete": "Удалить",

    // Context menu over a table
    "table.selectRow": "Строка",
    "table.selectColumn": "Столбец",
    "table.selectTable": "Таблица",
    "table.rowAbove": "Строка сверху",
    "table.rowBelow": "Строка снизу",
    "table.columnLeft": "Столбец слева",
    "table.columnRight": "Столбец справа",
    "table.deleteRows": "Строки",
    "table.deleteColumns": "Столбцы",
    "table.select": "Выделить",
    "table.insert": "Вставить",
    "table.delete": "Удалить",
    "table.mergeCells": "Объединить ячейки",
    "table.unmergeCells": "Отменить объединение ячеек",

    // Crop mode and the Image Size dialog
    "image.aspectRatio": "Соотношение сторон",
    "image.free": "Свободное",
    "image.original": "Исходное",
    "image.square": "Квадрат",
    "image.ratio": "{ratio}",
    "image.cropSize": "{width} × {height} пикс.",
    "image.reset": "Сбросить",
    "image.apply": "Применить",
    "image.keepRatio": "Сохранять пропорции",
    "image.originalSize": "Исходный размер: {width} × {height} пикс.",
    "image.pixels": "пикс.",

    // Toolbar
    "toolbar.label": "Панель инструментов редактора",
};
