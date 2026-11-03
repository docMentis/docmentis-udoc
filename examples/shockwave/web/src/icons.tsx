// The app's icons: line drawings on a 24-unit grid, in the text's color.
import type { ReactNode, SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            {children}
        </svg>
    );
}

/** Shockwave's mark: a seismogram's spike, on its orange. */
export function Logo({ size = 28 }: { size?: number }) {
    return (
        <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--ms-brand)" />
            <polyline
                points="4,17 9,17 11,13 13,21 16,6 19,26 21,14 23,17 28,17"
                fill="none"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export const HomeIcon = () => (
    <Icon>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
    </Icon>
);

export const LibraryIcon = () => (
    <Icon>
        <rect x="3" y="4" width="4" height="16" rx="1" />
        <rect x="9" y="4" width="4" height="16" rx="1" />
        <path d="m15 5 3.8-.9 3.4 15.3-3.8.9z" />
    </Icon>
);

/** Three sheets, one on another: content gathered together. */
export const CollectionsIcon = () => (
    <Icon>
        <path d="m12 3 9 4.5-9 4.5-9-4.5z" />
        <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
    </Icon>
);

/** A door and its handle: a room. */
export const DealRoomsIcon = () => (
    <Icon>
        <path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18" />
        <circle cx="14.5" cy="12" r="0.9" fill="currentColor" />
    </Icon>
);

/** A mortarboard. */
export const LearningIcon = () => (
    <Icon>
        <path d="m2 9 10-5 10 5-10 5z" />
        <path d="M6 11v5c0 1.4 2.7 3 6 3s6-1.6 6-3v-5M22 9v6" />
    </Icon>
);

export const InsightsIcon = () => (
    <Icon>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Icon>
);

/** A cog: eight teeth round an axle. */
export const SettingsIcon = () => (
    <Icon>
        <path d="M10.01 4.56 10.44 2.12 13.56 2.12 13.99 4.56 15.85 5.33 17.88 3.91 20.09 6.12 18.67 8.15 19.44 10.01 21.88 10.44 21.88 13.56 19.44 13.99 18.67 15.85 20.09 17.88 17.88 20.09 15.85 18.67 13.99 19.44 13.56 21.88 10.44 21.88 10.01 19.44 8.15 18.67 6.12 20.09 3.91 17.88 5.33 15.85 4.56 13.99 2.12 13.56 2.12 10.44 4.56 10.01 5.33 8.15 3.91 6.12 6.12 3.91 8.15 5.33Z" />
        <circle cx="12" cy="12" r="3.2" />
    </Icon>
);

/** Three lines: the navigation's menu button. */
export const MenuIcon = () => (
    <Icon width="20" height="20">
        <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
);

export const SearchIcon = () => (
    <Icon width="18" height="18">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
    </Icon>
);

export const ChevronRightIcon = () => (
    <Icon width="14" height="14">
        <path d="m9 6 6 6-6 6" />
    </Icon>
);

export const ChevronDownIcon = () => (
    <Icon width="14" height="14">
        <path d="m6 9 6 6 6-6" />
    </Icon>
);

export const CheckIcon = () => (
    <Icon width="16" height="16">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
);

/** Rows, each with its mark: the library as a list. */
export const ListIcon = () => (
    <Icon width="18" height="18">
        <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </Icon>
);

/** Four tiles: the library as a grid. */
export const GridIcon = () => (
    <Icon width="18" height="18">
        <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
    </Icon>
);

export const FolderIcon = () => (
    <Icon width="20" height="20">
        <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2.2h8.7A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
    </Icon>
);

export const FolderPlusIcon = () => (
    <Icon width="18" height="18">
        <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2.2h8.7A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5zM12 11v6M9 14h6" />
    </Icon>
);

export const UploadIcon = () => (
    <Icon width="18" height="18">
        <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </Icon>
);

/** Three dots in a row: a menu of what's done to something. */
export const MoreIcon = () => (
    <Icon width="18" height="18">
        <circle cx="6" cy="12" r="0.9" fill="currentColor" />
        <circle cx="12" cy="12" r="0.9" fill="currentColor" />
        <circle cx="18" cy="12" r="0.9" fill="currentColor" />
    </Icon>
);

export const CloseIcon = () => (
    <Icon width="18" height="18">
        <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
);
