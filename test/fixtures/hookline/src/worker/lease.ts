import type { Db } from "../store/db";
import { claimDue, type Delivery } from "../store/deliveries";

export const BATCH_SIZE = 10;
const LEASE_MS = 30_000;

export function leaseDue(db: Db, workerId: string, now: Date): Delivery[] {
  return claimDue(db, workerId, BATCH_SIZE, now, LEASE_MS);
}
