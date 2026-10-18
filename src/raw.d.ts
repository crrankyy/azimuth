// `import text from "./file.md?raw"` inlines a file as a string: Vite does this natively in the
// tests, and scripts/build-cli.mjs does it for the CLI bundle.
declare module "*?raw" {
  const text: string;
  export default text;
}
