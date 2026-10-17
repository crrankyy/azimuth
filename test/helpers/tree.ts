import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Writes `files` (relative path → content) into a fresh temp directory. */
export function writeTree(
  files: Record<string, string>,
  prefix = "azimuth-test-",
): {
  root: string;
  write: (path: string, content: string) => void;
  cleanup: () => void;
} {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const write = (path: string, content: string) => {
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };
  for (const [path, content] of Object.entries(files)) write(path, content);
  return { root, write, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

export const MINIMAL_CONFIG = `schema: 1
project:
  name: Demo
  description: A demo project.
  mode: greenfield
tests:
  globs: ["test/**/*.test.ts"]
`;

export function featureMd(fields: Record<string, string>, body = ""): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n${body}`;
}
