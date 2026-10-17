import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Db } from "../store/db";
import { deleteEndpoint, getEndpoint, insertEndpoint, listEndpoints, updateEndpoint } from "../store/endpoints";

interface Body {
  url?: unknown;
  events?: unknown;
}

function invalid(body: Body): { field: "url" | "events"; reason: string } | null {
  if (body.url !== undefined) {
    if (typeof body.url !== "string" || !URL.canParse(body.url)) return { field: "url", reason: "must be an absolute URL" };
    const { protocol } = new URL(body.url);
    if (protocol !== "http:" && protocol !== "https:") return { field: "url", reason: "must be http or https" };
  }
  if (body.events !== undefined && (!Array.isArray(body.events) || body.events.length === 0)) {
    return { field: "events", reason: "must not be empty" };
  }
  return null;
}

const view = ({ secret: _secret, ...endpoint }: { secret: string; [key: string]: unknown }) => endpoint;

export function endpointsRoutes(app: FastifyInstance, db: Db): void {
  app.post<{ Body: { url: string; events: string[] } }>("/endpoints", async (req, reply) => {
    const error = invalid(req.body);
    if (error) return reply.code(422).send(error);
    const endpoint = { id: randomUUID(), ...req.body, secret: randomBytes(32).toString("base64url") };
    insertEndpoint(db, endpoint);
    return reply.code(201).send(endpoint);
  });

  app.get("/endpoints", async () => listEndpoints(db).map(view));

  app.get<{ Params: { id: string } }>("/endpoints/:id", async (req, reply) => {
    const endpoint = getEndpoint(db, req.params.id);
    return endpoint ? view(endpoint) : reply.code(404).send({ error: "endpoint_not_found" });
  });

  app.patch<{ Params: { id: string }; Body: { url?: string; events?: string[] } }>("/endpoints/:id", async (req, reply) => {
    const error = invalid(req.body);
    if (error) return reply.code(422).send(error);
    const endpoint = updateEndpoint(db, req.params.id, req.body);
    return endpoint ? view(endpoint) : reply.code(404).send({ error: "endpoint_not_found" });
  });

  app.delete<{ Params: { id: string } }>("/endpoints/:id", async (req, reply) => {
    if (!deleteEndpoint(db, req.params.id)) return reply.code(404).send({ error: "endpoint_not_found" });
    return reply.code(204).send();
  });
}
