import { useState } from "react";
import { outputLineClass, tokenize } from "../lib/highlight";
import { parseStateDiagram } from "../lib/graph";
import { StateDiagram } from "./StateDiagram";

export function copyText(text: string): Promise<void> {
  return navigator.clipboard?.writeText(text) ?? Promise.reject(new Error("Clipboard unavailable"));
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={() =>
        copyText(text).then(
          () => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1_500);
          },
          () => undefined,
        )
      }
    >
      {done ? "Copied" : label}
    </button>
  );
}

/** A highlighted code block with a copy button; `mermaid` state diagrams render as diagrams. */
export function CodeBlock({ code, language = "" }: { code: string; language?: string }) {
  if (language === "mermaid") {
    const graph = parseStateDiagram(code);
    if (graph) return <StateDiagram graph={graph} />;
  }
  return (
    <div className="code-wrap">
      <pre className="az-code">
        <code>
          {tokenize(code, language).map((t, i) =>
            t.cls ? (
              <span key={i} className={t.cls}>
                {t.text}
              </span>
            ) : (
              t.text
            ),
          )}
        </code>
      </pre>
      <div className="code-tools">
        {language && <span className="code-lang">{language}</span>}
        <CopyButton text={code} />
      </div>
    </div>
  );
}

/** Test or command output with failures, passes and file pointers colored. */
export function OutputTail({ text, wrap = false }: { text: string; wrap?: boolean }) {
  return (
    <pre className="az-code output" style={wrap ? { whiteSpace: "pre-wrap" } : undefined}>
      {text.split("\n").map((line, i) => {
        const cls = outputLineClass(line);
        return (
          <span key={i} className={cls ? `out-${cls}` : undefined}>
            {line}
            {"\n"}
          </span>
        );
      })}
    </pre>
  );
}
