import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index } from "../../../src/core/types";
import { expectedIndex } from "../../../test/fixtures/hookline/expected-index";
import { IndexContext } from "../data/IndexProvider";
import { CommandPalette } from "./CommandPalette";
import { UiProvider } from "./Ui";

const NOW = Date.parse("2026-10-18T12:05:00Z");

function render(): string {
  const value = {
    index: structuredClone(expectedIndex) as unknown as Index,
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
        <CommandPalette onClose={() => undefined} />
      </IndexContext.Provider>
    </UiProvider>,
  );
}

/** The Go to group's items: each label with its key hints. */
function goToItems(html: string): { label: string; keys: string[] }[] {
  const after = html.split('<div class="palette-group">Go to</div>')[1] ?? "";
  const group = after.split('<div class="palette-foot">')[0] ?? "";
  return group
    .split('role="option"')
    .slice(1)
    .map((item) => ({
      label: /class="palette-label">([^<]*)</.exec(item)?.[1] ?? "",
      keys: [...item.matchAll(/class="az-kbd">([^<]*)</g)].map(([, key]) => key ?? ""),
    }));
}

describe("F-015 the palette's sections", () => {
  it("S-015.1.4 offers Agents after Inbox and Activity on g t", () => {
    const items = goToItems(render());
    expect(items.slice(0, 2)).toEqual([
      { label: "Inbox", keys: ["g", "i"] },
      { label: "Agents", keys: ["g", "a"] },
    ]);
    expect(items.find((item) => item.label === "Activity")).toEqual({
      label: "Activity",
      keys: ["g", "t"],
    });
  });
});
