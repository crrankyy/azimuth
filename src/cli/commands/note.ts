import { featureOf } from "../../core/ids";
import { addNote } from "../../core/notes";
import { recordInSession } from "../../core/session";
import { print, printJson, requirePositional, runtime } from "../io";
import type { Command } from "../types";

export const note: Command = {
  usage: 'note <T-ID | F-ID> "<text>"',
  summary: "Record what a task taught in the feature's notes.md (never makes the approval stale)",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const ref = requirePositional(positionals, 0, "ID");
    const text = requirePositional(positionals, 1, "text");
    const rt = runtime(values);
    const result = addNote(rt.root, ref, text, { actor: rt.actor, session: rt.session });
    const feature = featureOf(ref) ?? ref;
    recordInSession(rt.root, rt.session, {
      touched: feature === ref ? [feature] : [feature, ref],
    });
    if (rt.json) printJson(result);
    else print(result.message);
  },
};
