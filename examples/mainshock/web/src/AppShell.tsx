// The app around every signed-in page: the sidebar's navigation, and the top
// bar with the tenant and the user's menu.
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { NavLink, Outlet } from "react-router";

import type { User } from "../../shared/api.ts";
import { AnalyticsIcon, ChevronDownIcon, DealsIcon, DecksIcon, HomeIcon, LibraryIcon, Logo } from "./icons";
import { useSession, useUser } from "./session";
import { Avatar } from "./ui";

const NAVIGATION: { to: string; label: string; icon: ComponentType }[] = [
    { to: "/", label: "Home", icon: HomeIcon },
    { to: "/library", label: "Library", icon: LibraryIcon },
    { to: "/decks", label: "Decks", icon: DecksIcon },
    { to: "/deals", label: "Deals", icon: DealsIcon },
    { to: "/analytics", label: "Analytics", icon: AnalyticsIcon },
];

export function AppShell() {
    const user = useUser();
    return (
        <div className="shell">
            <aside className="sidebar">
                <div className="brand">
                    <Logo />
                    <span>Mainshock</span>
                </div>
                <nav className="nav">
                    {NAVIGATION.map(({ to, label, icon: NavIcon }) => (
                        <NavLink key={to} to={to} end={to === "/"} className="nav-item">
                            <NavIcon />
                            {label}
                        </NavLink>
                    ))}
                </nav>
            </aside>
            <div className="main">
                <header className="topbar">
                    <span className="tenant">{user.tenant.name}</span>
                    <UserMenu user={user} />
                </header>
                <main className="content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

function UserMenu({ user }: { user: User }) {
    const { signOut } = useSession();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const close = (event: PointerEvent) => ref.current?.contains(event.target as Node) || setOpen(false);
        const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("pointerdown", close);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);
    return (
        <div className="user-menu" ref={ref}>
            <button className="user-button" aria-expanded={open} onClick={() => setOpen(!open)}>
                <Avatar name={user.name} />
                <span className="user-name">
                    <strong>{user.name}</strong>
                    <small>{user.title}</small>
                </span>
                <ChevronDownIcon />
            </button>
            {open && (
                <div className="menu" role="menu">
                    <button role="menuitem" onClick={() => void signOut()}>
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
