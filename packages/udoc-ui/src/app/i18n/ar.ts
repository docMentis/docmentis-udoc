import type { Messages } from "./messages.js";

/** Arabic. */
export const ar: Messages = {
    // Shared
    "common.cancel": "إلغاء",
    "common.save": "حفظ",
    "common.close": "إغلاق",
    "common.delete": "حذف",

    // Numbers
    "format.percent": "{percent}%",
    "format.points": "{points} نقطة",

    // A key that runs a command, as a tooltip names it off a Mac
    "shortcut.control": "Ctrl+{key}",
    "shortcut.controlShift": "Ctrl+Shift+{key}",
    "shortcut.tooltip": "{label} ({shortcut})",

    // Regions
    "shell.skipToDocument": "انتقل إلى المستند",
    "shell.regionToolbar": "شريط الأدوات",
    "shell.regionSidePanel": "اللوحة الجانبية",
    "shell.regionDocument": "المستند",
    "shell.regionSearchComments": "البحث والتعليقات",
    "shell.regionNotes": "ملاحظات المتحدث",

    // Toolbar
    "toolbar.label": "شريط أدوات المستند",
    "toolbar.menu": "القائمة",
    "toolbar.more": "المزيد",
    "toolbar.search": "بحث",
    "toolbar.comments": "تعليقات",
    "toolbar.print": "طباعة",
    "toolbar.download": "تنزيل",
    "toolbar.darkMode": "الوضع الداكن",
    "toolbar.systemTheme": "سمة النظام",
    "toolbar.lightMode": "الوضع الفاتح",
    "toolbar.fullscreen": "ملء الشاشة",
    "toolbar.exitFullscreen": "الخروج من ملء الشاشة",
    "toolbar.developer": "المطور",

    // The people button: the collaboration the document is in
    "collaboration.label": "التحرير المشترك",
    "collaboration.paused": "التحرير المشترك متوقف مؤقتًا",
    "collaboration.reconnecting": "جارٍ إعادة الاتصال…",
    "collaboration.you": "{name} (أنت)",
    "collaboration.sharePointer": "مشاركة مؤشري",
    "collaboration.pause": "إيقاف التحرير المشترك مؤقتًا",
    "collaboration.resume": "استئناف التحرير المشترك",

    // Pointer tools
    "pointerTool.select": "تحديد",
    "pointerTool.pan": "تحريك",
    "pointerTool.zoom": "تكبير/تصغير",
    "pointerTool.options": "خيارات أداة المؤشر",
    "pointerTool.menu": "أدوات المؤشر",
    "pointerTool.tooltip": "الأداة: {tool}",
    "pointerTool.label": "أداة المؤشر: {tool}",

    // Ribbon tabs
    "ribbon.annotate": "تعليق توضيحي",
    "ribbon.view": "عرض",

    // Ribbon
    "ribbon.label": "خيارات الأداة",
    "ribbon.tabs": "علامات تبويب الأدوات",
    "ribbon.more": "مزيد من الأدوات",
    "ribbon.moreTabs": "مزيد من علامات التبويب",
    "ribbon.paintOptions": "خيارات {label}",

    // Ribbon commands, by command id
    "command.undo": "تراجع",
    "command.redo": "إعادة",
    "command.annotateHighlight": "تمييز",
    "command.annotateUnderline": "تسطير",
    "command.annotateStrikeOut": "يتوسطه خط",
    "command.annotateSquiggly": "خط متموج",
    "command.annotateNote": "ملاحظة",
    "command.annotateTextBox": "مربع نص",
    "command.annotateStamp": "ختم",
    "command.annotatePen": "قلم",
    "command.annotateShape": "أشكال",
    "command.annotationColor": "اللون",
    "command.annotationFill": "تعبئة",
    "command.annotationOpacity": "العتامة",
    "command.normalView": "عادي",
    "command.notesPageView": "صفحة الملاحظات",
    "command.notes": "ملاحظات",

    // Shape pickers
    "shape.rectangle": "مستطيل",
    "shape.ellipse": "شكل بيضاوي",
    "shape.line": "خط",
    "shape.arrow": "سهم",
    "shape.polygon": "مضلع",
    "shape.polyline": "خط مضلع",
    "shape.cloud": "سحابة",

    // Standard stamps
    "stamp.approved": "معتمد",
    "stamp.experimental": "تجريبي",
    "stamp.notApproved": "غير معتمد",
    "stamp.asIs": "كما هو",
    "stamp.expired": "منتهي الصلاحية",
    "stamp.notForPublicRelease": "ليس للنشر العام",
    "stamp.confidential": "سري",
    "stamp.final": "نهائي",
    "stamp.sold": "مُباع",
    "stamp.departmental": "خاص بالقسم",
    "stamp.forComment": "للتعليق",
    "stamp.topSecret": "سري للغاية",
    "stamp.draft": "مسودة",
    "stamp.forPublicRelease": "للنشر العام",

    // Color and line panel
    "paint.noFill": "بلا تعبئة",
    "paint.noLine": "بلا خط",
    "paint.noColor": "بلا لون",
    "paint.moreFillOptions": "خيارات تعبئة إضافية…",
    "paint.moreLineOptions": "خيارات خط إضافية…",
    "paint.moreColorOptions": "خيارات ألوان إضافية…",
    "paint.themeColors": "ألوان النسق",
    "paint.standardColors": "ألوان قياسية",
    "paint.recentColors": "الألوان الأخيرة",
    "paint.text1": "نص 1",
    "paint.background1": "خلفية 1",
    "paint.text2": "نص 2",
    "paint.background2": "خلفية 2",
    "paint.accent1": "تمييز 1",
    "paint.accent2": "تمييز 2",
    "paint.accent3": "تمييز 3",
    "paint.accent4": "تمييز 4",
    "paint.accent5": "تمييز 5",
    "paint.accent6": "تمييز 6",
    "paint.lighter": "أفتح بنسبة {percent}%",
    "paint.darker": "أغمق بنسبة {percent}%",
    "paint.themeVariant": "{color}، {variant}",
    "paint.weight": "السُمك",
    "paint.dashes": "الشرطات",
    "paint.solid": "متصل",
    "paint.dashed": "متقطع",
    "paint.dotted": "منقط",
    "paint.dashDot": "شرطة نقطة",
    "paint.start": "البداية",
    "paint.end": "النهاية",

    // Standard colors
    "color.darkRed": "أحمر داكن",
    "color.red": "أحمر",
    "color.orange": "برتقالي",
    "color.yellow": "أصفر",
    "color.lightGreen": "أخضر فاتح",
    "color.green": "أخضر",
    "color.lightBlue": "أزرق فاتح",
    "color.blue": "أزرق",
    "color.darkBlue": "أزرق داكن",
    "color.purple": "أرجواني",

    // Line endings
    "lineEnding.none": "بلا",
    "lineEnding.openArrow": "سهم مفتوح",
    "lineEnding.closedArrow": "سهم مغلق",
    "lineEnding.circle": "دائرة",
    "lineEnding.square": "مربع",
    "lineEnding.diamond": "معيّن",

    // Page navigation
    "viewControls.pageNavigation": "التنقل بين الصفحات والتكبير/التصغير",
    "viewControls.slideNavigation": "التنقل بين الشرائح والتكبير/التصغير",
    "viewControls.previousPage": "الصفحة السابقة",
    "viewControls.nextPage": "الصفحة التالية",
    "viewControls.pageNumber": "رقم الصفحة",
    "viewControls.previousSlide": "الشريحة السابقة",
    "viewControls.nextSlide": "الشريحة التالية",
    "viewControls.slideNumber": "رقم الشريحة",

    // Zoom
    "zoom.label": "تكبير/تصغير",
    "zoom.zoomIn": "تكبير",
    "zoom.zoomOut": "تصغير",
    "zoom.level": "مستوى التكبير/التصغير",
    "zoom.options": "خيارات التكبير/التصغير",
    "zoom.levels": "مستويات التكبير/التصغير",
    "zoom.fitWidth": "ملاءمة العرض",
    "zoom.fitHeight": "ملاءمة الارتفاع",
    "zoom.fitPage": "ملاءمة الصفحة",
    "zoom.fitSlide": "ملاءمة الشريحة",

    // View settings
    "viewMode.label": "إعدادات العرض",
    "viewMode.scroll": "التمرير",
    "viewMode.spread": "صفحة بصفحة",
    "viewMode.continuous": "متواصل",
    "viewMode.layout": "التخطيط",
    "viewMode.single": "مفرد",
    "viewMode.double": "مزدوج",
    "viewMode.coverRight": "غلاف يمين",
    "viewMode.coverLeft": "غلاف يسار",
    "viewMode.rotation": "التدوير",
    "viewMode.degrees": "{degrees}°",
    "viewMode.pageGap": "المسافة بين الصفحات",
    "viewMode.on": "تشغيل",
    "viewMode.off": "إيقاف",

    // Status bar
    "statusBar.label": "شريط المعلومات",

    // Sheets
    "sheet.tabs": "الأوراق",
    "sheet.all": "كل الأوراق",
    "sheet.scrollLeft": "تمرير علامات التبويب لليسار",
    "sheet.scrollRight": "تمرير علامات التبويب لليمين",
    "sheet.unnamed": "ورقة {sheet}",

    // Left panel
    "leftPanel.tabs": "علامات تبويب اللوحة",
    "leftPanel.thumbnails": "صور مصغرة",
    "leftPanel.outline": "المخطط التفصيلي",
    "leftPanel.layers": "الطبقات",
    "leftPanel.attachments": "المرفقات",
    "leftPanel.resizeHandle": "تغيير حجم اللوحة الجانبية",
    "leftPanel.placeholder": "{panel} — لا يوجد شيء هنا بعد",

    // Notes pane
    "notes.resizeHandle": "تغيير حجم الملاحظات",

    // Thumbnails
    "thumbnails.pages": "صور مصغرة للصفحات",
    "thumbnails.slides": "صور مصغرة للشرائح",
    "thumbnails.page": "صفحة {page}",
    "thumbnails.slide": "شريحة {page}",
    "thumbnails.hiddenSlide": "شريحة {page}، مخفية",
    "thumbnails.insertPage": "إدراج صفحة",
    "thumbnails.duplicatePage": "تكرار الصفحة",
    "thumbnails.rotateRight": "تدوير لليمين",
    "thumbnails.rotateLeft": "تدوير لليسار",
    "thumbnails.deletePage": "حذف الصفحة",
    "thumbnails.newSlide": "شريحة جديدة",
    "thumbnails.duplicateSlide": "تكرار الشريحة",
    "thumbnails.hideSlide": "إخفاء الشريحة",
    "thumbnails.deleteSlide": "حذف الشريحة",
    "thumbnails.section": "المقطع {name}",
    "thumbnails.collapseSection": "طي المقطع",
    "thumbnails.expandSection": "توسيع المقطع",
    "thumbnails.sectionName": "اسم المقطع",
    "thumbnails.addSection": "إضافة مقطع",
    "thumbnails.untitledSection": "مقطع بلا عنوان",
    "thumbnails.renameSection": "إعادة تسمية المقطع",
    "thumbnails.moveSectionUp": "نقل المقطع لأعلى",
    "thumbnails.moveSectionDown": "نقل المقطع لأسفل",
    "thumbnails.collapseAll": "طي الكل",
    "thumbnails.expandAll": "توسيع الكل",
    "thumbnails.removeSection": "إزالة المقطع",
    "thumbnails.removeSectionAndSlides": "إزالة المقطع والشرائح",
    "thumbnails.removeAllSections": "إزالة كافة المقاطع",

    // Outline panel
    "outline.loading": "جارٍ تحميل المخطط التفصيلي…",
    "outline.readFailed": "تعذرت قراءة المخطط التفصيلي",
    "outline.empty": "لا يوجد مخطط تفصيلي في هذا المستند",

    // Layers panel
    "layers.loading": "جارٍ تحميل الطبقات…",
    "layers.readFailed": "تعذرت قراءة الطبقات",
    "layers.empty": "لا توجد طبقات في هذا المستند",
    "layers.locked": "مؤمّنة",
    "layers.hide": "إخفاء الطبقة",
    "layers.show": "إظهار الطبقة",

    // Right panel
    "rightPanel.search": "بحث",
    "rightPanel.comments": "تعليقات",
    "rightPanel.resizeHandle": "تغيير حجم اللوحة",
    "rightPanel.close": "إغلاق اللوحة",

    // Search panel
    "search.placeholder": "البحث في المستند",
    "search.label": "نص البحث",
    "search.clear": "مسح البحث",
    "search.matchCase": "مطابقة حالة الأحرف",
    "search.fuzzyMatch": "مطابقة تقريبية",
    "search.previousMatch": "النتيجة السابقة",
    "search.previousMatchTooltip": "النتيجة السابقة (Shift+Enter)",
    "search.nextMatch": "النتيجة التالية",
    "search.nextMatchTooltip": "النتيجة التالية (Enter)",
    "search.results": "نتائج البحث",
    "search.status": "{current} من {total}",
    "search.statusRunning": "{current} من {total}+",
    "search.searching": "جارٍ البحث…",
    "search.noResults": "لا توجد نتائج",
    "search.page": "صفحة {page}",
    "search.slide": "شريحة {page}",

    // Comments panel
    "comments.page": "صفحة {page}",
    "comments.empty": "لا توجد تعليقات في هذا المستند",
    "comments.loading": "جارٍ تحميل التعليقات…",

    // A comment thread
    "comment.label": "تعليق",
    "comment.placeholder": "إضافة تعليق",
    "comment.reply": "رد",
    "comment.edit": "تحرير",
    "comment.cancelEditing": "إلغاء التحرير",
    "comment.save": "حفظ التعليق",
    "comment.replyField": "رد",
    "comment.cancelReply": "إلغاء الرد",
    "comment.saveReply": "حفظ الرد",
    "comment.replies.zero": "لا توجد ردود",
    "comment.replies.one": "رد واحد",
    "comment.replies.two": "ردّان",
    "comment.replies.few": "{count} ردود",
    "comment.replies.many": "{count} ردًا",
    "comment.replies.other": "{count} رد",
    "comment.locked": "مؤمّن: لا يمكن حذفه أو نقله",
    "comment.lockedContents": "مؤمّن: لا يمكن تحرير النص",
    "comment.lockedBoth": "مؤمّن: لا يمكن حذفه أو نقله أو تحريره",

    // An annotation's kind, as a comment names it
    "annotationKind.note": "ملاحظة",
    "annotationKind.textBox": "مربع نص",
    "annotationKind.line": "خط",
    "annotationKind.rectangle": "مستطيل",
    "annotationKind.ellipse": "شكل بيضاوي",
    "annotationKind.polygon": "مضلع",
    "annotationKind.polyline": "خط مضلع",
    "annotationKind.highlight": "تمييز",
    "annotationKind.underline": "تسطير",
    "annotationKind.squiggly": "خط متموج",
    "annotationKind.strikethrough": "يتوسطه خط",
    "annotationKind.stamp": "ختم",
    "annotationKind.pen": "قلم",
    "annotationKind.attachment": "مرفق",
    "annotationKind.caret": "علامة إقحام",
    "annotationKind.sound": "صوت",
    "annotationKind.redaction": "تنقيح",

    // Annotation bar
    "annotationBar.label": "تعليق توضيحي",

    // Print dialog
    "print.title": "طباعة",
    "print.print": "طباعة",
    "print.pages": "الصفحات",
    "print.slides": "الشرائح",
    "print.allPages": "جميع الصفحات",
    "print.allSlides": "جميع الشرائح",
    "print.currentPage": "الصفحة الحالية ({page})",
    "print.currentSlide": "الشريحة الحالية ({page})",
    "print.to": "إلى",
    "print.firstPage": "الصفحة الأولى",
    "print.firstSlide": "الشريحة الأولى",
    "print.lastPage": "الصفحة الأخيرة",
    "print.lastSlide": "الشريحة الأخيرة",
    "print.custom": "مخصص",
    "print.customPlaceholder": "مثال: 1,3,5-8",
    "print.customPages": "صفحات مخصصة",
    "print.customSlides": "شرائح مخصصة",
    "print.quality": "الجودة",
    "print.qualityDraft": "مسودة (150 DPI)",
    "print.qualityStandard": "قياسية (300 DPI)",
    "print.qualityHigh": "عالية (600 DPI)",
    "print.pagesFromToInvalid": "أدخل صفحات من 1 إلى {count}.",
    "print.slidesFromToInvalid": "أدخل شرائح من 1 إلى {count}.",
    "print.pagesFromAfterTo": "لا يمكن أن تأتي الصفحة الأولى بعد الصفحة الأخيرة.",
    "print.slidesFromAfterTo": "لا يمكن أن تأتي الشريحة الأولى بعد الشريحة الأخيرة.",
    "print.pagesCustomInvalid": "أدخل صفحات ونطاقات من 1 إلى {count}، مثل 1,3,5-8.",
    "print.slidesCustomInvalid": "أدخل شرائح ونطاقات من 1 إلى {count}، مثل 1,3,5-8.",

    // Password dialog
    "password.title": "كلمة المرور مطلوبة",
    "password.message": "هذا المستند محمي. يرجى إدخال كلمة المرور لفتحه.",
    "password.placeholder": "أدخل كلمة المرور",
    "password.label": "كلمة المرور",
    "password.show": "إظهار كلمة المرور",
    "password.hide": "إخفاء كلمة المرور",
    "password.unlock": "فتح القفل",
    "password.incorrect": "كلمة المرور غير صحيحة",

    // Busy hold
    "busy.preparingPrint": "جارٍ التحضير للطباعة…",
    "busy.preparingPage": "جارٍ تحضير الصفحة {page} من {count}…",
    "busy.preparingSlide": "جارٍ تحضير الشريحة {page} من {count}…",

    // Loading overlay
    "loading.opening": "جارٍ الفتح…",
    "loading.downloading": "جارٍ التنزيل…",
    "loading.progress": "{loaded} / {total} ميغابايت",

    // License notice
    "license.invalidLicense": "ترخيص غير صالح",
    "license.permitRefused": "الاستخدام المجاني غير متاح",
    "license.cannotVerify": "تعذر التحقق من الاستخدام المجاني",
    "license.contactOwner": "يرجى الاتصال بمالك الموقع.",

    // The docMentis decal's link
    "branding.title": "مدعوم من docMentis",
    "branding.label": "مدعوم من docMentis — يفتح docmentis.com",

    // The text input that takes typing
    "textInput.label": "نص المستند",

    // Context menu
    "contextMenu.label": "إجراءات المستند",
    "contextMenu.copy": "نسخ",
};
