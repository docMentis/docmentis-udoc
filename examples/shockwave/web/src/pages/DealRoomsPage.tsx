// Deal Rooms: what those who sell prepare, one room for each deal. They see the
// rooms they can enter, and make more; to anyone else, it isn't there.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { sellsDeals } from "../../../shared/api.ts";
import type { DealRoom } from "../../../shared/api.ts";
import { api } from "../api";
import { NewDealRoomDialog } from "../DealRoomDialogs";
import { DealRoomCard, dealRoomPath } from "../DealRoomViews";
import { PlusIcon } from "../icons";
import { useUser } from "../session";
import { EmptyState, useDocumentTitle } from "../ui";
import { NotFoundPage } from "./PlaceholderPage";

export function DealRoomsPage() {
    const navigate = useNavigate();
    const sells = sellsDeals(useUser().role);
    const [rooms, setRooms] = useState<DealRoom[]>();
    const [failed, setFailed] = useState(false);
    const [creating, setCreating] = useState(false);
    useDocumentTitle("Deal Rooms");

    useEffect(() => {
        if (!sells) return;
        let gone = false;
        api.dealRooms().then(
            (found) => gone || setRooms(found),
            () => gone || setFailed(true),
        );
        return () => {
            gone = true;
        };
    }, [sells]);

    if (!sells) return <NotFoundPage />;

    return (
        <div className="page">
            <header className="page-header page-header-actions">
                <h1>Deal Rooms</h1>
                <div className="page-actions">
                    <button className="button primary" onClick={() => setCreating(true)}>
                        <PlusIcon />
                        New deal room
                    </button>
                </div>
            </header>
            {failed && (
                <p className="error" role="alert">
                    The deal rooms didn't load. Try again.
                </p>
            )}
            {rooms?.length === 0 && (
                <div className="card">
                    <EmptyState title="No deal rooms yet">
                        Make one for a deal: prepare its content with your team, then put it on the frontstage for its
                        buyers.
                    </EmptyState>
                </div>
            )}
            {rooms && rooms.length > 0 && (
                <div className="file-grid">
                    {rooms.map((room) => (
                        <DealRoomCard key={room.id} room={room} />
                    ))}
                </div>
            )}
            {creating && (
                <NewDealRoomDialog
                    onClose={() => setCreating(false)}
                    onCreated={(room) => navigate(dealRoomPath(room.id))}
                />
            )}
        </div>
    );
}
