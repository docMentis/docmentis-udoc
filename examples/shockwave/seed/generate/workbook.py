"""Larchmere's performance and fees workbook: each strategy's monthly returns,
and what's worked out from them by formula (growth indices, trailing and
calendar-year returns, growth of 10,000), and a fee calculator.

openpyxl writes a formula with no value, and a reader that doesn't calculate
shows such a cell empty, so each formula's value is worked out here too and
written beside it, as Excel does when it saves; Excel calculates them again
on opening."""

from __future__ import annotations

import re
import zipfile
from datetime import date

from openpyxl import Workbook
from openpyxl.chart import LineChart, Reference
from openpyxl.chart.data_source import AxDataSource, NumData, NumRef, NumVal, StrData, StrRef, StrVal
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

import brand as b
import figures as f

PCT = "0.0%"
PCT2 = "0.00%"
TITLE = Font(name=b.HEAD_FONT, size=16, color=b.FOREST)
SUBTITLE = Font(name=b.BODY_FONT, size=10, color=b.SLATE)
HEAD = Font(name=b.BODY_FONT, size=10, bold=True, color=b.WHITE)
HEAD_FILL = PatternFill("solid", fgColor=b.FOREST)
MINT_FILL = PatternFill("solid", fgColor=b.MINT)
BOLD = Font(name=b.BODY_FONT, size=10, bold=True, color=b.INK)
BODY = Font(name=b.BODY_FONT, size=10, color=b.INK)
NOTE = Font(name=b.BODY_FONT, size=9, italic=True, color=b.SLATE)
SECTION = Font(name=b.HEAD_FONT, size=12, color=b.FOREST)
RULE = Border(bottom=Side(style="thin", color=b.RULE))


class Book:
    """A workbook whose formulas carry their values."""

    def __init__(self):
        self.wb = Workbook()
        self.wb.remove(self.wb.active)
        self.values: dict[tuple[str, str], float] = {}

    def sheet(self, title: str):
        ws = self.wb.create_sheet(title)
        ws.sheet_view.showGridLines = False
        return ws

    def formula(self, ws, ref: str, formula: str, value: float, number_format: str | None = None, font=BODY):
        ws[ref] = "=" + formula
        self.values[(ws.title, ref)] = value
        cell = ws[ref]
        cell.font = font
        if number_format:
            cell.number_format = number_format
        return cell

    def save(self, path: str) -> None:
        self.wb.calculation.fullCalcOnLoad = True
        self.wb.save(path)
        titles = [ws.title for ws in self.wb.worksheets]
        with zipfile.ZipFile(path) as source:
            entries = [(info, source.read(info.filename)) for info in source.infolist()]
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as target:
            for info, data in entries:
                match = re.fullmatch(r"xl/worksheets/sheet(\d+)\.xml", info.filename)
                if match:
                    title = titles[int(match.group(1)) - 1]
                    data = self._cache(title, data.decode("utf-8")).encode("utf-8")
                target.writestr(info, data)

    def _cache(self, title: str, xml: str) -> str:
        def fill(match: re.Match) -> str:
            ref = match.group(2)
            value = self.values.get((title, ref))
            if value is None:
                raise KeyError(f"no value for {title}!{ref}")
            return f"{match.group(1)}<v>{value!r}</v>"

        xml = re.sub(r'(<c r="([A-Z]+\d+)"[^>]*><f>[^<]*</f>)<v\s*/?>(?:</v>)?', fill, xml)
        return xml


def _header(ws, row: int, labels: list[str], first_col: int = 1) -> None:
    for i, label in enumerate(labels):
        cell = ws.cell(row=row, column=first_col + i, value=label)
        cell.font = HEAD
        cell.fill = HEAD_FILL
        cell.alignment = Alignment(horizontal="left" if i == 0 else "right", vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 30


def _title(ws, title: str, subtitle: str) -> None:
    ws["A1"] = title
    ws["A1"].font = TITLE
    ws["A2"] = subtitle
    ws["A2"].font = SUBTITLE
    ws.row_dimensions[1].height = 24


def workbook(path: str) -> None:
    book = Book()

    # ── Monthly returns, and each strategy's growth indices ──────────────────
    monthly = book.sheet("Monthly")
    _title(monthly, "Monthly returns", f"Each strategy's gross, net and benchmark return for each month, and the indices they compound to (100 at inception). Fictional, for demonstration.")
    first_month = min(s.months[0] for s in f.STRATEGIES)
    all_months = []
    year, month = first_month
    while (year, month) <= (f.AS_OF.year, f.AS_OF.month):
        all_months.append((year, month))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    top = 5  # first data row
    row_of = {m: top + i for i, m in enumerate(all_months)}
    monthly.cell(row=3, column=1, value="")
    labels = ["Month"]
    columns: dict[str, dict[str, int]] = {}
    col = 2
    for s in f.STRATEGIES:
        short = s.name.replace("Larchmere ", "")
        columns[s.key] = {}
        for kind in ("gross", "net", "bench", "gross index", "net index", "bench index"):
            columns[s.key][kind] = col
            labels.append(f"{short}: {kind.replace('bench', 'benchmark')}")
            col += 1
    _header(monthly, 4, labels)
    monthly.row_dimensions[4].height = 45
    monthly.column_dimensions["A"].width = 11
    for c in range(2, col):
        monthly.column_dimensions[get_column_letter(c)].width = 13
    for m, r in row_of.items():
        cell = monthly.cell(row=r, column=1, value=date(m[0], m[1], 1))
        cell.number_format = "mmm yyyy"
        cell.font = BODY
    index_of: dict[tuple[str, str], dict[tuple[int, int], float]] = {}
    for s in f.STRATEGIES:
        series = {"gross": s.gross, "net": s.net, "bench": s.bench}
        for kind, values in series.items():
            index_of[(s.key, kind)] = {}
            ret_col = columns[s.key][kind]
            idx_col = columns[s.key][f"{kind} index"]
            level = 100.0
            for i, m in enumerate(s.months):
                r = row_of[m]
                cell = monthly.cell(row=r, column=ret_col, value=round(values[i], 6))
                cell.number_format = PCT2
                cell.font = BODY
                level *= 1 + round(values[i], 6)
                ret = f"{get_column_letter(ret_col)}{r}"
                ref = f"{get_column_letter(idx_col)}{r}"
                previous = "100" if i == 0 else f"{get_column_letter(idx_col)}{r - 1}"
                book.formula(monthly, ref, f"{previous}*(1+{ret})", level, "0.00")
                index_of[(s.key, kind)][m] = level
    monthly.freeze_panes = "B5"

    def index_ref(s: f.Strategy, kind: str, m: tuple[int, int] | None) -> tuple[str, float]:
        """The index cell at the end of month `m`, or 100 before inception for None."""
        if m is None:
            return "100", 100.0
        r = row_of[m]
        return f"Monthly!{get_column_letter(columns[s.key][kind + ' index'])}{r}", index_of[(s.key, kind)][m]

    # ── Summary: trailing returns ────────────────────────────────────────────
    summary = book.sheet("Summary")
    book.wb.move_sheet("Summary", offset=-1)
    _title(summary, "Performance and fees", f"{f.FIRM['name']}  ·  Data as of {f.AS_OF_TEXT}  ·  Fictional, for demonstration")
    summary.column_dimensions["A"].width = 30
    for c in range(2, 9):
        summary.column_dimensions[get_column_letter(c)].width = 13
    row = 4
    periods = [(label, n) for label, n in f.PERIODS] + [("Since inception", None)]
    for s in f.STRATEGIES:
        summary.cell(row=row, column=1, value=s.name).font = SECTION
        summary.cell(row=row + 1, column=1, value=f"Benchmark: {s.benchmark}. Inception: {s.inception_text}.").font = NOTE
        _header(summary, row + 2, ["Returns to " + f.AS_OF_TEXT] + [label for label, _ in periods])
        last = s.months[-1]
        for k, (label, kind) in enumerate((("Gross", "gross"), ("Net", "net"), ("Benchmark", "bench"))):
            r = row + 3 + k
            summary.cell(row=r, column=1, value=label).font = BOLD if kind != "bench" else BODY
            for c, (period, n) in enumerate(periods, start=2):
                ref = f"{get_column_letter(c)}{r}"
                if n is not None and n > len(s.months):
                    summary[ref] = "n/a"
                    summary[ref].alignment = Alignment(horizontal="right")
                    summary[ref].font = BODY
                    continue
                count = len(s.months) if n is None else n
                start = None if count == len(s.months) else s.months[-count - 1]
                end_ref, end_value = index_ref(s, kind, last)
                start_ref, start_value = index_ref(s, kind, start)
                ratio = end_value / start_value
                if count < 12:
                    book.formula(summary, ref, f"{end_ref}/{start_ref}-1", ratio - 1, PCT)
                else:
                    book.formula(summary, ref, f"({end_ref}/{start_ref})^(12/{count})-1", ratio ** (12 / count) - 1, PCT)
        r = row + 6
        summary.cell(row=r, column=1, value="Excess, gross").font = BOLD
        for c, (period, n) in enumerate(periods, start=2):
            letter = get_column_letter(c)
            gross = book.values.get(("Summary", f"{letter}{row + 3}"))
            bench = book.values.get(("Summary", f"{letter}{row + 5}"))
            if gross is None:
                summary[f"{letter}{r}"] = "n/a"
                summary[f"{letter}{r}"].alignment = Alignment(horizontal="right")
                continue
            book.formula(summary, f"{letter}{r}", f"{letter}{row + 3}-{letter}{row + 5}", gross - bench, '+0.0%;−0.0%;0.0%', font=BOLD)
        for rr in range(row + 3, row + 7):
            for c in range(1, len(periods) + 2):
                summary.cell(row=rr, column=c).border = RULE
        row += 9
    summary.cell(row=row, column=1, value="Periods over a year are annualized. Net returns deduct each strategy's highest standard fee, monthly. Every figure is calculated from the Monthly sheet.").font = NOTE
    summary.cell(row=row + 1, column=1, value=f.DISCLAIMER).font = NOTE

    # ── Calendar years ───────────────────────────────────────────────────────
    years_ws = book.sheet("Calendar years")
    _title(years_ws, "Calendar-year returns", f"Each year from the indices on the Monthly sheet; the first year from inception, {f.AS_OF.year} to {f.AS_OF_TEXT}.")
    years_ws.column_dimensions["A"].width = 12
    col = 2
    _header(years_ws, 4, ["Year"])
    year_rows = {y: 5 + i for i, y in enumerate(range(f.AS_OF.year, first_month[0] - 1, -1))}
    for y, r in year_rows.items():
        cell = years_ws.cell(row=r, column=1, value=f"{y} YTD" if y == f.AS_OF.year else str(y))
        cell.font = BOLD
    for s in f.STRATEGIES:
        short = s.name.replace("Larchmere ", "")
        heads = [f"{short}: gross", f"{short}: net", f"{short}: benchmark", f"{short}: excess"]
        for i, label in enumerate(heads):
            cell = years_ws.cell(row=4, column=col + i, value=label)
            cell.font = HEAD
            cell.fill = HEAD_FILL
            cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
            years_ws.column_dimensions[get_column_letter(col + i)].width = 14
        years = sorted({y for y, _ in s.months})
        for y in years:
            r = year_rows[y]
            ends = [m for m in s.months if m[0] == y]
            before = [m for m in s.months if m[0] < y]
            values = {}
            for i, kind in enumerate(("gross", "net", "bench")):
                end_ref, end_value = index_ref(s, kind, ends[-1])
                start_ref, start_value = index_ref(s, kind, before[-1] if before else None)
                values[kind] = end_value / start_value - 1
                book.formula(years_ws, f"{get_column_letter(col + i)}{r}", f"{end_ref}/{start_ref}-1", values[kind], PCT)
            g, bm = get_column_letter(col), get_column_letter(col + 2)
            book.formula(years_ws, f"{get_column_letter(col + 3)}{r}", f"{g}{r}-{bm}{r}", values["gross"] - values["bench"], '+0.0%;−0.0%;0.0%', font=BOLD)
        col += 4
    years_ws.row_dimensions[4].height = 45
    for r in year_rows.values():
        for c in range(1, col):
            years_ws.cell(row=r, column=c).border = RULE
    years_ws.freeze_panes = "B5"

    # ── Growth of 10,000 ─────────────────────────────────────────────────────
    growth = book.sheet("Growth")
    s = f.GLOBAL_EQUITY
    _title(growth, "Growth of $10,000: Global Equity", "Net of fees, against the benchmark, at each year's end, from the Monthly sheet.")
    _header(growth, 4, ["Year end", "Strategy, net", "Benchmark"])
    growth.column_dimensions["A"].width = 12
    growth.column_dimensions["B"].width = 15
    growth.column_dimensions["C"].width = 15
    points = [m for m in s.months if m[1] == 12] + [s.months[-1]]
    r = 5
    growth.cell(row=r, column=1, value=date(*s.inception, 1).strftime("%b %Y")).font = BODY
    for c in (2, 3):
        cell = growth.cell(row=r, column=c, value=10000)
        cell.number_format = "#,##0"
        cell.font = BODY
    for m in points:
        r += 1
        growth.cell(row=r, column=1, value=str(m[0]) if m[1] == 12 else date(m[0], m[1], 1).strftime("%b %Y")).font = BODY
        for c, kind in ((2, "net"), (3, "bench")):
            ref, value = index_ref(s, kind, m)
            book.formula(growth, f"{get_column_letter(c)}{r}", f"10000*{ref}/100", 10000 * value / 100, "#,##0")
    chart = LineChart()
    chart.height, chart.width = 9, 17
    chart.legend.position = "t"
    chart.y_axis.numFmt = "#,##0"
    chart.y_axis.majorGridlines.spPr = None
    chart.add_data(Reference(growth, min_col=2, min_row=4, max_col=3, max_row=r), titles_from_data=True)
    # The categories are text, and each series carries what it plots, as Excel
    # writes them, for a reader that draws a chart from its own data.
    labels = [growth.cell(row=i, column=1).value for i in range(5, r + 1)]
    for c, series in zip((2, 3), chart.series):
        values = [10000.0] + [book.values[("Growth", f"{get_column_letter(c)}{i}")] for i in range(6, r + 1)]
        series.cat = AxDataSource(strRef=StrRef(f=f"'Growth'!$A$5:$A${r}", strCache=StrData(ptCount=len(labels), pt=[StrVal(idx=i, v=v) for i, v in enumerate(labels)])))
        series.val.numRef = NumRef(f=series.val.numRef.f, numCache=NumData(formatCode="#,##0", ptCount=len(values), pt=[NumVal(idx=i, v=round(v, 2)) for i, v in enumerate(values)]))
    for series, color in zip(chart.series, (b.FOREST, b.GRAY)):
        series.graphicalProperties.line.solidFill = color
        series.graphicalProperties.line.width = 28575
        series.smooth = False
    growth.add_chart(chart, "E4")

    # ── Fees ─────────────────────────────────────────────────────────────────
    fees = book.sheet("Fees")
    _title(fees, "Fee calculator", "Separate accounts' standard fee schedules, and the fee on a mandate of the size entered below.")
    fees.column_dimensions["A"].width = 30
    for c in range(2, 8):
        fees.column_dimensions[get_column_letter(c)].width = 15
    fees["A4"] = "Mandate size ($ million)"
    fees["A4"].font = BOLD
    mandate = 250
    fees["B4"] = mandate
    fees["B4"].number_format = "#,##0"
    fees["B4"].fill = MINT_FILL
    fees["B4"].font = BOLD
    fees["C4"] = "← change this"
    fees["C4"].font = NOTE
    check = DataValidation(type="decimal", operator="greaterThan", formula1="0", showErrorMessage=True, error="Enter the mandate's size in $ million.")
    fees.add_data_validation(check)
    check.add("B4")
    row = 6
    for s in f.STRATEGIES:
        fees.cell(row=row, column=1, value=s.name).font = SECTION
        _header(fees, row + 1, ["Tier", "From ($m)", "Size ($m)", "Rate", "In tier ($m)", "Fee ($m)"])
        start = 0
        first = row + 2
        for i, (size, rate) in enumerate(s.fee_tiers):
            r = row + 2 + i
            fees.cell(row=r, column=1, value=("First" if i == 0 else "Next") + f" ${size}m" if size else f"Above ${start}m").font = BODY
            fees.cell(row=r, column=2, value=start).number_format = "#,##0"
            size_cell = fees.cell(row=r, column=3, value=size if size else "rest")
            size_cell.alignment = Alignment(horizontal="right")
            fees.cell(row=r, column=4, value=rate / 100).number_format = PCT2
            in_tier = max(0, min(mandate - start, size if size else mandate))
            if size:
                book.formula(fees, f"E{r}", f"MAX(0,MIN($B$4-B{r},C{r}))", in_tier, "#,##0.0")
            else:
                book.formula(fees, f"E{r}", f"MAX(0,$B$4-B{r})", max(0, mandate - start), "#,##0.0")
            book.formula(fees, f"F{r}", f"E{r}*D{r}", (in_tier if size else max(0, mandate - start)) * rate / 100, "#,##0.000")
            for c in range(1, 7):
                fees.cell(row=r, column=c).border = RULE
                if c > 1 and fees.cell(row=r, column=c).font != BOLD:
                    fees.cell(row=r, column=c).font = BODY
            start += size or 0
        last = row + 1 + len(s.fee_tiers)
        total = f.fee_for(s, mandate)
        r = last + 1
        fees.cell(row=r, column=1, value="Annual fee ($m)").font = BOLD
        book.formula(fees, f"F{r}", f"SUM(F{first}:F{last})", total, "#,##0.000", font=BOLD)
        fees.cell(row=r + 1, column=1, value="Effective rate").font = BOLD
        book.formula(fees, f"F{r + 1}", f"F{r}/$B$4", total / mandate, "0.000%", font=BOLD)
        fees.cell(row=r + 1, column=6).fill = MINT_FILL
        fees.cell(row=r + 2, column=1, value=f"Minimum account ${s.minimum} million.").font = NOTE
        row = r + 4
    fees.cell(row=row, column=1, value=f.DISCLAIMER).font = NOTE

    props = book.wb.properties
    props.title = f"Performance and fees, {f.QUARTER}"
    props.creator = f.FIRM["name"]
    props.keywords = "fictional; docMentis demonstration"
    book.save(path)
