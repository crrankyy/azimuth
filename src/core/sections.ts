/** Splitting Markdown bodies into `## ` sections (ignoring headings inside code fences). */

export interface Section {
  title: string;
  body: string;
  /** 1-based line of the heading within the text passed in. */
  line: number;
}

const FENCE = /^\s*(```|~~~)/;

/** Removes a leading `# Title` line (and surrounding blank lines) and trims the result. */
export function stripTitle(body: string): string {
  const text = body.replace(/\r\n?/g, "\n").replace(/^\s*\n/, "");
  const lines = text.split("\n");
  if (/^#\s/.test(lines[0] ?? "")) lines.shift();
  return lines.join("\n").trim();
}

export function splitSections(body: string): { preamble: string; sections: Section[] } {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const sections: Section[] = [];
  const preamble: string[] = [];
  let current: { title: string; line: number; lines: string[] } | null = null;
  let inFence = false;
  lines.forEach((line, i) => {
    if (FENCE.test(line)) inFence = !inFence;
    const heading = !inFence ? /^##\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (heading && !line.startsWith("###")) {
      if (current)
        sections.push({
          title: current.title,
          line: current.line,
          body: current.lines.join("\n").trim(),
        });
      current = { title: heading[1] ?? "", line: i + 1, lines: [] };
      return;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  });
  if (current) {
    const c = current as { title: string; line: number; lines: string[] };
    sections.push({ title: c.title, line: c.line, body: c.lines.join("\n").trim() });
  }
  return { preamble: stripTitle(preamble.join("\n")), sections };
}

/** Section body by case-insensitive title, or "" when absent. */
export function sectionBody(sections: Section[], title: string): string {
  const wanted = title.toLowerCase();
  return sections.find((s) => s.title.toLowerCase() === wanted)?.body ?? "";
}
