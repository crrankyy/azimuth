import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Index } from "../../src/core/types";
import { App } from "./App";
import { IndexProvider } from "./data/IndexProvider";
import "./styles/azimuth.css";
import "./styles/base.css";

/** In `pnpm dev:viewer` (no backend) the app renders the Hookline sample. */
const sample = import.meta.env.DEV
  ? () =>
      import("../../test/fixtures/hookline/expected-index").then(
        (m) => m.expectedIndex as unknown as Index,
      )
  : undefined;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(
  <StrictMode>
    <IndexProvider sample={sample}>
      <App />
    </IndexProvider>
  </StrictMode>,
);
