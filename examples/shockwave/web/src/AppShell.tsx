// The app around every signed-in page, in its tenant's brand: its colors
// Material 3's scheme made from the tenant's brand color, over app.css's,
// Shockwave's orange's, while the app shows; the navigation down the window's
// left, the header across the rest, and the page under it.
// The navigation has, under its menu button, the sections and, after a
// divider, the workspace's settings; at its foot, under a divider, "Powered by
// Shockwave". The menu button turns it from a panel of the sections' names to
// a bar of their icons and back, which this browser remembers. The header has
// the tenant's logo and name, search in its middle, and the user's avatar,
// which opens their menu.
import { useLayoutEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { NavLink, Outlet } from "react-router";

import type { User } from "../../shared/api.ts";
import {
    CollectionsIcon,
    DealRoomsIcon,
    HomeIcon,
    InsightsIcon,
    LearningIcon,
    LibraryIcon,
    Logo,
    MenuIcon,
    SearchIcon,
    SettingsIcon,
} from "./icons";
import { schemeOf } from "./scheme";
import { useSession, useUser } from "./session";
import { Avatar, TenantBrand, useDismiss } from "./ui";

const SECTIONS: { to: string; label: string; icon: ComponentType }[] = [
    { to: "/", label: "Home", icon: HomeIcon },
    { to: "/library", label: "Library", icon: LibraryIcon },
    { to: "/collections", label: "Collections", icon: CollectionsIcon },
    { to: "/deal-rooms", label: "Deal Rooms", icon: DealRoomsIcon },
    { to: "/learning", label: "Learning", icon: LearningIcon },
    { to: "/insights", label: "Insights", icon: InsightsIcon },
];

const BAR_KEY = "shockwave.navigation.bar";

function savedBar(): boolean {
    try {
        return localStorage.getItem(BAR_KEY) === "true";
    } catch {
        return false;
    }
}

/**
 * The app's colors, the scheme `brandColor` seeds, set before the app shows
 * and taken away as it goes, back to app.css's; app.css's alone for none.
 */
function useBrandColors(brandColor: string | null): void {
    useLayoutEffect(() => {
        if (!brandColor) return;
        const root = document.documentElement.style;
        const scheme = Object.entries(schemeOf(brandColor));
        for (const [role, color] of scheme) root.setProperty(`--md-sys-color-${role}`, color);
        return () => {
            for (const [role] of scheme) root.removeProperty(`--md-sys-color-${role}`);
        };
    }, [brandColor]);
}

export function AppShell() {
    const user = useUser();
    const [bar, setBar] = useState(savedBar);
    useBrandColors(user.tenant.brandColor);

    function toggle() {
        setBar(!bar);
        try {
            localStorage.setItem(BAR_KEY, String(!bar));
        } catch {
            // Kept for this visit alone.
        }
    }

    return (
        <div className={bar ? "shell shell-bar" : "shell"}>
            <aside className="navigation">
                <div className="navigation-top">
                    <button
                        className="icon-button navigation-toggle"
                        aria-label={bar ? "Expand the navigation" : "Collapse the navigation"}
                        aria-expanded={!bar}
                        onClick={toggle}
                    >
                        <MenuIcon />
                    </button>
                </div>
                <nav className="nav">
                    {SECTIONS.map(({ to, label, icon }) => (
                        <NavigationLink key={to} to={to} label={label} icon={icon} bar={bar} />
                    ))}
                    <div className="nav-divider" role="separator" />
                    <NavigationLink to="/settings" label="Settings" icon={SettingsIcon} bar={bar} />
                </nav>
                <div className="powered-by" title={bar ? "Powered by Shockwave" : undefined}>
                    <Logo size={24} />
                    <span className="nav-label">
                        Powered by <strong>Shockwave</strong>
                    </span>
                </div>
            </aside>
            <header className="header">
                <div className="brand">
                    <TenantBrand tenant={user.tenant} />
                </div>
                <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
                    <SearchIcon />
                    <input type="search" placeholder="Search" aria-label="Search" />
                </form>
                <UserMenu user={user} />
            </header>
            <main className="content">
                <Outlet />
            </main>
        </div>
    );
}

/** A section in the navigation: its icon and its name, the name a tooltip in the bar. */
function NavigationLink({
    to,
    label,
    icon: Icon,
    bar,
}: {
    to: string;
    label: string;
    icon: ComponentType;
    bar: boolean;
}) {
    return (
        <NavLink to={to} end={to === "/"} className="nav-item" title={bar ? label : undefined}>
            <Icon />
            <span className="nav-label">{label}</span>
        </NavLink>
    );
}

/** The user's avatar, opening their menu down from it: their name and email, then signing out. */
function UserMenu({ user }: { user: User }) {
    const { signOut } = useSession();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useDismiss(ref, open, () => setOpen(false));
    return (
        <div className="user-menu" ref={ref}>
            <button
                className="user-button"
                aria-label={user.name}
                aria-haspopup="menu"
                aria-expanded={open}
                title={user.name}
                onClick={() => setOpen(!open)}
            >
                <Avatar name={user.name} />
            </button>
            {open && (
                <div className="menu" role="menu">
                    <div className="menu-header">
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                    </div>
                    <button role="menuitem" onClick={() => void signOut()}>
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
