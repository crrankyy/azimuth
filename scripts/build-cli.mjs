// Bundles the CLI (and its one runtime dependency, yaml) into a single file the plugin runs.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

// `import text from "./file.md?raw"` inlines the file as a string, as Vite does in the tests;
// `azimuth docs` prints the reference docs this way.
const rawText = {
  name: "raw-text",
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.slice(0, -"?raw".length)),
      namespace: "raw",
    }));
    b.onLoad({ filter: /.*/, namespace: "raw" }, async (args) => ({
      contents: await readFile(args.path, "utf8"),
      loader: "text",
      watchFiles: [args.path],
    }));
  },
};

await build({
  entryPoints: ["src/cli/index.ts"],
  outfile: "plugin/dist/cli.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: "linked",
  legalComments: "none",
  // yaml's Node entry is CommonJS; give the ESM bundle a real `require` for it.
  banner: {
    js: 'import { createRequire as __azimuthRequire } from "node:module"; const require = __azimuthRequire(import.meta.url);',
  },
  logLevel: "warning",
  plugins: [rawText],
});
