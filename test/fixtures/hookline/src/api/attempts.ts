import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { listAttempts, type AttemptRecord } from "../store/attempts";
import type { Db } from "../store/db";
import { getDelivery } from "../store/deliveries";
import { attemptsResponse } from "./attempts.schema";

type Request = FastifyRequest<{ Params: { id: string } }>;

const toJson = (attempt: AttemptRecord) => ({ ...attempt, startedAt: attempt.startedAt.toISOString() });

export function attemptsRoute(app: FastifyInstance, db: Db): void {
  app.get("/deliveries/:id/attempts", { schema: { response: { 200: attemptsResponse } } }, list);

  function list(req: Request, reply: FastifyReply): void {
    const delivery = getDelivery(db, req.params.id);
    if (!delivery) {
      reply.code(404).send({ error: "delivery_not_found" });
      return;
    }
    reply.send(listAttempts(db, delivery.id).map(toJson));
  }
}
