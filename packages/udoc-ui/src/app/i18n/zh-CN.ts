import type { Messages } from "./messages.js";

/** Simplified Chinese. */
export const zhCN: Messages = {
    // Shared
    "common.cancel": "取消",
    "common.save": "保存",
    "common.close": "关闭",
    "common.delete": "删除",

    // Numbers
    "format.percent": "{percent}%",
    "format.points": "{points} 磅",

    // A key that runs a command, as a tooltip names it off a Mac
    "shortcut.control": "Ctrl+{key}",
    "shortcut.controlShift": "Ctrl+Shift+{key}",
    "shortcut.tooltip": "{label} ({shortcut})",

    // Regions
    "shell.skipToDocument": "跳转到文档",
    "shell.regionToolbar": "工具栏",
    "shell.regionSidePanel": "侧边面板",
    "shell.regionDocument": "文档",
    "shell.regionSearchComments": "搜索与批注",

    // Toolbar
    "toolbar.label": "文档工具栏",
    "toolbar.menu": "菜单",
    "toolbar.more": "更多",
    "toolbar.search": "搜索",
    "toolbar.comments": "批注",
    "toolbar.print": "打印",
    "toolbar.download": "下载",
    "toolbar.darkMode": "深色模式",
    "toolbar.systemTheme": "跟随系统",
    "toolbar.lightMode": "浅色模式",
    "toolbar.fullscreen": "全屏",
    "toolbar.exitFullscreen": "退出全屏",
    "toolbar.developer": "开发工具",

    // The people button: the collaboration the document is in
    "collaboration.label": "协同编辑",
    "collaboration.paused": "协同编辑已暂停",
    "collaboration.reconnecting": "正在重新连接…",
    "collaboration.you": "{name}（我）",
    "collaboration.sharePointer": "共享我的指针",
    "collaboration.pause": "暂停协同编辑",
    "collaboration.resume": "继续协同编辑",

    // Pointer tools
    "pointerTool.select": "选择",
    "pointerTool.pan": "平移",
    "pointerTool.zoom": "缩放",
    "pointerTool.options": "指针工具选项",
    "pointerTool.menu": "指针工具",
    "pointerTool.tooltip": "工具：{tool}",
    "pointerTool.label": "指针工具：{tool}",

    // Ribbon tabs
    "ribbon.annotate": "注释",

    // Ribbon
    "ribbon.label": "工具选项",
    "ribbon.tabs": "工具选项卡",
    "ribbon.more": "更多工具",
    "ribbon.moreTabs": "更多选项卡",
    "ribbon.paintOptions": "{label}选项",

    // Ribbon commands, by command id
    "command.undo": "撤消",
    "command.redo": "重做",
    "command.annotateHighlight": "高亮",
    "command.annotateUnderline": "下划线",
    "command.annotateStrikeOut": "删除线",
    "command.annotateSquiggly": "波浪线",
    "command.annotateNote": "附注",
    "command.annotateTextBox": "文本框",
    "command.annotateStamp": "图章",
    "command.annotatePen": "画笔",
    "command.annotateShape": "形状",
    "command.annotationColor": "颜色",
    "command.annotationFill": "填充",
    "command.annotationOpacity": "不透明度",

    // Shape pickers
    "shape.rectangle": "矩形",
    "shape.ellipse": "椭圆",
    "shape.line": "直线",
    "shape.arrow": "箭头",
    "shape.polygon": "多边形",
    "shape.polyline": "折线",
    "shape.cloud": "云朵",

    // Standard stamps
    "stamp.approved": "已批准",
    "stamp.experimental": "实验性",
    "stamp.notApproved": "未批准",
    "stamp.asIs": "按原样",
    "stamp.expired": "已过期",
    "stamp.notForPublicRelease": "不公开发布",
    "stamp.confidential": "机密",
    "stamp.final": "最终版",
    "stamp.sold": "已售出",
    "stamp.departmental": "部门内部",
    "stamp.forComment": "征求意见",
    "stamp.topSecret": "绝密",
    "stamp.draft": "草稿",
    "stamp.forPublicRelease": "公开发布",

    // Color and line panel
    "paint.noFill": "无填充",
    "paint.noLine": "无线条",
    "paint.noColor": "无颜色",
    "paint.moreFillOptions": "其他填充选项…",
    "paint.moreLineOptions": "其他线条选项…",
    "paint.moreColorOptions": "其他颜色选项…",
    "paint.themeColors": "主题颜色",
    "paint.standardColors": "标准色",
    "paint.recentColors": "最近使用的颜色",
    "paint.text1": "文字 1",
    "paint.background1": "背景 1",
    "paint.text2": "文字 2",
    "paint.background2": "背景 2",
    "paint.accent1": "个性色 1",
    "paint.accent2": "个性色 2",
    "paint.accent3": "个性色 3",
    "paint.accent4": "个性色 4",
    "paint.accent5": "个性色 5",
    "paint.accent6": "个性色 6",
    "paint.lighter": "淡色 {percent}%",
    "paint.darker": "深色 {percent}%",
    "paint.themeVariant": "{color}，{variant}",
    "paint.weight": "粗细",
    "paint.dashes": "虚线",
    "paint.solid": "实线",
    "paint.dashed": "短划线",
    "paint.dotted": "圆点",
    "paint.dashDot": "短划线-点",
    "paint.start": "起点",
    "paint.end": "终点",

    // Standard colors
    "color.darkRed": "深红",
    "color.red": "红色",
    "color.orange": "橙色",
    "color.yellow": "黄色",
    "color.lightGreen": "浅绿",
    "color.green": "绿色",
    "color.lightBlue": "浅蓝",
    "color.blue": "蓝色",
    "color.darkBlue": "深蓝",
    "color.purple": "紫色",

    // Line endings
    "lineEnding.none": "无",
    "lineEnding.openArrow": "开放箭头",
    "lineEnding.closedArrow": "封闭箭头",
    "lineEnding.circle": "圆形",
    "lineEnding.square": "方形",
    "lineEnding.diamond": "菱形",

    // Page navigation
    "viewControls.pageNavigation": "页面导航与缩放",
    "viewControls.slideNavigation": "幻灯片导航与缩放",
    "viewControls.previousPage": "上一页",
    "viewControls.nextPage": "下一页",
    "viewControls.pageNumber": "页码",
    "viewControls.previousSlide": "上一张幻灯片",
    "viewControls.nextSlide": "下一张幻灯片",
    "viewControls.slideNumber": "幻灯片编号",

    // Zoom
    "zoom.label": "缩放",
    "zoom.zoomIn": "放大",
    "zoom.zoomOut": "缩小",
    "zoom.level": "缩放级别",
    "zoom.options": "缩放选项",
    "zoom.levels": "缩放级别",
    "zoom.fitWidth": "适合宽度",
    "zoom.fitHeight": "适合高度",
    "zoom.fitPage": "适合页面",
    "zoom.fitSlide": "适合幻灯片",

    // View settings
    "viewMode.label": "视图设置",
    "viewMode.scroll": "滚动",
    "viewMode.spread": "跨页",
    "viewMode.continuous": "连续",
    "viewMode.layout": "布局",
    "viewMode.single": "单页",
    "viewMode.double": "双页",
    "viewMode.coverRight": "封面居右",
    "viewMode.coverLeft": "封面居左",
    "viewMode.rotation": "旋转",
    "viewMode.degrees": "{degrees}°",
    "viewMode.pageGap": "页面间距",
    "viewMode.on": "开",
    "viewMode.off": "关",

    // Status bar
    "statusBar.label": "状态栏",

    // Sheets
    "sheet.tabs": "工作表",
    "sheet.all": "所有工作表",
    "sheet.scrollLeft": "向左滚动标签",
    "sheet.scrollRight": "向右滚动标签",
    "sheet.unnamed": "Sheet{sheet}",

    // Left panel
    "leftPanel.tabs": "面板选项卡",
    "leftPanel.thumbnails": "缩略图",
    "leftPanel.outline": "大纲",
    "leftPanel.layers": "图层",
    "leftPanel.attachments": "附件",
    "leftPanel.resizeHandle": "调整侧边面板大小",
    "leftPanel.placeholder": "{panel}——暂无内容",

    // Thumbnails
    "thumbnails.pages": "页面缩略图",
    "thumbnails.slides": "幻灯片缩略图",
    "thumbnails.page": "第 {page} 页",
    "thumbnails.slide": "第 {page} 张幻灯片",
    "thumbnails.hiddenSlide": "第 {page} 张幻灯片，已隐藏",
    "thumbnails.insertPage": "插入页面",
    "thumbnails.duplicatePage": "复制页面",
    "thumbnails.rotateRight": "向右旋转",
    "thumbnails.rotateLeft": "向左旋转",
    "thumbnails.deletePage": "删除页面",
    "thumbnails.newSlide": "新建幻灯片",
    "thumbnails.duplicateSlide": "复制幻灯片",
    "thumbnails.hideSlide": "隐藏幻灯片",
    "thumbnails.deleteSlide": "删除幻灯片",

    // Outline panel
    "outline.loading": "正在加载大纲…",
    "outline.readFailed": "无法读取大纲",
    "outline.empty": "此文档暂无大纲",

    // Layers panel
    "layers.loading": "正在加载图层…",
    "layers.readFailed": "无法读取图层",
    "layers.empty": "此文档暂无图层",
    "layers.locked": "已锁定",
    "layers.hide": "隐藏图层",
    "layers.show": "显示图层",

    // Right panel
    "rightPanel.search": "搜索",
    "rightPanel.comments": "批注",
    "rightPanel.resizeHandle": "调整面板大小",
    "rightPanel.close": "关闭面板",

    // Search panel
    "search.placeholder": "在文档中搜索",
    "search.label": "搜索文本",
    "search.clear": "清除搜索",
    "search.matchCase": "区分大小写",
    "search.fuzzyMatch": "模糊匹配",
    "search.previousMatch": "上一个匹配项",
    "search.previousMatchTooltip": "上一个匹配项 (Shift+Enter)",
    "search.nextMatch": "下一个匹配项",
    "search.nextMatchTooltip": "下一个匹配项 (Enter)",
    "search.results": "搜索结果",
    "search.status": "第 {current} 项，共 {total} 项",
    "search.statusRunning": "第 {current} 项，共 {total}+ 项",
    "search.searching": "正在搜索…",
    "search.noResults": "无结果",
    "search.page": "第 {page} 页",
    "search.slide": "第 {page} 张幻灯片",

    // Comments panel
    "comments.page": "第 {page} 页",
    "comments.empty": "此文档暂无批注",
    "comments.loading": "正在加载批注…",

    // A comment thread
    "comment.label": "批注",
    "comment.placeholder": "添加批注",
    "comment.reply": "回复",
    "comment.edit": "编辑",
    "comment.cancelEditing": "取消编辑",
    "comment.save": "保存批注",
    "comment.replyField": "回复",
    "comment.cancelReply": "取消回复",
    "comment.saveReply": "保存回复",
    "comment.replies.other": "{count} 条回复",
    "comment.locked": "已锁定：无法删除或移动",
    "comment.lockedContents": "已锁定：无法编辑文本",
    "comment.lockedBoth": "已锁定：无法删除、移动或编辑",

    // An annotation's kind, as a comment names it
    "annotationKind.note": "附注",
    "annotationKind.textBox": "文本框",
    "annotationKind.line": "直线",
    "annotationKind.rectangle": "矩形",
    "annotationKind.ellipse": "椭圆",
    "annotationKind.polygon": "多边形",
    "annotationKind.polyline": "折线",
    "annotationKind.highlight": "高亮",
    "annotationKind.underline": "下划线",
    "annotationKind.squiggly": "波浪线",
    "annotationKind.strikethrough": "删除线",
    "annotationKind.stamp": "图章",
    "annotationKind.pen": "画笔",
    "annotationKind.attachment": "附件",
    "annotationKind.caret": "插入符",
    "annotationKind.sound": "声音",
    "annotationKind.redaction": "密文",

    // Annotation bar
    "annotationBar.label": "注释",

    // Print dialog
    "print.title": "打印",
    "print.print": "打印",
    "print.pages": "页面范围",
    "print.slides": "幻灯片范围",
    "print.allPages": "全部页面",
    "print.allSlides": "全部幻灯片",
    "print.currentPage": "当前页 ({page})",
    "print.currentSlide": "当前幻灯片 ({page})",
    "print.to": "至",
    "print.firstPage": "起始页",
    "print.firstSlide": "起始幻灯片",
    "print.lastPage": "结束页",
    "print.lastSlide": "结束幻灯片",
    "print.custom": "自定义",
    "print.customPlaceholder": "例如 1,3,5-8",
    "print.customPages": "自定义页面",
    "print.customSlides": "自定义幻灯片",
    "print.quality": "质量",
    "print.qualityDraft": "草稿 (150 DPI)",
    "print.qualityStandard": "标准 (300 DPI)",
    "print.qualityHigh": "高质量 (600 DPI)",
    "print.pagesFromToInvalid": "请输入 1 到 {count} 之间的页码。",
    "print.slidesFromToInvalid": "请输入 1 到 {count} 之间的幻灯片编号。",
    "print.pagesFromAfterTo": "起始页不能大于结束页。",
    "print.slidesFromAfterTo": "起始幻灯片不能大于结束幻灯片。",
    "print.pagesCustomInvalid": "请输入 1 到 {count} 之间的页码或页码范围，例如 1,3,5-8。",
    "print.slidesCustomInvalid": "请输入 1 到 {count} 之间的幻灯片编号或编号范围，例如 1,3,5-8。",

    // Password dialog
    "password.title": "需要密码",
    "password.message": "此文档受密码保护，请输入密码以打开。",
    "password.placeholder": "输入密码",
    "password.label": "密码",
    "password.show": "显示密码",
    "password.hide": "隐藏密码",
    "password.unlock": "解锁",
    "password.incorrect": "密码不正确",

    // Busy hold
    "busy.preparingPrint": "正在准备打印…",
    "busy.preparingPage": "正在准备第 {page} 页，共 {count} 页…",
    "busy.preparingSlide": "正在准备第 {page} 张幻灯片，共 {count} 张…",

    // Loading overlay
    "loading.opening": "正在打开…",
    "loading.downloading": "正在下载…",
    "loading.progress": "{loaded} / {total} MB",

    // License notice
    "license.invalidLicense": "许可证无效",
    "license.permitRefused": "无法免费使用",
    "license.cannotVerify": "无法验证免费使用额度",
    "license.contactOwner": "请联系网站所有者。",

    // The docMentis decal's link
    "branding.title": "由 docMentis 提供支持",
    "branding.label": "由 docMentis 提供支持——将打开 docmentis.com",

    // The text input that takes typing
    "textInput.label": "文档文本",

    // Context menu
    "contextMenu.label": "文档操作",
    "contextMenu.copy": "复制",
};
