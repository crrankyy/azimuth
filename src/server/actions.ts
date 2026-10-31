import { isAzimuthError } from "../core/errors";
import {
  acknowledge,
  addLogEntry,
  answerQuestion,
  move,
  moveDecision,
  moveFeature,
  reapproveFeature,
  setField,
  type Result,
} from "../core/transitions";
import { idKind } from "../core/ids";
import { releaseMilestone } from "../core/release";

/** A write the viewer asks for. `expect` is the status the user saw (stale-write protection). */
export interface ActionRequest {
  action: string;
  ref: string;
  expect?: string;
  payload?: Record<string, unknown>;
}

export interface ActionResponse {
  status: number;
  body: Record<string, unknown>;
}

const you = { actor: "you" as const };

function text(payload: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = payload?.[key];
  return typeof value === "string" ? value : undefined;
}

/** Runs one viewer action as you; the server never acts as an agent. */
export function runAction(root: string, req: ActionRequest): { result: Result } | ActionResponse {
  if (typeof req.ref !== "string" || !idKind(req.ref)) {
    return {
      status: 400,
      body: { ok: false, error: "invalid", message: "ref must be an Azimuth ID." },
    };
  }
  const p = req.payload ?? {};
  const opts = { ...you, expectStatus: req.expect };
  try {
    switch (req.action) {
      case "approve":
        return { result: moveFeature(root, req.ref, "approved", opts) };
      case "reapprove":
        return { result: reapproveFeature(root, req.ref, opts) };
      case "request-changes":
        return { result: addLogEntry(root, req.ref, "review", text(p, "comment") ?? "", you) };
      case "answer":
        return {
          result: answerQuestion(
            root,
            req.ref,
            { option: text(p, "option") ?? null, text: text(p, "text") },
            you,
          ),
        };
      case "decide": {
        const decision = text(p, "decision");
        if (decision !== "accepted" && decision !== "rejected") {
          return {
            status: 400,
            body: {
              ok: false,
              error: "invalid",
              message: "decision must be accepted or rejected.",
            },
          };
        }
        return {
          result: moveDecision(root, req.ref, decision, { ...opts, note: text(p, "note") }),
        };
      }
      case "acknowledge":
        return { result: acknowledge(root, req.ref, you) };
      case "revert":
        return idKind(req.ref) === "feature"
          ? { result: moveFeature(root, req.ref, "draft", { ...opts, reason: text(p, "reason") }) }
          : { result: moveDecision(root, req.ref, "proposed", opts) };
      case "move":
        return {
          result: move(root, req.ref, text(p, "to") ?? "", {
            ...opts,
            reason: text(p, "reason"),
            supersededBy: text(p, "by"),
          }),
        };
      case "release":
        return { result: releaseMilestone(root, req.ref, opts) };
      case "set": {
        const value = p.value === null ? null : text(p, "value");
        return { result: setField(root, req.ref, text(p, "field") ?? "", value ?? null, you) };
      }
      default:
        return {
          status: 400,
          body: { ok: false, error: "invalid", message: `Unknown action "${req.action}".` },
        };
    }
  } catch (e) {
    if (!isAzimuthError(e)) throw e;
    const status = {
      gate: 409,
      conflict: 409,
      busy: 409,
      "not-found": 404,
      policy: 403,
      invalid: 400,
    }[e.code];
    return {
      status,
      body: { ok: false, error: e.code, message: e.message, ...(e.gate ? { gate: e.gate } : {}) },
    };
  }
}
