import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index, InboxItem, Question } from "../../../src/core/types";
import { expectedIndex } from "../../../test/fixtures/hookline/expected-index";
import { UiProvider } from "../components/Ui";
import { IndexContext } from "../data/IndexProvider";
import { parseRoute } from "../lib/router";
import { InboxScreen } from "./Inbox";

const NOW = Date.parse("2026-10-20T12:00:00Z");

/** The sample index with Q-0001 "Which lock?" answered by an agent, and `inbox` as its inbox. */
function indexWith(inbox: InboxItem[]): Index {
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
    answer: { option: "a", text: "", answered_at: "2026-10-20T09:00:00Z", by: "agent" },
    resolution: null,
    review_ack_at: null,
  };
  index.questions = [question];
  index.inbox = inbox;
  return index;
}

function render(index: Index): string {
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
        <InboxScreen route={parseRoute("#/inbox")} />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

const ASIDE = '<aside aria-label="Agent status"';

/** The inbox row whose markup mentions `id` (rows end where the next row or the aside begins). */
const row = (html: string, id: string) =>
  (html.split(ASIDE)[0] ?? "")
    .split("data-inbox-row=")
    .slice(1)
    .find((r) => r.includes(id)) ?? "";

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buttons = (html: string) =>
  [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(([, inner]) => text(inner ?? ""));

const reviewItem = (ref: string, title: string, detail: string): InboxItem => ({
  kind: "review-auto",
  ref,
  title,
  detail,
  since: "2026-10-20T09:00:00Z",
  urgency: "low",
});

describe("F-012 Review items in the inbox", () => {
  it("S-012.6.3 offers to answer an agent's answer differently", () => {
    const html = render(
      indexWith([
        reviewItem(
          "Q-0001",
          "Which lock?",
          "Answered by an agent with its recommendation: Lockfile. Acknowledge it or answer differently.",
        ),
      ]),
    );
    const q = row(html, "Q-0001");
    expect(text(q)).toContain(
      "Answered by an agent with its recommendation: Lockfile. Acknowledge it or answer differently.",
    );
    expect(buttons(q)).toEqual(expect.arrayContaining(["Answer differently", "Acknowledge"]));
    expect(buttons(q)).not.toContain("Send back…");
    expect(text(html.split(ASIDE)[1] ?? "")).not.toContain("You answered Q-0001");
  });

  it("S-012.6.4 still sends a feature back", () => {
    const html = render(
      indexWith([
        reviewItem(
          "F-005",
          "Retry with exponential backoff was approved automatically",
          "An agent approved this spec when every check passed. Acknowledge it or send it back to draft.",
        ),
      ]),
    );
    const f = row(html, "F-005");
    expect(buttons(f)).toEqual(expect.arrayContaining(["Send back…", "Acknowledge"]));
    expect(buttons(f)).not.toContain("Answer differently");
  });
});
