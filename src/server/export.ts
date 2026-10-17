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

/** A single self-contained HTML snapshot: no token, no absolute paths, write actions disabled. */
export function exportHtml(viewerDir: string, index: Index): string {
  const snapshot: Index = {
    ...index,
    mode: "export",
    server: null,
    project: { ...index.project, root: null },
  };
  return inlineViewer(
    viewerDir,
    `<script type="application/json" id="azimuth-index">${embeddedJson(snapshot)}</script>`,
  );
}
