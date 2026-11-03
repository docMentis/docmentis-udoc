// The pieces the pages are made of.
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

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
 * the focus on its element marked `data-autofocus`, if it has one, and gives
 * it back on closing.
 *
 * It's modal to the app, not the window: it opens in the app's root, `#app`,
 * over the rest of the app, which goes inert while it's open. The browser's
 * own modal, `showModal()`, would cover the whole window, and make inert
 * whatever is beside the app too.
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
    const titleId = useId();
    const latest = useRef(onClose);
    latest.current = onClose;
    useEffect(() => {
        const dialog = ref.current!;
        const layer = dialog.parentElement!;
        const app = layer.parentElement!;
        const opener = document.activeElement;
        const beneath = [...app.children].filter(
            (child): child is HTMLElement => child !== layer && child instanceof HTMLElement && !child.inert,
        );
        for (const element of beneath) element.inert = true;
        dialog.show();
        dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
        // Escape pressed in the app, or with the focus nowhere, and not taken already; not beside the app.
        const escape = (event: KeyboardEvent) => {
            const target = event.target as Node;
            if (event.key !== "Escape" || event.defaultPrevented) return;
            if (app.contains(target) || target === document.body) latest.current();
        };
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("keydown", escape);
            dialog.close();
            for (const element of beneath) element.inert = false;
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, []);
    return createPortal(
        <div className="dialog-layer">
            <dialog
                ref={ref}
                className={className ? `dialog ${className}` : "dialog"}
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <header className="dialog-header">
                    <h2 id={titleId}>{title}</h2>
                    <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
                        <CloseIcon />
                    </button>
                </header>
                {children}
            </dialog>
        </div>,
        document.getElementById("app")!,
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
