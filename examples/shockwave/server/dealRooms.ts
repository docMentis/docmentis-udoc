// Who gets into a deal room: its tenant's managers, and those who sell and are on
// it. The routes and the gate both ask this. A reviewer isn't on any, and reads a
// room's file only through the versions sent to them.
import { entersAllDealRooms, sellsDeals } from "../shared/api.ts";
import type { User } from "../shared/api.ts";
import type { TenantDb } from "./db.ts";

/** Whether `user` works in deal room `roomId`. */
export function entersDealRoom(db: TenantDb, user: User, roomId: string): boolean {
    if (!sellsDeals(user.role)) return false;
    const room = db.prepare("SELECT 1 FROM deal_rooms WHERE tenant_id = :tenant AND id = ?").get(roomId);
    if (!room) return false;
    if (entersAllDealRooms(user.role)) return true;
    const onIt = db
        .prepare("SELECT 1 FROM deal_room_people WHERE tenant_id = :tenant AND room_id = ? AND user_id = ?")
        .get(roomId, user.id);
    return onIt !== undefined;
}

/** Whether version `number` of file `assetId` was sent to `user` to review. */
export function sentToReview(db: TenantDb, user: User, assetId: string, number: number): boolean {
    const row = db
        .prepare("SELECT 1 FROM versions WHERE tenant_id = :tenant AND asset_id = ? AND number = ? AND reviewer_id = ?")
        .get(assetId, number, user.id);
    return row !== undefined;
}

/** Whether any version of file `assetId` was sent to `user` to review. */
export function anySentToReview(db: TenantDb, user: User, assetId: string): boolean {
    const row = db
        .prepare("SELECT 1 FROM versions WHERE tenant_id = :tenant AND asset_id = ? AND reviewer_id = ?")
        .get(assetId, user.id);
    return row !== undefined;
}
