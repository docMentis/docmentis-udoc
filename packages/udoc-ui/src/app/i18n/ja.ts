import type { Messages } from "./messages.js";

/** Japanese. */
export const ja: Messages = {
    // Shared
    "common.cancel": "キャンセル",
    "common.save": "保存",
    "common.close": "閉じる",
    "common.delete": "削除",

    // Numbers
    "format.percent": "{percent}%",
    "format.points": "{points} pt",

    // A key that runs a command, as a tooltip names it off a Mac
    "shortcut.control": "Ctrl+{key}",
    "shortcut.controlShift": "Ctrl+Shift+{key}",
    "shortcut.tooltip": "{label} ({shortcut})",

    // Regions
    "shell.skipToDocument": "文書へスキップ",
    "shell.regionToolbar": "ツールバー",
    "shell.regionSidePanel": "サイドパネル",
    "shell.regionDocument": "文書",
    "shell.regionSearchComments": "検索とコメント",

    // Toolbar
    "toolbar.label": "文書ツールバー",
    "toolbar.menu": "メニュー",
    "toolbar.more": "その他",
    "toolbar.search": "検索",
    "toolbar.comments": "コメント",
    "toolbar.print": "印刷",
    "toolbar.download": "ダウンロード",
    "toolbar.darkMode": "ダークモード",
    "toolbar.systemTheme": "システムテーマ",
    "toolbar.lightMode": "ライトモード",
    "toolbar.fullscreen": "全画面表示",
    "toolbar.exitFullscreen": "全画面表示を終了",
    "toolbar.developer": "開発",

    // The people button: the collaboration the document is in
    "collaboration.label": "共同編集",
    "collaboration.paused": "共同編集を一時停止中",
    "collaboration.reconnecting": "再接続しています…",
    "collaboration.you": "{name}（自分）",
    "collaboration.sharePointer": "自分のポインターを共有",
    "collaboration.pause": "共同編集を一時停止",
    "collaboration.resume": "共同編集を再開",

    // Pointer tools
    "pointerTool.select": "選択",
    "pointerTool.pan": "手のひら",
    "pointerTool.zoom": "ズーム",
    "pointerTool.options": "ポインターツールのオプション",
    "pointerTool.menu": "ポインターツール",
    "pointerTool.tooltip": "ツール: {tool}",
    "pointerTool.label": "ポインターツール: {tool}",

    // Ribbon tabs
    "ribbon.annotate": "注釈",

    // Ribbon
    "ribbon.label": "ツールオプション",
    "ribbon.tabs": "ツールタブ",
    "ribbon.more": "その他のツール",
    "ribbon.moreTabs": "その他のタブ",
    "ribbon.paintOptions": "{label}のオプション",

    // Ribbon commands, by command id
    "command.undo": "元に戻す",
    "command.redo": "やり直し",
    "command.annotateHighlight": "ハイライト",
    "command.annotateUnderline": "下線",
    "command.annotateStrikeOut": "取り消し線",
    "command.annotateSquiggly": "波線",
    "command.annotateNote": "ノート注釈",
    "command.annotateTextBox": "テキストボックス",
    "command.annotateStamp": "スタンプ",
    "command.annotatePen": "ペン",
    "command.annotateShape": "図形",
    "command.annotationColor": "色",
    "command.annotationFill": "塗りつぶし",
    "command.annotationOpacity": "不透明度",

    // Shape pickers
    "shape.rectangle": "長方形",
    "shape.ellipse": "楕円",
    "shape.line": "直線",
    "shape.arrow": "矢印",
    "shape.polygon": "多角形",
    "shape.polyline": "折れ線",
    "shape.cloud": "雲形",

    // Standard stamps
    "stamp.approved": "承認済み",
    "stamp.experimental": "試験版",
    "stamp.notApproved": "未承認",
    "stamp.asIs": "現状のまま",
    "stamp.expired": "期限切れ",
    "stamp.notForPublicRelease": "非公開",
    "stamp.confidential": "機密",
    "stamp.final": "最終版",
    "stamp.sold": "販売済み",
    "stamp.departmental": "部門内",
    "stamp.forComment": "コメント用",
    "stamp.topSecret": "極秘",
    "stamp.draft": "下書き",
    "stamp.forPublicRelease": "公開用",

    // Color and line panel
    "paint.noFill": "塗りつぶしなし",
    "paint.noLine": "枠線なし",
    "paint.noColor": "色なし",
    "paint.moreFillOptions": "その他の塗りつぶしオプション…",
    "paint.moreLineOptions": "その他の枠線オプション…",
    "paint.moreColorOptions": "その他の色オプション…",
    "paint.themeColors": "テーマの色",
    "paint.standardColors": "標準の色",
    "paint.recentColors": "最近使用した色",
    "paint.text1": "テキスト 1",
    "paint.background1": "背景 1",
    "paint.text2": "テキスト 2",
    "paint.background2": "背景 2",
    "paint.accent1": "アクセント 1",
    "paint.accent2": "アクセント 2",
    "paint.accent3": "アクセント 3",
    "paint.accent4": "アクセント 4",
    "paint.accent5": "アクセント 5",
    "paint.accent6": "アクセント 6",
    "paint.lighter": "白 + 基本色 {percent}%",
    "paint.darker": "黒 + 基本色 {percent}%",
    "paint.themeVariant": "{color}、{variant}",
    "paint.weight": "太さ",
    "paint.dashes": "実線/点線",
    "paint.solid": "実線",
    "paint.dashed": "破線",
    "paint.dotted": "点線",
    "paint.dashDot": "一点鎖線",
    "paint.start": "始点",
    "paint.end": "終点",

    // Standard colors
    "color.darkRed": "濃い赤",
    "color.red": "赤",
    "color.orange": "オレンジ",
    "color.yellow": "黄",
    "color.lightGreen": "薄い緑",
    "color.green": "緑",
    "color.lightBlue": "薄い青",
    "color.blue": "青",
    "color.darkBlue": "濃い青",
    "color.purple": "紫",

    // Line endings
    "lineEnding.none": "なし",
    "lineEnding.openArrow": "開いた矢印",
    "lineEnding.closedArrow": "閉じた矢印",
    "lineEnding.circle": "円",
    "lineEnding.square": "四角形",
    "lineEnding.diamond": "ひし形",

    // Page navigation
    "viewControls.pageNavigation": "ページナビゲーションとズーム",
    "viewControls.slideNavigation": "スライドナビゲーションとズーム",
    "viewControls.previousPage": "前のページ",
    "viewControls.nextPage": "次のページ",
    "viewControls.pageNumber": "ページ番号",
    "viewControls.previousSlide": "前のスライド",
    "viewControls.nextSlide": "次のスライド",
    "viewControls.slideNumber": "スライド番号",

    // Zoom
    "zoom.label": "ズーム",
    "zoom.zoomIn": "拡大",
    "zoom.zoomOut": "縮小",
    "zoom.level": "ズームレベル",
    "zoom.options": "ズームオプション",
    "zoom.levels": "ズームレベル一覧",
    "zoom.fitWidth": "幅に合わせる",
    "zoom.fitHeight": "高さに合わせる",
    "zoom.fitPage": "ページに合わせる",
    "zoom.fitSlide": "スライドに合わせる",

    // View settings
    "viewMode.label": "表示設定",
    "viewMode.scroll": "スクロール",
    "viewMode.spread": "見開き単位",
    "viewMode.continuous": "連続",
    "viewMode.layout": "レイアウト",
    "viewMode.single": "単一ページ",
    "viewMode.double": "見開きページ",
    "viewMode.coverRight": "表紙を右に表示",
    "viewMode.coverLeft": "表紙を左に表示",
    "viewMode.rotation": "回転",
    "viewMode.degrees": "{degrees}°",
    "viewMode.pageGap": "ページ間隔",
    "viewMode.on": "オン",
    "viewMode.off": "オフ",

    // Status bar
    "statusBar.label": "ステータスバー",

    // Sheets
    "sheet.tabs": "シート",
    "sheet.all": "すべてのシート",
    "sheet.scrollLeft": "タブを左にスクロール",
    "sheet.scrollRight": "タブを右にスクロール",
    "sheet.unnamed": "Sheet{sheet}",

    // Left panel
    "leftPanel.tabs": "パネルタブ",
    "leftPanel.thumbnails": "サムネイル",
    "leftPanel.outline": "アウトライン",
    "leftPanel.layers": "レイヤー",
    "leftPanel.attachments": "添付ファイル",
    "leftPanel.resizeHandle": "サイドパネルのサイズ変更",
    "leftPanel.placeholder": "{panel} — まだ何もありません",

    // Thumbnails
    "thumbnails.pages": "ページサムネイル",
    "thumbnails.slides": "スライドサムネイル",
    "thumbnails.page": "{page}ページ",
    "thumbnails.slide": "スライド {page}",
    "thumbnails.insertPage": "ページを挿入",
    "thumbnails.duplicatePage": "ページを複製",
    "thumbnails.rotateRight": "右へ回転",
    "thumbnails.rotateLeft": "左へ回転",
    "thumbnails.deletePage": "ページを削除",
    "thumbnails.newSlide": "新しいスライド",
    "thumbnails.duplicateSlide": "スライドの複製",
    "thumbnails.deleteSlide": "スライドの削除",

    // Outline panel
    "outline.loading": "アウトラインを読み込み中…",
    "outline.readFailed": "アウトラインを読み取れませんでした",
    "outline.empty": "この文書にアウトラインはありません",

    // Layers panel
    "layers.loading": "レイヤーを読み込み中…",
    "layers.readFailed": "レイヤーを読み取れませんでした",
    "layers.empty": "この文書にレイヤーはありません",
    "layers.locked": "ロック済み",
    "layers.hide": "レイヤーを非表示",
    "layers.show": "レイヤーを表示",

    // Right panel
    "rightPanel.search": "検索",
    "rightPanel.comments": "コメント",
    "rightPanel.resizeHandle": "パネルのサイズ変更",
    "rightPanel.close": "パネルを閉じる",

    // Search panel
    "search.placeholder": "文書内を検索",
    "search.label": "検索テキスト",
    "search.clear": "検索をクリア",
    "search.matchCase": "大文字と小文字を区別する",
    "search.fuzzyMatch": "あいまい検索",
    "search.previousMatch": "前の検索結果",
    "search.previousMatchTooltip": "前の検索結果 (Shift+Enter)",
    "search.nextMatch": "次の検索結果",
    "search.nextMatchTooltip": "次の検索結果 (Enter)",
    "search.results": "検索結果",
    "search.status": "{current}/{total}",
    "search.statusRunning": "{current}/{total}+",
    "search.searching": "検索中…",
    "search.noResults": "結果なし",
    "search.page": "{page}ページ",
    "search.slide": "スライド {page}",

    // Comments panel
    "comments.page": "{page}ページ",
    "comments.empty": "この文書にコメントはありません",
    "comments.loading": "コメントを読み込み中…",

    // A comment thread
    "comment.label": "コメント",
    "comment.placeholder": "コメントを追加",
    "comment.reply": "返信",
    "comment.edit": "編集",
    "comment.cancelEditing": "編集をキャンセル",
    "comment.save": "コメントを保存",
    "comment.replyField": "返信",
    "comment.cancelReply": "返信をキャンセル",
    "comment.saveReply": "返信を保存",
    "comment.replies.other": "{count}件の返信",
    "comment.locked": "ロック済み: 削除や移動はできません",
    "comment.lockedContents": "ロック済み: テキストは編集できません",
    "comment.lockedBoth": "ロック済み: 削除、移動、編集はできません",

    // An annotation's kind, as a comment names it
    "annotationKind.note": "ノート注釈",
    "annotationKind.textBox": "テキストボックス",
    "annotationKind.line": "直線",
    "annotationKind.rectangle": "長方形",
    "annotationKind.ellipse": "楕円",
    "annotationKind.polygon": "多角形",
    "annotationKind.polyline": "折れ線",
    "annotationKind.highlight": "ハイライト",
    "annotationKind.underline": "下線",
    "annotationKind.squiggly": "波線",
    "annotationKind.strikethrough": "取り消し線",
    "annotationKind.stamp": "スタンプ",
    "annotationKind.pen": "ペン",
    "annotationKind.attachment": "添付ファイル",
    "annotationKind.caret": "キャレット",
    "annotationKind.sound": "サウンド",
    "annotationKind.redaction": "墨消し",

    // Annotation bar
    "annotationBar.label": "注釈",

    // Print dialog
    "print.title": "印刷",
    "print.print": "印刷",
    "print.pages": "ページ",
    "print.slides": "スライド",
    "print.allPages": "すべてのページ",
    "print.allSlides": "すべてのスライド",
    "print.currentPage": "現在のページ ({page})",
    "print.currentSlide": "現在のスライド ({page})",
    "print.to": "〜",
    "print.firstPage": "開始ページ",
    "print.firstSlide": "開始スライド",
    "print.lastPage": "終了ページ",
    "print.lastSlide": "終了スライド",
    "print.custom": "ユーザー設定",
    "print.customPlaceholder": "例: 1,3,5-8",
    "print.customPages": "ページ指定",
    "print.customSlides": "スライド指定",
    "print.quality": "品質",
    "print.qualityDraft": "下書き (150 DPI)",
    "print.qualityStandard": "標準 (300 DPI)",
    "print.qualityHigh": "高品質 (600 DPI)",
    "print.pagesFromToInvalid": "1から{count}までのページ番号を入力してください。",
    "print.slidesFromToInvalid": "1から{count}までのスライド番号を入力してください。",
    "print.pagesFromAfterTo": "開始ページを終了ページより後にすることはできません。",
    "print.slidesFromAfterTo": "開始スライドを終了スライドより後にすることはできません。",
    "print.pagesCustomInvalid": "1から{count}までのページ番号または範囲を、1,3,5-8 のように入力してください。",
    "print.slidesCustomInvalid": "1から{count}までのスライド番号または範囲を、1,3,5-8 のように入力してください。",

    // Password dialog
    "password.title": "パスワードが必要です",
    "password.message": "この文書は保護されています。パスワードを入力して開いてください。",
    "password.placeholder": "パスワードを入力",
    "password.label": "パスワード",
    "password.show": "パスワードを表示",
    "password.hide": "パスワードを非表示",
    "password.unlock": "ロック解除",
    "password.incorrect": "パスワードが正しくありません",

    // Busy hold
    "busy.preparingPrint": "印刷の準備中…",
    "busy.preparingPage": "{count}ページ中{page}ページ目を準備中…",
    "busy.preparingSlide": "{count}枚中{page}枚目のスライドを準備中…",

    // Loading overlay
    "loading.opening": "開いています…",
    "loading.downloading": "ダウンロード中…",
    "loading.progress": "{loaded} / {total} MB",

    // License notice
    "license.invalidLicense": "無効なライセンス",
    "license.permitRefused": "無料使用は利用できません",
    "license.cannotVerify": "無料使用量を確認できません",
    "license.contactOwner": "サイトの所有者にお問い合わせください。",

    // The docMentis decal's link
    "branding.title": "Powered by docMentis",
    "branding.label": "Powered by docMentis — docmentis.com を開きます",

    // The text input that takes typing
    "textInput.label": "文書のテキスト",

    // Context menu
    "contextMenu.label": "文書の操作",
    "contextMenu.copy": "コピー",
};
