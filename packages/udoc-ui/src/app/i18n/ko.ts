import type { Messages } from "./messages.js";

/** Korean. */
export const ko: Messages = {
    // Shared
    "common.cancel": "취소",
    "common.save": "저장",
    "common.close": "닫기",
    "common.delete": "삭제",

    // Numbers
    "format.percent": "{percent}%",
    "format.points": "{points} pt",

    // A key that runs a command, as a tooltip names it off a Mac
    "shortcut.control": "Ctrl+{key}",
    "shortcut.controlShift": "Ctrl+Shift+{key}",
    "shortcut.tooltip": "{label} ({shortcut})",

    // Regions
    "shell.skipToDocument": "문서로 건너뛰기",
    "shell.regionToolbar": "도구 모음",
    "shell.regionSidePanel": "사이드 패널",
    "shell.regionDocument": "문서",
    "shell.regionSearchComments": "검색 및 메모",
    "shell.regionNotes": "슬라이드 노트",

    // Toolbar
    "toolbar.label": "문서 도구 모음",
    "toolbar.menu": "메뉴",
    "toolbar.more": "더 보기",
    "toolbar.search": "검색",
    "toolbar.comments": "메모",
    "toolbar.print": "인쇄",
    "toolbar.download": "다운로드",
    "toolbar.darkMode": "다크 모드",
    "toolbar.systemTheme": "시스템 테마",
    "toolbar.lightMode": "라이트 모드",
    "toolbar.fullscreen": "전체 화면",
    "toolbar.exitFullscreen": "전체 화면 종료",
    "toolbar.developer": "개발 도구",

    // The people button: the collaboration the document is in
    "collaboration.label": "공동 편집",
    "collaboration.paused": "공동 편집 일시 중지됨",
    "collaboration.reconnecting": "다시 연결하는 중…",
    "collaboration.you": "{name}(나)",
    "collaboration.sharePointer": "내 포인터 공유",
    "collaboration.pause": "공동 편집 일시 중지",
    "collaboration.resume": "공동 편집 재개",

    // Pointer tools
    "pointerTool.select": "선택",
    "pointerTool.pan": "화면 이동",
    "pointerTool.zoom": "확대/축소",
    "pointerTool.options": "포인터 도구 옵션",
    "pointerTool.menu": "포인터 도구",
    "pointerTool.tooltip": "도구: {tool}",
    "pointerTool.label": "포인터 도구: {tool}",

    // Ribbon tabs
    "ribbon.annotate": "주석",
    "ribbon.view": "보기",

    // Ribbon
    "ribbon.label": "도구 옵션",
    "ribbon.tabs": "도구 탭",
    "ribbon.more": "도구 더 보기",
    "ribbon.moreTabs": "탭 더 보기",
    "ribbon.paintOptions": "{label} 옵션",

    // Ribbon commands, by command id
    "command.undo": "실행 취소",
    "command.redo": "다시 실행",
    "command.annotateHighlight": "강조 표시",
    "command.annotateUnderline": "밑줄",
    "command.annotateStrikeOut": "취소선",
    "command.annotateSquiggly": "물결선",
    "command.annotateNote": "노트",
    "command.annotateTextBox": "텍스트 상자",
    "command.annotateStamp": "스탬프",
    "command.annotatePen": "펜",
    "command.annotateShape": "도형",
    "command.annotationColor": "색",
    "command.annotationFill": "채우기",
    "command.annotationOpacity": "불투명도",
    "command.notes": "슬라이드 노트",

    // Shape pickers
    "shape.rectangle": "사각형",
    "shape.ellipse": "타원",
    "shape.line": "선",
    "shape.arrow": "화살표",
    "shape.polygon": "다각형",
    "shape.polyline": "꺾은선",
    "shape.cloud": "구름",

    // Standard stamps
    "stamp.approved": "승인됨",
    "stamp.experimental": "실험용",
    "stamp.notApproved": "승인되지 않음",
    "stamp.asIs": "현재 상태",
    "stamp.expired": "만료됨",
    "stamp.notForPublicRelease": "공개용 아님",
    "stamp.confidential": "기밀",
    "stamp.final": "최종",
    "stamp.sold": "판매됨",
    "stamp.departmental": "부서용",
    "stamp.forComment": "검토용",
    "stamp.topSecret": "일급 기밀",
    "stamp.draft": "초안",
    "stamp.forPublicRelease": "공개용",

    // Color and line panel
    "paint.noFill": "채우기 없음",
    "paint.noLine": "윤곽선 없음",
    "paint.noColor": "색 없음",
    "paint.moreFillOptions": "기타 채우기 옵션…",
    "paint.moreLineOptions": "기타 윤곽선 옵션…",
    "paint.moreColorOptions": "기타 색 옵션…",
    "paint.themeColors": "테마 색",
    "paint.standardColors": "표준 색",
    "paint.recentColors": "최근에 사용한 색",
    "paint.text1": "텍스트 1",
    "paint.background1": "배경 1",
    "paint.text2": "텍스트 2",
    "paint.background2": "배경 2",
    "paint.accent1": "강조 1",
    "paint.accent2": "강조 2",
    "paint.accent3": "강조 3",
    "paint.accent4": "강조 4",
    "paint.accent5": "강조 5",
    "paint.accent6": "강조 6",
    "paint.lighter": "{percent}% 더 밝게",
    "paint.darker": "{percent}% 더 어둡게",
    "paint.themeVariant": "{color}, {variant}",
    "paint.weight": "두께",
    "paint.dashes": "대시",
    "paint.solid": "실선",
    "paint.dashed": "파선",
    "paint.dotted": "점선",
    "paint.dashDot": "파선-점선",
    "paint.start": "시작점",
    "paint.end": "끝점",

    // Standard colors
    "color.darkRed": "진한 빨강",
    "color.red": "빨강",
    "color.orange": "주황",
    "color.yellow": "노랑",
    "color.lightGreen": "연한 녹색",
    "color.green": "녹색",
    "color.lightBlue": "연한 파랑",
    "color.blue": "파랑",
    "color.darkBlue": "진한 파랑",
    "color.purple": "자주",

    // Line endings
    "lineEnding.none": "없음",
    "lineEnding.openArrow": "열린 화살표",
    "lineEnding.closedArrow": "닫힌 화살표",
    "lineEnding.circle": "원",
    "lineEnding.square": "사각형",
    "lineEnding.diamond": "다이아몬드",

    // Page navigation
    "viewControls.pageNavigation": "페이지 탐색 및 확대/축소",
    "viewControls.slideNavigation": "슬라이드 탐색 및 확대/축소",
    "viewControls.previousPage": "이전 페이지",
    "viewControls.nextPage": "다음 페이지",
    "viewControls.pageNumber": "페이지 번호",
    "viewControls.previousSlide": "이전 슬라이드",
    "viewControls.nextSlide": "다음 슬라이드",
    "viewControls.slideNumber": "슬라이드 번호",

    // Zoom
    "zoom.label": "확대/축소",
    "zoom.zoomIn": "확대",
    "zoom.zoomOut": "축소",
    "zoom.level": "확대/축소 수준",
    "zoom.options": "확대/축소 옵션",
    "zoom.levels": "확대/축소 수준 목록",
    "zoom.fitWidth": "너비에 맞추기",
    "zoom.fitHeight": "높이에 맞추기",
    "zoom.fitPage": "페이지에 맞추기",
    "zoom.fitSlide": "슬라이드에 맞추기",

    // View settings
    "viewMode.label": "보기 설정",
    "viewMode.scroll": "스크롤",
    "viewMode.spread": "펼침",
    "viewMode.continuous": "연속",
    "viewMode.layout": "레이아웃",
    "viewMode.single": "단일 페이지",
    "viewMode.double": "두 페이지",
    "viewMode.coverRight": "표지 오른쪽",
    "viewMode.coverLeft": "표지 왼쪽",
    "viewMode.rotation": "회전",
    "viewMode.degrees": "{degrees}°",
    "viewMode.pageGap": "페이지 간격",
    "viewMode.on": "켬",
    "viewMode.off": "끔",

    // Status bar
    "statusBar.label": "상태 표시줄",

    // Sheets
    "sheet.tabs": "시트",
    "sheet.all": "모든 시트",
    "sheet.scrollLeft": "탭을 왼쪽으로 스크롤",
    "sheet.scrollRight": "탭을 오른쪽으로 스크롤",
    "sheet.unnamed": "시트 {sheet}",

    // Left panel
    "leftPanel.tabs": "패널 탭",
    "leftPanel.thumbnails": "축소판 그림",
    "leftPanel.outline": "개요",
    "leftPanel.layers": "레이어",
    "leftPanel.attachments": "첨부 파일",
    "leftPanel.resizeHandle": "사이드 패널 크기 조정",
    "leftPanel.placeholder": "{panel} — 아직 내용이 없습니다",

    // Notes pane
    "notes.resizeHandle": "슬라이드 노트 크기 조정",

    // Thumbnails
    "thumbnails.pages": "페이지 축소판 그림",
    "thumbnails.slides": "슬라이드 축소판 그림",
    "thumbnails.page": "{page}페이지",
    "thumbnails.slide": "슬라이드 {page}",
    "thumbnails.hiddenSlide": "슬라이드 {page}, 숨김",
    "thumbnails.insertPage": "페이지 삽입",
    "thumbnails.duplicatePage": "페이지 복제",
    "thumbnails.rotateRight": "오른쪽으로 회전",
    "thumbnails.rotateLeft": "왼쪽으로 회전",
    "thumbnails.deletePage": "페이지 삭제",
    "thumbnails.newSlide": "새 슬라이드",
    "thumbnails.duplicateSlide": "슬라이드 복제",
    "thumbnails.hideSlide": "슬라이드 숨기기",
    "thumbnails.deleteSlide": "슬라이드 삭제",
    "thumbnails.section": "구역 {name}",
    "thumbnails.collapseSection": "구역 축소",
    "thumbnails.expandSection": "구역 확장",
    "thumbnails.sectionName": "구역 이름",
    "thumbnails.addSection": "구역 추가",
    "thumbnails.untitledSection": "제목 없는 구역",
    "thumbnails.renameSection": "구역 이름 바꾸기",
    "thumbnails.moveSectionUp": "구역을 위로 이동",
    "thumbnails.moveSectionDown": "구역을 아래로 이동",
    "thumbnails.collapseAll": "모두 축소",
    "thumbnails.expandAll": "모두 확장",
    "thumbnails.removeSection": "구역 제거",
    "thumbnails.removeSectionAndSlides": "구역 및 슬라이드 제거",
    "thumbnails.removeAllSections": "모든 구역 제거",

    // Outline panel
    "outline.loading": "개요를 불러오는 중…",
    "outline.readFailed": "개요를 읽을 수 없습니다",
    "outline.empty": "이 문서에 개요가 없습니다",

    // Layers panel
    "layers.loading": "레이어를 불러오는 중…",
    "layers.readFailed": "레이어를 읽을 수 없습니다",
    "layers.empty": "이 문서에 레이어가 없습니다",
    "layers.locked": "잠김",
    "layers.hide": "레이어 숨기기",
    "layers.show": "레이어 표시",

    // Right panel
    "rightPanel.search": "검색",
    "rightPanel.comments": "메모",
    "rightPanel.resizeHandle": "패널 크기 조정",
    "rightPanel.close": "패널 닫기",

    // Search panel
    "search.placeholder": "문서에서 검색",
    "search.label": "검색 텍스트",
    "search.clear": "검색 지우기",
    "search.matchCase": "대/소문자 구분",
    "search.fuzzyMatch": "유사 검색",
    "search.previousMatch": "이전 결과",
    "search.previousMatchTooltip": "이전 결과 (Shift+Enter)",
    "search.nextMatch": "다음 결과",
    "search.nextMatchTooltip": "다음 결과 (Enter)",
    "search.results": "검색 결과",
    "search.status": "{total}개 중 {current}번째",
    "search.statusRunning": "{total}+개 중 {current}번째",
    "search.searching": "검색 중…",
    "search.noResults": "결과 없음",
    "search.page": "{page}페이지",
    "search.slide": "슬라이드 {page}",

    // Comments panel
    "comments.page": "{page}페이지",
    "comments.empty": "이 문서에 메모가 없습니다",
    "comments.loading": "메모를 불러오는 중…",

    // A comment thread
    "comment.label": "메모",
    "comment.placeholder": "메모 추가",
    "comment.reply": "회신",
    "comment.edit": "편집",
    "comment.cancelEditing": "편집 취소",
    "comment.save": "메모 저장",
    "comment.replyField": "회신",
    "comment.cancelReply": "회신 취소",
    "comment.saveReply": "회신 저장",
    "comment.replies.other": "회신 {count}개",
    "comment.locked": "잠김: 삭제하거나 이동할 수 없음",
    "comment.lockedContents": "잠김: 텍스트를 편집할 수 없음",
    "comment.lockedBoth": "잠김: 삭제, 이동 또는 편집할 수 없음",

    // An annotation's kind, as a comment names it
    "annotationKind.note": "노트",
    "annotationKind.textBox": "텍스트 상자",
    "annotationKind.line": "선",
    "annotationKind.rectangle": "사각형",
    "annotationKind.ellipse": "타원",
    "annotationKind.polygon": "다각형",
    "annotationKind.polyline": "꺾은선",
    "annotationKind.highlight": "강조 표시",
    "annotationKind.underline": "밑줄",
    "annotationKind.squiggly": "물결선",
    "annotationKind.strikethrough": "취소선",
    "annotationKind.stamp": "스탬프",
    "annotationKind.pen": "펜",
    "annotationKind.attachment": "첨부 파일",
    "annotationKind.caret": "텍스트 삽입",
    "annotationKind.sound": "사운드",
    "annotationKind.redaction": "교정",

    // Annotation bar
    "annotationBar.label": "주석",

    // Print dialog
    "print.title": "인쇄",
    "print.print": "인쇄",
    "print.pages": "페이지",
    "print.slides": "슬라이드",
    "print.allPages": "모든 페이지",
    "print.allSlides": "모든 슬라이드",
    "print.currentPage": "현재 페이지 ({page})",
    "print.currentSlide": "현재 슬라이드 ({page})",
    "print.to": "~",
    "print.firstPage": "시작 페이지",
    "print.firstSlide": "시작 슬라이드",
    "print.lastPage": "끝 페이지",
    "print.lastSlide": "끝 슬라이드",
    "print.custom": "사용자 지정",
    "print.customPlaceholder": "예: 1,3,5-8",
    "print.customPages": "사용자 지정 페이지",
    "print.customSlides": "사용자 지정 슬라이드",
    "print.quality": "품질",
    "print.qualityDraft": "초안 (150 DPI)",
    "print.qualityStandard": "표준 (300 DPI)",
    "print.qualityHigh": "고품질 (600 DPI)",
    "print.pagesFromToInvalid": "1에서 {count} 사이의 페이지를 입력하세요.",
    "print.slidesFromToInvalid": "1에서 {count} 사이의 슬라이드를 입력하세요.",
    "print.pagesFromAfterTo": "시작 페이지는 끝 페이지보다 뒤에 올 수 없습니다.",
    "print.slidesFromAfterTo": "시작 슬라이드는 끝 슬라이드보다 뒤에 올 수 없습니다.",
    "print.pagesCustomInvalid": "1에서 {count} 사이의 페이지와 범위를 1,3,5-8과 같이 입력하세요.",
    "print.slidesCustomInvalid": "1에서 {count} 사이의 슬라이드와 범위를 1,3,5-8과 같이 입력하세요.",

    // Password dialog
    "password.title": "암호 필요",
    "password.message": "이 문서는 보호되어 있습니다. 문서를 열려면 암호를 입력하세요.",
    "password.placeholder": "암호 입력",
    "password.label": "암호",
    "password.show": "암호 표시",
    "password.hide": "암호 숨기기",
    "password.unlock": "잠금 해제",
    "password.incorrect": "암호가 올바르지 않습니다",

    // Busy hold
    "busy.preparingPrint": "인쇄 준비 중…",
    "busy.preparingPage": "{count}페이지 중 {page}페이지 준비 중…",
    "busy.preparingSlide": "슬라이드 {count}개 중 {page}번째 준비 중…",

    // Loading overlay
    "loading.opening": "여는 중…",
    "loading.downloading": "다운로드 중…",
    "loading.progress": "{loaded} / {total} MB",

    // License notice
    "license.invalidLicense": "유효하지 않은 라이선스",
    "license.permitRefused": "무료 사용 불가",
    "license.cannotVerify": "무료 사용을 확인할 수 없음",
    "license.contactOwner": "사이트 소유자에게 문의하세요.",

    // The docMentis decal's link
    "branding.title": "docMentis 제공",
    "branding.label": "docMentis 제공 — docmentis.com 열기",

    // The text input that takes typing
    "textInput.label": "문서 텍스트",

    // Context menu
    "contextMenu.label": "문서 작업",
    "contextMenu.copy": "복사",
};
