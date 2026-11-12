"""Larchmere's figures: one made-up source for every file the generator writes.

Larchmere Investment Management is fictional, and so is everything here: its
strategies, people, indices, holdings and returns. The returns are monthly
series drawn from a seeded generator, shaped so that each calendar year comes
to the figure given below, so that every number a file quotes (trailing
returns, calendar years, growth of 10,000, risk) is worked out from the same
months, and agrees with every other file's.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import date

AS_OF = date(2026, 9, 30)
AS_OF_TEXT = "September 30, 2026"
QUARTER = "Q3 2026"

FIRM = {
    "name": "Larchmere Investment Management",
    "short": "Larchmere",
    "founded": 1998,
    "aum": 48.6,  # $ billion
    "employees": 310,
    "investment_professionals": 74,
    "clients": 212,
    "offices": ["Boston", "London", "Singapore"],
    "ownership": "Employee-owned since 2011",
}

DISCLAIMER = (
    "Larchmere Investment Management is a fictional company. Everything in this "
    "document, its strategies, people, indices, holdings and figures, is made up to "
    "demonstrate docMentis, and none of it describes a real investment, index or "
    "company. Nothing here is investment advice or an offer of any security."
)

PAST_PERFORMANCE = (
    "Past performance does not guarantee future results. Returns are in US dollars. "
    "Gross returns are before management fees and after trading costs; net returns "
    "deduct the strategy's highest standard management fee, applied monthly. Returns "
    "for periods over one year are annualized."
)

INDEX_NOTE = (
    "The Merrow indices are fictional benchmarks, made up for this demonstration "
    "like the rest of the document."
)


@dataclass
class Person:
    name: str
    title: str
    years: int  # in the industry
    at_firm: int  # at Larchmere
    focus: str


@dataclass
class Holding:
    name: str
    sector: str
    country: str
    weight: float  # %


@dataclass
class Strategy:
    key: str
    name: str
    asset_class: str
    benchmark: str
    inception: tuple[int, int]  # year, first month
    aum: float  # $ billion
    vehicle: str
    objective: str
    fee_tiers: list[tuple[float | None, float]]  # ($m in the tier, or None for the rest; fee %)
    minimum: int  # $m
    bench_years: dict[int, float]  # calendar-year %, partial for the first and the last
    excess_years: dict[int, float]  # gross excess over the benchmark, %
    vol: float  # monthly
    te: float  # monthly
    seed: int
    characteristics: list[tuple[str, str, str]] = field(default_factory=list)
    sectors: list[tuple[str, float, float]] = field(default_factory=list)
    regions: list[tuple[str, float, float]] = field(default_factory=list)
    quality: list[tuple[str, float, float]] = field(default_factory=list)
    holdings: list[Holding] = field(default_factory=list)
    team: list[Person] = field(default_factory=list)
    approach: list[tuple[str, str]] = field(default_factory=list)
    # Filled in by `_build`.
    months: list[tuple[int, int]] = field(default_factory=list)
    bench: list[float] = field(default_factory=list)
    gross: list[float] = field(default_factory=list)
    net: list[float] = field(default_factory=list)

    @property
    def model_fee(self) -> float:
        return self.fee_tiers[0][1]

    @property
    def inception_text(self) -> str:
        year, month = self.inception
        return date(year, month, 1).strftime("%B 1, %Y")


def _fit(base: list[float], noise: list[float], target: float) -> list[float]:
    """`base` plus `noise` plus the one constant that compounds them to `target`."""
    lo, hi = -0.5, 0.5
    for _ in range(200):
        mid = (lo + hi) / 2
        value = math.prod(1 + b + n + mid for b, n in zip(base, noise)) - 1
        if value < target:
            lo = mid
        else:
            hi = mid
    c = (lo + hi) / 2
    return [b + n + c for b, n in zip(base, noise)]


def _build(strategy: Strategy) -> Strategy:
    rng = random.Random(strategy.seed)
    year, month = strategy.inception
    while (year, month) <= (AS_OF.year, AS_OF.month):
        strategy.months.append((year, month))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    for year in sorted(strategy.bench_years):
        idx = [i for i, (y, _) in enumerate(strategy.months) if y == year]
        bench = _fit([0.0] * len(idx), [rng.gauss(0, strategy.vol) for _ in idx], strategy.bench_years[year] / 100)
        target = (strategy.bench_years[year] + strategy.excess_years[year]) / 100
        gross = _fit(bench, [rng.gauss(0, strategy.te) for _ in idx], target)
        strategy.bench += bench
        strategy.gross += gross
    assert len(strategy.bench) == len(strategy.months), strategy.key
    strategy.net = [g - strategy.model_fee / 100 / 12 for g in strategy.gross]
    return strategy


# ── Returns, worked out ────────────────────────────────────────────────────────


def compound(returns: list[float]) -> float:
    return math.prod(1 + r for r in returns) - 1


def annualized(returns: list[float]) -> float:
    """Annualized over a year or more; cumulative under one."""
    total = compound(returns)
    return total if len(returns) < 12 else (1 + total) ** (12 / len(returns)) - 1


PERIODS = [("3 months", 3), ("Year to date", AS_OF.month), ("1 year", 12), ("3 years", 36), ("5 years", 60), ("10 years", 120)]


def trailing(strategy: Strategy) -> list[tuple[str, float | None, float | None, float | None]]:
    """(period, gross, net, benchmark) in %, None where the strategy's too young, and since inception."""
    rows = []
    for label, n in PERIODS:
        if n > len(strategy.months):
            rows.append((label, None, None, None))
            continue
        rows.append(
            (
                label,
                annualized(strategy.gross[-n:]) * 100,
                annualized(strategy.net[-n:]) * 100,
                annualized(strategy.bench[-n:]) * 100,
            )
        )
    rows.append(
        (
            "Since inception",
            annualized(strategy.gross) * 100,
            annualized(strategy.net) * 100,
            annualized(strategy.bench) * 100,
        )
    )
    return rows


def calendar_years(strategy: Strategy) -> list[tuple[str, float, float, float]]:
    """(year, gross, net, benchmark) in %, newest first; the first year partial, the last to date."""
    rows = []
    for year in sorted({y for y, _ in strategy.months}, reverse=True):
        idx = [i for i, (y, _) in enumerate(strategy.months) if y == year]
        label = f"{year} YTD" if year == AS_OF.year else (f"{year}*" if idx[0] == 0 and strategy.inception[1] != 1 else str(year))
        rows.append(
            (
                label,
                compound([strategy.gross[i] for i in idx]) * 100,
                compound([strategy.net[i] for i in idx]) * 100,
                compound([strategy.bench[i] for i in idx]) * 100,
            )
        )
    return rows


def growth(strategy: Strategy, start: float = 10_000) -> list[tuple[str, float, float]]:
    """Growth of `start`, net, against the benchmark: at inception, then at each
    year's end, labelled by the year, and at the last month."""
    year, month = strategy.inception
    points = [(date(year, month, 1).strftime("%b %Y"), start, start)]
    net = bench = start
    for i, (year, month) in enumerate(strategy.months):
        net *= 1 + strategy.net[i]
        bench *= 1 + strategy.bench[i]
        if month == 12 or i == len(strategy.months) - 1:
            label = str(year) if month == 12 else date(year, month, 1).strftime("%b %Y")
            points.append((label, net, bench))
    return points


def _stdev(values: list[float]) -> float:
    mean = sum(values) / len(values)
    return math.sqrt(sum((v - mean) ** 2 for v in values) / (len(values) - 1))


def risk(strategy: Strategy) -> dict[str, float]:
    """Over the last five years, or since inception for a younger strategy: annualized, gross."""
    n = min(60, len(strategy.months))
    s, b = strategy.gross[-n:], strategy.bench[-n:]
    diff = [x - y for x, y in zip(s, b)]
    mean_s, mean_b = sum(s) / n, sum(b) / n
    cov = sum((x - mean_s) * (y - mean_b) for x, y in zip(s, b)) / (n - 1)
    var = sum((y - mean_b) ** 2 for y in b) / (n - 1)
    te = _stdev(diff) * math.sqrt(12)
    excess = annualized(s) - annualized(b)
    up = [i for i in range(n) if b[i] > 0]
    down = [i for i in range(n) if b[i] <= 0]

    def capture(idx: list[int]) -> float:
        return annualized([s[i] for i in idx]) / annualized([b[i] for i in idx]) * 100 if idx else 0.0

    return {
        "months": n,
        "volatility": _stdev(s) * math.sqrt(12) * 100,
        "bench_volatility": _stdev(b) * math.sqrt(12) * 100,
        "tracking_error": te * 100,
        "information_ratio": excess / te,
        "beta": cov / var,
        "up_capture": capture(up),
        "down_capture": capture(down),
        "excess": excess * 100,
    }


def fee_for(strategy: Strategy, mandate: float) -> float:
    """The annual fee, $m, on a mandate of `mandate` $m."""
    fee, left = 0.0, mandate
    for size, rate in strategy.fee_tiers:
        part = left if size is None else min(left, size)
        fee += part * rate / 100
        left -= part
        if left <= 0:
            break
    return fee


def pct(value: float | None, places: int = 1, sign: bool = False) -> str:
    if value is None:
        return "—"
    if round(value, places) == 0:
        value = 0.0  # never "−0.0"
    text = f"{value:+.{places}f}" if sign else f"{value:.{places}f}"
    return text.replace("-", "−")


# ── The strategies ─────────────────────────────────────────────────────────────

GLOBAL_EQUITY = _build(
    Strategy(
        key="global-equity",
        name="Larchmere Global Equity",
        asset_class="Global equity",
        benchmark="Merrow World Equity Index",
        inception=(2012, 7),
        aum=14.2,
        vehicle="Separate account; commingled fund",
        objective=(
            "Long-term growth of capital, outperforming the Merrow World Equity Index by 2% a "
            "year, gross of fees, over a market cycle, from a concentrated portfolio of "
            "high-quality companies bought at sensible prices."
        ),
        fee_tiers=[(50, 0.70), (50, 0.60), (150, 0.50), (None, 0.45)],
        minimum=50,
        bench_years={
            2012: 9.4, 2013: 21.8, 2014: 4.6, 2015: -2.1, 2016: 8.2, 2017: 23.6, 2018: -9.0,
            2019: 26.1, 2020: 15.8, 2021: 19.2, 2022: -17.6, 2023: 21.9, 2024: 17.0, 2025: 16.4, 2026: 11.8,
        },
        excess_years={
            2012: 1.6, 2013: 2.4, 2014: 1.1, 2015: 2.8, 2016: -0.9, 2017: 3.1, 2018: 1.9,
            2019: 2.2, 2020: 3.6, 2021: -1.4, 2022: 2.7, 2023: 1.5, 2024: -0.6, 2025: 2.0, 2026: 1.3,
        },
        vol=0.040,
        te=0.0085,
        seed=1998,
        characteristics=[
            ("Number of holdings", "52", "1,512"),
            ("Active share", "86%", "—"),
            ("Weighted average market cap", "$212bn", "$318bn"),
            ("Price / earnings (next 12 months)", "18.4x", "17.9x"),
            ("Return on equity", "21.3%", "16.8%"),
            ("Net debt / equity", "31%", "48%"),
            ("Dividend yield", "1.6%", "1.9%"),
            ("Turnover (trailing 12 months)", "24%", "—"),
        ],
        sectors=[
            ("Information technology", 24.8, 25.9),
            ("Financials", 15.2, 16.4),
            ("Health care", 13.9, 10.2),
            ("Industrials", 13.1, 10.9),
            ("Consumer discretionary", 9.4, 10.6),
            ("Communication services", 7.2, 8.1),
            ("Consumer staples", 6.1, 6.0),
            ("Materials", 4.3, 3.7),
            ("Energy", 2.1, 3.6),
            ("Utilities", 1.6, 2.6),
            ("Real estate", 0.0, 2.0),
            ("Cash", 2.3, 0.0),
        ],
        regions=[
            ("North America", 57.6, 66.2),
            ("Europe ex UK", 16.9, 12.4),
            ("United Kingdom", 6.2, 3.5),
            ("Japan", 7.1, 5.3),
            ("Asia Pacific ex Japan", 5.4, 5.8),
            ("Emerging markets", 4.5, 6.8),
            ("Cash", 2.3, 0.0),
        ],
        holdings=[
            Holding("Halvern Semiconductor", "Information technology", "United States", 4.1),
            Holding("Orris Health Systems", "Health care", "United States", 3.6),
            Holding("Brightwell Payments", "Financials", "United States", 3.3),
            Holding("Kaltmann Industrie", "Industrials", "Germany", 3.1),
            Holding("Seravin Software", "Information technology", "United States", 2.9),
            Holding("Tokushima Precision", "Industrials", "Japan", 2.7),
            Holding("Aldine Pharmaceuticals", "Health care", "United Kingdom", 2.6),
            Holding("Penhallow Insurance", "Financials", "United Kingdom", 2.4),
            Holding("Corvane Brands", "Consumer staples", "Switzerland", 2.3),
            Holding("Velora Networks", "Communication services", "Canada", 2.2),
        ],
        team=[
            Person("Elena Varga, CFA", "Lead Portfolio Manager", 24, 14, "Leads the strategy; final say on the portfolio"),
            Person("Marcus Hale", "Portfolio Manager", 19, 11, "Portfolio construction and risk"),
            Person("Priya Raman, CFA", "Portfolio Manager, Head of Research", 16, 9, "Leads the 11 sector analysts"),
            Person("Tomás Lindqvist", "Senior Analyst", 12, 6, "Industrials and materials"),
            Person("Paula Ortiz", "Client Portfolio Manager", 15, 7, "The strategy's voice to clients and consultants"),
        ],
        approach=[
            ("Quality first", "Companies that earn high returns on capital and can keep reinvesting at them, with strong balance sheets and management we trust."),
            ("A sensible price", "Every holding has a written valuation case and a price at which we would sell it. We pay for quality, not for hope."),
            ("Patience", "A five-year horizon and turnover near 25% a year: we let compounding do the work, and engage as owners."),
        ],
    )
)

CORE_PLUS = _build(
    Strategy(
        key="core-plus-fixed-income",
        name="Larchmere Core Plus Fixed Income",
        asset_class="US fixed income",
        benchmark="Merrow US Aggregate Bond Index",
        inception=(2005, 1),
        aum=19.8,
        vehicle="Separate account; commingled fund",
        objective=(
            "Total return ahead of the Merrow US Aggregate Bond Index by 1% a year, gross of "
            "fees, over a market cycle, with risk close to the index's, from investment-grade "
            "bonds and measured allocations to high yield, securitized and emerging markets debt."
        ),
        fee_tiers=[(100, 0.35), (100, 0.30), (300, 0.25), (None, 0.22)],
        minimum=75,
        bench_years={
            2005: 2.6, 2006: 4.4, 2007: 6.8, 2008: 4.9, 2009: 6.1, 2010: 6.4, 2011: 7.6, 2012: 4.3,
            2013: -2.1, 2014: 6.1, 2015: 0.4, 2016: 2.7, 2017: 3.6, 2018: 0.1, 2019: 8.6, 2020: 7.4,
            2021: -1.6, 2022: -12.9, 2023: 5.6, 2024: 1.4, 2025: 7.0, 2026: 5.1,
        },
        excess_years={
            2005: 0.6, 2006: 0.5, 2007: -0.3, 2008: -3.1, 2009: 5.2, 2010: 1.6, 2011: 0.2, 2012: 2.4,
            2013: 0.9, 2014: 0.3, 2015: -0.4, 2016: 1.3, 2017: 0.9, 2018: -0.5, 2019: 1.1, 2020: 1.4,
            2021: 0.8, 2022: -0.6, 2023: 1.0, 2024: 1.2, 2025: 0.7, 2026: 0.6,
        },
        vol=0.011,
        te=0.0032,
        seed=2005,
        characteristics=[
            ("Number of issues", "612", "13,418"),
            ("Effective duration", "6.2 years", "6.0 years"),
            ("Yield to worst", "5.4%", "4.6%"),
            ("Average credit quality", "A+", "AA"),
            ("Option-adjusted spread", "118 bp", "41 bp"),
            ("Turnover (trailing 12 months)", "142%", "—"),
        ],
        sectors=[
            ("US Treasuries", 22.4, 43.6),
            ("Agency mortgage-backed", 24.1, 25.9),
            ("Investment-grade corporates", 28.6, 24.6),
            ("Government-related", 1.2, 3.5),
            ("Securitized, non-agency", 11.1, 2.4),
            ("High yield", 6.2, 0.0),
            ("Emerging markets debt", 3.5, 0.0),
            ("Cash", 2.9, 0.0),
        ],
        quality=[
            ("AAA", 41.5, 71.8),
            ("AA", 4.2, 3.1),
            ("A", 15.8, 11.2),
            ("BBB", 26.4, 13.9),
            ("BB", 7.1, 0.0),
            ("B and below", 2.1, 0.0),
            ("Cash", 2.9, 0.0),
        ],
        team=[
            Person("Daniel Okoro, CFA", "Lead Portfolio Manager", 22, 16, "Leads the strategy and its duration calls"),
            Person("Hannah Sorensen", "Portfolio Manager, Credit", 17, 8, "Corporate and high-yield credit"),
            Person("Wei Lin", "Portfolio Manager, Securitized", 14, 6, "Mortgage and asset-backed securities"),
        ],
        approach=[
            ("Core first", "Most of the portfolio is high-quality bonds that behave like the index when markets fall."),
            ("Plus, measured", "High yield, securitized and emerging markets debt, each within limits, and only where we're paid for the risk."),
            ("Duration near the index", "We add value from the bonds we own, not from bets on the direction of interest rates."),
        ],
    )
)

INFRASTRUCTURE = _build(
    Strategy(
        key="global-infrastructure",
        name="Larchmere Global Listed Infrastructure",
        asset_class="Global equity, infrastructure",
        benchmark="Merrow Core Infrastructure Index",
        inception=(2022, 4),
        aum=3.1,
        vehicle="Separate account; commingled fund",
        objective=(
            "Inflation-aware income and growth from listed owners of essential assets, such as "
            "power networks, toll roads, airports and communications towers, outperforming the "
            "Merrow Core Infrastructure Index over a market cycle."
        ),
        fee_tiers=[(50, 0.75), (50, 0.65), (150, 0.55), (None, 0.50)],
        minimum=50,
        bench_years={2022: -8.4, 2023: 4.2, 2024: 11.6, 2025: 14.9, 2026: 9.3},
        excess_years={2022: 1.9, 2023: 1.2, 2024: 0.8, 2025: 1.7, 2026: 0.9},
        vol=0.036,
        te=0.008,
        seed=2022,
        characteristics=[
            ("Number of holdings", "38", "246"),
            ("Distribution yield", "4.1%", "3.6%"),
            ("Weighted average market cap", "$41bn", "$38bn"),
            ("Enterprise value / EBITDA", "11.8x", "12.6x"),
            ("Regulated or contracted revenue", "78%", "71%"),
        ],
        sectors=[
            ("Electric and gas networks", 27.4, 31.2),
            ("Toll roads", 14.8, 9.6),
            ("Airports", 11.2, 7.9),
            ("Communications towers", 12.6, 10.4),
            ("Renewable generation", 13.9, 12.1),
            ("Midstream energy", 9.1, 18.3),
            ("Rail", 7.3, 10.5),
            ("Cash", 3.7, 0.0),
        ],
        regions=[
            ("North America", 46.2, 51.2),
            ("Europe", 31.5, 28.1),
            ("Asia Pacific", 14.8, 15.6),
            ("Latin America", 3.8, 5.1),
            ("Cash", 3.7, 0.0),
        ],
        team=[
            Person("Sofia Marchetti", "Lead Portfolio Manager", 20, 4, "Leads the strategy; utilities and networks"),
            Person("James Whitfield", "Portfolio Manager", 13, 4, "Transport and communications"),
        ],
        approach=[
            ("Essential assets", "Networks, roads, airports and towers whose services people and businesses can't do without."),
            ("Contracted revenues", "We favor revenues that are regulated or set by long contracts, often linked to inflation."),
            ("Sound balance sheets", "Long-lived assets need long-dated debt: we avoid companies that must refinance at the wrong time."),
        ],
    )
)

STRATEGIES = [GLOBAL_EQUITY, CORE_PLUS, INFRASTRUCTURE]

# The firm's line-up, for the overview: the three above, and two with no
# files of their own here.
LINE_UP = [
    ("Global Equity", "Global equity", 2012, 14.2, "Merrow World Equity Index"),
    ("US Small Cap Equity", "US equity", 2001, 6.4, "Merrow US Small Cap Index"),
    ("Core Plus Fixed Income", "US fixed income", 2005, 19.8, "Merrow US Aggregate Bond Index"),
    ("Multi-Asset Income", "Multi-asset", 2015, 5.1, "60% Merrow World Equity, 40% Merrow Global Aggregate"),
    ("Global Listed Infrastructure", "Global equity", 2022, 3.1, "Merrow Core Infrastructure Index"),
]

CLIENTS = [
    ("Public pensions", 34),
    ("Corporate pensions", 21),
    ("Endowments and foundations", 14),
    ("Insurance", 12),
    ("Sub-advisory", 11),
    ("Sovereign and other", 8),
]

HISTORY = [
    (1998, "Founded in Boston by four partners, managing $400 million for two pension funds"),
    (2001, "US Small Cap Equity launches"),
    (2005, "Core Plus Fixed Income launches; assets pass $5 billion"),
    (2009, "London office opens to serve European clients"),
    (2011, "The partners hand ownership to the firm's employees"),
    (2012, "Global Equity launches"),
    (2017, "Singapore office opens"),
    (2022, "Global Listed Infrastructure launches"),
    (2026, "$48.6 billion for 212 institutions in 14 countries"),
]

CONTACTS = [
    ("Ryan Brooks", "Director, Institutional Sales", "ryan.brooks@larchmere.example"),
    ("Paula Ortiz", "Client Portfolio Manager", "paula.ortiz@larchmere.example"),
]


def _check() -> None:
    for strategy in STRATEGIES:
        for label, rows in (("sectors", strategy.sectors), ("regions", strategy.regions), ("quality", strategy.quality)):
            if not rows:
                continue
            for column in (1, 2):
                total = sum(row[column] for row in rows)
                assert abs(total - 100) < 0.05, (strategy.key, label, column, total)
    assert abs(sum(row[3] for row in LINE_UP) - FIRM["aum"]) < 0.05
    assert sum(share for _, share in CLIENTS) == 100


_check()
