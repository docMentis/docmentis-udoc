"""Larchmere's look, shared by every file: its colors, its fonts, its logo, and
its charts, which the decks hold as they are and the documents borrow."""

from __future__ import annotations

import io

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_LEGEND_POSITION, XL_MARKER_STYLE
from pptx.oxml import parse_xml
from pptx.util import Emu, Pt

# Forest and sage, the logo's, lead; mint is their tint, and amber the one accent.
FOREST = "1F4E3D"
FOREST_DARK = "163A2D"
GREEN = "4E8A6D"
SAGE = "B5DCC2"
MINT = "E8F4EC"
AMBER = "C8892E"
SLATE = "5B6770"
GRAY = "9AA5AE"
INK = "1B1F1D"
RULE = "D5DDD8"
WHITE = "FFFFFF"

HEAD_FONT = "Cambria"
BODY_FONT = "Calibri"

# Strategy gross, strategy net, benchmark.
SERIES = [FOREST, GREEN, GRAY]

LOGO_PNG: bytes | None = None  # set by main.py, from the SVG the app keeps


def rgb(hex_color: str) -> RGBColor:
    return RGBColor.from_string(hex_color)


# ── Charts ────────────────────────────────────────────────────────────────────


def add_chart(shapes, kind: str, x, y, w, h, categories, series, *, number_format="0.0", labels=True, legend=True, colors=None, font_size=11, axis_max=None, axis_min=None):
    """A chart on `shapes`, in Larchmere's style: `kind` is "bar" (horizontal),
    "column", "line" or "doughnut"; `series` a list of (name, values)."""
    data = CategoryChartData(number_format=number_format)
    data.categories = categories
    for name, values in series:
        data.add_series(name, values)
    chart_type = {
        "bar": XL_CHART_TYPE.BAR_CLUSTERED,
        "column": XL_CHART_TYPE.COLUMN_CLUSTERED,
        "line": XL_CHART_TYPE.LINE,
        "doughnut": XL_CHART_TYPE.DOUGHNUT,
    }[kind]
    chart = shapes.add_chart(chart_type, x, y, w, h, data).chart
    colors = colors or SERIES
    chart.font.name = BODY_FONT
    chart.font.size = Pt(font_size)
    chart.font.color.rgb = rgb(SLATE)
    chart.has_title = False
    # No frame round the chart: the page around it is its frame.
    space = chart._chartSpace
    ns = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
    for old in space.xpath("c:roundedCorners"):
        space.remove(old)
    space.insert(0 if space.find("{http://schemas.openxmlformats.org/drawingml/2006/chart}date1904") is None else 1, parse_xml(f'<c:roundedCorners {ns} val="0"/>'))
    inner = space.xpath("c:chart")[0]
    inner.addnext(parse_xml(f'<c:spPr {ns}><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>'))
    chart.has_legend = legend
    if legend:
        chart.legend.position = XL_LEGEND_POSITION.RIGHT if kind == "doughnut" else XL_LEGEND_POSITION.TOP
        chart.legend.include_in_layout = False
        chart.legend.font.size = Pt(font_size)
    plot = chart.plots[0]
    if kind == "doughnut":
        for point, color in zip(plot.series[0].points, colors):
            point.format.fill.solid()
            point.format.fill.fore_color.rgb = rgb(color)
            point.format.line.color.rgb = rgb(WHITE)
        hole = chart._chartSpace.xpath(".//c:holeSize")
        if hole:
            hole[0].set("val", "58")
        if labels:
            plot.has_data_labels = True
            plot.data_labels.show_value = True
            plot.data_labels.number_format = '0"%"'
            plot.data_labels.number_format_is_linked = False
            plot.data_labels.font.size = Pt(font_size)
            plot.data_labels.font.color.rgb = rgb(WHITE)
            plot.data_labels.font.bold = True
        return chart
    for s, color in zip(plot.series, colors):
        if kind == "line":
            s.format.line.color.rgb = rgb(color)
            s.format.line.width = Pt(2.5)
            s.smooth = False
            s.marker.style = XL_MARKER_STYLE.NONE
        else:
            s.format.fill.solid()
            s.format.fill.fore_color.rgb = rgb(color)
    if kind in ("bar", "column"):
        plot.gap_width = 60
        plot.overlap = -8
        if labels:
            plot.has_data_labels = True
            labels_ = plot.data_labels
            labels_.show_value = True
            labels_.number_format = number_format
            labels_.number_format_is_linked = False
            labels_.position = XL_LABEL_POSITION.OUTSIDE_END
            labels_.font.size = Pt(font_size - 1)
            labels_.font.color.rgb = rgb(INK)
    value_axis = chart.value_axis
    value_axis.has_major_gridlines = True
    value_axis.major_gridlines.format.line.color.rgb = rgb(RULE)
    value_axis.major_gridlines.format.line.width = Pt(0.75)
    value_axis.format.line.fill.background()
    value_axis.tick_labels.font.size = Pt(font_size - 1)
    value_axis.tick_labels.number_format = number_format.replace("0.0", "0") if kind != "line" else '#,##0'
    value_axis.tick_labels.number_format_is_linked = False
    if axis_max is not None:
        value_axis.maximum_scale = axis_max
    if axis_min is not None:
        value_axis.minimum_scale = axis_min
    category_axis = chart.category_axis
    category_axis.format.line.color.rgb = rgb(GRAY)
    category_axis.tick_labels.font.size = Pt(font_size - 1)
    category_axis.has_major_gridlines = False
    if kind == "bar":
        # Top to bottom in the order given.
        category_axis.reverse_order = True
    return chart


def chart_parts(kind: str, w_emu: int, h_emu: int, categories, series, **options) -> tuple[bytes, bytes]:
    """A chart as the documents take it: its chart part's XML, and the workbook
    holding its data, drawn the way the decks draw theirs."""
    deck = Presentation()
    slide = deck.slides.add_slide(deck.slide_layouts[6])
    chart = add_chart(slide.shapes, kind, Emu(0), Emu(0), Emu(w_emu), Emu(h_emu), categories, series, **options)
    workbook = chart.part.chart_workbook.xlsx_part.blob
    return chart.part.blob, workbook


def logo_stream() -> io.BytesIO:
    assert LOGO_PNG is not None, "main.py sets the logo"
    return io.BytesIO(LOGO_PNG)
