import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Index } from "../../src/core/types";
import { IndexProvider, useIndexState } from "./data/IndexProvider";

/** In `pnpm dev:viewer` (no backend) the app renders the Hookline sample. */
const sample = import.meta.env.DEV
  ? () =>
      import("../../test/fixtures/hookline/expected-index").then(
        (m) => m.expectedIndex as unknown as Index,
      )
  : undefined;

function App() {
  const { index, connection } = useIndexState();
  if (!index) return <main>Loading…</main>;
  return (
    <main>
      <h1>{index.project.name}</h1>
      <p>
        {connection} · {index.features.length} features · rev {index.rev}
      </p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(
  <StrictMode>
    <IndexProvider sample={sample}>
      <App />
    </IndexProvider>
  </StrictMode>,
);
