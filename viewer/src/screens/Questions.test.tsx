import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Actor, Index, Question } from "../../../src/core/types";
import { expectedIndex } from "../../../test/fixtures/hookline/expected-index";
import { UiProvider } from "../components/Ui";
import { IndexContext } from "../data/IndexProvider";
import { parseRoute } from "../lib/router";
import { QuestionsScreen } from "./Questions";

const NOW = Date.parse("2026-10-20T12:00:00Z");

/** The sample index with one question, Q-0001 "Which lock?", answered with option a by `by`. */
function indexAnsweredBy(by: Actor): Index {
  const index = structuredClone(expectedIndex) as unknown as Index;
  const question: Question = {
    ...(index.questions[0] as Question),
    id: "Q-0001",
    title: "Which lock?",
    status: "answered",
    blocking: false,
    options: [
      { key: "a", label: "Lockfile", detail: "Simple", recommended: true },
      { key: "b", label: "Advisory lock", detail: "Faster", recommended: false },
    ],
    answer: { option: "a", text: "", answered_at: "2026-10-20T09:00:00Z", by },
    resolution: null,
    review_ack_at: null,
  };
  index.questions = [question];
  return index;
}

function render(index: Index, hash: string): string {
  const value = {
    index,
    connection: "live" as const,
    attempts: 0,
    lastUpdate: NOW,
    changed: new Set<string>(),
    now: NOW,
    act: async () => ({ ok: true, status: 200 }),
  };
  return renderToStaticMarkup(
    <UiProvider>
      <IndexContext.Provider value={value}>
        <QuestionsScreen route={parseRoute(hash)} />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

/** The text of every button in some markup. */
const buttons = (html: string) =>
  [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(([, inner]) =>
    (inner ?? "").replace(/<[^>]+>/g, "").trim(),
  );

describe("F-012 the Questions screen shows who answered", () => {
  it("S-012.6.1 labels an agent's answer and offers to answer differently", () => {
    const html = render(indexAnsweredBy("agent"), "#/questions/Q-0001");
    expect(html).toContain("Answered by an agent with its recommendation");
    expect(buttons(html)).toContain("Answer differently");
    expect(html).not.toContain("Your answer");
  });

  it("S-012.6.2 shows your own answer without an overrule", () => {
    const html = render(indexAnsweredBy("you"), "#/questions/Q-0001");
    expect(html).toContain("Your answer");
    expect(html).not.toContain("Answer differently");
  });
});
