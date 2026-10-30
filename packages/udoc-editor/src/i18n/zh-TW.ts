import type { EditMessages } from "./messages.js";

/** Traditional Chinese. */
export const zhTW: EditMessages = {
    // Modes
    "mode.view": "檢視",
    "mode.edit": "編輯",

    // Mode switcher
    "modeSwitch.label": "編輯器模式",

    // Page controls
    "pageControls.label": "第 {page} 頁控制項",
    "pageControls.moveUp": "上移頁面",
    "pageControls.moveUpLabel": "將第 {page} 頁上移",
    "pageControls.moveDown": "下移頁面",
    "pageControls.moveDownLabel": "將第 {page} 頁下移",
    "pageControls.rotate": "向右旋轉頁面",
    "pageControls.rotateLabel": "將第 {page} 頁向右旋轉",
    "pageControls.settings": "頁面設定",
    "pageControls.settingsLabel": "第 {page} 頁設定",
    "pageControls.delete": "刪除頁面",
    "pageControls.deleteLabel": "刪除第 {page} 頁",
    "pageControls.insert": "在此插入頁面",
    "pageControls.insertAtEnd": "在結尾插入頁面",
    "pageControls.insertBefore": "在第 {page} 頁之前插入頁面",

    // Page settings dialog
    "pageSettings.title": "第 {page} 頁",
    "pageSettings.label": "第 {page} 頁設定",
    "pageSettings.pageSize": "頁面大小",
    "pageSettings.preset": "預設頁面大小",
    "pageSettings.width": "寬度",
    "pageSettings.height": "高度",
    "pageSettings.pageWidth": "頁面寬度",
    "pageSettings.pageHeight": "頁面高度",
    "pageSettings.units": "單位",
    "pageSettings.inches": "英吋",
    "pageSettings.millimeters": "公釐",
    "pageSettings.points": "點",
    "pageSettings.portrait": "直向",
    "pageSettings.landscape": "橫向",
    "pageSettings.rotation": "旋轉",
    "pageSettings.rotateLeft": "向左旋轉",
    "pageSettings.rotatePageLeft": "向左旋轉頁面",
    "pageSettings.rotateRight": "向右旋轉",
    "pageSettings.rotatePageRight": "向右旋轉頁面",
    "pageSettings.applySize": "套用大小",

    // Page sizes
    "pageSize.letter": "Letter",
    "pageSize.legal": "Legal",
    "pageSize.tabloid": "Tabloid",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "自訂",

    // Ribbon tabs
    "ribbon.home": "常用",
    "ribbon.insert": "插入",
    "ribbon.text": "文字",
    "ribbon.shape": "圖案",
    "ribbon.object": "物件",

    // Commands
    "command.ruler": "尺規",
    "command.createSlide": "新投影片",
    "command.insertImage": "圖片",
    "command.insertShape": "圖案",
    "command.cropPage": "裁剪",
    "command.resizePage": "影像大小",
    "command.fontFamily": "字型",
    "command.fontSize": "大小",
    "command.bold": "粗體",
    "command.italic": "斜體",
    "command.underline": "底線",
    "command.strikethrough": "刪除線",
    "command.superscript": "上標",
    "command.subscript": "下標",
    "command.widthScale": "縮放比例",
    "command.textFill": "文字色彩",
    "command.textHighlight": "醒目提示",
    "command.paragraphAlign": "對齊與縮排",
    "command.lineSpacing": "行距與段落間距",
    "command.bulletList": "項目符號清單",
    "command.numberList": "編號清單",
    "command.shapeFillColor": "填滿",
    "command.shapeStrokeColor": "線條",
    "command.shapeArrange": "排列",
    "command.objectFillColor": "填滿",
    "command.objectStrokeColor": "線條",
    "command.objectArrange": "排列",

    // New Slide dialog
    "newSlide.label": "新投影片版面配置",
    "newSlide.layouts": "投影片版面配置",
    "newSlide.layout": "版面配置 {index}",

    // Shared
    "common.done": "完成",

    // Ribbon
    "ribbon.noMatchingFonts": "沒有相符的字型",
    "ribbon.listOptions": "{label}選項",
    "ribbon.listStyles": "{label}樣式",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "靠左對齊",
    "paragraph.center": "置中",
    "paragraph.alignRight": "靠右對齊",
    "paragraph.justify": "左右對齊",
    "paragraph.increaseIndent": "增加縮排",
    "paragraph.decreaseIndent": "減少縮排",
    "paragraph.lineSpacingSingle": "單行間距",
    "paragraph.lineSpacingDouble": "2 倍行高",
    "paragraph.lineSpacingLines": "{lines}",
    "paragraph.spaceBefore": "段落前的間距",
    "paragraph.spaceAfter": "段落後的間距",

    // Bullet and numbering galleries, by style id
    "list.disc": "實心圓形項目符號",
    "list.circle": "空心圓形項目符號",
    "list.square": "實心方形項目符號",
    "list.diamond": "菱形項目符號",
    "list.arrow": "箭號項目符號",
    "list.dash": "破折號項目符號",
    "list.decimal": "數字加句點",
    "list.decimalParen": "數字加括號",
    "list.lowerLetter": "小寫字母",
    "list.upperLetter": "大寫字母",
    "list.lowerRoman": "小寫羅馬數字",
    "list.upperRoman": "大寫羅馬數字",

    // Arrange
    "arrange.bringToFront": "移到最上層",
    "arrange.bringForward": "上移一層",
    "arrange.sendBackward": "下移一層",
    "arrange.sendToBack": "移到最下層",
    "arrange.alignLeft": "靠左對齊",
    "arrange.alignCenter": "水平置中",
    "arrange.alignRight": "靠右對齊",
    "arrange.alignTop": "靠上對齊",
    "arrange.alignMiddle": "垂直置中",
    "arrange.alignBottom": "靠下對齊",
    "arrange.distributeHorizontally": "水平均分",
    "arrange.distributeVertically": "垂直均分",
    "arrange.alignToPage": "對齊頁面",
    "arrange.rotateRight": "向右旋轉 90°",
    "arrange.rotateLeft": "向左旋轉 90°",
    "arrange.flipHorizontal": "水平翻轉",
    "arrange.flipVertical": "垂直翻轉",
    "arrange.order": "順序",
    "arrange.align": "對齊",
    "arrange.rotate": "旋轉",
    "arrange.group": "組成群組",
    "arrange.ungroup": "取消群組",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "填滿選項",
    "paintOptions.lineTitle": "線條選項",
    "paintOptions.textColorTitle": "文字色彩選項",
    "paintOptions.highlightTitle": "醒目提示選項",
    "paintOptions.fillBlurb": "自訂色彩，以及漸層、圖樣與圖片填滿，日後將放在這裡。",
    "paintOptions.lineBlurb": "自訂色彩、複合線條、端點與接點類型，以及箭號樣式，日後將放在這裡。",
    "paintOptions.textColorBlurb": "自訂色彩與更多文字色彩選項，日後將放在這裡。",
    "paintOptions.highlightBlurb": "自訂色彩與更多醒目提示選項，日後將放在這裡。",

    // Busy hold
    "busy.loadingFont": "正在載入 {font}…",

    // Context menu
    "contextMenu.cut": "剪下",
    "contextMenu.paste": "貼上",
    "contextMenu.delete": "刪除",

    // Context menu over a table
    "table.selectRow": "列",
    "table.selectColumn": "欄",
    "table.selectTable": "表格",
    "table.rowAbove": "上方列",
    "table.rowBelow": "下方列",
    "table.columnLeft": "左方欄",
    "table.columnRight": "右方欄",
    "table.deleteRows": "列",
    "table.deleteColumns": "欄",
    "table.select": "選取",
    "table.insert": "插入",
    "table.delete": "刪除",
    "table.mergeCells": "合併儲存格",
    "table.unmergeCells": "取消合併儲存格",

    // Crop mode and the Image Size dialog
    "image.aspectRatio": "長寬比",
    "image.free": "自由",
    "image.original": "原始",
    "image.square": "正方形",
    "image.ratio": "{ratio}",
    "image.cropSize": "{width} × {height} 像素",
    "image.reset": "重設",
    "image.apply": "套用",
    "image.keepRatio": "保持長寬比",
    "image.originalSize": "原始大小：{width} × {height} 像素",
    "image.pixels": "像素",

    // Toolbar
    "toolbar.label": "編輯器工具列",
};
