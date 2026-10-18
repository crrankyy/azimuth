import { tidyPaths, type Places } from "../core/paths";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Index } from "../core/types";

/** Text safe to place inside a `<script>` element. */
function scriptSafe(text: string): string {
  return text.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

/** JSON safe to embed in a `<script type="application/json">` element. */
export function embeddedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/**
 * The viewer's index.html with its built JS and CSS inlined and `extraHead` added, so one file
 * holds the whole app. Vite emits `./app.js` and `./app.css` (see viewer/vite.config.ts).
 */
export function inlineViewer(viewerDir: string, extraHead: string): string {
  const html = readFileSync(join(viewerDir, "index.html"), "utf8");
  const js = readFileSync(join(viewerDir, "app.js"), "utf8");
  let css = "";
  try {
    css = readFileSync(join(viewerDir, "app.css"), "utf8");
  } catch {
    // A build without styles.
  }
  return html
    .replace(/<script[^>]*src="\.\/app\.js"[^>]*><\/script>/, () => "")
    .replace(/<link[^>]*href="\.\/app\.css"[^>]*>/, () => "")
    .replace("</head>", () => `${css ? `<style>${css}</style>` : ""}${extraHead}</head>`)
    .replace("</body>", () => `<script type="module">${scriptSafe(js)}</script></body>`);
}

/** Applies `tidy` to every string in a JSON value. */
function mapStrings<T>(value: T, tidy: (s: string) => string): T {
  if (typeof value === "string") return tidy(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, tidy)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, tidy)])) as T;
  }
  return value;
}

/**
 * A single self-contained HTML snapshot to share: no token, write actions disabled, no live
 * agent activity (command lines can carry secrets and are stale anyway), and this machine's
 * folders rewritten in every text (project paths relative, home as `~`).
 */
export function exportHtml(viewerDir: string, index: Index, places: Places): string {
  const snapshot: Index = mapStrings(
    {
      ...index,
      mode: "export",
      server: null,
      project: { ...index.project, root: null },
      live: [],
    },
    (s) => tidyPaths(s, places),
  );
  return inlineViewer(
    viewerDir,
    `<script type="application/json" id="azimuth-index">${embeddedJson(snapshot)}</script>`,
  );
}
