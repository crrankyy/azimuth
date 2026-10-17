import Fastify from "fastify";
import type { Db } from "../store/db";
import { attemptsRoute } from "./attempts";
import { endpointsRoutes } from "./endpoints";
import { eventsRoutes } from "./events";

export function buildServer(db: Db) {
  const app = Fastify({ logger: false });
  endpointsRoutes(app, db);
  eventsRoutes(app, db);
  attemptsRoute(app, db);
  return app;
}
