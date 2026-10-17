import { randomUUID } from "node:crypto";
import type { Config } from "../config/schema";
import type { Db } from "../store/db";
import { getEndpoint } from "../store/endpoints";
import { deliver } from "./deliver";
import { leaseDue } from "./lease";

export function startWorker(db: Db, config: Config): () => void {
  const workerId = randomUUID();
  let polling = false;
  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      for (const delivery of leaseDue(db, workerId, new Date())) {
        const endpoint = getEndpoint(db, delivery.endpointId);
        if (endpoint) await deliver(db, delivery, endpoint, new Date());
      }
    } finally {
      polling = false;
    }
  };
  const timer = setInterval(() => void poll(), config.pollIntervalMs);
  return () => clearInterval(timer);
}
