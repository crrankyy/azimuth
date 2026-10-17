import type { FastifyInstance } from "fastify";
import type { Db } from "../store/db";
import { insertEvent } from "../store/deliveries";

export function eventsRoutes(app: FastifyInstance, db: Db): void {
  app.post<{ Body: { type?: string; payload?: unknown } }>("/events", async (req, reply) => {
    if (!req.body.type) return reply.code(422).send({ field: "type", reason: "required" });
    const eventId = insertEvent(db, req.body.type, req.body.payload ?? null);
    return reply.code(202).send({ eventId });
  });
}
