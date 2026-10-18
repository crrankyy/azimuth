import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { inline } from "./markdown";

const html = (text: string) => renderToStaticMarkup(<>{inline(text)}</>);

describe("inline", () => {
  it("leaves underscores inside words alone", () => {
    expect(html("d1.state = scheduled_retry, attempt_count = 3")).toBe(
      "d1.state = scheduled_retry, attempt_count = 3",
    );
  });

  it("still reads _emphasis_ and *emphasis* between words", () => {
    expect(html("an _important_ and *other* note")).toBe(
      "an <em>important</em> and <em>other</em> note",
    );
  });

  it("drops links with unsafe schemes but keeps their label", () => {
    const out = html("[click](javascript:alert) and [docs](https://example.com)");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("click and ");
    expect(out).toContain('href="https://example.com"');
  });
});
