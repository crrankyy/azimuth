import { featureOf } from "../../../../src/core/ids";
import type { Index, Module } from "../../../../src/core/types";
import { IdChip } from "../../components/IdChip";
import { ModuleMap } from "../../components/ModuleMap";
import { FlagBadge } from "../../components/primitives";
import { plural } from "../../lib/format";
import { Prose } from "../../lib/markdown";

/** Splits a document after its first `##` section, where the module map goes. */
function splitAfterFirstSection(body: string): [string, string] {
  const headings = [...body.matchAll(/^##\s/gm)];
  const second = headings[1]?.index;
  return second === undefined ? [body, ""] : [body.slice(0, second), body.slice(second)];
}

const underModule = (path: string, modules: Module[]) =>
  modules.some((m) => path === m.path || path.startsWith(`${m.path}/`));

/**
 * Directories that features create or change outside every module path; the same rule as the
 * W-PATH check in src/core/validate.ts.
 */
function unmappedDirs(index: Index): string[] {
  const modules = index.knowledge.architecture.modules;
  if (modules.length === 0) return [];
  const dirs = index.features.flatMap((f) =>
    (f.detail?.impact ?? [])
      .filter((e) => e.change !== "test" && !underModule(e.path, modules))
      .map((e) => (e.path.includes("/") ? e.path.slice(0, e.path.lastIndexOf("/")) : e.path)),
  );
  return [...new Set(dirs)].sort();
}

/** Features referenced by commits made after the reconciled commit. */
function featuresSince(index: Index, sha: string | null): string[] | null {
  const base = index.commits.find((c) => c.sha === sha);
  if (!base) return null;
  const ids = index.commits
    .filter((c) => c.at > base.at)
    .flatMap((c) => c.refs.map(featureOf))
    .filter((id): id is string => !!id);
  return [...new Set(ids)].sort();
}

function FreshnessNote({ index }: { index: Index }) {
  const arch = index.knowledge.architecture;
  const base = index.commits.find((c) => c.sha === arch.reconciled_at);
  const since = featuresSince(index, arch.reconciled_at);
  return (
    <div role="note" className="kn-fresh">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M8 2.5l6 11H2z" />
        <path d="M8 7v2.6M8 11.6v.1" />
      </svg>
      <div className="kn-fresh-text">
        <span className="kn-fresh-title">
          May be out of date: {plural(arch.commits_since_reconciled, "commit")} since last
          reconciled
        </span>
        <span className="kn-fresh-detail">
          {arch.reconciled_at ? (
            <>
              Reconciled at <span className="az-mono">{arch.reconciled_at}</span>
              {base ? ` (${base.subject})` : ""}.
            </>
          ) : (
            "Never reconciled."
          )}
          {since && since.length > 0 && (
            <>
              {" Since then, commits touched "}
              {since.map((id, i) => (
                <span key={id}>
                  {i > 0 && (i === since.length - 1 ? " and " : ", ")}
                  <IdChip id={id} />
                </span>
              ))}
              .
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/** architecture.md with its freshness notice and the ModuleMap after the first section. */
export function ArchitectureDoc({ index }: { index: Index }) {
  const arch = index.knowledge.architecture;
  const options = { terms: index.knowledge.glossary };
  const [head, rest] = splitAfterFirstSection(arch.body);
  const unmapped = unmappedDirs(index);
  return (
    <>
      {arch.commits_since_reconciled > 0 && <FreshnessNote index={index} />}
      {head.trim() && <Prose text={head} options={options} />}
      <div className="az-prose">
        <h2>Module map</h2>
      </div>
      {arch.modules.length > 0 ? (
        <ModuleMap
          modules={arch.modules}
          footer={unmapped.map((dir) => (
            <span key={dir} className="kn-unmapped">
              <FlagBadge>{dir}</FlagBadge>
              not under any module yet
            </span>
          ))}
        />
      ) : (
        <p className="kn-quiet">
          No modules yet. List them under <span className="az-mono">modules</span> in the
          frontmatter of <span className="az-mono">{arch.file}</span> to draw the map.
        </p>
      )}
      {rest.trim() && <Prose text={rest} options={options} />}
    </>
  );
}
