"""Larchmere's decks: the Global Equity pitch book and the firm overview, 16:9,
on a theme of Larchmere's colors and fonts, their charts native."""

from __future__ import annotations

import re

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
from pptx.util import Emu, Inches, Pt

import brand as b
import figures as f

W, H = Inches(13.333), Inches(7.5)
MARGIN = Inches(0.6)
CONTENT_TOP = Inches(1.55)


# ── The theme ─────────────────────────────────────────────────────────────────


def _theme(deck: Presentation) -> None:
    """Larchmere's colors and fonts as the deck's theme, so that what's added to it later takes them."""
    part = deck.slide_master.part.part_related_by(RT.THEME)
    xml = part.blob.decode("utf-8")
    colors = {
        "dk1": b.INK, "lt1": b.WHITE, "dk2": b.FOREST, "lt2": b.MINT,
        "accent1": b.FOREST, "accent2": b.GREEN, "accent3": b.SAGE, "accent4": b.AMBER,
        "accent5": b.SLATE, "accent6": b.GRAY, "hlink": b.FOREST, "folHlink": b.SLATE,
    }
    scheme = "".join(f'<a:{k}><a:srgbClr val="{v}"/></a:{k}>' for k, v in colors.items())
    xml = re.sub(r'<a:clrScheme name="[^"]*">.*?</a:clrScheme>', f'<a:clrScheme name="Larchmere">{scheme}</a:clrScheme>', xml, flags=re.S)
    xml = re.sub(r'(<a:majorFont><a:latin typeface=")[^"]*', rf"\g<1>{b.HEAD_FONT}", xml)
    xml = re.sub(r'(<a:minorFont><a:latin typeface=")[^"]*', rf"\g<1>{b.BODY_FONT}", xml)
    xml = re.sub(r'<a:theme ([^>]*)name="[^"]*"', r'<a:theme \1name="Larchmere"', xml)
    part._blob = xml.encode("utf-8")


def _deck(title: str, subject: str) -> Presentation:
    deck = Presentation()
    deck.slide_width, deck.slide_height = W, H
    _theme(deck)
    props = deck.core_properties
    props.title, props.subject, props.author = title, subject, f.FIRM["name"]
    props.keywords = "fictional; docMentis demonstration"
    return deck


# ── Drawing ───────────────────────────────────────────────────────────────────


def box(slide, x, y, w, h, fill, *, rounded=False, line=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE, x, y, w, h)
    if rounded:
        shape.adjustments[0] = 0.08
    shape.fill.solid()
    shape.fill.fore_color.rgb = b.rgb(fill)
    if line:
        shape.line.color.rgb = b.rgb(line)
        shape.line.width = Pt(1)
    else:
        shape.line.fill.background()
    shape.shadow.inherit = False
    return shape


def text(slide, x, y, w, h, paragraphs, *, size=16, color=b.INK, bold=False, head=False, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=4, italic=False):
    """A text box; `paragraphs` a string, or a list of strings or of lists of
    (text, {size, color, bold, head, italic}) runs."""
    shape = slide.shapes.add_textbox(x, y, w, h)
    frame = shape.text_frame
    frame.word_wrap = True
    frame.margin_left = frame.margin_right = frame.margin_top = frame.margin_bottom = 0
    frame.vertical_anchor = anchor
    if isinstance(paragraphs, str):
        paragraphs = [paragraphs]
    for i, paragraph in enumerate(paragraphs):
        p = frame.paragraphs[0] if i == 0 else frame.add_paragraph()
        p.alignment = align
        p.space_after = Pt(spacing)
        runs = [(paragraph, {})] if isinstance(paragraph, str) else paragraph
        for content, style in runs:
            run = p.add_run()
            run.text = content
            font = run.font
            font.size = Pt(style.get("size", size))
            font.bold = style.get("bold", bold)
            font.italic = style.get("italic", italic)
            font.color.rgb = b.rgb(style.get("color", color))
            if style.get("head", head):
                font.name = "+mj-lt"
    return shape


def title(slide, content: str, kicker: str | None = None) -> None:
    if kicker:
        text(slide, MARGIN, Inches(0.42), Inches(10), Inches(0.3), kicker.upper(), size=12, color=b.GREEN, bold=True)
    text(slide, MARGIN, Inches(0.72), W - 2 * MARGIN, Inches(0.7), content, size=30, color=b.FOREST, head=True)


def footer(slide, number: int, note: str) -> None:
    text(slide, MARGIN, H - Inches(0.45), Inches(9), Inches(0.25), note, size=10, color=b.SLATE)
    text(slide, W - MARGIN - Inches(1), H - Inches(0.45), Inches(1), Inches(0.25), str(number), size=10, color=b.SLATE, align=PP_ALIGN.RIGHT)


def table(slide, x, y, widths, rows, *, size=13, header=True, row_height=Inches(0.42), aligns=None, bold_first=False, highlight=None):
    """A table, its header row forest; `widths` in inches, `aligns` per column ("l" or "r")."""
    shape = slide.shapes.add_table(len(rows), len(widths), x, y, Inches(sum(widths)), row_height * len(rows))
    grid = shape.table
    grid.first_row = header
    grid.horz_banding = False
    for i, width in enumerate(widths):
        grid.columns[i].width = Inches(width)
    for r, row in enumerate(rows):
        grid.rows[r].height = row_height
        for c, value in enumerate(row):
            cell = grid.cell(r, c)
            cell.margin_left = cell.margin_right = Inches(0.1)
            cell.margin_top = cell.margin_bottom = Inches(0.04)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            is_header = header and r == 0
            fill = b.FOREST if is_header else (b.MINT if highlight and highlight(r) else (b.WHITE if r % 2 else "F4F8F5"))
            cell.fill.solid()
            cell.fill.fore_color.rgb = b.rgb(fill)
            frame = cell.text_frame
            frame.word_wrap = True
            p = frame.paragraphs[0]
            p.alignment = PP_ALIGN.RIGHT if aligns and aligns[c] == "r" else PP_ALIGN.LEFT
            run = p.add_run()
            run.text = value
            run.font.size = Pt(size)
            run.font.bold = is_header or (bold_first and c == 0)
            run.font.color.rgb = b.rgb(b.WHITE if is_header else b.INK)
    return shape


def stat(slide, x, y, w, h, figure: str, label: str, *, fill=b.MINT, color=b.FOREST, size=40):
    box(slide, x, y, w, h, fill, rounded=True)
    inset = Inches(0.25)
    text(slide, x + inset, y + Inches(0.25), w - 2 * inset, Inches(0.8), figure, size=size, color=color, head=True)
    text(slide, x + inset, y + Inches(0.25) + Inches(0.85), w - 2 * inset, h - Inches(1.2), label, size=14, color=b.INK)


def numbered(slide, x, y, n: str, *, fill=b.FOREST, color=b.WHITE, d=Inches(0.55)):
    circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, x, y, d, d)
    circle.fill.solid()
    circle.fill.fore_color.rgb = b.rgb(fill)
    circle.line.fill.background()
    circle.shadow.inherit = False
    frame = circle.text_frame
    frame.margin_left = frame.margin_right = frame.margin_top = frame.margin_bottom = 0
    frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = n
    run.font.size = Pt(18)
    run.font.bold = True
    run.font.color.rgb = b.rgb(color)


def cover(deck, kicker: str, heading: str, subheading: str):
    slide = deck.slides.add_slide(deck.slide_layouts[6])
    box(slide, 0, 0, W, H, b.FOREST)
    text(slide, MARGIN + Inches(0.2), Inches(2.0), Inches(7.6), Inches(0.4), kicker.upper(), size=14, color=b.SAGE, bold=True)
    text(slide, MARGIN + Inches(0.2), Inches(2.45), Inches(7.6), Inches(1.9), heading, size=46, color=b.WHITE, head=True)
    text(slide, MARGIN + Inches(0.2), Inches(4.35), Inches(7.6), Inches(0.9), subheading, size=20, color=b.MINT)
    text(slide, MARGIN + Inches(0.2), H - Inches(1.1), Inches(7.6), Inches(0.4), f"Data as of {f.AS_OF_TEXT}  ·  For institutional investors only", size=12, color=b.SAGE)
    card = Inches(3.6)
    cx, cy = W - MARGIN - card - Inches(0.2), (H - card) / 2
    box(slide, cx, cy, card, card, b.WHITE, rounded=True)
    logo = Inches(2.1)
    slide.shapes.add_picture(b.logo_stream(), cx + (card - logo) / 2, cy + Inches(0.42), logo, logo)
    text(slide, cx + Inches(0.2), cy + Inches(2.65), card - Inches(0.4), Inches(0.7), [[("Larchmere", {"size": 22, "head": True, "color": b.FOREST})], [("INVESTMENT MANAGEMENT", {"size": 10, "bold": True, "color": b.SLATE})]], align=PP_ALIGN.CENTER, spacing=0)
    return slide


def content(deck, heading: str, kicker: str, number: int, note: str):
    slide = deck.slides.add_slide(deck.slide_layouts[6])
    title(slide, heading, kicker)
    footer(slide, number, note)
    slide.shapes.add_picture(b.logo_stream(), W - MARGIN - Inches(0.55), Inches(0.5), Inches(0.55), Inches(0.55))
    return slide


def disclosures(deck, number: int, note: str, extra: list[str]):
    slide = content(deck, "Important information", "Disclosures", number, note)
    paragraphs = [f.DISCLAIMER, *extra, f.PAST_PERFORMANCE, f.INDEX_NOTE, "For institutional investors only. Not for distribution to retail investors."]
    half = (len(paragraphs) + 1) // 2
    width = (W - 2 * MARGIN - Inches(0.5)) / 2
    for i, column in enumerate((paragraphs[:half], paragraphs[half:])):
        text(slide, MARGIN + i * (width + Inches(0.5)), CONTENT_TOP, width, Inches(5), column, size=13, color=b.INK, spacing=10)
    return slide


# ── The Global Equity pitch book ──────────────────────────────────────────────


def pitch_book(path: str) -> None:
    s = f.GLOBAL_EQUITY
    deck = _deck("Larchmere Global Equity: strategy review", f"Pitch book, data as of {f.AS_OF_TEXT}")
    note = f"Larchmere Global Equity  ·  Data as of {f.AS_OF_TEXT}  ·  Fictional, for demonstration"
    trailing = f.trailing(s)
    inception = trailing[-1]
    risk = f.risk(s)

    cover(deck, "Global Equity", "Larchmere Global Equity", "Quality companies, bought sensibly and held patiently")

    # 2: at a glance
    slide = content(deck, "Global Equity at a glance", "The strategy", 2, note)
    w = (W - 2 * MARGIN - 3 * Inches(0.3)) / 4
    stats = [
        (f"${s.aum:.1f}bn", "in the strategy, across 41 institutional clients"),
        (f"+{inception[1] - inception[3]:.1f}%", f"a year ahead of the benchmark since {s.inception[0]}, gross of fees"),
        ("52", "holdings: a concentrated portfolio, each a conviction"),
        ("86%", "active share: it looks nothing like the index"),
    ]
    for i, (figure, label) in enumerate(stats):
        stat(slide, MARGIN + i * (w + Inches(0.3)), CONTENT_TOP + Inches(0.1), w, Inches(2.3), figure, label)
    box(slide, MARGIN, Inches(4.35), W - 2 * MARGIN, Inches(2.2), "F4F8F5", rounded=True)
    text(slide, MARGIN + Inches(0.35), Inches(4.6), Inches(2.2), Inches(0.4), "Objective", size=18, color=b.FOREST, head=True)
    text(slide, MARGIN + Inches(2.7), Inches(4.62), W - 2 * MARGIN - Inches(3.1), Inches(1.8), [s.objective, f"Benchmark: {s.benchmark}  ·  Inception: {s.inception_text}  ·  {s.vehicle}"], size=16, spacing=10)

    # 3: the firm
    slide = content(deck, "Larchmere at a glance", "The firm", 3, note)
    facts = [
        (f"{f.FIRM['founded']}", "Founded in Boston"),
        (f"${f.FIRM['aum']}bn", "Assets under management"),
        (f"{f.FIRM['clients']}", "Institutional clients in 14 countries"),
        (f"{f.FIRM['investment_professionals']}", "Investment professionals"),
    ]
    for i, (figure, label) in enumerate(facts):
        row, col = divmod(i, 2)
        stat(slide, MARGIN + col * Inches(3.05), CONTENT_TOP + Inches(0.1) + row * Inches(2.45), Inches(2.8), Inches(2.2), figure, label, size=36)
    text(slide, Inches(7.1), CONTENT_TOP + Inches(0.05), Inches(5.6), Inches(0.4), "Assets by client type (%)", size=16, color=b.FOREST, head=True)
    b.add_chart(slide.shapes, "doughnut", Inches(6.9), CONTENT_TOP + Inches(0.5), Inches(5.9), Inches(4.4), [c for c, _ in f.CLIENTS], [("Share of assets", [v for _, v in f.CLIENTS])], colors=[b.FOREST, b.GREEN, "7FB396", b.SAGE, b.AMBER, b.GRAY], font_size=13)

    # 4: philosophy
    slide = content(deck, "Quality, bought sensibly, held patiently", "Philosophy", 4, note)
    pillars = [
        ("Quality compounders", "Companies that earn high returns on capital and can keep reinvesting at them: durable franchises, strong balance sheets, management we trust."),
        ("Valuation discipline", "We pay for quality, not for hope. Every holding has a written valuation case and a price at which we would sell it."),
        ("Patience", "A five-year horizon and turnover near 25% a year. We let compounding do the work, and engage with companies as their owners."),
    ]
    w = (W - 2 * MARGIN - 2 * Inches(0.4)) / 3
    for i, (head, body) in enumerate(pillars):
        x = MARGIN + i * (w + Inches(0.4))
        box(slide, x, CONTENT_TOP + Inches(0.2), w, Inches(4.6), "F4F8F5", rounded=True)
        numbered(slide, x + Inches(0.35), CONTENT_TOP + Inches(0.55), str(i + 1))
        text(slide, x + Inches(0.35), CONTENT_TOP + Inches(1.35), w - Inches(0.7), Inches(0.5), head, size=22, color=b.FOREST, head=True)
        text(slide, x + Inches(0.35), CONTENT_TOP + Inches(2.0), w - Inches(0.7), Inches(2.6), body, size=16)

    # 5: process
    slide = content(deck, "A process that narrows 4,000 companies to about 50", "Process", 5, note)
    steps = [
        ("4,000", "Screen", "Developed and emerging markets over $2bn, screened for returns on capital, balance sheet strength and governance."),
        ("400", "Research", "Sector analysts write the case: the franchise, its reinvestment runway, its risks and management's record."),
        ("120", "Value", "Each company gets a valuation and a five-year view; the approved list holds those we would own at the right price."),
        ("45–60", "Construct", "Positions sized by conviction and valuation, with limits on any one company, sector and country."),
    ]
    w = (W - 2 * MARGIN - 3 * Inches(0.35)) / 4
    for i, (count, head, body) in enumerate(steps):
        x = MARGIN + i * (w + Inches(0.35))
        fill = [b.MINT, "D3EADB", b.SAGE, b.FOREST][i]
        color = b.WHITE if i == 3 else b.FOREST
        box(slide, x, CONTENT_TOP + Inches(0.2), w, Inches(1.5), fill, rounded=True)
        text(slide, x, CONTENT_TOP + Inches(0.35), w, Inches(0.7), count, size=36, color=color, head=True, align=PP_ALIGN.CENTER)
        text(slide, x, CONTENT_TOP + Inches(1.1), w, Inches(0.4), "companies" if i < 3 else "holdings", size=13, color=color, align=PP_ALIGN.CENTER)
        if i < 3:
            arrow = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, x + w + Inches(0.06), CONTENT_TOP + Inches(0.78), Inches(0.24), Inches(0.34))
            arrow.fill.solid()
            arrow.fill.fore_color.rgb = b.rgb(b.GRAY)
            arrow.line.fill.background()
        numbered(slide, x, CONTENT_TOP + Inches(2.1), str(i + 1), d=Inches(0.45))
        text(slide, x + Inches(0.6), CONTENT_TOP + Inches(2.15), w - Inches(0.6), Inches(0.4), head, size=20, color=b.FOREST, head=True)
        text(slide, x, CONTENT_TOP + Inches(2.75), w, Inches(2.2), body, size=15)

    # 6: team
    slide = content(deck, "An experienced, stable team", "People", 6, note)
    rows = [["", "Role", "Industry", "Larchmere", "Focus"]]
    rows += [[p.name, p.title, f"{p.years} years", f"{p.at_firm} years", p.focus] for p in s.team]
    table(slide, MARGIN, CONTENT_TOP + Inches(0.1), [2.6, 3.4, 1.25, 1.35, 3.53], rows, size=14, row_height=Inches(0.62), aligns="llrrl", bold_first=True)
    text(slide, MARGIN, CONTENT_TOP + Inches(4.15), W - 2 * MARGIN, Inches(0.8), "Supported by 11 sector analysts and Larchmere's independent risk team. No portfolio manager has left the strategy since its launch.", size=15, color=b.SLATE)

    # 7: characteristics
    slide = content(deck, "Better businesses, at the market's price", "Portfolio", 7, note)
    rows = [["", "Strategy", "Benchmark"]] + [list(row) for row in s.characteristics]
    table(slide, MARGIN, CONTENT_TOP + Inches(0.1), [4.2, 1.6, 1.6], rows, size=14, row_height=Inches(0.5), aligns="lrr")
    points = [
        ("Higher returns, less debt", "Return on equity of 21% against the index's 17%, with two-thirds of its leverage."),
        ("No premium paid", "Earnings valued in line with the market: the quality comes without a premium price."),
        ("Concentrated", "52 holdings and 86% active share: the result is ours, not the index's."),
    ]
    for i, (head, body) in enumerate(points):
        y = CONTENT_TOP + Inches(0.1) + i * Inches(1.5)
        box(slide, Inches(8.55), y, W - MARGIN - Inches(8.55), Inches(1.3), b.MINT, rounded=True)
        text(slide, Inches(8.8), y + Inches(0.18), W - MARGIN - Inches(9.05), Inches(0.4), head, size=17, color=b.FOREST, head=True)
        text(slide, Inches(8.8), y + Inches(0.58), W - MARGIN - Inches(9.05), Inches(0.7), body, size=13)

    # 8: sectors
    slide = content(deck, "Overweight health care and industrials; no real estate", "Positioning", 8, note)
    sectors = [row for row in s.sectors if row[0] != "Cash"]
    b.add_chart(slide.shapes, "bar", MARGIN, CONTENT_TOP, Inches(8.4), Inches(5.3), [r[0] for r in sectors], [("Strategy", [r[1] for r in sectors]), ("Benchmark", [r[2] for r in sectors])], colors=[b.FOREST, b.GRAY], font_size=12)
    box(slide, Inches(9.35), CONTENT_TOP + Inches(0.2), W - MARGIN - Inches(9.35), Inches(4.9), "F4F8F5", rounded=True)
    active = sorted(((r[0], r[1] - r[2]) for r in sectors), key=lambda x: -x[1])
    lines = [[("Largest active weights", {"size": 17, "head": True, "color": b.FOREST})]]
    lines += [[(f"{name}  ", {"size": 14}), (f.pct(diff, sign=True), {"size": 14, "bold": True, "color": b.FOREST if diff > 0 else b.AMBER})] for name, diff in active[:3] + active[-3:]]
    lines += [[(f"Cash {s.sectors[-1][1]:.1f}%. Weights in % of the portfolio.", {"size": 12, "color": b.SLATE})]]
    text(slide, Inches(9.6), CONTENT_TOP + Inches(0.45), W - MARGIN - Inches(9.85), Inches(4.5), lines, spacing=10)

    # 9: holdings and regions
    slide = content(deck, "Top ten holdings", "Portfolio", 9, note)
    rows = [["Company", "Sector", "Country", "Weight"]] + [[h.name, h.sector, h.country, f"{h.weight:.1f}%"] for h in s.holdings]
    table(slide, MARGIN, CONTENT_TOP + Inches(0.05), [2.75, 2.55, 1.7, 0.95], rows, size=13, row_height=Inches(0.43), aligns="lllr")
    top = sum(h.weight for h in s.holdings)
    text(slide, MARGIN, CONTENT_TOP + Inches(4.9), Inches(8), Inches(0.35), f"The top ten are {top:.1f}% of the portfolio. Company names are fictional.", size=12, color=b.SLATE)
    text(slide, Inches(9.0), CONTENT_TOP + Inches(0.05), Inches(3.7), Inches(0.4), "Regions (%)", size=16, color=b.FOREST, head=True)
    regions = [r for r in s.regions if r[0] != "Cash"]
    b.add_chart(slide.shapes, "bar", Inches(8.85), CONTENT_TOP + Inches(0.45), W - MARGIN - Inches(8.85), Inches(4.7), [r[0] for r in regions], [("Strategy", [r[1] for r in regions]), ("Benchmark", [r[2] for r in regions])], colors=[b.FOREST, b.GRAY], font_size=11)

    # 10: performance
    periods = [row for row in trailing if row[0] not in ("3 months", "Year to date")]
    assert all(p[1] > p[3] for p in periods), "the slide's title says so"
    slide = content(deck, "Ahead of the benchmark over every period from one year", "Performance", 10, note)
    b.add_chart(slide.shapes, "column", MARGIN, CONTENT_TOP, W - 2 * MARGIN, Inches(3.6), [p[0] for p in periods], [("Strategy, gross", [round(p[1], 1) for p in periods]), ("Strategy, net", [round(p[2], 1) for p in periods]), ("Benchmark", [round(p[3], 1) for p in periods])], font_size=13)
    rows = [["Annualized, %"] + [p[0] for p in trailing]]
    for label, i in (("Strategy, gross", 1), ("Strategy, net", 2), ("Benchmark", 3)):
        rows.append([label] + [f.pct(p[i]) for p in trailing])
    rows.append(["Excess, gross"] + [f.pct(p[1] - p[3], sign=True) for p in trailing])
    table(slide, MARGIN, CONTENT_TOP + Inches(3.7), [2.25] + [1.41] * 7, rows, size=12, row_height=Inches(0.31), aligns="l" + "r" * 7, bold_first=True)

    # 11: calendar years
    slide = content(deck, "Calendar-year returns", "Performance", 11, note)
    years = f.calendar_years(s)[:11]
    rows = [["%"] + [y[0] for y in years]]
    for label, i in (("Strategy, gross", 1), ("Strategy, net", 2), ("Benchmark", 3)):
        rows.append([label] + [f.pct(y[i]) for y in years])
    rows.append(["Excess, gross"] + [f.pct(y[1] - y[3], sign=True) for y in years])
    table(slide, MARGIN, CONTENT_TOP + Inches(0.1), [2.13] + [0.95] * 11, rows, size=13, row_height=Inches(0.5), aligns="l" + "r" * 11, bold_first=True)
    ahead = sum(1 for y in f.calendar_years(s) if y[1] > y[3] and "YTD" not in y[0] and "*" not in y[0])
    full = sum(1 for y in f.calendar_years(s) if "YTD" not in y[0] and "*" not in y[0])
    stat(slide, MARGIN, CONTENT_TOP + Inches(3.0), Inches(4.0), Inches(2.1), f"{ahead} of {full}", "full calendar years ahead of the benchmark, gross of fees", size=36)
    worst = min(f.calendar_years(s), key=lambda y: y[3])
    stat(slide, MARGIN + Inches(4.35), CONTENT_TOP + Inches(3.0), Inches(4.0), Inches(2.1), f.pct(worst[1] - worst[3], sign=True) + "%", f"ahead in {worst[0]}, the benchmark's worst year, when it fell {f.pct(-worst[3])}%", size=36)
    text(slide, MARGIN + Inches(8.75), CONTENT_TOP + Inches(3.1), W - 2 * MARGIN - Inches(8.75), Inches(2), "Net returns deduct the highest standard fee, 0.70% a year. 2026 is to September 30.", size=13, color=b.SLATE)

    # 12: risk and growth
    slide = content(deck, "More of the rises, less of the falls", "Risk", 12, note)
    cells = [
        (f"{risk['up_capture']:.0f}%", "upside capture"),
        (f"{risk['down_capture']:.0f}%", "downside capture"),
        (f"{risk['tracking_error']:.1f}%", "tracking error"),
        (f"{risk['information_ratio']:.2f}", "information ratio"),
        (f"{risk['beta']:.2f}", "beta"),
        (f"{risk['volatility']:.1f}%", f"volatility; benchmark {risk['bench_volatility']:.1f}%"),
    ]
    for i, (figure, label) in enumerate(cells):
        row, col = divmod(i, 2)
        x = MARGIN + col * Inches(2.55)
        y = CONTENT_TOP + Inches(0.1) + row * Inches(1.6)
        box(slide, x, y, Inches(2.35), Inches(1.4), b.MINT, rounded=True)
        text(slide, x + Inches(0.22), y + Inches(0.18), Inches(2), Inches(0.6), figure, size=28, color=b.FOREST, head=True)
        text(slide, x + Inches(0.22), y + Inches(0.8), Inches(2), Inches(0.5), label, size=13)
    text(slide, Inches(6.0), CONTENT_TOP + Inches(0.05), Inches(6.7), Inches(0.4), "Growth of $10,000 since inception, net of fees", size=16, color=b.FOREST, head=True)
    points = f.growth(s)
    b.add_chart(slide.shapes, "line", Inches(5.85), CONTENT_TOP + Inches(0.45), W - MARGIN - Inches(5.85), Inches(4.45), [p[0] for p in points], [("Strategy, net", [round(p[1]) for p in points]), ("Benchmark", [round(p[2]) for p in points])], number_format="#,##0", colors=[b.FOREST, b.GRAY], font_size=11)
    text(slide, MARGIN, CONTENT_TOP + Inches(4.85), Inches(5), Inches(0.4), "Five years to September 30, 2026, monthly, gross of fees.", size=12, color=b.SLATE)

    # 13: contacts
    slide = content(deck, "Your Larchmere team", "Contacts", 13, note)
    w = (W - 2 * MARGIN - Inches(0.4)) / 2
    for i, (name, role, email) in enumerate(f.CONTACTS):
        x = MARGIN + i * (w + Inches(0.4))
        box(slide, x, CONTENT_TOP + Inches(0.3), w, Inches(2.4), "F4F8F5", rounded=True)
        text(slide, x + Inches(0.4), CONTENT_TOP + Inches(0.65), w - Inches(0.8), Inches(1.8), [[(name, {"size": 26, "head": True, "color": b.FOREST})], [(role, {"size": 16})], [(email, {"size": 15, "color": b.GREEN})]], spacing=8)
    text(slide, MARGIN, CONTENT_TOP + Inches(3.05), W - 2 * MARGIN, Inches(0.4), "Next steps", size=20, color=b.FOREST, head=True)
    steps = [
        ("Due diligence", "We answer your questionnaire, and send our composite's full record and the representative account's holdings."),
        ("Meet the team", "Elena Varga and Paula Ortiz take you through the portfolio, in Boston or wherever suits you."),
        ("Proposal", "A fee proposal and investment guidelines drafted to your mandate's size and constraints."),
    ]
    w = (W - 2 * MARGIN - 2 * Inches(0.4)) / 3
    for i, (head, body) in enumerate(steps):
        x = MARGIN + i * (w + Inches(0.4))
        numbered(slide, x, CONTENT_TOP + Inches(3.6), str(i + 1), d=Inches(0.45))
        text(slide, x + Inches(0.6), CONTENT_TOP + Inches(3.65), w - Inches(0.6), Inches(0.4), head, size=18, color=b.FOREST, head=True)
        text(slide, x + Inches(0.6), CONTENT_TOP + Inches(4.1), w - Inches(0.6), Inches(1.0), body, size=14)
    text(slide, MARGIN, H - Inches(0.85), W - 2 * MARGIN, Inches(0.3), f"{f.FIRM['name']}  ·  One Larch Square, Boston  ·  Offices in London and Singapore", size=12, color=b.SLATE)

    disclosures(deck, 14, note, [
        f"Larchmere Global Equity composite: all fee-paying, discretionary global equity accounts managed to the strategy, from {s.inception_text}. Holdings, sectors and characteristics are of a representative account, and will differ between accounts.",
    ])
    deck.save(path)


# ── The firm overview ─────────────────────────────────────────────────────────


def firm_overview(path: str) -> None:
    deck = _deck("Larchmere Investment Management: firm overview", f"Firm overview, data as of {f.AS_OF_TEXT}")
    note = f"Larchmere Investment Management  ·  Data as of {f.AS_OF_TEXT}  ·  Fictional, for demonstration"
    cover(deck, "Firm overview", "Larchmere Investment Management", "Independent, employee-owned, and patient with our clients' capital")

    slide = content(deck, "Larchmere at a glance", "The firm", 2, note)
    w = (W - 2 * MARGIN - 3 * Inches(0.3)) / 4
    stats = [
        (f"${f.FIRM['aum']}bn", "assets under management, for institutions alone"),
        (str(f.FIRM["clients"]), "institutional clients in 14 countries"),
        (str(f.FIRM["investment_professionals"]), f"investment professionals among {f.FIRM['employees']} people"),
        (str(f.AS_OF.year - f.FIRM["founded"]), f"years since our founding in {f.FIRM['founded']}"),
    ]
    for i, (figure, label) in enumerate(stats):
        stat(slide, MARGIN + i * (w + Inches(0.3)), CONTENT_TOP + Inches(0.1), w, Inches(2.3), figure, label)
    box(slide, MARGIN, Inches(4.35), W - 2 * MARGIN, Inches(2.2), "F4F8F5", rounded=True)
    text(slide, MARGIN + Inches(0.35), Inches(4.6), W - 2 * MARGIN - Inches(0.7), Inches(1.8), [
        [("Owned by the people who work here. ", {"bold": True, "color": b.FOREST}), ("The founding partners handed the firm to its employees in 2011. No outside shareholder sets our targets, so we can close a strategy to protect its returns, and say no to growth that would hurt them.", {})],
        [("Three offices, one research team. ", {"bold": True, "color": b.FOREST}), (", ".join(f.FIRM["offices"]) + ": every analyst covers a global sector, not a country.", {})],
    ], size=16, spacing=12)

    slide = content(deck, "Twenty-eight years of steady growth", "History", 3, note)
    line_y = Inches(4.1)
    box(slide, MARGIN, line_y - Inches(0.02), W - 2 * MARGIN, Inches(0.04), b.SAGE)
    step = (W - 2 * MARGIN - Inches(1.2)) / (len(f.HISTORY) - 1)
    for i, (year, event) in enumerate(f.HISTORY):
        x = MARGIN + Inches(0.6) + step * i
        dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, x - Inches(0.11), line_y - Inches(0.11), Inches(0.22), Inches(0.22))
        dot.fill.solid()
        dot.fill.fore_color.rgb = b.rgb(b.FOREST if i in (0, len(f.HISTORY) - 1) else b.GREEN)
        dot.line.color.rgb = b.rgb(b.WHITE)
        dot.shadow.inherit = False
        up = i % 2 == 0
        tw = Inches(2.3)
        ty = line_y - Inches(1.6) if up else line_y + Inches(0.3)
        text(slide, x - tw / 2, ty, tw, Inches(0.45), str(year), size=20, color=b.FOREST, head=True, align=PP_ALIGN.CENTER)
        text(slide, x - tw / 2, ty + Inches(0.45), tw, Inches(1.3), event, size=12, align=PP_ALIGN.CENTER)

    slide = content(deck, "Five strategies, one way of investing", "Strategies", 4, note)
    rows = [["Strategy", "Asset class", "Since", "Assets", "Benchmark"]]
    rows += [[name, asset_class, str(year), f"${aum:.1f}bn", bench] for name, asset_class, year, aum, bench in f.LINE_UP]
    rows.append(["Firm total", "", "", f"${f.FIRM['aum']:.1f}bn", ""])
    table(slide, MARGIN, CONTENT_TOP + Inches(0.1), [3.3, 2.0, 0.9, 1.3, 4.63], rows, size=14, row_height=Inches(0.55), aligns="llrrl", bold_first=True, highlight=lambda r: r == len(rows) - 1)
    text(slide, MARGIN, CONTENT_TOP + Inches(4.3), W - 2 * MARGIN, Inches(0.8), "Each strategy is run by its own portfolio managers, on research from one global team of sector analysts, with risk overseen independently of them.", size=15, color=b.SLATE)

    slide = content(deck, "Trusted by pensions, endowments and insurers", "Clients", 5, note)
    b.add_chart(slide.shapes, "bar", MARGIN, CONTENT_TOP, Inches(7.4), Inches(5.0), [c for c, _ in f.CLIENTS], [("Share of assets, %", [v for _, v in f.CLIENTS])], number_format='0"%"', legend=False, colors=[b.FOREST], font_size=13)
    facts = [("11 years", "the average client has been with us"), ("97%", "of assets retained each year over the last five"), ("14", "countries our clients are in")]
    for i, (figure, label) in enumerate(facts):
        y = CONTENT_TOP + Inches(0.1) + i * Inches(1.7)
        box(slide, Inches(8.5), y, W - MARGIN - Inches(8.5), Inches(1.5), b.MINT, rounded=True)
        text(slide, Inches(8.75), y + Inches(0.17), Inches(3.8), Inches(0.6), figure, size=30, color=b.FOREST, head=True)
        text(slide, Inches(8.75), y + Inches(0.85), Inches(3.8), Inches(0.5), label, size=14)

    slide = content(deck, "Owners, not renters, of the companies we hold", "Stewardship", 6, note)
    pillars = [
        ("2,940", "votes cast at 412 company meetings in 2025, each by the analyst who covers the company"),
        ("186", "engagements with company boards in 2025, on capital allocation, pay and climate risk"),
        ("100%", "of equity holdings carry a written stewardship case, reviewed each year"),
    ]
    w = (W - 2 * MARGIN - 2 * Inches(0.4)) / 3
    for i, (figure, body) in enumerate(pillars):
        x = MARGIN + i * (w + Inches(0.4))
        box(slide, x, CONTENT_TOP + Inches(0.2), w, Inches(4.4), "F4F8F5", rounded=True)
        text(slide, x + Inches(0.35), CONTENT_TOP + Inches(0.6), w - Inches(0.7), Inches(1), figure, size=48, color=b.FOREST, head=True)
        text(slide, x + Inches(0.35), CONTENT_TOP + Inches(1.75), w - Inches(0.7), Inches(2.6), body, size=17)

    disclosures(deck, 7, note, ["Assets under management include discretionary and advisory assets, at market value. Client figures count each institution once, whatever the number of its mandates."])
    deck.save(path)
