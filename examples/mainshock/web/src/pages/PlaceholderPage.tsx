// A section of the app a later step builds: its title, until then.
import { Link } from "react-router";

import { EmptyState, PageHeader } from "../ui";

export function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="page">
            <PageHeader title={title} subtitle={subtitle} />
            <div className="card">
                <EmptyState title="Coming soon." />
            </div>
        </div>
    );
}

export function NotFoundPage() {
    return (
        <div className="page">
            <div className="card">
                <EmptyState title="There's no page here.">
                    <Link to="/">Go home</Link>
                </EmptyState>
            </div>
        </div>
    );
}
