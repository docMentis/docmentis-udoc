// Home: what needs the user, and what's new for them, in the sections their
// role has (docs/design/examples-shockwave.md). A section shows what it
// holds, or says what it will.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { arrangesCollections, readsLibrary } from "../../../shared/api.ts";
import type { Asset, Collection, Role, WaitingVersion } from "../../../shared/api.ts";
import { api } from "../api";
import { CollectionCard } from "../CollectionViews";
import { FileCard } from "../LibraryViews";
import { useUser } from "../session";
import { EmptyState, useDocumentTitle } from "../ui";

type Section = "attention" | "library" | "dealRooms" | "collections";

/** Each role's sections, in order: those who keep and review the Library see what's new in it; sales, their deals. */
const SECTIONS: Record<Role, Section[]> = {
    admin: ["attention", "library"],
    reviewer: ["attention", "library"],
    manager: ["attention", "dealRooms", "collections"],
    member: ["attention", "dealRooms", "collections"],
};

/** How many collections Home shows: those changed last. */
const RECENT_COLLECTIONS = 8;

/** What needs each role, said while nothing does. */
const ATTENTION: Record<Role, string> = {
    admin: "Versions returned to you, and approved ones to publish, show here.",
    reviewer: "Versions sent to you to review show here.",
    manager: "Buyers opening what your team has shared show here.",
    member: "Buyers opening what you've shared show here.",
};

/** "Good afternoon, Maya", by the hour where the user is. */
function greeting(name: string): string {
    const hour = new Date().getHours();
    const time = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    return `Good ${time}, ${name.split(" ")[0]}`;
}

export function HomePage() {
    const user = useUser();
    useDocumentTitle("Home");
    return (
        <div className="page">
            <header className="page-header">
                <h1>{greeting(user.name)}</h1>
            </header>
            <div className="home-sections">
                {SECTIONS[user.role].map((section) => {
                    switch (section) {
                        case "attention":
                            return readsLibrary(user.role) ? (
                                <FilesWaiting key={section} role={user.role} />
                            ) : (
                                <HomeSection key={section} title="Needs your attention">
                                    <Empty title="You're all caught up">{ATTENTION[user.role]}</Empty>
                                </HomeSection>
                            );
                        case "library":
                            return <NewInLibrary key={section} />;
                        case "dealRooms":
                            return (
                                <HomeSection key={section} title="Your deal rooms">
                                    <Empty title="No deal rooms yet">
                                        The content you prepare for each deal, and share with its buyers, shows here.
                                    </Empty>
                                </HomeSection>
                            );
                        case "collections":
                            return <YourCollections key={section} role={user.role} />;
                    }
                })}
            </div>
        </div>
    );
}

/** The versions waiting on the user, as the library's cards, each saying what for. */
function FilesWaiting({ role }: { role: Role }) {
    const [versions, setVersions] = useState<WaitingVersion[]>();
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let gone = false;
        api.waitingVersions().then(
            (found) => gone || setVersions(found),
            () => gone || setFailed(true),
        );
        return () => {
            gone = true;
        };
    }, []);
    return (
        <HomeSection title="Needs your attention">
            {failed && (
                <p className="error" role="alert">
                    What needs your attention didn't load. Try again.
                </p>
            )}
            {versions?.length === 0 && <Empty title="You're all caught up">{ATTENTION[role]}</Empty>}
            {versions && versions.length > 0 && (
                <div className="file-grid">
                    {versions.map(({ asset, number, status }) => (
                        <FileCard key={`${asset.id}-${number}`} asset={asset} waiting={{ number, status }} />
                    ))}
                </div>
            )}
        </HomeSection>
    );
}

/** The files uploaded last, as the library's cards. */
function NewInLibrary() {
    const [assets, setAssets] = useState<Asset[]>();
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let gone = false;
        api.recentAssets().then(
            (found) => gone || setAssets(found),
            () => gone || setFailed(true),
        );
        return () => {
            gone = true;
        };
    }, []);
    return (
        <HomeSection
            title="New in the library"
            link={
                <Link className="button text" to="/library">
                    View library
                </Link>
            }
        >
            {failed && (
                <p className="error" role="alert">
                    The library didn't load. Try again.
                </p>
            )}
            {assets?.length === 0 && <Empty title="No files yet" />}
            {assets && assets.length > 0 && (
                <div className="file-grid">
                    {assets.map((asset) => (
                        <FileCard key={asset.id} asset={asset} />
                    ))}
                </div>
            )}
        </HomeSection>
    );
}

/** The collections changed last, as cards. */
function YourCollections({ role }: { role: Role }) {
    const [collections, setCollections] = useState<Collection[]>();
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let gone = false;
        api.collections().then(
            (found) => gone || setCollections(found),
            () => gone || setFailed(true),
        );
        return () => {
            gone = true;
        };
    }, []);
    const recent = collections?.toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, RECENT_COLLECTIONS);
    return (
        <HomeSection
            title="Your collections"
            link={
                <Link className="button text" to="/collections">
                    View collections
                </Link>
            }
        >
            {failed && (
                <p className="error" role="alert">
                    The collections didn't load. Try again.
                </p>
            )}
            {recent?.length === 0 && (
                <Empty title="No collections yet">
                    {arrangesCollections(role)
                        ? "The collections you arrange for your team to sell with show here."
                        : "The content your sales manager arranges for you to sell with shows here."}
                </Empty>
            )}
            {recent && recent.length > 0 && (
                <div className="file-grid">
                    {recent.map((collection) => (
                        <CollectionCard key={collection.id} collection={collection} />
                    ))}
                </div>
            )}
        </HomeSection>
    );
}

function HomeSection({ title, link, children }: { title: string; link?: ReactNode; children: ReactNode }) {
    return (
        <section className="home-section">
            <header className="home-section-header">
                <h2>{title}</h2>
                {link}
            </header>
            {children}
        </section>
    );
}

/** A section with nothing in it, on a card. */
function Empty({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <div className="card">
            <EmptyState title={title}>{children}</EmptyState>
        </div>
    );
}
