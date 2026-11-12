"""Write Larchmere's files: `python3 main.py <logo.png> <out> <staged>`.

The decks, the questionnaire and the workbook go to `out` as they are; the
fact sheets and the commentary go to `staged` as Word documents, which
generate.mjs has Word save as PDF. Run generate.mjs rather than this: it
makes the logo's PNG first, and the PDFs after.
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import brand

# The files' own dates: when the quarter's material was published, so that
# making them again changes nothing but what changed.
PUBLISHED = datetime(2026, 10, 9, 9, 0, 0)


def _dated(path: Path) -> None:
    if path.suffix == ".pptx":
        from pptx import Presentation as Open
    elif path.suffix == ".docx":
        from docx import Document as Open
    else:
        return
    document = Open(str(path))
    props = document.core_properties
    props.created = props.modified = PUBLISHED
    props.last_modified_by = "Larchmere Investment Management"
    props.revision = 1
    document.save(str(path))


def main() -> None:
    logo, out, staged = (Path(arg) for arg in sys.argv[1:4])
    brand.LOGO_PNG = logo.read_bytes()

    import decks
    import documents
    import figures
    import workbook

    out.mkdir(parents=True, exist_ok=True)
    staged.mkdir(parents=True, exist_ok=True)
    written = [
        (decks.pitch_book, out / "global-equity-pitch-book.pptx", {}),
        (decks.firm_overview, out / "firm-overview.pptx", {}),
        (documents.ddq, out / "global-equity-ddq.docx", {}),
        (workbook.workbook, out / "performance-and-fees-q3-2026.xlsx", {}),
        (documents.fact_sheet, staged / "global-equity-fact-sheet.docx", {"s": figures.GLOBAL_EQUITY}),
        (documents.fact_sheet, staged / "core-plus-fixed-income-fact-sheet.docx", {"s": figures.CORE_PLUS}),
        # The draft compliance returns: see the seed.
        (documents.fact_sheet, staged / "global-infrastructure-fact-sheet.docx", {"s": figures.INFRASTRUCTURE, "draft_flaws": True}),
        (documents.commentary, staged / "market-commentary-q3-2026.docx", {}),
    ]
    for write, path, options in written:
        write(str(path), **options)
        _dated(path)
        print(f"  {path.name}")


if __name__ == "__main__":
    main()
