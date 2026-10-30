import type { EditMessages } from "./messages.js";

/** Japanese. */
export const ja: EditMessages = {
    // Modes
    "mode.view": "表示",
    "mode.edit": "編集",

    // Mode switcher
    "modeSwitch.label": "エディターモード",

    // Page controls
    "pageControls.label": "{page}ページの操作",
    "pageControls.moveUp": "ページを上へ移動",
    "pageControls.moveUpLabel": "{page}ページを上へ移動",
    "pageControls.moveDown": "ページを下へ移動",
    "pageControls.moveDownLabel": "{page}ページを下へ移動",
    "pageControls.rotate": "ページを右へ回転",
    "pageControls.rotateLabel": "{page}ページを右へ回転",
    "pageControls.settings": "ページ設定",
    "pageControls.settingsLabel": "{page}ページの設定",
    "pageControls.delete": "ページを削除",
    "pageControls.deleteLabel": "{page}ページを削除",
    "pageControls.insert": "ここにページを挿入",
    "pageControls.insertAtEnd": "末尾にページを挿入",
    "pageControls.insertBefore": "{page}ページの前にページを挿入",

    // Page settings dialog
    "pageSettings.title": "{page}ページ",
    "pageSettings.label": "{page}ページの設定",
    "pageSettings.pageSize": "ページサイズ",
    "pageSettings.preset": "ページサイズのプリセット",
    "pageSettings.width": "幅",
    "pageSettings.height": "高さ",
    "pageSettings.pageWidth": "ページの幅",
    "pageSettings.pageHeight": "ページの高さ",
    "pageSettings.units": "単位",
    "pageSettings.inches": "インチ",
    "pageSettings.millimeters": "mm",
    "pageSettings.points": "pt",
    "pageSettings.portrait": "縦",
    "pageSettings.landscape": "横",
    "pageSettings.rotation": "回転",
    "pageSettings.rotateLeft": "左へ回転",
    "pageSettings.rotatePageLeft": "ページを左へ回転",
    "pageSettings.rotateRight": "右へ回転",
    "pageSettings.rotatePageRight": "ページを右へ回転",
    "pageSettings.applySize": "サイズを適用",

    // Page sizes
    "pageSize.letter": "レター",
    "pageSize.legal": "リーガル",
    "pageSize.tabloid": "タブロイド",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "ユーザー設定",

    // Ribbon tabs
    "ribbon.home": "ホーム",
    "ribbon.insert": "挿入",
    "ribbon.text": "テキスト",
    "ribbon.shape": "図形",
    "ribbon.object": "オブジェクト",

    // Commands
    "command.ruler": "ルーラー",
    "command.createSlide": "新しいスライド",
    "command.insertImage": "画像",
    "command.insertShape": "図形",
    "command.cropPage": "トリミング",
    "command.resizePage": "画像サイズ",
    "command.fontFamily": "フォント",
    "command.fontSize": "サイズ",
    "command.bold": "太字",
    "command.italic": "斜体",
    "command.underline": "下線",
    "command.strikethrough": "取り消し線",
    "command.superscript": "上付き",
    "command.subscript": "下付き",
    "command.widthScale": "文字の拡大/縮小",
    "command.textFill": "フォントの色",
    "command.textHighlight": "蛍光ペン",
    "command.paragraphAlign": "配置とインデント",
    "command.lineSpacing": "行と段落の間隔",
    "command.bulletList": "箇条書き",
    "command.numberList": "段落番号",
    "command.shapeFillColor": "塗りつぶし",
    "command.shapeStrokeColor": "枠線",
    "command.shapeArrange": "配置",
    "command.objectFillColor": "塗りつぶし",
    "command.objectStrokeColor": "枠線",
    "command.objectArrange": "配置",

    // New Slide dialog
    "newSlide.label": "新しいスライドのレイアウト",
    "newSlide.layouts": "スライドのレイアウト",
    "newSlide.layout": "レイアウト {index}",

    // Shared
    "common.done": "完了",

    // Ribbon
    "ribbon.noMatchingFonts": "一致するフォントがありません",
    "ribbon.listOptions": "{label}のオプション",
    "ribbon.listStyles": "{label}のスタイル",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "左揃え",
    "paragraph.center": "中央揃え",
    "paragraph.alignRight": "右揃え",
    "paragraph.justify": "両端揃え",
    "paragraph.increaseIndent": "インデントを増やす",
    "paragraph.decreaseIndent": "インデントを減らす",
    "paragraph.lineSpacingSingle": "1行",
    "paragraph.lineSpacingDouble": "2行",
    "paragraph.lineSpacingLines": "{lines}",
    "paragraph.spaceBefore": "段落前の間隔",
    "paragraph.spaceAfter": "段落後の間隔",

    // Bullet and numbering galleries, by style id
    "list.disc": "塗りつぶし丸の行頭文字",
    "list.circle": "中抜き丸の行頭文字",
    "list.square": "塗りつぶし四角の行頭文字",
    "list.diamond": "ひし形の行頭文字",
    "list.arrow": "矢印の行頭文字",
    "list.dash": "ダッシュの行頭文字",
    "list.decimal": "ピリオド付き数字",
    "list.decimalParen": "片かっこ付き数字",
    "list.lowerLetter": "英小文字",
    "list.upperLetter": "英大文字",
    "list.lowerRoman": "小文字のローマ数字",
    "list.upperRoman": "大文字のローマ数字",

    // Arrange
    "arrange.bringToFront": "最前面へ移動",
    "arrange.bringForward": "前面へ移動",
    "arrange.sendBackward": "背面へ移動",
    "arrange.sendToBack": "最背面へ移動",
    "arrange.alignLeft": "左揃え",
    "arrange.alignCenter": "左右中央揃え",
    "arrange.alignRight": "右揃え",
    "arrange.alignTop": "上揃え",
    "arrange.alignMiddle": "上下中央揃え",
    "arrange.alignBottom": "下揃え",
    "arrange.distributeHorizontally": "左右に整列",
    "arrange.distributeVertically": "上下に整列",
    "arrange.alignToPage": "ページに合わせて配置",
    "arrange.rotateRight": "右へ90度回転",
    "arrange.rotateLeft": "左へ90度回転",
    "arrange.flipHorizontal": "左右反転",
    "arrange.flipVertical": "上下反転",
    "arrange.order": "順序",
    "arrange.align": "配置",
    "arrange.rotate": "回転",
    "arrange.group": "グループ化",
    "arrange.ungroup": "グループ解除",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "塗りつぶしのオプション",
    "paintOptions.lineTitle": "枠線のオプション",
    "paintOptions.textColorTitle": "フォントの色のオプション",
    "paintOptions.highlightTitle": "蛍光ペンのオプション",
    "paintOptions.fillBlurb":
        "ユーザー設定の色と、グラデーション、パターン、画像による塗りつぶしは、今後ここに追加される予定です。",
    "paintOptions.lineBlurb":
        "ユーザー設定の色、一重線/多重線、線の先端と結合点、矢印の設定は、今後ここに追加される予定です。",
    "paintOptions.textColorBlurb":
        "ユーザー設定の色やその他のフォントの色のオプションは、今後ここに追加される予定です。",
    "paintOptions.highlightBlurb": "ユーザー設定の色やその他の蛍光ペンのオプションは、今後ここに追加される予定です。",

    // Busy hold
    "busy.loadingFont": "{font}を読み込み中…",

    // Context menu
    "contextMenu.cut": "切り取り",
    "contextMenu.paste": "貼り付け",
    "contextMenu.delete": "削除",

    // Context menu over a table
    "table.selectRow": "行の選択",
    "table.selectColumn": "列の選択",
    "table.selectTable": "表の選択",
    "table.rowAbove": "上に行を挿入",
    "table.rowBelow": "下に行を挿入",
    "table.columnLeft": "左に列を挿入",
    "table.columnRight": "右に列を挿入",
    "table.deleteRows": "行の削除",
    "table.deleteColumns": "列の削除",
    "table.select": "選択",
    "table.insert": "挿入",
    "table.delete": "削除",
    "table.mergeCells": "セルの結合",
    "table.unmergeCells": "セル結合の解除",

    // Crop mode and the Image Size dialog
    "image.aspectRatio": "縦横比",
    "image.free": "自由",
    "image.original": "元の比率",
    "image.square": "正方形",
    "image.ratio": "{ratio}",
    "image.cropSize": "{width} × {height} px",
    "image.reset": "リセット",
    "image.apply": "適用",
    "image.keepRatio": "縦横比を固定",
    "image.originalSize": "元のサイズ: {width} × {height} px",
    "image.pixels": "px",

    // Toolbar
    "toolbar.label": "エディターツールバー",
};
