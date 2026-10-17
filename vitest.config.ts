import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "viewer/src/**/*.test.{ts,tsx}"],
    exclude: ["test/fixtures/**", "node_modules/**"],
    environment: "node",
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
