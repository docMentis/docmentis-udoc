// Who gets into a deal room: its tenant's managers, and those who sell and are on
// it. The routes and the gate both ask this. A reviewer isn't on any, and reads a
// room's file only through the versions sent to them.
import type { DatabaseSync } from "node:sqlite";

import { entersAllDealRooms, sellsDeals } from "../shared/api.ts";
import type { User } from "../shared/api.ts";

/** Whether `user` works in deal room `roomId`. */
export function entersDealRoom(db: DatabaseSync, user: User, roomId: string): boolean {
    if (!sellsDeals(user.role)) return false;
    const ofTenant = db.prepare("SELECT 1 FROM deal_rooms WHERE id = ? AND tenant_id = ?").get(roomId, user.tenant.id);
    if (!ofTenant) return false;
    if (entersAllDealRooms(user.role)) return true;
    const onIt = db.prepare("SELECT 1 FROM deal_room_people WHERE room_id = ? AND user_id = ?").get(roomId, user.id);
    return onIt !== undefined;
}

/** Whether version `number` of file `assetId` was sent to `user` to review. */
export function sentToReview(db: DatabaseSync, user: User, assetId: string, number: number): boolean {
    const row = db
        .prepare("SELECT 1 FROM versions WHERE asset_id = ? AND number = ? AND reviewer_id = ?")
        .get(assetId, number, user.id);
    return row !== undefined;
}

/** Whether any version of file `assetId` was sent to `user` to review. */
export function anySentToReview(db: DatabaseSync, user: User, assetId: string): boolean {
    const row = db.prepare("SELECT 1 FROM versions WHERE asset_id = ? AND reviewer_id = ?").get(assetId, user.id);
    return row !== undefined;
}
