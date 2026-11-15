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

/** A new item of an array whose items `item` describes: an empty object,
 *  empty text, false or an empty array, as it holds. */
export function blankItem(item: BindingSchema | undefined): BindingValue {
    if (item === undefined) return {};
    if (item === "bool") return false;
    if ("text" in item) return "";
    if ("array" in item) return [];
    return {};
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
