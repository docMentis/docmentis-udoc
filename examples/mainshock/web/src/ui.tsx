// The pieces the pages are made of.
import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

import type { Tenant } from "../../shared/api.ts";
import { CloseIcon, MoreIcon } from "./icons";

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

/** While `open`, call `close` on a press outside `ref`'s element, or on Escape: a menu's dismissal. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void): void {
    const latest = useRef(close);
    latest.current = close;
    useEffect(() => {
        if (!open) return;
        const outside = (event: PointerEvent) => ref.current?.contains(event.target as Node) || latest.current();
        const escape = (event: KeyboardEvent) => event.key === "Escape" && latest.current();
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("keydown", escape);
        };
    }, [ref, open]);
}

/**
 * A modal dialog, open while it's shown: its title and a button to close it,
 * over its `children`. Escape closes it too, through `onClose`. It opens with
 * the focus on its element marked `data-autofocus`, if it has one.
 */
export function Dialog({
    title,
    className,
    onClose,
    children,
}: {
    title: string;
    className?: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current!;
        dialog.showModal();
        dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
        return () => dialog.close();
    }, []);
    return (
        <dialog
            ref={ref}
            className={className ? `dialog ${className}` : "dialog"}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <header className="dialog-header">
                <h2>{title}</h2>
                <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
                    <CloseIcon />
                </button>
            </header>
            {children}
        </dialog>
    );
}

/** A button opening a menu of `items` below it, for the thing `label` names. */
export function ActionsMenu({ label, items }: { label: string; items: { label: string; onSelect: () => void }[] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useDismiss(ref, open, () => setOpen(false));
    return (
        <div className="actions-menu" ref={ref}>
            <button
                type="button"
                className="icon-button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                <MoreIcon />
            </button>
            {open && (
                <div className="menu" role="menu">
                    {items.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setOpen(false);
                                item.onSelect();
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
