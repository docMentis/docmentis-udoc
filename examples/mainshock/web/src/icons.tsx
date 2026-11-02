// The app's icons: line drawings on a 24-unit grid, in the text's color.
import type { ReactNode, SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
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

/** Mainshock's mark: a seismogram's spike, on its orange. */
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

export const DecksIcon = () => (
    <Icon>
        <rect x="3" y="5" width="18" height="12" rx="1.5" />
        <path d="M12 17v3M8 20h8M7 13l3-3 2 2 4-4" />
    </Icon>
);

export const DealsIcon = () => (
    <Icon>
        <rect x="3" y="7" width="18" height="13" rx="1.5" />
        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12.5h18" />
    </Icon>
);

export const AnalyticsIcon = () => (
    <Icon>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Icon>
);

export const ChevronDownIcon = () => (
    <Icon width="16" height="16">
        <path d="m6 9 6 6 6-6" />
    </Icon>
);
