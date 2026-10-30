import type { EditMessages } from "./messages.js";

/** Arabic. */
export const ar: EditMessages = {
    // Modes
    "mode.view": "عرض",
    "mode.edit": "تحرير",

    // Mode switcher
    "modeSwitch.label": "وضع المحرر",

    // Page controls
    "pageControls.label": "عناصر التحكم في الصفحة {page}",
    "pageControls.moveUp": "نقل الصفحة لأعلى",
    "pageControls.moveUpLabel": "نقل الصفحة {page} لأعلى",
    "pageControls.moveDown": "نقل الصفحة لأسفل",
    "pageControls.moveDownLabel": "نقل الصفحة {page} لأسفل",
    "pageControls.rotate": "تدوير الصفحة لليمين",
    "pageControls.rotateLabel": "تدوير الصفحة {page} لليمين",
    "pageControls.settings": "إعدادات الصفحة",
    "pageControls.settingsLabel": "إعدادات الصفحة {page}",
    "pageControls.delete": "حذف الصفحة",
    "pageControls.deleteLabel": "حذف الصفحة {page}",
    "pageControls.insert": "إدراج صفحة هنا",
    "pageControls.insertAtEnd": "إدراج صفحة في النهاية",
    "pageControls.insertBefore": "إدراج صفحة قبل الصفحة {page}",

    // Page settings dialog
    "pageSettings.title": "صفحة {page}",
    "pageSettings.label": "إعدادات الصفحة {page}",
    "pageSettings.pageSize": "حجم الصفحة",
    "pageSettings.preset": "حجم صفحة محدد مسبقًا",
    "pageSettings.width": "العرض",
    "pageSettings.height": "الارتفاع",
    "pageSettings.pageWidth": "عرض الصفحة",
    "pageSettings.pageHeight": "ارتفاع الصفحة",
    "pageSettings.units": "الوحدات",
    "pageSettings.inches": "بوصة",
    "pageSettings.millimeters": "مم",
    "pageSettings.points": "نقطة",
    "pageSettings.portrait": "عمودي",
    "pageSettings.landscape": "أفقي",
    "pageSettings.rotation": "التدوير",
    "pageSettings.rotateLeft": "تدوير لليسار",
    "pageSettings.rotatePageLeft": "تدوير الصفحة لليسار",
    "pageSettings.rotateRight": "تدوير لليمين",
    "pageSettings.rotatePageRight": "تدوير الصفحة لليمين",
    "pageSettings.applySize": "تطبيق الحجم",

    // Page sizes
    "pageSize.letter": "رسالة",
    "pageSize.legal": "قانوني",
    "pageSize.tabloid": "تابلويد",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "مخصص",

    // Ribbon tabs
    "ribbon.home": "الصفحة الرئيسية",
    "ribbon.insert": "إدراج",
    "ribbon.text": "نص",
    "ribbon.shape": "شكل",
    "ribbon.object": "كائن",

    // Commands
    "command.ruler": "المسطرة",
    "command.createSlide": "شريحة جديدة",
    "command.insertImage": "صورة",
    "command.insertShape": "أشكال",
    "command.cropPage": "قص",
    "command.resizePage": "حجم الصورة",
    "command.fontFamily": "الخط",
    "command.fontSize": "الحجم",
    "command.bold": "غامق",
    "command.italic": "مائل",
    "command.underline": "تسطير",
    "command.strikethrough": "يتوسطه خط",
    "command.superscript": "مرتفع",
    "command.subscript": "منخفض",
    "command.widthScale": "تغيير الحجم",
    "command.textFill": "لون النص",
    "command.textHighlight": "تمييز",
    "command.paragraphAlign": "المحاذاة والمسافة البادئة",
    "command.lineSpacing": "تباعد الأسطر والفقرات",
    "command.bulletList": "تعداد نقطي",
    "command.numberList": "تعداد رقمي",
    "command.shapeFillColor": "تعبئة",
    "command.shapeStrokeColor": "خط",
    "command.shapeArrange": "ترتيب",
    "command.objectFillColor": "تعبئة",
    "command.objectStrokeColor": "خط",
    "command.objectArrange": "ترتيب",

    // New Slide dialog
    "newSlide.label": "تخطيط الشريحة الجديدة",
    "newSlide.layouts": "تخطيطات الشرائح",
    "newSlide.layout": "تخطيط {index}",

    // Shared
    "common.done": "تم",

    // Ribbon
    "ribbon.noMatchingFonts": "لا توجد خطوط مطابقة",
    "ribbon.listOptions": "خيارات {label}",
    "ribbon.listStyles": "أنماط {label}",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "محاذاة إلى اليسار",
    "paragraph.center": "توسيط",
    "paragraph.alignRight": "محاذاة إلى اليمين",
    "paragraph.justify": "ضبط",
    "paragraph.increaseIndent": "زيادة المسافة البادئة",
    "paragraph.decreaseIndent": "إنقاص المسافة البادئة",
    "paragraph.lineSpacingSingle": "مفرد",
    "paragraph.lineSpacingDouble": "مزدوج",
    "paragraph.lineSpacingLines": "{lines}",
    "paragraph.spaceBefore": "المسافة قبل الفقرة",
    "paragraph.spaceAfter": "المسافة بعد الفقرة",

    // Bullet and numbering galleries, by style id
    "list.disc": "تعداد نقطي دائري معبأ",
    "list.circle": "تعداد نقطي دائري مجوف",
    "list.square": "تعداد نقطي مربع معبأ",
    "list.diamond": "تعداد نقطي على شكل معيّن",
    "list.arrow": "تعداد نقطي على شكل سهم",
    "list.dash": "تعداد نقطي على شكل شرطة",
    "list.decimal": "أرقام متبوعة بنقطة",
    "list.decimalParen": "أرقام متبوعة بقوس",
    "list.lowerLetter": "أحرف صغيرة",
    "list.upperLetter": "أحرف كبيرة",
    "list.lowerRoman": "أرقام رومانية صغيرة",
    "list.upperRoman": "أرقام رومانية كبيرة",

    // Arrange
    "arrange.bringToFront": "إحضار إلى الأمام",
    "arrange.bringForward": "إحضار للأمام",
    "arrange.sendBackward": "إرسال للخلف",
    "arrange.sendToBack": "إرسال إلى الخلف",
    "arrange.alignLeft": "محاذاة إلى اليسار",
    "arrange.alignCenter": "توسيط",
    "arrange.alignRight": "محاذاة إلى اليمين",
    "arrange.alignTop": "محاذاة إلى الأعلى",
    "arrange.alignMiddle": "محاذاة إلى الوسط",
    "arrange.alignBottom": "محاذاة إلى الأسفل",
    "arrange.distributeHorizontally": "توزيع أفقي",
    "arrange.distributeVertically": "توزيع عمودي",
    "arrange.alignToPage": "محاذاة إلى الصفحة",
    "arrange.rotateRight": "تدوير 90° لليمين",
    "arrange.rotateLeft": "تدوير 90° لليسار",
    "arrange.flipHorizontal": "قلب أفقي",
    "arrange.flipVertical": "قلب عمودي",
    "arrange.order": "ترتيب الكائنات",
    "arrange.align": "محاذاة",
    "arrange.rotate": "تدوير",
    "arrange.group": "تجميع",
    "arrange.ungroup": "فك التجميع",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "خيارات التعبئة",
    "paintOptions.lineTitle": "خيارات الخط",
    "paintOptions.textColorTitle": "خيارات لون النص",
    "paintOptions.highlightTitle": "خيارات التمييز",
    "paintOptions.fillBlurb": "ستتوفر هنا الألوان المخصصة والتعبئة المتدرجة والتعبئة بنقش والتعبئة بصورة.",
    "paintOptions.lineBlurb": "ستتوفر هنا الألوان المخصصة والخطوط المركبة وأنواع الأطراف والوصلات ونهايات الأسهم.",
    "paintOptions.textColorBlurb": "ستتوفر هنا الألوان المخصصة والمزيد من خيارات لون النص.",
    "paintOptions.highlightBlurb": "ستتوفر هنا الألوان المخصصة والمزيد من خيارات التمييز.",

    // Busy hold
    "busy.loadingFont": "جارٍ تحميل {font}…",

    // Context menu
    "contextMenu.cut": "قص",
    "contextMenu.paste": "لصق",
    "contextMenu.delete": "حذف",

    // Context menu over a table
    "table.selectRow": "صف",
    "table.selectColumn": "عمود",
    "table.selectTable": "جدول",
    "table.rowAbove": "صف إلى الأعلى",
    "table.rowBelow": "صف إلى الأسفل",
    "table.columnLeft": "عمود إلى اليسار",
    "table.columnRight": "عمود إلى اليمين",
    "table.deleteRows": "صفوف",
    "table.deleteColumns": "أعمدة",
    "table.select": "تحديد",
    "table.insert": "إدراج",
    "table.delete": "حذف",
    "table.mergeCells": "دمج الخلايا",
    "table.unmergeCells": "إلغاء دمج الخلايا",

    // Crop mode and the Image Size dialog
    "image.aspectRatio": "نسبة العرض إلى الارتفاع",
    "image.free": "حر",
    "image.original": "الأصلية",
    "image.square": "مربع",
    "image.ratio": "{ratio}",
    "image.cropSize": "{width} × {height} بكسل",
    "image.reset": "إعادة تعيين",
    "image.apply": "تطبيق",
    "image.keepRatio": "الحفاظ على نسبة العرض إلى الارتفاع",
    "image.originalSize": "الحجم الأصلي: {width} × {height} بكسل",
    "image.pixels": "بكسل",

    // Toolbar
    "toolbar.label": "شريط أدوات المحرر",
};
