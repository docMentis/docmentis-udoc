// A section of the app a later step builds: its title, until then.
import { Link } from "react-router";

import { EmptyState, PageHeader } from "../ui";

export function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="page">
            <PageHeader title={title} subtitle={subtitle} />
            <div className="card">
                <EmptyState title="Coming soon" />
            </div>
        </div>
    );
}

export function NotFoundPage() {
    return (
        <div className="page">
            <PageHeader title="Page not found" subtitle="There's nothing at this address." />
            <div>
                <Link className="button" to="/">
                    Go to Home
                </Link>
            </div>
        </div>
    );
}
