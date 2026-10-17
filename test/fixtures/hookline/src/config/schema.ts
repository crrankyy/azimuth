export interface Config {
  port: number;
  databaseFile: string;
  httpTimeoutMs: number;
  pollIntervalMs: number;
}

export const DEFAULTS: Config = {
  port: 8080,
  databaseFile: "hookline.db",
  httpTimeoutMs: 15_000,
  pollIntervalMs: 500,
};
