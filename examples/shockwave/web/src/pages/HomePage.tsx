// Home: what needs the user, and what's new for them, in the sections their
// role has (docs/design/examples-shockwave.md). A section shows what it
// holds, or says what it will.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Asset, Role } from "../../../shared/api.ts";
import { api } from "../api";
import { FileCard } from "../LibraryViews";
import { useUser } from "../session";
import { EmptyState, useDocumentTitle } from "../ui";

type Section = "attention" | "library" | "dealRooms" | "collections";

/** Each role's sections, in order: those who keep and review the Library see what's new in it; sales, their deals. */
const SECTIONS: Record<Role, Section[]> = {
    admin: ["attention", "library"],
    reviewer: ["attention", "library"],
    member: ["attention", "dealRooms", "collections"],
};

/** What needs each role, said while nothing does. */
const ATTENTION: Record<Role, string> = {
    admin: "Files compliance returns to you, and approved ones to publish, show here.",
    reviewer: "Files submitted for your review show here.",
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
                            return (
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
                            return (
                                <HomeSection key={section} title="Your collections">
                                    <Empty title="No collections yet">
                                        The content your sales manager arranges for you to sell with shows here.
                                    </Empty>
                                </HomeSection>
                            );
                    }
                })}
            </div>
        </div>
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
