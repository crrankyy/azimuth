import { writeAsBuilt } from "../../core/as-built";
import { idKind } from "../../core/ids";
import { recordInSession } from "../../core/session";
import { print, printJson, requirePositional, runtime, UsageError } from "../io";
import type { Command } from "../types";

export const asBuilt: Command = {
  usage: "as-built <F-ID> [--json]",
  summary:
    "Draft as-built.md from the feature's commits: files changed and deviations from impact.md",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "F-ID");
    // writeAsBuilt refuses a non-feature ID too, but as AzimuthError (exit 1); this is a usage error.
    if (idKind(id) !== "feature") throw new UsageError(`${id} is not a feature ID.`);
    const rt = runtime(values);
    const result = writeAsBuilt(rt.root, id);
    recordInSession(rt.root, rt.session, { touched: [id] });
    if (rt.json) printJson(result);
    else print(result.message);
  },
};
