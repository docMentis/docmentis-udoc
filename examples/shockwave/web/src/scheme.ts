// Material 3's color schemes, light and dark, from a seed color, in the
// browser: HCT, a color's hue and chroma as CAM16 measures them under
// Material's default viewing conditions and its tone as CIELAB's L*, and the
// tonal palettes built in it, after material-color-utilities (its older
// solver). The palettes are CorePalette's: the primary at the seed's hue and
// its chroma or 48, whichever is more; the secondary at chroma 16; the
// neutrals at 4 and 8; the error at Material's red. Each role is at its tone
// in the baseline schemes. app.css holds the schemes Shockwave's orange
// seeds, the default.

/** The roles app.css uses, by the name of their `--md-sys-color-*` property. */
export type ColorRole =
    | "primary"
    | "on-primary"
    | "primary-container"
    | "on-primary-container"
    | "secondary"
    | "secondary-container"
    | "on-secondary-container"
    | "error"
    | "on-error"
    | "error-container"
    | "on-error-container"
    | "surface"
    | "surface-container-low"
    | "surface-container"
    | "surface-container-high"
    | "surface-container-highest"
    | "on-surface"
    | "on-surface-variant"
    | "outline"
    | "outline-variant"
    | "scrim"
    | "shadow";

type Rgb = [number, number, number];

/** A color as CAM16 sees it: lightness J, chroma, and hue in degrees. */
interface Cam {
    j: number;
    chroma: number;
    hue: number;
}

const WHITE = [95.047, 100.0, 108.883];

const M16 = [
    [0.401288, 0.650173, -0.051461],
    [-0.250268, 1.204414, 0.045854],
    [-0.002079, 0.048952, 0.953127],
];

function linearized(channel: number): number {
    const c = channel / 255;
    return (c <= 0.040449936 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * 100;
}

function delinearized(linear: number): number {
    const n = linear / 100;
    const c = n <= 0.0031308 ? n * 12.92 : 1.055 * n ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
}

function xyzOf([r, g, b]: Rgb): Rgb {
    const [lr, lg, lb] = [linearized(r), linearized(g), linearized(b)];
    return [
        0.41233895 * lr + 0.35762064 * lg + 0.18051042 * lb,
        0.2126 * lr + 0.7152 * lg + 0.0722 * lb,
        0.01932141 * lr + 0.11916382 * lg + 0.95034478 * lb,
    ];
}

function rgbOfXyz(x: number, y: number, z: number): Rgb {
    return [
        delinearized(3.2413774792388685 * x - 1.5376652402851851 * y - 0.49885366846268053 * z),
        delinearized(-0.9691452513005321 * x + 1.8758853451067872 * y + 0.04156585616912061 * z),
        delinearized(0.05562093689691305 * x - 0.20395524564742123 * y + 1.0571799111220335 * z),
    ];
}

function labF(t: number): number {
    return t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
}

function labInverse(ft: number): number {
    return ft ** 3 > 216 / 24389 ? ft ** 3 : (116 * ft - 16) / (24389 / 27);
}

function lstarOfY(y: number): number {
    return 116 * labF(y / 100) - 16;
}

function yOfLstar(lstar: number): number {
    return 100 * labInverse((lstar + 16) / 116);
}

function lstarOf(rgb: Rgb): number {
    return lstarOfY(xyzOf(rgb)[1]);
}

function grayOf(lstar: number): Rgb {
    const c = delinearized(yOfLstar(lstar));
    return [c, c, c];
}

/** Material's default viewing conditions: a gray world, average surround. */
const VC = (() => {
    const la = ((200 / Math.PI) * yOfLstar(50)) / 100;
    const f = 1.0;
    const c = 0.69;
    const d = Math.max(0, Math.min(1, f * (1 - (1 / 3.6) * Math.exp((-la - 42) / 92))));
    const rgbW = M16.map((row) => row.reduce((sum, m, i) => sum + m * WHITE[i], 0));
    const rgbD = rgbW.map((w) => d * (100 / w) + 1 - d);
    const k = 1 / (5 * la + 1);
    const k4 = k ** 4;
    const k4F = 1 - k4;
    const fl = k4 * la + 0.1 * k4F * k4F * Math.cbrt(5 * la);
    const n = yOfLstar(50) / WHITE[1];
    const z = 1.48 + Math.sqrt(n);
    const nbb = 0.725 / n ** 0.2;
    const rgbA = rgbW.map((w, i) => {
        const af = ((fl * rgbD[i] * w) / 100) ** 0.42;
        return (400 * af) / (af + 27.13);
    });
    const aw = (2 * rgbA[0] + rgbA[1] + 0.05 * rgbA[2]) * nbb;
    return { c, nc: f, rgbD, fl, n, z, nbb, ncb: nbb, aw };
})();

function camOf(rgb: Rgb): Cam {
    const xyz = xyzOf(rgb);
    const [rA, gA, bA] = M16.map((row, i) => {
        const cone = row.reduce((sum, m, j) => sum + m * xyz[j], 0);
        const adapted = VC.rgbD[i] * cone;
        const af = ((VC.fl * Math.abs(adapted)) / 100) ** 0.42;
        return (Math.sign(adapted) * 400 * af) / (af + 27.13);
    });
    const a = (11 * rA - 12 * gA + bA) / 11;
    const b = (rA + gA - 2 * bA) / 9;
    const u = (20 * rA + 20 * gA + 21 * bA) / 20;
    const p2 = (40 * rA + 20 * gA + bA) / 20;
    const hue = ((((Math.atan2(b, a) * 180) / Math.PI) % 360) + 360) % 360;
    const j = 100 * ((p2 * VC.nbb) / VC.aw) ** (VC.c * VC.z);
    const huePrime = hue < 20.14 ? hue + 360 : hue;
    const eHue = 0.25 * (Math.cos((huePrime * Math.PI) / 180 + 2) + 3.8);
    const p1 = (50000 / 13) * eHue * VC.nc * VC.ncb;
    const t = (p1 * Math.hypot(a, b)) / (u + 0.305);
    const alpha = t ** 0.9 * (1.64 - 0.29 ** VC.n) ** 0.73;
    return { j, chroma: alpha * Math.sqrt(j / 100), hue };
}

function rgbOfCam({ j, chroma, hue }: Cam): Rgb {
    const alpha = chroma === 0 || j === 0 ? 0 : chroma / Math.sqrt(j / 100);
    const t = (alpha / (1.64 - 0.29 ** VC.n) ** 0.73) ** (1 / 0.9);
    const h = (hue * Math.PI) / 180;
    const eHue = 0.25 * (Math.cos(h + 2) + 3.8);
    const ac = VC.aw * (j / 100) ** (1 / VC.c / VC.z);
    const p1 = eHue * (50000 / 13) * VC.nc * VC.ncb;
    const p2 = ac / VC.nbb;
    const [hSin, hCos] = [Math.sin(h), Math.cos(h)];
    const gamma = (23 * (p2 + 0.305) * t) / (23 * p1 + 11 * t * hCos + 108 * t * hSin);
    const a = gamma * hCos;
    const b = gamma * hSin;
    const [rF, gF, bF] = [
        (460 * p2 + 451 * a + 288 * b) / 1403,
        (460 * p2 - 891 * a - 261 * b) / 1403,
        (460 * p2 - 220 * a - 6300 * b) / 1403,
    ].map((v, i) => {
        const base = Math.max(0, (27.13 * Math.abs(v)) / (400 - Math.abs(v)));
        return (Math.sign(v) * (100 / VC.fl) * base ** (1 / 0.42)) / VC.rgbD[i];
    });
    return rgbOfXyz(
        1.86206786 * rF - 1.01125463 * gF + 0.14918677 * bF,
        0.38752654 * rF + 0.62144744 * gF - 0.00897398 * bF,
        -0.0158415 * rF - 0.03412294 * gF + 1.04996444 * bF,
    );
}

/** How far apart two colors look, in CAM16-UCS. */
function distance(one: Cam, other: Cam): number {
    const ucs = ({ j, chroma, hue }: Cam) => {
        const m = Math.log(1 + 0.0228 * chroma * VC.fl ** 0.25) / 0.0228;
        const h = (hue * Math.PI) / 180;
        return [(1.7 * j) / (1 + 0.007 * j), m * Math.cos(h), m * Math.sin(h)];
    };
    const [a, b] = [ucs(one), ucs(other)];
    return 1.41 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) ** 0.63;
}

/** The color of `hue` and `chroma` whose tone is `lstar`, found by its lightness J; `undefined` for none in sRGB. */
function findByJ(hue: number, chroma: number, lstar: number): Rgb | undefined {
    let [low, high, bestDistance] = [0, 100, 1000];
    let best: Rgb | undefined;
    while (Math.abs(low - high) > 0.01) {
        const mid = low + (high - low) / 2;
        const clipped = rgbOfCam({ j: mid, chroma, hue });
        const clippedLstar = lstarOf(clipped);
        const deltaL = Math.abs(lstar - clippedLstar);
        if (deltaL < 0.2) {
            const cam = camOf(clipped);
            const deltaE = distance(cam, { ...cam, hue });
            if (deltaE <= 1) {
                bestDistance = deltaE;
                best = clipped;
            }
        }
        if (bestDistance === 0 && deltaL === 0) break;
        if (clippedLstar < lstar) low = mid;
        else high = mid;
    }
    return best;
}

/** The color of `hue` and `tone`, as near `chroma` as sRGB has one. */
function hct(hue: number, chroma: number, tone: number): Rgb {
    if (chroma < 1 || Math.round(tone) <= 0 || Math.round(tone) >= 100) return grayOf(tone);
    hue = ((hue % 360) + 360) % 360;
    let [high, mid, low] = [chroma, chroma, 0];
    let first = true;
    let answer: Rgb | undefined;
    while (Math.abs(low - high) >= 0.4) {
        const possible = findByJ(hue, mid, tone);
        if (first) {
            if (possible) return possible;
            first = false;
        } else if (possible) {
            answer = possible;
            low = mid;
        } else {
            high = mid;
        }
        mid = low + (high - low) / 2;
    }
    return answer ?? grayOf(tone);
}

function hexOf([r, g, b]: Rgb): string {
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function rgbOfHex(hex: string): Rgb {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Each role's tone in Material's baseline schemes, light and dark, and the palette it's in. */
const TONES: Record<
    ColorRole,
    [palette: "primary" | "secondary" | "neutral" | "neutralVariant" | "error", light: number, dark: number]
> = {
    primary: ["primary", 40, 80],
    "on-primary": ["primary", 100, 20],
    "primary-container": ["primary", 90, 30],
    "on-primary-container": ["primary", 10, 90],
    secondary: ["secondary", 40, 80],
    "secondary-container": ["secondary", 90, 30],
    "on-secondary-container": ["secondary", 10, 90],
    error: ["error", 40, 80],
    "on-error": ["error", 100, 20],
    "error-container": ["error", 90, 30],
    "on-error-container": ["error", 10, 90],
    surface: ["neutral", 98, 6],
    "surface-container-low": ["neutral", 96, 10],
    "surface-container": ["neutral", 94, 12],
    "surface-container-high": ["neutral", 92, 17],
    "surface-container-highest": ["neutral", 90, 22],
    "on-surface": ["neutral", 10, 90],
    "on-surface-variant": ["neutralVariant", 30, 80],
    outline: ["neutralVariant", 50, 60],
    "outline-variant": ["neutralVariant", 80, 30],
    scrim: ["neutral", 0, 0],
    shadow: ["neutral", 0, 0],
};

/** The scheme `seed`, `#rrggbb`, makes, light or dark: each role's color. */
export function schemeOf(seed: string, mode: "light" | "dark" = "light"): Record<ColorRole, string> {
    const { chroma, hue } = camOf(rgbOfHex(seed));
    const palettes = {
        primary: [hue, Math.max(48, chroma)],
        secondary: [hue, 16],
        neutral: [hue, 4],
        neutralVariant: [hue, 8],
        error: [25, 84],
    };
    const roles = Object.entries(TONES).map(([role, [palette, light, dark]]) => {
        const [h, c] = palettes[palette];
        return [role, hexOf(hct(h, c, mode === "light" ? light : dark))];
    });
    return Object.fromEntries(roles) as Record<ColorRole, string>;
}
