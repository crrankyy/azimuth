import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AzimuthError } from "./errors";
import { toUtc } from "./git";
import { featureOf, isId } from "./ids";
import { withLock, writeFileAtomic } from "./lock";
import { loadProject } from "./model";
import { OPEN_PLACEHOLDER, settleLogBody, settleText } from "./placeholders";
import { appendLogText, type Result, type Who } from "./transitions";

function readOr(abs: string, fallback: string): string {
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return fallback;
  }
}

const left = (n: number) => (n === 0 ? "" : ` (${n} placeholder${n === 1 ? "" : "s"} left)`);

/**
 * Settles the scenario's first open placeholder and appends a note entry
 * (settleLogBody, actor and session from opts) to the feature's log.md, both in one locked step.
 * Result: { ref: scenarioId, from: null, to: null, changed: [stories.md, log.md], auto: false,
 * message: "<S-ID>: settled <value>" plus " (<n> placeholder[s] left)" when n > 0 }.
 */
export function settleValue(root: string, scenarioId: string, value: string, opts: Who): Result {
  if (!isId(scenarioId, "scenario"))
    throw new AzimuthError("invalid", `${scenarioId} is not a scenario ID.`);
  const featureId = featureOf(scenarioId) ?? scenarioId;
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const f = loadProject(root).features.find((x) => x.id === featureId);
    if (!f) throw new AzimuthError("not-found", `${featureId} does not exist.`);
    const storiesFile = f.files.stories ?? `${f.dir}stories.md`;
    const outcome = settleText(readOr(join(root, storiesFile), ""), scenarioId, value);
    if (!outcome.ok) {
      if (outcome.reason === "no-scenario")
        throw new AzimuthError("not-found", `${scenarioId} is not a scenario in ${storiesFile}.`);
      throw new AzimuthError(
        "invalid",
        outcome.reason === "bad-value"
          ? "A settled value can't be empty or contain {, } or a line break."
          : `${scenarioId} has no ${OPEN_PLACEHOLDER} left to settle.`,
      );
    }
    const settled = value.trim();
    const logFile = f.files.log ?? `${f.dir}log.md`;
    const log = appendLogText(readOr(join(root, logFile), ""), {
      at: toUtc(now.toISOString()),
      actor: opts.actor,
      type: "note",
      session: opts.session ?? null,
      body: settleLogBody(scenarioId, settled),
    });
    writeFileAtomic(join(root, storiesFile), outcome.text);
    writeFileAtomic(join(root, logFile), log);
    return {
      ref: scenarioId,
      from: null,
      to: null,
      changed: [storiesFile, logFile],
      auto: false,
      message: `${scenarioId}: settled ${settled}${left(outcome.left)}`,
    };
  });
}
