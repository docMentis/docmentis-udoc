// The workspace's settings, an admin's: its pages as tabs under the title.
// Brand: the tenant's logo, which leads the header; its brand's color, which
// the app's colors are made from; and the document viewer's colors, from
// those, over a viewer showing them. Users: who's in the workspace.
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { NavLink, Outlet } from "react-router";

// A deck the viewer's colors are shown on, the demo's own.
import sampleDeck from "../../../../../packages/udoc-demo/public/pptx/james-webb-space-telescope.pptx?url";

import { VIEWER_PRIMARIES, VIEWER_SURFACES, managesWorkspace } from "../../../shared/api.ts";
import type { Person, Role, ViewerColors, ViewerPrimary, ViewerSurface } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { DocumentViewer } from "../DocumentViewer";
import { announceMoment } from "../moments";
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
                        <span className="visually-hidden">Color</span>
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
            <ViewerColorsSection />
        </div>
    );
}

// The brand's surfaces, Brand 1 to 4, low to highest.
const TONE_LABELS: Record<ViewerSurface | ViewerPrimary, string> = {
    default: "Default",
    "surface-container-low": "Brand 1",
    "surface-container": "Brand 2",
    "surface-container-high": "Brand 3",
    "surface-container-highest": "Brand 4",
    brand: "Brand",
};

/**
 * The document viewer's colors, a swatch each to choose from, shown at once
 * and saved as they're chosen, over a viewer on a sample deck that shows
 * them; announced as they show, for the narrator.
 */
function ViewerColorsSection() {
    const { user, setTenant } = useSession();
    const tenant = user!.tenant;
    const colors = tenant.viewerColors;
    const [error, setError] = useState<string>();

    useEffect(() => {
        announceMoment({ kind: "viewer-colors:shown", where: "settings" });
        return () => announceMoment({ kind: "viewer-colors:hidden", where: "settings" });
    }, []);

    async function choose(next: ViewerColors) {
        setError(undefined);
        setTenant({ ...tenant, viewerColors: next });
        try {
            setTenant(await api.setViewerColors(tenant.id, next));
        } catch {
            setTenant(tenant);
            setError("That didn't go through. Try again.");
        }
    }

    return (
        <section className="card settings-section">
            <h2>Document viewer</h2>
            <p className="settings-help">
                The viewer&apos;s colors wherever it shows a document in {tenant.name}: its own, or your brand&apos;s,
                which fit it to the app around it, light and dark.
            </p>
            <div className="viewer-colors">
                <span id="viewer-toolbar">Toolbar</span>
                <Swatches
                    kind="toolbar"
                    tones={VIEWER_SURFACES}
                    value={colors.toolbar}
                    onChoose={(toolbar) => void choose({ ...colors, toolbar })}
                />
                <span id="viewer-background">Background</span>
                <Swatches
                    kind="background"
                    tones={VIEWER_SURFACES}
                    value={colors.background}
                    onChoose={(background) => void choose({ ...colors, background })}
                />
                <span id="viewer-primary">Primary</span>
                <Swatches
                    kind="primary"
                    tones={VIEWER_PRIMARIES}
                    value={colors.primary}
                    onChoose={(primary) => void choose({ ...colors, primary })}
                />
            </div>
            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
            <div className="viewer-preview">
                <DocumentViewer url={sampleDeck} />
            </div>
        </section>
    );
}

/** The tones `kind` may take, as swatches, `value` the one chosen. */
function Swatches<T extends ViewerSurface | ViewerPrimary>({
    kind,
    tones,
    value,
    onChoose,
}: {
    kind: keyof ViewerColors;
    tones: readonly T[];
    value: T;
    onChoose: (tone: T) => void;
}) {
    return (
        <div className="segmented" role="radiogroup" aria-labelledby={`viewer-${kind}`}>
            {tones.map((tone) => (
                <button
                    key={tone}
                    type="button"
                    role="radio"
                    aria-checked={value === tone}
                    onClick={() => onChoose(tone)}
                >
                    <span className={`swatch swatch-${kind}-${tone}`} aria-hidden="true" />
                    {TONE_LABELS[tone]}
                </button>
            ))}
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
