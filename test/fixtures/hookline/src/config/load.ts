import { DEFAULTS, type Config } from "./schema";

export function loadConfig(env: Record<string, string | undefined>): Config {
  return {
    ...DEFAULTS,
    port: env.PORT ? Number(env.PORT) : DEFAULTS.port,
    databaseFile: env.HOOKLINE_DB ?? DEFAULTS.databaseFile,
  };
}
