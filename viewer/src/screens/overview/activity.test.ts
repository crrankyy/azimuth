import { describe, expect, it } from "vitest";
import type { Index, Question } from "../../../../src/core/types";
import { expectedIndex } from "../../../../test/fixtures/hookline/expected-index";
import { recentActivity } from "./activity";

describe("F-012 recent activity says who answered", () => {
  it("S-012.6.5 leads an agent's answer with Agent answered", () => {
    const index = structuredClone(expectedIndex) as unknown as Index;
    const question: Question = {
      ...(index.questions[0] as Question),
      id: "Q-0001",
      status: "answered",
      answer: { option: "full", text: "", answered_at: "2026-10-20T09:00:00Z", by: "agent" },
    };
    index.questions = [question];
    const line = recentActivity(index, 100).find(
      (l) => l.id === "Q-0001" && l.at === "2026-10-20T09:00:00Z",
    );
    expect(line).toMatchObject({
      lead: "Agent answered",
      id: "Q-0001",
      at: "2026-10-20T09:00:00Z",
    });
  });
});
