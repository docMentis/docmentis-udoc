"""Larchmere's Word documents: the fact sheets and the quarter's commentary,
which the generator then has Word save as PDF, and the Global Equity due
diligence questionnaire, kept as Word."""

from __future__ import annotations

import re

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.opc.packuri import PackURI
from docx.opc.part import Part
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

import brand as b
import figures as f

CHART_TYPE = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"
XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def rgb(hex_color: str) -> RGBColor:
    return RGBColor.from_string(hex_color)


# ── The document ──────────────────────────────────────────────────────────────


def _theme(doc) -> None:
    part = doc.part.part_related_by(RT.THEME)
    xml = part.blob.decode("utf-8")
    colors = {
        "dk1": b.INK, "lt1": b.WHITE, "dk2": b.FOREST, "lt2": b.MINT,
        "accent1": b.FOREST, "accent2": b.GREEN, "accent3": b.SAGE, "accent4": b.AMBER,
        "accent5": b.SLATE, "accent6": b.GRAY, "hlink": b.FOREST, "folHlink": b.SLATE,
    }
    scheme = "".join(f'<a:{k}><a:srgbClr val="{v}"/></a:{k}>' for k, v in colors.items())
    xml = re.sub(r'<a:clrScheme name="[^"]*">.*?</a:clrScheme>', f'<a:clrScheme name="Larchmere">{scheme}</a:clrScheme>', xml, flags=re.S)
    part._blob = xml.encode("utf-8")


def new_document(title: str, subject: str, *, margins=0.65, body_size=10):
    doc = Document()
    _theme(doc)
    # Word 2013's layout, not the template's Word 2010: a table's edge, not its
    # text, lines up with the margin, as everything else on the page does.
    for setting in doc.settings.element.iter(qn("w:compatSetting")):
        if setting.get(qn("w:name")) == "compatibilityMode":
            setting.set(qn("w:val"), "15")
    section = doc.sections[0]
    section.page_width, section.page_height = Inches(8.5), Inches(11)
    section.left_margin = section.right_margin = Inches(margins)
    section.top_margin = Inches(0.95)
    section.bottom_margin = Inches(0.8)
    section.header_distance = Inches(0.4)
    section.footer_distance = Inches(0.35)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = b.BODY_FONT
    normal.font.size = Pt(body_size)
    normal.font.color.rgb = rgb(b.INK)
    normal.paragraph_format.space_after = Pt(4)
    normal.paragraph_format.line_spacing = 1.08
    for name, size, before, after in (("Title", 26, 0, 2), ("Heading 1", 15, 12, 4), ("Heading 2", 12, 10, 3), ("Heading 3", 10.5, 8, 2)):
        style = styles[name]
        style.font.name = b.HEAD_FONT
        style.font.size = Pt(size)
        style.font.bold = name == "Heading 3"
        style.font.italic = False
        style.font.color.rgb = rgb(b.FOREST)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        if name == "Title":
            # The template's title has a rule under it; Larchmere's doesn't.
            pPr = style.element.find(qn("w:pPr"))
            if pPr is not None:
                for border in pPr.findall(qn("w:pBdr")):
                    pPr.remove(border)
    props = doc.core_properties
    props.title, props.subject, props.author = title, subject, f.FIRM["name"]
    props.keywords = "fictional; docMentis demonstration"
    return doc


def header_footer(doc, right: str, footer: str) -> None:
    section = doc.sections[0]
    grid = section.header.add_table(1, 2, Inches(7.2))
    _no_borders(grid)
    _widths(grid, [3.6, 3.6])
    left = grid.cell(0, 0).paragraphs[0]
    left.add_run().add_picture(b.logo_stream(), height=Inches(0.36))
    run = left.add_run("  Larchmere")
    run.font.name = b.HEAD_FONT
    run.font.size = Pt(14)
    run.font.color.rgb = rgb(b.FOREST)
    _valign(grid.cell(0, 0))
    p = grid.cell(0, 1).paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = p.add_run(right)
    run.font.size = Pt(9)
    run.font.color.rgb = rgb(b.SLATE)
    _valign(grid.cell(0, 1))
    # The template's empty first paragraph would sit under the table.
    first = section.header.paragraphs[0]
    if not first.text:
        first._element.getparent().remove(first._element)
    p = section.footer.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(footer + "  ·  Page ")
    run.font.size = Pt(8)
    run.font.color.rgb = rgb(b.SLATE)
    _field(p, "PAGE", size=8)


def _field(paragraph, instruction: str, size: float) -> None:
    """A field Word works out, such as PAGE, each of its parts in the footer's
    size and color: Word draws a simple field's result in the paragraph's."""

    def run(child: str, text: str | None = None, **attrs) -> None:
        r = OxmlElement("w:r")
        rPr = OxmlElement("w:rPr")
        color = OxmlElement("w:color")
        color.set(qn("w:val"), b.SLATE)
        sz = OxmlElement("w:sz")
        sz.set(qn("w:val"), str(int(size * 2)))
        rPr.append(color)
        rPr.append(sz)
        r.append(rPr)
        element = OxmlElement(child)
        for key, value in attrs.items():
            element.set(qn(f"w:{key}"), value)
        if text is not None:
            element.text = text
            element.set(qn("xml:space"), "preserve")
        r.append(element)
        paragraph._p.append(r)

    run("w:fldChar", fldCharType="begin")
    run("w:instrText", f" {instruction} ")
    run("w:fldChar", fldCharType="separate")
    run("w:t", "1")
    run("w:fldChar", fldCharType="end")


def para(container, content="", *, size=None, color=None, bold=False, italic=False, align=None, after=None, before=None, style=None, head=False):
    """A paragraph at the end of `container` (a document or a cell); `content` a
    string or a list of (text, {bold, color, size, italic}) runs."""
    p = container.add_paragraph(style=style) if style else container.add_paragraph()
    if align == "r":
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    elif align == "c":
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if after is not None:
        p.paragraph_format.space_after = Pt(after)
    if before is not None:
        p.paragraph_format.space_before = Pt(before)
    runs = [(content, {})] if isinstance(content, str) else content
    for text, style_ in runs:
        run = p.add_run(text)
        run.bold = style_.get("bold", bold)
        run.italic = style_.get("italic", italic)
        if style_.get("size", size):
            run.font.size = Pt(style_.get("size", size))
        if style_.get("color", color):
            run.font.color.rgb = rgb(style_.get("color", color))
        if style_.get("head", head):
            run.font.name = b.HEAD_FONT
    return p


def _first_para(cell, content="", **options):
    """Fill a cell's own first paragraph rather than add one under it."""
    p = cell.paragraphs[0]
    runs = [(content, {})] if isinstance(content, str) else content
    for text, style_ in runs:
        run = p.add_run(text)
        run.bold = style_.get("bold", options.get("bold", False))
        size = style_.get("size", options.get("size"))
        if size:
            run.font.size = Pt(size)
        color = style_.get("color", options.get("color"))
        if color:
            run.font.color.rgb = rgb(color)
        if style_.get("head", options.get("head")):
            run.font.name = b.HEAD_FONT
    align = options.get("align")
    if align == "r":
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    elif align == "c":
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(options.get("after", 0))
    return p


# ── Tables ────────────────────────────────────────────────────────────────────


def _set(element, tag: str, **attrs):
    child = element.find(qn(tag))
    if child is None:
        child = OxmlElement(tag)
        element.append(child)
    for key, value in attrs.items():
        child.set(qn(f"w:{key}"), value)
    return child


def _shade(cell, fill: str) -> None:
    tcPr = cell._tc.get_or_add_tcPr()
    _set(tcPr, "w:shd", val="clear", color="auto", fill=fill)


def _valign(cell, where="center") -> None:
    _set(cell._tc.get_or_add_tcPr(), "w:vAlign", val=where)


def _widths(table, widths) -> None:
    table.autofit = False
    tblPr = table._tbl.tblPr
    _set(tblPr, "w:tblLayout", type="fixed")
    _set(tblPr, "w:tblW", w=str(int(sum(widths) * 1440)), type="dxa")
    grid = table._tbl.tblGrid
    for col, width in zip(grid.findall(qn("w:gridCol")), widths):
        col.set(qn("w:w"), str(int(width * 1440)))
    for row in table.rows:
        for cell, width in zip(row.cells, widths):
            cell.width = Inches(width)


def _borders(table, spec: dict[str, tuple[str, int]]) -> None:
    """Table borders: `spec` maps top, bottom, insideH and so on to (color, eighths of a point)."""
    tblPr = table._tbl.tblPr
    borders = tblPr.find(qn("w:tblBorders"))
    if borders is not None:
        tblPr.remove(borders)
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = OxmlElement(f"w:{edge}")
        if edge in spec:
            color, size = spec[edge]
            element.set(qn("w:val"), "single")
            element.set(qn("w:sz"), str(size))
            element.set(qn("w:color"), color)
        else:
            element.set(qn("w:val"), "nil")
        borders.append(element)
    tblPr.append(borders)


def _no_borders(table) -> None:
    _borders(table, {})


def _margins(table, left=0.06, right=0.06, top=0.02, bottom=0.02) -> None:
    mar = _set(table._tbl.tblPr, "w:tblCellMar")
    for edge, value in (("left", left), ("right", right), ("top", top), ("bottom", bottom)):
        _set(mar, f"w:{edge}", w=str(int(value * 1440)), type="dxa")


def data_table(container, rows, widths, *, aligns=None, size=8.5, header=True, bold_first=False, emphasize=None):
    """A table of figures: a forest header, rules between rows, numbers right-aligned."""
    table = container.add_table(rows=len(rows), cols=len(widths))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _widths(table, widths)
    _borders(table, {"bottom": (b.FOREST, 8), "insideH": (b.RULE, 4)})
    _margins(table)
    for r, row in enumerate(rows):
        trPr = table.rows[r]._tr.get_or_add_trPr()
        _set(trPr, "w:cantSplit")
        if header and r == 0:
            _set(trPr, "w:tblHeader")
        for c, value in enumerate(row):
            cell = table.cell(r, c)
            is_header = header and r == 0
            if is_header:
                _shade(cell, b.FOREST)
            elif emphasize and emphasize(r):
                _shade(cell, b.MINT)
            _valign(cell)
            _first_para(
                cell,
                value,
                size=size,
                bold=is_header or (bold_first and c == 0),
                color=b.WHITE if is_header else b.INK,
                align="r" if aligns and aligns[c] == "r" else None,
            )
    return table


def layout(container, widths):
    """A borderless table of columns to lay content out in."""
    table = container.add_table(rows=1, cols=len(widths))
    _widths(table, widths)
    _no_borders(table)
    _margins(table, left=0, right=0.12, top=0, bottom=0)
    for cell in table.rows[0].cells:
        _valign(cell, "top")
    return table.rows[0].cells


def panel(container, width, fill=b.MINT):
    """A one-cell shaded box; returns its cell."""
    table = container.add_table(rows=1, cols=1)
    _widths(table, [width])
    _no_borders(table)
    _margins(table, left=0.14, right=0.14, top=0.08, bottom=0.08)
    cell = table.cell(0, 0)
    _shade(cell, fill)
    return cell


def drop_first_empty(cell) -> None:
    """A cell starts with an empty paragraph; once it holds more, that one goes."""
    first = cell.paragraphs[0]
    if not first.text and len(cell._tc) > 2 and not first._p.findall(qn("w:r")):
        cell._tc.remove(first._p)


# ── Charts ────────────────────────────────────────────────────────────────────


class Charts:
    """Native charts in one document: each a chart part, with the workbook of its data."""

    def __init__(self, doc):
        self.doc = doc
        self.count = 0

    def add(self, paragraph, kind, width_in, height_in, categories, series, **options):
        self.count += 1
        n = self.count
        w, h = int(Inches(width_in)), int(Inches(height_in))
        chart_xml, workbook = b.chart_parts(kind, w, h, categories, series, **options)
        package = self.doc.part.package
        xlsx = Part(PackURI(f"/word/embeddings/Microsoft_Excel_Sheet{n}.xlsx"), XLSX_TYPE, workbook, package)
        chart = Part(PackURI(f"/word/charts/chart{n}.xml"), CHART_TYPE, b"", package)
        rid = chart.relate_to(xlsx, RT.PACKAGE)
        chart._blob = re.sub(rb'(<c:externalData r:id=")[^"]*', b"\\g<1>" + rid.encode(), chart_xml)
        chart_rid = self.doc.part.relate_to(chart, RT.CHART)
        drawing = f"""<w:r xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="{w}" cy="{h}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="{1000 + n}" name="Chart {n}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="{chart_rid}"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>"""
        paragraph._p.append(parse_xml(drawing))


def heading(container, text: str, *, size=12, before=8, after=3, color=b.FOREST):
    p = para(container, text, size=size, color=color, head=True, before=before, after=after)
    p.paragraph_format.keep_with_next = True
    return p


# ── Fact sheets ───────────────────────────────────────────────────────────────


def _fee_text(s: f.Strategy) -> str:
    parts = []
    for size, rate in s.fee_tiers:
        parts.append(f"{rate:.2f}% on the rest" if size is None else f"{rate:.2f}% on the {'first' if not parts else 'next'} ${size}m")
    return "; ".join(parts)


def fact_sheet(path: str, s: f.Strategy, *, draft_flaws: bool = False) -> None:
    """Two pages: the strategy, its returns and how it invests on the first; its
    positioning, risk and managers on the second. `draft_flaws` writes the draft
    compliance returned: its returns since inception alone, its yield undated."""
    doc = new_document(f"{s.name}: fact sheet", f"Fact sheet, {f.QUARTER}", margins=0.6, body_size=9)
    header_footer(doc, f"Fact sheet  ·  {f.QUARTER}", "Fictional, for demonstration. See Important information.")
    charts = Charts(doc)
    trailing = f.trailing(s)
    risk = f.risk(s)

    para(doc, s.name, style="Title", after=0)
    para(doc, f"{s.asset_class[0].upper()}{s.asset_class[1:]}  ·  As of {f.AS_OF_TEXT}", size=10.5, color=b.SLATE, after=8)
    box = panel(doc, 7.3)
    _first_para(box, [("Objective  ", {"bold": True, "color": b.FOREST}), (s.objective, {})], size=10, after=0)

    left, right = layout(doc, [2.55, 4.75])
    heading(left, "Key facts", before=10)
    facts = [
        ("Inception", s.inception_text),
        ("Benchmark", s.benchmark),
        ("Strategy assets", f"${s.aum:.1f} billion"),
        ("Vehicles", s.vehicle),
        ("Minimum account", f"${s.minimum} million"),
        ("Management fee", _fee_text(s)),
    ]
    if draft_flaws:
        facts.append(("Distribution yield", "4.1%"))
    table = data_table(left, [[k, v] for k, v in facts], [0.95, 1.5], size=8.5, header=False, bold_first=True)
    _borders(table, {"top": (b.FOREST, 8), "bottom": (b.FOREST, 8), "insideH": (b.RULE, 4)})

    heading(right, "Performance (%)", before=10)
    shown = [row for row in trailing if row[0] == "Since inception"] if draft_flaws else [row for row in trailing if row[1] is not None]
    rows = [[""] + [row[0].replace("Since inception", "Since incept.").replace("Year to date", "YTD") for row in shown]]
    for label, i in (("Gross", 1), ("Net", 2), ("Benchmark", 3)):
        rows.append([label] + [f.pct(row[i]) for row in shown])
    rows.append(["Excess, gross"] + [f.pct(row[1] - row[3], sign=True) for row in shown])
    first = 1.05
    data_table(right, rows, [first] + [(4.6 - first) / len(shown)] * len(shown), aligns="l" + "r" * len(shown), size=8.5, bold_first=True)
    para(right, "Periods over a year are annualized.", size=7.5, color=b.SLATE, after=4)
    heading(right, "Growth of $10,000, net of fees", size=10.5, before=4, after=0)
    points = f.growth(s)
    charts.add(para(right, after=0), "line", 4.6, 2.05, [p[0] for p in points], [("Strategy, net", [round(p[1]) for p in points]), ("Benchmark", [round(p[2]) for p in points])], number_format="#,##0", colors=[b.FOREST, b.GRAY], font_size=8)
    for cell in (left, right):
        drop_first_empty(cell)

    heading(doc, "Calendar-year returns (%)", before=10)
    years = f.calendar_years(s)[:11]
    rows = [[""] + [y[0].replace(" YTD", "\nYTD") for y in years]]
    for label, i in (("Gross", 1), ("Net", 2), ("Benchmark", 3)):
        rows.append([label] + [f.pct(y[i]) for y in years])
    rows.append(["Excess, gross"] + [f.pct(y[1] - y[3], sign=True) for y in years])
    data_table(doc, rows, [first] + [(7.3 - first) / len(years)] * len(years), aligns="l" + "r" * len(years), size=8.5, bold_first=True)
    partial = f"* From inception, {s.inception_text}. " if any("*" in y[0] for y in years) else ""
    para(doc, f"{partial}2026 is to {f.AS_OF_TEXT}.", size=7.5, color=b.SLATE)

    heading(doc, "How we invest", before=10)
    for cell, (head, body) in zip(layout(doc, [2.43, 2.43, 2.44]), s.approach):
        inner = panel(cell, 2.31, fill="F4F8F5")
        _first_para(inner, head, head=True, size=11, color=b.FOREST, after=2)
        para(inner, body, size=9, after=2)
        drop_first_empty(cell)

    # The second page starts here; a break in a paragraph of its own would land
    # on a full first page and leave the second empty.
    top = para(doc, after=0)
    top.paragraph_format.page_break_before = True
    top.paragraph_format.line_spacing = Pt(1)

    left, right = layout(doc, [3.65, 3.65])
    heading(left, "Sector allocation (%)", before=0, after=0)
    sectors = [row for row in s.sectors if row[0] != "Cash"]
    charts.add(para(left, after=0), "bar", 3.5, 3.0, [r[0] for r in sectors], [("Strategy", [r[1] for r in sectors]), ("Benchmark", [r[2] for r in sectors])], colors=[b.FOREST, b.GRAY], font_size=7)
    para(left, f"Cash {s.sectors[-1][1]:.1f}% of the portfolio.", size=7.5, color=b.SLATE)
    second_title, second = ("Regions (%)", s.regions) if s.regions else ("Credit quality (%)", s.quality)
    heading(left, second_title, before=6, after=0)
    second = [row for row in second if row[0] != "Cash"]
    charts.add(para(left, after=0), "bar", 3.5, 2.3, [r[0] for r in second], [("Strategy", [r[1] for r in second]), ("Benchmark", [r[2] for r in second])], colors=[b.FOREST, b.GRAY], font_size=7)

    if s.holdings:
        heading(right, "Top ten holdings (%)", before=0)
        rows = [["Company", "Country", "Weight"]] + [[h.name, h.country, f"{h.weight:.1f}"] for h in s.holdings]
        data_table(right, rows, [1.65, 1.15, 0.7], aligns="llr", size=8)
        para(right, "Company names are fictional.", size=7.5, color=b.SLATE)
    heading(right, "Characteristics", before=0 if not s.holdings else 8)
    rows = [["", "Strategy", "Benchmark"]] + [list(row) for row in s.characteristics]
    if draft_flaws:
        rows = [row for row in rows if row[0] != "Distribution yield"]
    data_table(right, rows, [1.9, 0.8, 0.8], aligns="lrr", size=8)
    span = "five years" if risk["months"] == 60 else "since inception"
    heading(right, f"Risk, {span}, gross", before=8)
    rows = [
        ["Volatility", f"{risk['volatility']:.1f}%", "Tracking error", f"{risk['tracking_error']:.1f}%"],
        ["Benchmark volatility", f"{risk['bench_volatility']:.1f}%", "Information ratio", f"{risk['information_ratio']:.2f}"],
        ["Beta", f"{risk['beta']:.2f}", "Upside capture", f"{risk['up_capture']:.0f}%"],
        ["", "", "Downside capture", f"{risk['down_capture']:.0f}%"],
    ]
    data_table(right, rows, [1.05, 0.55, 1.05, 0.85], aligns="lrlr", size=8, header=False)
    for cell in (left, right):
        drop_first_empty(cell)

    managers = [p for p in s.team if "Portfolio Manager" in p.title and "Client" not in p.title][:3]
    heading(doc, "Portfolio managers", before=10)
    for cell, person in zip(layout(doc, [2.43, 2.43, 2.44]), managers):
        _first_para(cell, person.name, bold=True, size=9, color=b.FOREST, after=0)
        para(cell, f"{person.title}. {person.years} years in the industry, {person.at_firm} at Larchmere.", size=8.5, after=0)

    heading(doc, "Important information", size=9.5, before=10, after=2)
    for text in (f.DISCLAIMER, f.PAST_PERFORMANCE, f.INDEX_NOTE + " Holdings, sectors and characteristics are of a representative account."):
        para(doc, text, size=7, color=b.SLATE, after=2)
    doc.save(path)


# ── The quarter's commentary ──────────────────────────────────────────────────


def _quarter(s: f.Strategy) -> tuple[float, float, float]:
    row = next(row for row in f.trailing(s) if row[0] == "3 months")
    return row[1], row[2], row[3]


def commentary(path: str) -> None:
    doc = new_document(f"Quarterly market commentary, {f.QUARTER}", "Market commentary", margins=0.9, body_size=10.5)
    header_footer(doc, f"Market commentary  ·  {f.QUARTER}", "Fictional, for demonstration. See Important information.")
    charts = Charts(doc)
    ge, fi, infra = (_quarter(s) for s in f.STRATEGIES)
    # What the text says of each quarter, so that it holds.
    assert ge[0] < ge[2] and fi[0] < fi[2] and infra[0] > infra[2] and ge[2] > 5 and fi[2] > 0

    para(doc, "Quarterly market commentary", style="Title", after=0)
    para(doc, f"Third quarter 2026  ·  Published October 9, 2026", size=11, color=b.SLATE, after=2)
    para(doc, "Elena Varga, CFA, Lead Portfolio Manager, Global Equity, and Daniel Okoro, CFA, Lead Portfolio Manager, Core Plus Fixed Income", size=9.5, color=b.SLATE, italic=True, after=10)

    box = panel(doc, 6.7)
    _first_para(box, "The quarter in brief", head=True, size=12.5, color=b.FOREST, after=3)
    for line in (
        f"World equities rose {f.pct(ge[2])}%, their best quarter in two years, as inflation eased and the market began to count on lower interest rates.",
        f"Bonds gained {f.pct(fi[2])}% as yields fell across maturities; credit spreads ended close to where they began.",
        f"Global Equity returned {f.pct(ge[0])}% gross, behind its benchmark: the quarter rewarded the largest, most expensive companies we hold least of.",
        f"Global Listed Infrastructure returned {f.pct(infra[0])}%, ahead of its benchmark, as regulated networks and airports did well.",
    ):
        p = box.add_paragraph(style="List Bullet")
        p.add_run(line).font.size = Pt(10)
        p.paragraph_format.space_after = Pt(2)

    heading(doc, "Equities: a narrow rally", size=15, before=14)
    para(doc, (
        "The quarter began with doubt and ended with conviction. Inflation figures through July and August came in "
        "below expectations in most large economies, and by September markets were pricing two cuts in policy rates "
        f"before the middle of next year. The Merrow World Equity Index gained {f.pct(ge[2])}%, taking its return this "
        "year to double digits."
    ))
    para(doc, (
        "Leadership was narrow. The largest companies in the index, already its most expensive, did most of the work, "
        "while smaller companies and those valued on their present earnings rather than their distant ones trailed. "
        "Energy companies rose with the oil price in August, then gave much of it back."
    ))
    para(doc, (
        f"Global Equity returned {f.pct(ge[0])}% gross of fees, {f.pct(ge[2] - ge[0])} points behind its benchmark. "
        "Two things cost us: holding less than the index in its largest technology companies, whose valuations we "
        "can't justify, and our underweight in energy during August. Our health care holdings helped, Orris Health "
        "Systems most of all after it raised its guidance for the year. This year to date, the strategy remains ahead "
        "of its benchmark."
    ))

    p = heading(doc, "Returns in the third quarter (%)", size=11, before=10, after=0)
    labels = ["Global Equity", "Core Plus Fixed Income", "Global Listed Infrastructure"]
    charts.add(para(doc, after=2), "column", 6.7, 2.6, labels, [("Strategy, gross", [round(q[0], 1) for q in (ge, fi, infra)]), ("Strategy, net", [round(q[1], 1) for q in (ge, fi, infra)]), ("Benchmark", [round(q[2], 1) for q in (ge, fi, infra)])], font_size=9)
    para(doc, "Three months to September 30, 2026. Benchmarks are the Merrow indices named in each strategy's fact sheet.", size=8, color=b.SLATE)

    heading(doc, "Bonds: duration paid", size=15, before=12)
    para(doc, (
        f"Yields fell by between a quarter and a half of a percentage point across maturities, and the Merrow US Aggregate Bond "
        f"Index returned {f.pct(fi[2])}%. Investment-grade credit spreads widened in early August, on a run of weaker "
        "manufacturing data, then narrowed again; high yield ended the quarter a little wider."
    ))
    para(doc, (
        f"Core Plus Fixed Income returned {f.pct(fi[0])}% gross, behind its benchmark. We hold fewer Treasuries than the "
        "index in favor of corporate and securitized bonds, which yield more but gained less as Treasuries rallied. "
        "We kept our duration close to the benchmark's: the market already expects the rate cuts we expect, so there is "
        "little to be paid for betting on them."
    ))

    heading(doc, "Infrastructure: steady hands", size=15, before=12)
    para(doc, (
        f"Global Listed Infrastructure returned {f.pct(infra[0])}% gross against {f.pct(infra[2])}% for its benchmark. "
        "Regulated electricity and gas networks rose as lower rates made their steady returns worth more, and airport "
        "operators reported traffic above last year's. Our underweight in midstream energy, where we see revenues "
        "too exposed to volumes, held us back in August and helped us in September."
    ))

    heading(doc, "Outlook", size=15, before=12)
    para(doc, (
        "Markets now price a gentle landing: slower growth, inflation at target and lower rates. That may well come, "
        "but it leaves little room for disappointment, above all in the companies whose prices assume it. We see better "
        "value in high-quality businesses outside the largest ten, in Europe and Japan as well as the United States, and "
        "in shorter-dated credit, where yields remain well above inflation."
    ))

    heading(doc, "How we're positioned", size=11, before=10)
    rows = [["Strategy", "Q3, gross", "Benchmark", "Positioning"]]
    rows += [
        ["Global Equity", f.pct(ge[0]), f.pct(ge[2]), "Overweight health care and industrials; underweight the largest technology companies and energy"],
        ["Core Plus Fixed Income", f.pct(fi[0]), f.pct(fi[2]), "Duration near the benchmark's; overweight securitized and investment-grade corporate bonds"],
        ["Global Listed Infrastructure", f.pct(infra[0]), f.pct(infra[2]), "Overweight regulated networks, toll roads and airports; underweight midstream energy"],
    ]
    data_table(doc, rows, [1.75, 0.8, 0.85, 3.3], aligns="lrrl", size=9, bold_first=True)

    heading(doc, "Important information", size=10, before=14, after=2)
    for text in (f.DISCLAIMER, "The views here are the authors' as of the date of publication and may change. They are not a recommendation to buy or sell any security.", f.PAST_PERFORMANCE, f.INDEX_NOTE):
        para(doc, text, size=8, color=b.SLATE, after=3)
    doc.save(path)


# ── The due diligence questionnaire ───────────────────────────────────────────


def ddq(path: str) -> None:
    s = f.GLOBAL_EQUITY
    doc = new_document("Due diligence questionnaire: Larchmere Global Equity", f"DDQ, as of {f.AS_OF_TEXT}", margins=0.9, body_size=10.5)
    header_footer(doc, "Due diligence questionnaire  ·  Global Equity", "Fictional, for demonstration. Confidential: for the recipient's evaluation only.")
    numbered = {"section": 0, "question": 0}

    def section(title: str) -> None:
        numbered["section"] += 1
        numbered["question"] = 0
        doc.add_heading(f"{numbered['section']}.  {title}", level=1)

    def question(text: str, *answers) -> None:
        numbered["question"] += 1
        p = para(doc, [(f"{numbered['section']}.{numbered['question']}  ", {"bold": True, "color": b.FOREST}), (text, {"bold": True})], before=8, after=3)
        p.paragraph_format.keep_with_next = True
        for answer in answers:
            if isinstance(answer, str):
                para(doc, answer)
            else:
                answer()

    para(doc, "Due diligence questionnaire", style="Title", after=0)
    para(doc, f"{s.name}  ·  Answers as of {f.AS_OF_TEXT}", size=12, color=b.SLATE, after=10)
    rows = [
        ["Firm", f.FIRM["name"]],
        ["Strategy", s.name],
        ["Strategy assets", f"${s.aum:.1f} billion, in 41 accounts"],
        ["Firm assets", f"${f.FIRM['aum']:.1f} billion"],
        ["Contact", f"{f.CONTACTS[0][0]}, {f.CONTACTS[0][1]}, {f.CONTACTS[0][2]}"],
    ]
    table = data_table(doc, rows, [1.6, 5.1], size=10, header=False, bold_first=True)
    _borders(table, {"top": (b.FOREST, 8), "bottom": (b.FOREST, 8), "insideH": (b.RULE, 4)})
    para(doc, "Answers are reviewed by Larchmere's compliance team each quarter. Figures are as of the date above unless a question says otherwise.", size=9, color=b.SLATE, before=6)

    section("The firm")
    question("Give a brief history of the firm.",
        "Larchmere was founded in Boston in 1998 by four partners from a large mutual fund company, with $400 million from two public pension funds. "
        "It has managed money only for institutions since. Core Plus Fixed Income launched in 2005, Global Equity in 2012 and Global Listed "
        "Infrastructure in 2022. The London office opened in 2009 and the Singapore office in 2017.")
    question("Describe the firm's ownership.",
        "Larchmere is wholly owned by its employees. The founding partners sold their shares to the firm's employees in 2011, under a plan that "
        "lets every employee with three years' service own shares. No employee owns more than 9%, and 64% of employees are shareholders. Shares "
        "are bought back from those who leave, at a price set each year by an independent valuer.")
    question("Give the firm's assets under management by strategy.", lambda: data_table(
        doc, [["Strategy", "Since", "Assets ($bn)"]] + [[name, str(year), f"{aum:.1f}"] for name, _, year, aum, _ in f.LINE_UP] + [["Firm total", "", f"{f.FIRM['aum']:.1f}"]],
        [3.6, 1.0, 1.4], aligns="lrr", size=9.5, emphasize=lambda r: r == len(f.LINE_UP) + 1))
    question("With which regulators is the firm registered?",
        "Larchmere is registered as an investment adviser in the United States, is authorized and regulated in the United Kingdom for its London "
        "office, and holds a capital markets services license in Singapore. It has never been the subject of an enforcement action.")
    question("Is the firm, or anyone in it, party to any litigation or regulatory proceeding?", "No.")

    section("The investment team")
    question("Who manages the strategy, and what is their experience?", lambda: data_table(
        doc, [["Name", "Role", "Industry", "Larchmere"]] + [[p.name, p.title, f"{p.years} years", f"{p.at_firm} years"] for p in s.team],
        [1.8, 2.7, 1.0, 1.1], aligns="llrr", size=9.5))
    question("How has the team changed over the last five years?",
        "No portfolio manager has left the strategy since it launched. Two analysts have joined in the last five years, in health care (2022) and "
        "consumer companies (2024); one analyst left in 2023 to join a university endowment, and was replaced from within.")
    question("How are the investment professionals paid?",
        "A salary, and a bonus of which 70% depends on the strategy's results over rolling three- and five-year periods and 30% on the quality of "
        "the individual's research, as judged by the portfolio managers. Half of each bonus over $100,000 is deferred for three years into the "
        "strategy's commingled fund, so that the team's money moves with its clients'. Every portfolio manager is also a shareholder in the firm.")

    section("Philosophy and process")
    question("What is the strategy's investment philosophy?",
        "We believe that companies which earn high returns on capital, and can keep reinvesting at those returns, compound their value faster than "
        "the market expects, and that the market undervalues that persistence. We buy such companies when their price does not already assume it, "
        "and hold them for as long as the case holds, typically five years or more.")
    question("Describe the investment process.", *[
        (lambda line=line: (lambda p: p.add_run(line))(doc.add_paragraph(style="List Number")))
        for line in (
            "Screen: from about 4,000 companies worth over $2 billion, a quantitative screen of returns on capital, balance sheet strength and governance leaves about 400.",
            "Research: sector analysts write a case for each company worth pursuing: the franchise, its reinvestment runway, its risks and its management's record.",
            "Value: each company gets a five-year valuation; the approved list, about 120 companies, holds those we would own at the right price.",
            "Construct: the portfolio managers size positions by conviction and by the gap between price and value, within the limits in 4.1.",
        )
    ])
    question("When does the strategy sell a holding?",
        "When the case breaks: returns on capital fall for reasons we believe will last, management allocates capital in ways we can't support, or "
        "the governance we relied on changes. We also sell, or trim, when the price passes our estimate of value, and to fund a better idea.")
    question("How are environmental, social and governance matters considered?",
        "As part of each case, by the analyst who covers the company, not by a separate team. Each case names the matters that could change the "
        "company's returns on capital, from carbon costs to labor relations, and how we would know. We vote every proxy ourselves, and engaged with "
        "the boards of 23 of the strategy's holdings in 2025.")

    section("Portfolio construction and risk")
    question("What are the strategy's portfolio guidelines?", lambda: data_table(
        doc, [["Guideline", "Limit"], ["Number of holdings", "45 to 60"], ["Largest position", "6% at purchase; trimmed above 7%"], ["Sector weight", "Benchmark ± 10 points"], ["Country weight", "Benchmark ± 15 points"], ["Emerging markets", "Up to 15%"], ["Cash", "Up to 5%"]],
        [3.0, 3.4], size=9.5))
    question("How is risk overseen?",
        "Larchmere's risk team reports to the chief operating officer, not to the portfolio managers. It reviews the portfolio each week against the "
        "guidelines above and against its expected tracking error, between 2% and 5% a year, and meets the portfolio managers each month. A breach is "
        "corrected within five business days and reported to the client.")

    section("Performance")
    trailing = f.trailing(s)
    question(f"Give the strategy's returns to {f.AS_OF_TEXT}.", lambda: data_table(
        doc, [["%", "Gross", "Net", "Benchmark", "Excess, gross"]] + [[row[0], f.pct(row[1]), f.pct(row[2]), f.pct(row[3]), f.pct(None if row[1] is None else row[1] - row[3], sign=True)] for row in trailing],
        [1.9, 1.1, 1.1, 1.2, 1.3], aligns="lrrrr", size=9.5), "Over a year, annualized. Net of the highest standard fee, 0.70% a year. The benchmark is the Merrow World Equity Index.")
    question("Give the strategy's calendar-year returns.", lambda: data_table(
        doc, [["%", "Gross", "Net", "Benchmark", "Excess, gross"]] + [[y[0], f.pct(y[1]), f.pct(y[2]), f.pct(y[3]), f.pct(y[1] - y[3], sign=True)] for y in f.calendar_years(s)],
        [1.9, 1.1, 1.1, 1.2, 1.3], aligns="lrrrr", size=9.5), f"2012 from inception, {s.inception_text}.")
    years = {y[0]: y for y in f.calendar_years(s)}
    behind = [label for label, y in years.items() if y[1] < y[3] and "*" not in label and "YTD" not in label]
    question("Explain any years in which the strategy trailed its benchmark.",
        f"The strategy trailed in {', '.join(behind[:-1])} and {behind[-1]}. In each, the market was led by a narrow group of large, highly valued "
        "companies that we held less of than the index. We expect to lag in such markets, and to make it up when valuations matter again, as they did "
        "in 2018 and 2022, when the benchmark fell and the strategy fell less.")
    assert all(years[str(y)][1] > years[str(y)][3] > years[str(y)][1] - 5 and years[str(y)][3] < 0 for y in (2018, 2022)), "the answer says so"

    section("Operations and compliance")
    question("How are trades placed?",
        "By a central trading desk of five, separate from the portfolio managers, which aggregates orders across accounts and allocates them "
        "pro rata before execution. Brokers are reviewed each quarter on the quality of their execution; research is paid for by Larchmere, not "
        "from clients' commissions.")
    question("How are holdings valued, and who is the custodian?",
        "Holdings are valued daily from independent pricing sources by Larchmere's operations team, separate from the investment team. Clients "
        "choose their own custodian for a separate account; the commingled fund's custodian and administrator is an independent global bank.")
    question("Describe the firm's business continuity and cybersecurity arrangements.",
        "Each office can run the firm's critical work alone, and all three are tested each year by failing over to one. Systems are hosted in two "
        "regions. An outside firm tests our defenses twice a year, and every employee is trained four times a year; we had no material incident "
        "in the last five years.")
    question("Does the firm have a code of ethics?",
        "Yes. Every employee certifies compliance each quarter. Personal trades in any security the firm holds or follows need approval first and "
        "must be held for 60 days, and no employee may trade a security within seven days of a client trade in it.")

    section("Fees")
    question("Give the strategy's fee schedule for a separate account.", lambda: data_table(
        doc, [["Assets", "Annual fee"]] + [[("First" if i == 0 else "Next") + f" ${size}m" if size else "Above $250m", f"{rate:.2f}%"] for i, (size, rate) in enumerate(s.fee_tiers)],
        [3.0, 1.6], aligns="lr", size=9.5), f"The minimum account is ${s.minimum} million. On a $250 million account the fee comes to ${f.fee_for(s, 250):.2f} million a year, {f.fee_for(s, 250) / 250 * 100:.2f}% of assets.")
    question("Is a performance fee available?",
        "Yes, for accounts of $100 million or more: a base fee of 0.35% a year and 15% of returns above the benchmark, measured over rolling three-year "
        "periods and capped at 1.20% a year in all.")

    heading(doc, "Important information", size=11, before=16, after=3)
    for text in (f.DISCLAIMER, f.PAST_PERFORMANCE, f.INDEX_NOTE):
        para(doc, text, size=8.5, color=b.SLATE, after=3)
    doc.save(path)
