// The workspace's settings, an admin's: its pages as tabs under the title.
// Brand: the tenant's logo, which leads the header, and its brand's color,
// which the app's colors are made from. Users: who's in the workspace.
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { NavLink, Outlet } from "react-router";

import { managesWorkspace } from "../../../shared/api.ts";
import type { Person, Role } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { useSession, useUser } from "../session";
import { Avatar, EmptyState, PageHeader } from "../ui";

/** The largest logo, in bytes: the backend's limit. */
const MAX_LOGO_BYTES = 1024 * 1024;

/** A brand's color: `#rrggbb`. */
const COLOR = /^#[0-9a-f]{6}$/i;

const ROLES: Record<Role, string> = { admin: "Admin", reviewer: "Reviewer", member: "Member" };

export function SettingsPage() {
    const user = useUser();
    return (
        <div className="page">
            <PageHeader title="Settings" />
            {managesWorkspace(user.role) ? (
                <>
                    <nav className="settings-tabs" aria-label="Settings">
                        <NavLink to="/settings/brand">Brand</NavLink>
                        <NavLink to="/settings/users">Users</NavLink>
                    </nav>
                    <Outlet />
                </>
            ) : (
                <div className="card">
                    <EmptyState title="Only an admin keeps the workspace's settings" />
                </div>
            )}
        </div>
    );
}

export function BrandSettings() {
    const { user, setTenant } = useSession();
    const tenant = user!.tenant;
    const picker = useRef<HTMLInputElement>(null);
    const [logoBusy, setLogoBusy] = useState(false);
    const [logoError, setLogoError] = useState<string>();
    const [color, setColor] = useState(tenant.brandColor ?? "");
    const [colorBusy, setColorBusy] = useState(false);
    const [colorError, setColorError] = useState<string>();
    const valid = COLOR.test(color);

    async function upload(file: File | undefined) {
        if (!file) return;
        setLogoError(undefined);
        if (file.size > MAX_LOGO_BYTES) {
            setLogoError("A logo is at most 1 MB.");
            return;
        }
        setLogoBusy(true);
        try {
            setTenant(await api.uploadLogo(tenant.id, file));
        } catch (failure) {
            setLogoError(
                failure instanceof ApiError && failure.status === 415
                    ? "A logo is a PNG, a JPEG, a WebP or an SVG."
                    : "That didn't go through. Try again.",
            );
        }
        setLogoBusy(false);
    }

    async function remove() {
        setLogoError(undefined);
        setLogoBusy(true);
        try {
            setTenant(await api.removeLogo(tenant.id));
        } catch {
            setLogoError("That didn't go through. Try again.");
        }
        setLogoBusy(false);
    }

    async function save(event: FormEvent) {
        event.preventDefault();
        setColorError(undefined);
        setColorBusy(true);
        try {
            const saved = await api.setBrandColor(tenant.id, color.toLowerCase());
            setTenant(saved);
            setColor(saved.brandColor ?? "");
        } catch {
            setColorError("That didn't go through. Try again.");
        }
        setColorBusy(false);
    }

    return (
        <div className="settings-sections">
            <section className="card settings-section">
                <h2>Logo</h2>
                <p className="settings-help">
                    A square image: a PNG, JPEG, WebP or SVG of at most 1 MB. It leads the header for everyone in{" "}
                    {tenant.name}.
                </p>
                <div className="logo-setting">
                    <div className="logo-preview">
                        {tenant.logo ? (
                            <img src={tenant.logo} alt={`${tenant.name}'s logo`} />
                        ) : (
                            <span className="tenant-initial" aria-hidden="true">
                                {tenant.name[0]}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="button"
                        disabled={logoBusy}
                        onClick={() => picker.current?.click()}
                    >
                        {tenant.logo ? "Replace" : "Upload logo"}
                    </button>
                    {tenant.logo && (
                        <button type="button" className="button" disabled={logoBusy} onClick={() => void remove()}>
                            Remove
                        </button>
                    )}
                    <input
                        ref={picker}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        hidden
                        onChange={(event) => {
                            void upload(event.target.files?.[0]);
                            event.target.value = "";
                        }}
                    />
                </div>
                {logoError && (
                    <p className="error" role="alert">
                        {logoError}
                    </p>
                )}
            </section>
            <section className="card settings-section">
                <h2>Brand color</h2>
                <p className="settings-help">
                    The app&apos;s colors are made from it, as Material 3 makes a color scheme, for everyone in{" "}
                    {tenant.name}.
                </p>
                <form className="brand-color" onSubmit={(event) => void save(event)}>
                    <input
                        type="color"
                        aria-label="Brand color"
                        value={valid ? color.toLowerCase() : "#000000"}
                        onChange={(event) => setColor(event.target.value)}
                    />
                    <label className="field brand-hex">
                        <span className="visually-hidden">Hex</span>
                        <input
                            value={color}
                            placeholder="#rrggbb"
                            maxLength={7}
                            spellCheck={false}
                            onChange={(event) => setColor(event.target.value.trim())}
                        />
                    </label>
                    <button
                        type="submit"
                        className="button primary"
                        disabled={colorBusy || !valid || color.toLowerCase() === tenant.brandColor}
                    >
                        Save
                    </button>
                </form>
                {color !== "" && !valid && <p className="settings-help">A color is # and six hex digits.</p>}
                {colorError && (
                    <p className="error" role="alert">
                        {colorError}
                    </p>
                )}
            </section>
        </div>
    );
}

export function UsersSettings() {
    const { tenant } = useUser();
    const [users, setUsers] = useState<Person[]>();
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let gone = false;
        api.users(tenant.id).then(
            (found) => gone || setUsers(found),
            () => gone || setFailed(true),
        );
        return () => {
            gone = true;
        };
    }, [tenant.id]);

    if (failed)
        return (
            <p className="error" role="alert">
                The users didn't load. Try again.
            </p>
        );
    if (!users) return null;
    return (
        <section className="card file-list">
            <table className="user-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Title</th>
                        <th>Role</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((person) => (
                        <tr key={person.id}>
                            <td>
                                <span className="user-name">
                                    <Avatar name={person.name} />
                                    {person.name}
                                </span>
                            </td>
                            <td>{person.email}</td>
                            <td>{person.title}</td>
                            <td>{ROLES[person.role]}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}
