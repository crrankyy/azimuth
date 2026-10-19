import { featureOf } from "../../core/ids";
import { recordInSession } from "../../core/session";
import { settleValue } from "../../core/settle";
import { print, printJson, requirePositional, runtime } from "../io";
import type { Command } from "../types";

export const settle: Command = {
  usage: 'settle <S-ID> "<value>"',
  summary: "Replace a scenario's first {?} with the value a passing test proved",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "S-ID");
    const value = requirePositional(positionals, 1, "value");
    const rt = runtime(values);
    const result = settleValue(rt.root, id, value, { actor: rt.actor, session: rt.session });
    recordInSession(rt.root, rt.session, { touched: [featureOf(id) ?? id, id] });
    if (rt.json) printJson(result);
    else print(result.message);
  },
};
