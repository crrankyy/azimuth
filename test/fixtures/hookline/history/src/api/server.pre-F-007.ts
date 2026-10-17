import Fastify from "fastify";
import type { Db } from "../store/db";
import { endpointsRoutes } from "./endpoints";
import { eventsRoutes } from "./events";

export function buildServer(db: Db) {
  const app = Fastify({ logger: false });
  endpointsRoutes(app, db);
  eventsRoutes(app, db);
  return app;
}
