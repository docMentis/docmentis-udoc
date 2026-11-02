// The pieces the pages are made of.
import { useEffect } from "react";
import type { ReactNode } from "react";

import type { Tenant } from "../../shared/api.ts";

/** Title the browser's tab after the page: "Library · Mainshock". */
export function useDocumentTitle(title: string): void {
    useEffect(() => {
        document.title = `${title} · Mainshock`;
    }, [title]);
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
    useDocumentTitle(title);
    return (
        <header className="page-header">
            <h1>{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </header>
    );
}

/** A person's initials, first and last, in a circle. */
export function Avatar({ name }: { name: string }) {
    const words = name.split(" ").filter(Boolean);
    const initials = (words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "");
    return (
        <span className="avatar" aria-hidden="true">
            {initials}
        </span>
    );
}

/** A tenant's brand: its logo, a square, or for one without, its initial in one; and its name. */
export function TenantBrand({ tenant }: { tenant: Tenant }) {
    return (
        <>
            {tenant.logo ? (
                <img className="tenant-logo" src={tenant.logo} alt="" />
            ) : (
                <span className="tenant-logo tenant-initial" aria-hidden="true">
                    {tenant.name[0]}
                </span>
            )}
            <span className="tenant-name">{tenant.name}</span>
        </>
    );
}

/** What a page or a card shows with nothing in it yet. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <div className="empty">
            <p className="empty-title">{title}</p>
            {children && <div className="empty-body">{children}</div>}
        </div>
    );
}
