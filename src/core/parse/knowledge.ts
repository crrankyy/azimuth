import { fieldContext, finishSchema, opt, r, type Reader } from "../schema";
import { stripTitle } from "../sections";
import type { GlossaryTerm, KnowledgeDoc, Module, Problem } from "../types";
import { readFrontmatter } from "./common";

export function parseDoc(
  text: string | null,
  file: string,
): { doc: KnowledgeDoc; problems: Problem[] } {
  if (text === null) return { doc: { file, updated: null, body: "" }, problems: [] };
  const { fm, problems } = readFrontmatter(text, file);
  const ctx = fieldContext(file, fm.data, fm.keyLines);
  const updated = opt(ctx, "updated", r.nullable(r.date()), null);
  return {
    doc: { file, updated, body: stripTitle(fm.body) },
    problems: [...problems, ...finishSchema(ctx)],
  };
}

const modulesReader: Reader<Module[]> = (v) => {
  if (v === null || v === undefined) return { ok: true, value: [] };
  if (!Array.isArray(v))
    return { ok: false, expected: "a list of {name, path, responsibility, depends_on}" };
  const modules: Module[] = [];
  for (const item of v) {
    const o = (item ?? {}) as Record<string, unknown>;
    if (typeof o.name !== "string" || typeof o.path !== "string") {
      return { ok: false, expected: "a list of {name, path, responsibility, depends_on}" };
    }
    modules.push({
      name: o.name,
      path: o.path.replace(/\/+$/, ""),
      responsibility: typeof o.responsibility === "string" ? o.responsibility : "",
      depends_on: Array.isArray(o.depends_on) ? o.depends_on.map(String) : [],
    });
  }
  return { ok: true, value: modules };
};

export interface ArchitectureDoc extends KnowledgeDoc {
  reconciled_at: string | null;
  modules: Module[];
}

export function parseArchitecture(
  text: string | null,
  file: string,
): { doc: ArchitectureDoc; problems: Problem[] } {
  if (text === null)
    return {
      doc: { file, updated: null, body: "", reconciled_at: null, modules: [] },
      problems: [],
    };
  const { fm, problems } = readFrontmatter(text, file);
  const ctx = fieldContext(file, fm.data, fm.keyLines);
  const doc: ArchitectureDoc = {
    file,
    updated: opt(ctx, "updated", r.nullable(r.date()), null),
    body: stripTitle(fm.body),
    reconciled_at: opt(ctx, "reconciled_at", r.nullable(r.text()), null),
    modules: opt(ctx, "modules", modulesReader, []),
  };
  return { doc, problems: [...problems, ...finishSchema(ctx)] };
}

const termsReader: Reader<GlossaryTerm[]> = (v) => {
  if (v === null || v === undefined) return { ok: true, value: [] };
  if (!Array.isArray(v)) return { ok: false, expected: "a list of {term, definition, aliases}" };
  const terms: GlossaryTerm[] = [];
  for (const item of v) {
    const o = (item ?? {}) as Record<string, unknown>;
    if (typeof o.term !== "string")
      return { ok: false, expected: "a list of {term, definition, aliases}" };
    terms.push({
      term: o.term,
      definition: typeof o.definition === "string" ? o.definition : "",
      aliases: Array.isArray(o.aliases) ? o.aliases.map(String) : [],
    });
  }
  return { ok: true, value: terms };
};

export function parseGlossary(
  text: string | null,
  file: string,
): { terms: GlossaryTerm[]; problems: Problem[] } {
  if (text === null) return { terms: [], problems: [] };
  const { fm, problems } = readFrontmatter(text, file);
  const ctx = fieldContext(file, fm.data, fm.keyLines);
  const terms = opt(ctx, "terms", termsReader, []);
  return { terms, problems: [...problems, ...finishSchema(ctx)] };
}
