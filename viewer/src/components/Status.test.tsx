import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentStatusMark } from "./Status";

describe("F-015 agent status marks", () => {
  it("S-015.6.4 pairs each status's mark with its label", () => {
    expect(renderToStaticMarkup(<AgentStatusMark status="running" />)).toBe(
      '<span class="agent-status running"><span class="az-run" aria-hidden="true"></span>Running</span>',
    );
    expect(renderToStaticMarkup(<AgentStatusMark status="waiting" />)).toBe(
      '<span class="agent-status waiting"><span class="az-wait" aria-hidden="true"></span>Waiting on you</span>',
    );
    expect(renderToStaticMarkup(<AgentStatusMark status="done" />)).toBe(
      '<span class="agent-status done"><span class="az-g s-done" aria-hidden="true"></span>Done</span>',
    );
  });

  it("S-015.6.5 keeps a short or hidden label readable", () => {
    expect(renderToStaticMarkup(<AgentStatusMark status="waiting" short />)).toBe(
      '<span class="agent-status waiting"><span class="az-wait" aria-hidden="true"></span>waiting</span>',
    );
    expect(renderToStaticMarkup(<AgentStatusMark status="waiting" hideLabel />)).toBe(
      '<span class="agent-status waiting"><span class="az-wait" aria-hidden="true"></span><span class="sr-only">Waiting on you</span></span>',
    );
  });
});
