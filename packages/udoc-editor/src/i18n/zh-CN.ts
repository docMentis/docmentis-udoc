import type { EditMessages } from "./messages.js";

/** Simplified Chinese. */
export const zhCN: EditMessages = {
    // Modes
    "mode.view": "查看",
    "mode.edit": "编辑",

    // Mode switcher
    "modeSwitch.label": "编辑器模式",

    // Page controls
    "pageControls.label": "第 {page} 页控件",
    "pageControls.moveUp": "上移页面",
    "pageControls.moveUpLabel": "上移第 {page} 页",
    "pageControls.moveDown": "下移页面",
    "pageControls.moveDownLabel": "下移第 {page} 页",
    "pageControls.rotate": "向右旋转页面",
    "pageControls.rotateLabel": "向右旋转第 {page} 页",
    "pageControls.settings": "页面设置",
    "pageControls.settingsLabel": "第 {page} 页设置",
    "pageControls.delete": "删除页面",
    "pageControls.deleteLabel": "删除第 {page} 页",
    "pageControls.insert": "在此处插入页面",
    "pageControls.insertAtEnd": "在末尾插入页面",
    "pageControls.insertBefore": "在第 {page} 页前插入页面",

    // Page settings dialog
    "pageSettings.title": "第 {page} 页",
    "pageSettings.label": "第 {page} 页设置",
    "pageSettings.pageSize": "页面大小",
    "pageSettings.preset": "页面大小预设",
    "pageSettings.width": "宽度",
    "pageSettings.height": "高度",
    "pageSettings.pageWidth": "页面宽度",
    "pageSettings.pageHeight": "页面高度",
    "pageSettings.units": "单位",
    "pageSettings.inches": "英寸",
    "pageSettings.millimeters": "毫米",
    "pageSettings.points": "磅",
    "pageSettings.portrait": "纵向",
    "pageSettings.landscape": "横向",
    "pageSettings.rotation": "旋转",
    "pageSettings.rotateLeft": "向左旋转",
    "pageSettings.rotatePageLeft": "向左旋转页面",
    "pageSettings.rotateRight": "向右旋转",
    "pageSettings.rotatePageRight": "向右旋转页面",
    "pageSettings.applySize": "应用大小",

    // Page sizes
    "pageSize.letter": "信纸",
    "pageSize.legal": "法律专用纸",
    "pageSize.tabloid": "小报",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "自定义",

    // Ribbon tabs
    "ribbon.home": "开始",
    "ribbon.insert": "插入",
    "ribbon.text": "文本",
    "ribbon.shape": "形状",
    "ribbon.object": "对象",

    // Commands
    "command.ruler": "标尺",
    "command.createSlide": "新建幻灯片",
    "command.insertImage": "图片",
    "command.insertShape": "形状",
    "command.cropPage": "裁剪",
    "command.resizePage": "图像大小",
    "command.fontFamily": "字体",
    "command.fontSize": "字号",
    "command.bold": "加粗",
    "command.italic": "倾斜",
    "command.underline": "下划线",
    "command.strikethrough": "删除线",
    "command.superscript": "上标",
    "command.subscript": "下标",
    "command.widthScale": "字符缩放",
    "command.textFill": "字体颜色",
    "command.textHighlight": "突出显示",
    "command.paragraphAlign": "对齐和缩进",
    "command.lineSpacing": "行和段落间距",
    "command.bulletList": "项目符号",
    "command.numberList": "编号",
    "command.shapeFillColor": "填充",
    "command.shapeStrokeColor": "线条",
    "command.shapeArrange": "排列",
    "command.objectFillColor": "填充",
    "command.objectStrokeColor": "线条",
    "command.objectArrange": "排列",

    // New Slide dialog
    "newSlide.label": "新建幻灯片版式",
    "newSlide.layouts": "幻灯片版式",
    "newSlide.layout": "版式 {index}",

    // Shared
    "common.done": "完成",

    // Ribbon
    "ribbon.noMatchingFonts": "没有匹配的字体",
    "ribbon.listOptions": "{label}选项",
    "ribbon.listStyles": "{label}样式",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "左对齐",
    "paragraph.center": "居中",
    "paragraph.alignRight": "右对齐",
    "paragraph.justify": "两端对齐",
    "paragraph.increaseIndent": "增加缩进量",
    "paragraph.decreaseIndent": "减少缩进量",
    "paragraph.lineSpacingSingle": "单倍行距",
    "paragraph.lineSpacingDouble": "2 倍行距",
    "paragraph.lineSpacingLines": "{lines} 倍行距",
    "paragraph.spaceBefore": "段前间距",
    "paragraph.spaceAfter": "段后间距",

    // Bullet and numbering galleries, by style id
    "list.disc": "带填充效果的圆形项目符号",
    "list.circle": "空心圆形项目符号",
    "list.square": "带填充效果的方形项目符号",
    "list.diamond": "菱形项目符号",
    "list.arrow": "箭头项目符号",
    "list.dash": "短划线项目符号",
    "list.decimal": "带句点的数字",
    "list.decimalParen": "带右括号的数字",
    "list.lowerLetter": "小写字母",
    "list.upperLetter": "大写字母",
    "list.lowerRoman": "小写罗马数字",
    "list.upperRoman": "大写罗马数字",

    // Arrange
    "arrange.bringToFront": "置于顶层",
    "arrange.bringForward": "上移一层",
    "arrange.sendBackward": "下移一层",
    "arrange.sendToBack": "置于底层",
    "arrange.alignLeft": "左对齐",
    "arrange.alignCenter": "水平居中",
    "arrange.alignRight": "右对齐",
    "arrange.alignTop": "顶端对齐",
    "arrange.alignMiddle": "垂直居中",
    "arrange.alignBottom": "底端对齐",
    "arrange.distributeHorizontally": "横向分布",
    "arrange.distributeVertically": "纵向分布",
    "arrange.alignToPage": "对齐页面",
    "arrange.rotateRight": "向右旋转 90°",
    "arrange.rotateLeft": "向左旋转 90°",
    "arrange.flipHorizontal": "水平翻转",
    "arrange.flipVertical": "垂直翻转",
    "arrange.order": "叠放次序",
    "arrange.align": "对齐",
    "arrange.rotate": "旋转",
    "arrange.group": "组合",
    "arrange.ungroup": "取消组合",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "填充选项",
    "paintOptions.lineTitle": "线条选项",
    "paintOptions.textColorTitle": "字体颜色选项",
    "paintOptions.highlightTitle": "突出显示选项",
    "paintOptions.fillBlurb": "自定义颜色以及渐变、图案和图片填充将在此处提供。",
    "paintOptions.lineBlurb": "自定义颜色、复合线条、线端和连接类型以及箭头将在此处提供。",
    "paintOptions.textColorBlurb": "自定义颜色及更多字体颜色选项将在此处提供。",
    "paintOptions.highlightBlurb": "自定义颜色及更多突出显示选项将在此处提供。",

    // Busy hold
    "busy.loadingFont": "正在加载字体 {font}…",

    // Context menu
    "contextMenu.cut": "剪切",
    "contextMenu.paste": "粘贴",
    "contextMenu.delete": "删除",

    // Context menu over a table
    "table.selectRow": "选择行",
    "table.selectColumn": "选择列",
    "table.selectTable": "选择表格",
    "table.rowAbove": "在上方插入行",
    "table.rowBelow": "在下方插入行",
    "table.columnLeft": "在左侧插入列",
    "table.columnRight": "在右侧插入列",
    "table.deleteRows": "删除行",
    "table.deleteColumns": "删除列",
    "table.select": "选择",
    "table.insert": "插入",
    "table.delete": "删除",
    "table.mergeCells": "合并单元格",
    "table.unmergeCells": "取消合并单元格",

    // Crop mode and the Image Size dialog
    "image.aspectRatio": "纵横比",
    "image.free": "自由",
    "image.original": "原始",
    "image.square": "正方形",
    "image.ratio": "{ratio}",
    "image.cropSize": "{width} × {height} 像素",
    "image.reset": "重置",
    "image.apply": "应用",
    "image.keepRatio": "保持纵横比",
    "image.originalSize": "原始大小：{width} × {height} 像素",
    "image.pixels": "像素",

    // Toolbar
    "toolbar.label": "编辑器工具栏",
};
