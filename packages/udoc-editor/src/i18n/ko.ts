import type { EditMessages } from "./messages.js";

/** Korean. */
export const ko: EditMessages = {
    // Modes
    "mode.view": "보기",
    "mode.edit": "편집",

    // Mode switcher
    "modeSwitch.label": "편집기 모드",

    // Page controls
    "pageControls.label": "{page}페이지 컨트롤",
    "pageControls.moveUp": "페이지 위로 이동",
    "pageControls.moveUpLabel": "{page}페이지 위로 이동",
    "pageControls.moveDown": "페이지 아래로 이동",
    "pageControls.moveDownLabel": "{page}페이지 아래로 이동",
    "pageControls.rotate": "페이지 오른쪽으로 회전",
    "pageControls.rotateLabel": "{page}페이지 오른쪽으로 회전",
    "pageControls.settings": "페이지 설정",
    "pageControls.settingsLabel": "{page}페이지 설정",
    "pageControls.delete": "페이지 삭제",
    "pageControls.deleteLabel": "{page}페이지 삭제",
    "pageControls.insert": "여기에 페이지 삽입",
    "pageControls.insertAtEnd": "맨 끝에 페이지 삽입",
    "pageControls.insertBefore": "{page}페이지 앞에 페이지 삽입",

    // Page settings dialog
    "pageSettings.title": "{page}페이지",
    "pageSettings.label": "{page}페이지 설정",
    "pageSettings.pageSize": "페이지 크기",
    "pageSettings.preset": "페이지 크기 사전 설정",
    "pageSettings.width": "너비",
    "pageSettings.height": "높이",
    "pageSettings.pageWidth": "페이지 너비",
    "pageSettings.pageHeight": "페이지 높이",
    "pageSettings.units": "단위",
    "pageSettings.inches": "in",
    "pageSettings.millimeters": "mm",
    "pageSettings.points": "pt",
    "pageSettings.portrait": "세로",
    "pageSettings.landscape": "가로",
    "pageSettings.rotation": "회전",
    "pageSettings.rotateLeft": "왼쪽으로 회전",
    "pageSettings.rotatePageLeft": "페이지 왼쪽으로 회전",
    "pageSettings.rotateRight": "오른쪽으로 회전",
    "pageSettings.rotatePageRight": "페이지 오른쪽으로 회전",
    "pageSettings.applySize": "크기 적용",

    // Page sizes
    "pageSize.letter": "레터",
    "pageSize.legal": "리갈",
    "pageSize.tabloid": "타블로이드",
    "pageSize.a3": "A3",
    "pageSize.a4": "A4",
    "pageSize.a5": "A5",
    "pageSize.custom": "사용자 지정",

    // Ribbon tabs
    "ribbon.home": "홈",
    "ribbon.insert": "삽입",
    "ribbon.text": "텍스트",
    "ribbon.shape": "도형",
    "ribbon.object": "개체",

    // Commands
    "command.ruler": "눈금자",
    "command.createSlide": "새 슬라이드",
    "command.insertImage": "그림",
    "command.insertShape": "도형",
    "command.cropPage": "자르기",
    "command.resizePage": "이미지 크기",
    "command.fontFamily": "글꼴",
    "command.fontSize": "크기",
    "command.bold": "굵게",
    "command.italic": "기울임꼴",
    "command.underline": "밑줄",
    "command.strikethrough": "취소선",
    "command.superscript": "위 첨자",
    "command.subscript": "아래 첨자",
    "command.widthScale": "장평",
    "command.textFill": "글꼴 색",
    "command.textHighlight": "텍스트 강조 색",
    "command.paragraphAlign": "맞춤 및 들여쓰기",
    "command.lineSpacing": "줄 및 단락 간격",
    "command.bulletList": "글머리 기호",
    "command.numberList": "번호 매기기",
    "command.shapeFillColor": "채우기",
    "command.shapeStrokeColor": "윤곽선",
    "command.shapeArrange": "정렬",
    "command.objectFillColor": "채우기",
    "command.objectStrokeColor": "윤곽선",
    "command.objectArrange": "정렬",

    // New Slide dialog
    "newSlide.label": "새 슬라이드 레이아웃",
    "newSlide.layouts": "슬라이드 레이아웃",
    "newSlide.layout": "레이아웃 {index}",

    // Shared
    "common.done": "완료",

    // Ribbon
    "ribbon.noMatchingFonts": "일치하는 글꼴 없음",
    "ribbon.listOptions": "{label} 옵션",
    "ribbon.listStyles": "{label} 스타일",

    // Align & Indent, Line & Paragraph Spacing
    "paragraph.alignLeft": "왼쪽 맞춤",
    "paragraph.center": "가운데 맞춤",
    "paragraph.alignRight": "오른쪽 맞춤",
    "paragraph.justify": "양쪽 맞춤",
    "paragraph.increaseIndent": "들여쓰기",
    "paragraph.decreaseIndent": "내어쓰기",
    "paragraph.lineSpacingSingle": "1줄",
    "paragraph.lineSpacingDouble": "2줄",
    "paragraph.lineSpacingLines": "{lines}줄",
    "paragraph.spaceBefore": "단락 앞 간격",
    "paragraph.spaceAfter": "단락 뒤 간격",

    // Bullet and numbering galleries, by style id
    "list.disc": "채워진 둥근 글머리 기호",
    "list.circle": "속이 빈 둥근 글머리 기호",
    "list.square": "채워진 사각형 글머리 기호",
    "list.diamond": "다이아몬드 글머리 기호",
    "list.arrow": "화살표 글머리 기호",
    "list.dash": "대시 글머리 기호",
    "list.decimal": "마침표가 붙은 숫자",
    "list.decimalParen": "괄호가 붙은 숫자",
    "list.lowerLetter": "영문 소문자",
    "list.upperLetter": "영문 대문자",
    "list.lowerRoman": "로마 숫자 소문자",
    "list.upperRoman": "로마 숫자 대문자",

    // Arrange
    "arrange.bringToFront": "맨 앞으로 가져오기",
    "arrange.bringForward": "앞으로 가져오기",
    "arrange.sendBackward": "뒤로 보내기",
    "arrange.sendToBack": "맨 뒤로 보내기",
    "arrange.alignLeft": "왼쪽 맞춤",
    "arrange.alignCenter": "가운데 맞춤",
    "arrange.alignRight": "오른쪽 맞춤",
    "arrange.alignTop": "위쪽 맞춤",
    "arrange.alignMiddle": "중간 맞춤",
    "arrange.alignBottom": "아래쪽 맞춤",
    "arrange.distributeHorizontally": "가로 간격을 동일하게",
    "arrange.distributeVertically": "세로 간격을 동일하게",
    "arrange.alignToPage": "페이지에 맞춤",
    "arrange.rotateRight": "오른쪽으로 90도 회전",
    "arrange.rotateLeft": "왼쪽으로 90도 회전",
    "arrange.flipHorizontal": "좌우 대칭",
    "arrange.flipVertical": "상하 대칭",
    "arrange.order": "순서",
    "arrange.align": "맞춤",
    "arrange.rotate": "회전",
    "arrange.group": "그룹",
    "arrange.ungroup": "그룹 해제",

    // Fill / Line options dialog
    "paintOptions.fillTitle": "채우기 옵션",
    "paintOptions.lineTitle": "윤곽선 옵션",
    "paintOptions.textColorTitle": "글꼴 색 옵션",
    "paintOptions.highlightTitle": "텍스트 강조 색 옵션",
    "paintOptions.fillBlurb": "사용자 지정 색과 그라데이션, 패턴, 그림 채우기가 여기에 추가될 예정입니다.",
    "paintOptions.lineBlurb": "사용자 지정 색, 겹선, 끝 모양과 연결 유형, 화살표가 여기에 추가될 예정입니다.",
    "paintOptions.textColorBlurb": "사용자 지정 색과 추가 글꼴 색 옵션이 여기에 추가될 예정입니다.",
    "paintOptions.highlightBlurb": "사용자 지정 색과 추가 강조 색 옵션이 여기에 추가될 예정입니다.",

    // Busy hold
    "busy.loadingFont": "{font} 글꼴을 불러오는 중…",

    // Context menu
    "contextMenu.cut": "잘라내기",
    "contextMenu.paste": "붙여넣기",
    "contextMenu.delete": "삭제",

    // Context menu over a table
    "table.selectRow": "행",
    "table.selectColumn": "열",
    "table.selectTable": "표",
    "table.rowAbove": "위에 행",
    "table.rowBelow": "아래에 행",
    "table.columnLeft": "왼쪽에 열",
    "table.columnRight": "오른쪽에 열",
    "table.deleteRows": "행",
    "table.deleteColumns": "열",
    "table.select": "선택",
    "table.insert": "삽입",
    "table.delete": "삭제",
    "table.mergeCells": "셀 병합",
    "table.unmergeCells": "셀 병합 취소",

    // Crop mode and the Image Size dialog
    "image.aspectRatio": "가로 세로 비율",
    "image.free": "자유",
    "image.original": "원본",
    "image.square": "정사각형",
    "image.ratio": "{ratio}",
    "image.cropSize": "{width} × {height}px",
    "image.reset": "재설정",
    "image.apply": "적용",
    "image.keepRatio": "가로 세로 비율 고정",
    "image.originalSize": "원본 크기: {width} × {height}px",
    "image.pixels": "px",

    // Toolbar
    "toolbar.label": "편집기 도구 모음",
};
