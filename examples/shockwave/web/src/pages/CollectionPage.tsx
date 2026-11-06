// A collection: what it's for, how to use it, and its files in the order its
// manager put them, each showing the version its file publishes. A manager adds
// files, takes them out, moves them and says how to use each.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { arrangesCollections } from "../../../shared/api.ts";
import type { Collection, CollectionItem } from "../../../shared/api.ts";
import { ApiError, api } from "../api";
import { AddFilesDialog, CollectionDialog, DeleteCollectionDialog, FileInstructionsDialog } from "../CollectionDialogs";
import { CollectionFileCard } from "../CollectionViews";
import { PlusIcon } from "../icons";
import { useUser } from "../session";
import { ActionsMenu, EmptyState, useDocumentTitle } from "../ui";
import { NotFoundPage } from "./PlaceholderPage";

/** What a dialog is open for. */
type Task = "edit" | "delete" | "add" | { instructionsOf: CollectionItem };

export function CollectionPage() {
    const { collectionId } = useParams();
    const navigate = useNavigate();
    const user = useUser();
    const arranges = arrangesCollections(user.role);
    const [collection, setCollection] = useState<Collection | null>();
    const [failure, setFailure] = useState<string>();
    const [task, setTask] = useState<Task>();

    useEffect(() => {
        let gone = false;
        api.collection(collectionId!).then(
            (found) => gone || setCollection(found),
            (error: unknown) => {
                if (gone) return;
                if (error instanceof ApiError && error.status === 404) setCollection(null);
                else setFailure("The collection didn't load. Try again.");
            },
        );
        return () => {
            gone = true;
        };
    }, [collectionId]);

    useDocumentTitle(collection?.name ?? "Collections");
    if (collection === null) return <NotFoundPage />;

    /** Done with a dialog: the collection as it left it. */
    function changed(next: Collection) {
        setCollection(next);
        setTask(undefined);
    }

    /** Change the collection from its page, with no dialog: what went wrong, if it did, over its files. */
    async function change(request: Promise<Collection>) {
        setFailure(undefined);
        try {
            setCollection(await request);
        } catch {
            setFailure("That didn't go through. Reload the page, and try again.");
        }
    }

    /** Move the file at `index` by one place, earlier or later. */
    function move(current: Collection, index: number, by: -1 | 1) {
        const order = current.items.map((item) => item.file.id);
        [order[index], order[index + by]] = [order[index + by], order[index]];
        void change(api.orderCollection(current.id, order));
    }

    return (
        <div className="page">
            <header className="page-header page-header-actions">
                <div>
                    <nav className="breadcrumb" aria-label="Collections">
                        <Link to="/collections">Collections</Link>
                    </nav>
                    <h1>{collection?.name}</h1>
                    {collection?.description && <p className="page-subtitle">{collection.description}</p>}
                </div>
                {arranges && collection && (
                    <div className="page-actions">
                        <button className="button primary" onClick={() => setTask("add")}>
                            <PlusIcon />
                            Add files
                        </button>
                        <ActionsMenu
                            label={`Actions for ${collection.name}`}
                            items={[
                                { label: "Edit", onSelect: () => setTask("edit") },
                                { label: "Delete", onSelect: () => setTask("delete") },
                            ]}
                        />
                    </div>
                )}
            </header>
            {failure && (
                <p className="error" role="alert">
                    {failure}
                </p>
            )}
            {collection?.instructions && (
                <section className="card collection-instructions">
                    <h2>How to use this collection</h2>
                    <p>{collection.instructions}</p>
                </section>
            )}
            {collection?.items.length === 0 && (
                <div className="card">
                    <EmptyState title="No files yet">
                        {arranges
                            ? "Add published files for your team to sell with."
                            : "The files your sales manager adds show here."}
                    </EmptyState>
                </div>
            )}
            {collection && collection.items.length > 0 && (
                <div className="file-grid">
                    {collection.items.map((item, index) => (
                        <CollectionFileCard
                            key={item.file.id}
                            collectionId={collection.id}
                            item={item}
                            menu={
                                arranges && (
                                    <ActionsMenu
                                        label={`Actions for ${item.file.name}`}
                                        items={[
                                            {
                                                label: "Edit instructions",
                                                onSelect: () => setTask({ instructionsOf: item }),
                                            },
                                            ...(index > 0
                                                ? [
                                                      {
                                                          label: "Move earlier",
                                                          onSelect: () => move(collection, index, -1),
                                                      },
                                                  ]
                                                : []),
                                            ...(index < collection.items.length - 1
                                                ? [{ label: "Move later", onSelect: () => move(collection, index, 1) }]
                                                : []),
                                            {
                                                label: "Remove from collection",
                                                onSelect: () =>
                                                    void change(api.removeFromCollection(collection.id, item.file.id)),
                                            },
                                        ]}
                                    />
                                )
                            }
                        />
                    ))}
                </div>
            )}
            {collection && task === "edit" && (
                <CollectionDialog
                    title="Edit collection"
                    action="Save"
                    collection={collection}
                    onClose={() => setTask(undefined)}
                    onSubmit={async (fields) => changed(await api.updateCollection(collection.id, fields))}
                />
            )}
            {collection && task === "delete" && (
                <DeleteCollectionDialog
                    collection={collection}
                    onClose={() => setTask(undefined)}
                    onDeleted={() => navigate("/collections")}
                />
            )}
            {collection && task === "add" && (
                <AddFilesDialog collection={collection} onClose={() => setTask(undefined)} onAdded={changed} />
            )}
            {collection && typeof task === "object" && (
                <FileInstructionsDialog
                    item={task.instructionsOf}
                    onClose={() => setTask(undefined)}
                    onSubmit={async (instructions) =>
                        changed(await api.setFileInstructions(collection.id, task.instructionsOf.file.id, instructions))
                    }
                />
            )}
        </div>
    );
}
