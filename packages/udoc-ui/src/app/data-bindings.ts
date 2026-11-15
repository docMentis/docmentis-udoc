// A template's sample data, as the right panel's Data tab edits it: a value at a
// place in the data, named by the steps from its root — a name into an object,
// an index into an array — read, set, and an array's items added and removed,
// each edit giving a new copy of the data and leaving the old one as it is.
import type { BindingData, BindingSchema, BindingValue } from "@docmentis/udoc-wasm";

/** A place in the data: the names and indices from its root. */
export type SamplePath = readonly (string | number)[];

/** The value at `path` in `data`, or undefined where it holds none. */
export function sampleAt(data: BindingData | undefined, path: SamplePath): BindingValue | undefined {
    let at: BindingValue | undefined = data;
    for (const step of path) {
        if (typeof step === "number") at = Array.isArray(at) ? at[step] : undefined;
        else at = isObject(at) ? at[step] : undefined;
        if (at === undefined) return undefined;
    }
    return at;
}

/** `data` with `value` at `path`, making the objects and arrays on the way
 *  where it holds none. */
export function withSample(data: BindingData | undefined, path: SamplePath, value: BindingValue): BindingData {
    return setIn(data ?? {}, path, value) as BindingData;
}

/** `data` with `item` after the items of the array at `path`. */
export function withItem(data: BindingData | undefined, path: SamplePath, item: BindingValue): BindingData {
    const items = sampleAt(data, path);
    return withSample(data, path, [...(Array.isArray(items) ? items : []), item]);
}

/** `data` without the item at `index` of the array at `path`. */
export function withoutItem(data: BindingData | undefined, path: SamplePath, index: number): BindingData {
    const items = sampleAt(data, path);
    if (!Array.isArray(items)) return data ?? {};
    return withSample(
        data,
        path,
        items.filter((_, at) => at !== index),
    );
}

/** The path, as the engine resolves a binding's, that the value at `path` in
 *  the data is bound by: its names joined by `.`, `[]` for each item —
 *  `funds[].name` for any fund's name. Every item of an array is bound alike. */
export function boundPath(path: SamplePath): string {
    let text = "";
    for (const step of path) {
        if (typeof step === "number") text += "[]";
        else text += text === "" ? step : `.${step}`;
    }
    return text;
}

/** A new item of an array whose items `item` describes: an empty object,
 *  empty text, false or an empty array, as it holds. */
export function blankItem(item: BindingSchema | undefined): BindingValue {
    if (item === undefined) return {};
    if (item === "bool") return false;
    if ("text" in item) return "";
    if ("array" in item) return [];
    return {};
}

/** How many items a made-up array holds: enough for a repeat's separators to
 *  show, the last one apart. */
const MADE_UP_ITEMS = 3;

/** The words of `path`'s names in title case — `customer.name` "Customer
 *  Name", `fund.paysDividend` "Fund Pays Dividend". An item's index is no word. */
export function titleOf(path: SamplePath): string {
    return path
        .filter((step): step is string => typeof step === "string")
        .flatMap((name) => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[_\s]+/))
        .filter((word) => word !== "")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/** A value made up for what `schema` holds at `path`: text its path's title,
 *  or a choice's first value; `true`; three items; an object of a value for
 *  each of its properties. */
export function madeUpSample(schema: BindingSchema, path: SamplePath = []): BindingValue {
    if (schema === "bool") return true;
    if ("text" in schema) return schema.text.values[0] ?? titleOf(path);
    if ("array" in schema) {
        const item = schema.array.item;
        return Array.from({ length: MADE_UP_ITEMS }, (_, index) =>
            item === undefined ? titleOf(path) : madeUpSample(item, [...path, index]),
        );
    }
    const object: BindingData = {};
    for (const [name, property] of Object.entries(schema.object.properties)) {
        object[name] = madeUpSample(property, [...path, name]);
    }
    return object;
}

/** `sample`, the sample data a template keeps, with every value it lacks made
 *  up from `schema` ({@link madeUpSample}): its own values kept, its arrays'
 *  items as many as it holds, each completed as a made-up item is. */
export function completedSample(sample: BindingData | undefined, schema: BindingSchema): BindingData {
    const completed = complete(sample, madeUpSample(schema));
    return isObject(completed) ? completed : {};
}

/** `kept` with what it lacks taken from `madeUp`. */
function complete(kept: BindingValue | undefined, madeUp: BindingValue): BindingValue {
    if (kept === undefined || kept === null) return madeUp;
    if (isObject(kept) && isObject(madeUp)) {
        const out: BindingData = { ...madeUp };
        for (const [name, value] of Object.entries(kept)) {
            const other = madeUp[name];
            out[name] = other === undefined ? value : complete(value, other);
        }
        return out;
    }
    if (Array.isArray(kept) && Array.isArray(madeUp)) {
        const item = madeUp[0];
        return item === undefined ? kept : kept.map((value) => complete(value, item));
    }
    return kept;
}

function isObject(value: BindingValue | undefined): value is BindingData {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setIn(at: BindingValue | undefined, path: SamplePath, value: BindingValue): BindingValue {
    const [step, ...rest] = path;
    if (step === undefined) return value;
    if (typeof step === "number") {
        const items = Array.isArray(at) ? [...at] : [];
        while (items.length < step) items.push(null);
        items[step] = setIn(items[step], rest, value);
        return items;
    }
    const object = isObject(at) ? { ...at } : {};
    object[step] = setIn(object[step], rest, value);
    return object;
}
