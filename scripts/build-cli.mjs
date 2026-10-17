// Bundles the CLI (and its one runtime dependency, yaml) into a single file the plugin runs.
import { build } from "esbuild";

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
});
