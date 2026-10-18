import { describe, expect, it } from "vitest";
import { parseOptions } from "../../src/cli/commands/write";

describe("question options from --option", () => {
  it("BUG-0015 keeps commas inside an option", () => {
    const options = parseOptions(
      ["a=Per-user: the XDG path, else ~/.config", "b=Per-project: the nearest .tallyrc"],
      "a",
    );
    expect(options).toEqual([
      { key: "a", label: "Per-user", detail: "the XDG path, else ~/.config", recommended: true },
      { key: "b", label: "Per-project", detail: "the nearest .tallyrc", recommended: false },
    ]);
  });

  it('BUG-0018 ends the label at the first ": " outside brackets and quotes', () => {
    const [json] = parseOptions(
      ['a=JSON (config.json with {"json": true}): parsed by JSON.parse'],
      "a",
    );
    expect(json).toMatchObject({
      label: 'JSON (config.json with {"json": true})',
      detail: "parsed by JSON.parse",
    });
    const [quoted] = parseOptions(['b="Label: with colon": the detail'], undefined);
    expect(quoted).toMatchObject({ label: '"Label: with colon"', detail: "the detail" });
  });

  it("takes the whole text as the label when there is no detail", () => {
    expect(parseOptions("c=Just a label, no detail", undefined)).toEqual([
      { key: "c", label: "Just a label, no detail", detail: "", recommended: false },
    ]);
  });
});
