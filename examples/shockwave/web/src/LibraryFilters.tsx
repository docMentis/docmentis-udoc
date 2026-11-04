// The library's filters: what a folder's list is narrowed to, by what's
// typed of a name, and by its files' type, who uploaded them and when, kept
// in the page's address so that a link or Back keeps them. The name is typed
// in a box; each of the others is a chip, naming the filter and what it's set
// to, with a menu of what it may be set to: the types and the people in the
// folder, and how recently.
import { useRef, useState } from "react";

import type { Asset, Folder } from "../../shared/api.ts";
import { typeLabel } from "./files";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "./icons";
import { useDismiss } from "./ui";

/** What a folder's list is narrowed to; `null`, not at all by that. */
export interface Filters {
    /** What's typed of a name, found anywhere in it, whatever its case. */
    name: string | null;
    /** A type, as people name it ("PowerPoint"), or "Folder". */
    type: string | null;
    /** Who uploaded a file: their id. */
    uploader: string | null;
    /** How recently a file was uploaded: one of `UPLOADED`'s values. */
    uploaded: string | null;
}

const UPLOADED = [
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "year", label: "This year" },
];

const DAY = 24 * 60 * 60 * 1000;

/** The filters an address's `params` sets. */
export function filtersOf(params: URLSearchParams): Filters {
    return {
        name: params.get("name"),
        type: params.get("type"),
        uploader: params.get("uploader"),
        uploaded: params.get("uploaded"),
    };
}

/** `filters` as an address's params, leaving out those not set. */
export function paramsOf(filters: Filters): Record<string, string> {
    return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== null));
}

export function isFiltered(filters: Filters): boolean {
    return Object.values(filters).some((value) => value !== null);
}

/** The earliest upload that `uploaded` takes in, from `now`. */
function since(uploaded: string, now: Date): number {
    switch (uploaded) {
        case "today":
            return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        case "7d":
            return now.getTime() - 7 * DAY;
        case "30d":
            return now.getTime() - 30 * DAY;
        case "year":
            return new Date(now.getFullYear(), 0, 1).getTime();
        default:
            return -Infinity;
    }
}

/** No filter set. */
export const NO_FILTERS: Filters = { name: null, type: null, uploader: null, uploaded: null };

/**
 * What of a folder's `folders` and `assets` `filters` keeps. A folder has no
 * uploader and no upload, so it's kept only with neither filter set, and with
 * the type, only with Folder.
 */
export function applyFilters(
    folders: Folder[],
    assets: Asset[],
    filters: Filters,
): { folders: Folder[]; assets: Asset[] } {
    const keepsFolders =
        (filters.type === null || filters.type === "Folder") && filters.uploader === null && filters.uploaded === null;
    const from = filters.uploaded === null ? -Infinity : since(filters.uploaded, new Date());
    const typed = filters.name?.trim().toLocaleLowerCase() ?? "";
    const named = (name: string) => name.toLocaleLowerCase().includes(typed);
    return {
        folders: keepsFolders ? folders.filter((folder) => named(folder.name)) : [],
        assets: assets.filter(
            (asset) =>
                named(asset.name) &&
                (filters.type === null || typeLabel(asset.format) === filters.type) &&
                (filters.uploader === null || asset.uploadedBy.id === filters.uploader) &&
                asset.uploadedAt >= from,
        ),
    };
}

/**
 * The box a name is typed in, and the chips setting a folder's other filters,
 * each from what's in it; and, with any set, a button clearing them.
 */
export function FilterBar({
    folders,
    assets,
    filters,
    onChange,
}: {
    folders: Folder[];
    assets: Asset[];
    filters: Filters;
    onChange: (filters: Filters) => void;
}) {
    const types = [...new Set(assets.map((asset) => typeLabel(asset.format)))].sort();
    const uploaders = [...new Map(assets.map(({ uploadedBy }) => [uploadedBy.id, uploadedBy.name]))].sort(
        ([, a], [, b]) => a.localeCompare(b),
    );
    return (
        <div className="filters">
            <label className="name-filter">
                <SearchIcon />
                <input
                    type="search"
                    placeholder="Filter by name"
                    aria-label="Filter by name"
                    value={filters.name ?? ""}
                    onChange={(event) => onChange({ ...filters, name: event.target.value || null })}
                />
            </label>
            <FilterChip
                name="Type"
                any="Any type"
                value={filters.type}
                options={[...(folders.length > 0 ? ["Folder"] : []), ...types].map((type) => ({
                    value: type,
                    label: type,
                }))}
                onPick={(type) => onChange({ ...filters, type })}
            />
            <FilterChip
                name="Uploaded by"
                any="Anyone"
                value={filters.uploader}
                options={uploaders.map(([id, name]) => ({ value: id, label: name }))}
                onPick={(uploader) => onChange({ ...filters, uploader })}
            />
            <FilterChip
                name="Uploaded"
                any="Any time"
                value={filters.uploaded}
                options={UPLOADED}
                onPick={(uploaded) => onChange({ ...filters, uploaded })}
            />
            {isFiltered(filters) && (
                <button type="button" className="button text" onClick={() => onChange(NO_FILTERS)}>
                    Clear filters
                </button>
            )}
        </div>
    );
}

/** A filter's chip: its name, and what it's set to; its menu, what it may be set to, `any` first. */
function FilterChip({
    name,
    any,
    value,
    options,
    onPick,
}: {
    name: string;
    any: string;
    value: string | null;
    options: { value: string; label: string }[];
    onPick: (value: string | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useDismiss(ref, open, () => setOpen(false));
    const picked = options.find((option) => option.value === value);
    return (
        <div className="filter" ref={ref}>
            <button
                type="button"
                className={value === null ? "chip" : "chip chip-set"}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                {value === null ? name : `${name}: ${picked?.label ?? value}`}
                <ChevronDownIcon />
            </button>
            {open && (
                <div className="menu" role="menu" aria-label={name}>
                    {[{ value: null, label: any }, ...options].map((option) => (
                        <button
                            key={option.value ?? ""}
                            type="button"
                            role="menuitemradio"
                            aria-checked={option.value === value}
                            onClick={() => {
                                setOpen(false);
                                onPick(option.value);
                            }}
                        >
                            <CheckIcon />
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
