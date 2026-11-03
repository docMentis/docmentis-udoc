// The app around every signed-in page, in its tenant's brand: the sidebar and
// the page. The sidebar has the tenant's logo and name, the navigation and,
// after a divider, the workspace's settings; at its foot the user's menu, then,
// under a divider, "Powered by Mainshock". It folds to a rail of its icons,
// which this browser remembers.
import { useRef, useState } from "react";
import type { ComponentType } from "react";
import { NavLink, Outlet } from "react-router";

import type { User } from "../../shared/api.ts";
import {
    AnalyticsIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsUpDownIcon,
    DealsIcon,
    DecksIcon,
    HomeIcon,
    LibraryIcon,
    Logo,
    SettingsIcon,
} from "./icons";
import { useSession, useUser } from "./session";
import { Avatar, TenantBrand, useDismiss } from "./ui";

const NAVIGATION: { to: string; label: string; icon: ComponentType }[] = [
    { to: "/", label: "Home", icon: HomeIcon },
    { to: "/library", label: "Library", icon: LibraryIcon },
    { to: "/decks", label: "Decks", icon: DecksIcon },
    { to: "/deals", label: "Deals", icon: DealsIcon },
    { to: "/analytics", label: "Analytics", icon: AnalyticsIcon },
];

const FOLDED_KEY = "mainshock.sidebar.folded";

function savedFolded(): boolean {
    try {
        return localStorage.getItem(FOLDED_KEY) === "true";
    } catch {
        return false;
    }
}

export function AppShell() {
    const user = useUser();
    const [folded, setFolded] = useState(savedFolded);

    function fold() {
        setFolded(!folded);
        try {
            localStorage.setItem(FOLDED_KEY, String(!folded));
        } catch {
            // Kept for this visit alone.
        }
    }

    return (
        <div className={folded ? "shell shell-folded" : "shell"}>
            <aside className="sidebar">
                <div className="brand">
                    <TenantBrand tenant={user.tenant} />
                </div>
                <button
                    className="sidebar-fold"
                    aria-label={folded ? "Unfold the sidebar" : "Fold the sidebar"}
                    aria-expanded={!folded}
                    onClick={fold}
                >
                    {folded ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                </button>
                <nav className="nav">
                    {NAVIGATION.map(({ to, label, icon }) => (
                        <SidebarLink key={to} to={to} label={label} icon={icon} folded={folded} />
                    ))}
                    <div className="nav-divider" role="separator" />
                    <SidebarLink to="/settings" label="Settings" icon={SettingsIcon} folded={folded} />
                </nav>
                <div className="sidebar-foot">
                    <UserMenu user={user} folded={folded} />
                </div>
                <div className="powered-by" title={folded ? "Powered by Mainshock" : undefined}>
                    <Logo size={24} />
                    <span className="nav-label">
                        Powered by <strong>Mainshock</strong>
                    </span>
                </div>
            </aside>
            <main className="content">
                <Outlet />
            </main>
        </div>
    );
}

/** A link in the sidebar: its icon and its label, the label a tooltip when folded. */
function SidebarLink({
    to,
    label,
    icon: Icon,
    folded,
}: {
    to: string;
    label: string;
    icon: ComponentType;
    folded: boolean;
}) {
    return (
        <NavLink to={to} end={to === "/"} className="nav-item" title={folded ? label : undefined}>
            <Icon />
            <span className="nav-label">{label}</span>
        </NavLink>
    );
}

/** The user, and their menu, opening up from the sidebar's foot; folded, beside it, with their name. */
function UserMenu({ user, folded }: { user: User; folded: boolean }) {
    const { signOut } = useSession();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useDismiss(ref, open, () => setOpen(false));
    return (
        <div className="user-menu" ref={ref}>
            <button
                className="user-button"
                aria-expanded={open}
                aria-label={folded ? user.name : undefined}
                title={folded ? user.name : undefined}
                onClick={() => setOpen(!open)}
            >
                <Avatar name={user.name} />
                <span className="user-name">{user.name}</span>
                <ChevronsUpDownIcon />
            </button>
            {open && (
                <div className="menu" role="menu">
                    {folded && <div className="menu-header">{user.name}</div>}
                    <button role="menuitem" onClick={() => void signOut()}>
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
