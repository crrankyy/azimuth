import { useEffect, useState } from "react";
import type { Problem } from "../../../src/core/types";
import { useIndexState } from "../data/IndexProvider";
import { clock } from "../lib/format";
import { useListKeys } from "../lib/keys";
import { copyText } from "./CodeBlock";
import { Icon } from "./Icon";
import { StatusGlyph } from "./Status";
import { useUi } from "./Ui";
import "./overlays.css";

const EDITOR_SCHEMES = /^(vscode|cursor|zed|idea|file):/i;

/** An "Open in editor" link from `viewer.editor_url`, only for allowlisted schemes. */
export function editorLink(
  template: string | null,
  root: string | null,
  p: Pick<Problem, "file" | "line">,
): string | null {
  if (!template || !root || !EDITOR_SCHEMES.test(template)) return null;
  return template.replace("{abs}", `${root}/${p.file}`).replace("{line}", String(p.line ?? 1));
}

const shortPath = (file: string) => file.replace(/^\.azimuth\//, "");

/** Bottom drawer listing `azimuth check` problems, like an editor's problems view. */
export function ProblemsPanel({ onClose }: { onClose: () => void }) {
  const { index } = useIndexState();
  const { toast } = useUi();
  const [selected, setSelected] = useState(0);
  const problems = index?.problems ?? [];
  useListKeys({ count: problems.length, selected, onSelect: setSelected, insideOverlay: true });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!index) return null;
  const errors = problems.filter((p) => p.severity === "error").length;
  return (
    <section className="problems" aria-label="Problems">
      <header className="problems-head">
        <b>Problems</b>
        <span className="row" style={{ gap: 6 }}>
          <StatusGlyph glyph="s-failing" /> {errors}
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="warn-triangle" aria-hidden="true" /> {problems.length - errors}
        </span>
        <span className="spacer" />
        <span className="muted">from azimuth check · {clock(index.generated_at)}</span>
        <button type="button" className="icon-btn" aria-label="Close problems" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </header>
      <div className="problems-list" role="list">
        {problems.length === 0 && (
          <div className="palette-empty">No problems. `azimuth check` is clean.</div>
        )}
        {problems.map((p, i) => {
          const where = `${shortPath(p.file)}${p.line ? `:${p.line}` : ""}`;
          const link = editorLink(index.project.editor_url, index.project.root, p);
          return (
            <div
              key={`${p.code}-${p.file}-${p.line}-${i}`}
              role="listitem"
              className={`problem-row ${i === selected ? "sel" : ""}`.trim()}
              onClick={() => setSelected(i)}
            >
              {p.severity === "error" ? (
                <StatusGlyph glyph="s-failing" label="Error" />
              ) : (
                <span className="warn-triangle" role="img" aria-label="Warning" />
              )}
              <span className={`mono code ${p.severity}`}>{p.code}</span>
              <span className="message" title={p.message}>
                {p.message}
              </span>
              {i === selected ? (
                <span className="row" style={{ gap: 6 }}>
                  <span className="mono path">{where}</span>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() =>
                      copyText(p.file).then(() =>
                        toast({ title: "Copied the path", detail: p.file }),
                      )
                    }
                  >
                    Copy path
                  </button>
                  {link && (
                    <a className="copy-btn" href={link}>
                      Open in editor
                    </a>
                  )}
                </span>
              ) : (
                <span className="mono path">{where}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
