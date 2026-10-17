import { buildServer } from "./api/server";
import { loadConfig } from "./config/load";
import { openDb } from "./store/db";
import { startWorker } from "./worker/loop";

const config = loadConfig(process.env);
const db = openDb(config.databaseFile);
startWorker(db, config);
await buildServer(db).listen({ port: config.port, host: "0.0.0.0" });
