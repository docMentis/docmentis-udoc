// Collections: how sales get content, as their tenant's manager arranges it.
// Everyone at the tenant finds it here, and a manager makes more.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { arrangesCollections } from "../../../shared/api.ts";
import type { Collection } from "../../../shared/api.ts";
import { api } from "../api";
import { CollectionDialog } from "../CollectionDialogs";
import { CollectionCard, collectionPath } from "../CollectionViews";
import { PlusIcon } from "../icons";
import { useUser } from "../session";
import { EmptyState, useDocumentTitle } from "../ui";

export function CollectionsPage() {
    const navigate = useNavigate();
    const user = useUser();
    const arranges = arrangesCollections(user.role);
    const [collections, setCollections] = useState<Collection[]>();
    const [failed, setFailed] = useState(false);
    const [creating, setCreating] = useState(false);
    useDocumentTitle("Collections");

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

    return (
        <div className="page">
            <header className="page-header page-header-actions">
                <h1>Collections</h1>
                {arranges && (
                    <div className="page-actions">
                        <button className="button primary" onClick={() => setCreating(true)}>
                            <PlusIcon />
                            New collection
                        </button>
                    </div>
                )}
            </header>
            {failed && (
                <p className="error" role="alert">
                    The collections didn't load. Try again.
                </p>
            )}
            {collections?.length === 0 && (
                <div className="card">
                    <EmptyState title="No collections yet">
                        {arranges
                            ? "Arrange published files in a collection for your team to sell with."
                            : "The content your sales manager arranges shows here."}
                    </EmptyState>
                </div>
            )}
            {collections && collections.length > 0 && (
                <div className="file-grid">
                    {collections.map((collection) => (
                        <CollectionCard key={collection.id} collection={collection} />
                    ))}
                </div>
            )}
            {creating && (
                <CollectionDialog
                    title="New collection"
                    action="Create"
                    onClose={() => setCreating(false)}
                    onSubmit={async (fields) => navigate(collectionPath((await api.createCollection(fields)).id))}
                />
            )}
        </div>
    );
}
