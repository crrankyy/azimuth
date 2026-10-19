import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { parseConfig } from "../../src/core/config";
import { AzimuthError } from "../../src/core/errors";
import { configYaml } from "../../src/core/init";
import { loadProject } from "../../src/core/model";
import { acknowledge, answerQuestion, proceedWithRecommendation } from "../../src/core/transitions";
import { featureFiles } from "../helpers/project";
import { featureMd, MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const PROCEED = `${MINIMAL_CONFIG}autonomy:\n  questions: proceed\n`;
const QUESTION_FILE = ".azimuth/questions/Q-0001.md";
const LOG_FILE = ".azimuth/features/F-001-thing/log.md";
const AGENT = {
  actor: "agent" as const,
  session: "SES-20261020-0900",
  now: new Date("2026-10-20T09:00:00Z"),
};

/** Q-0001 "Which lock?" as the stories describe it; `over` replaces frontmatter lines. */
function questionMd(over: Record<string, string> = {}): string {
  return featureMd(
    {
      id: "Q-0001",
      title: "Which lock?",
      status: "open",
      feature: "F-001",
      blocking: "false",
      raised_by: "agent",
      raised_at: "2026-10-20T08:55:00Z",
      options: [
        "",
        "  - key: a",
        "    label: Lockfile",
        "    detail: Simple",
        "    recommended: true",
        "  - key: b",
        "    label: Advisory lock",
        "    detail: Faster",
      ].join("\n"),
      answer: "null",
      resolution: "null",
      ...over,
    },
    "## Context\nTwo agents may write the same file.\n",
  );
}

/** The proceed project: F-001 with a log and Q-0001 (`over` changes the question). */
function project(over: Record<string, string> = {}, config = PROCEED) {
  const tree = writeTree({
    ".azimuth/config.yaml": config,
    ...featureFiles({ id: "F-001", status: "in-progress" }),
    [QUESTION_FILE]: questionMd(over),
  });
  cleanup = tree.cleanup;
  return tree;
}

describe("ST-012.1 autonomy.questions", () => {
  it("S-012.1.1 reads proceed from the config", () => {
    const { config, problems } = parseConfig(PROCEED);
    expect(config.autonomy).toEqual({
      approve_specs: "auto",
      accept_adrs: "auto",
      questions: "proceed",
      strict: false,
    });
    expect(problems).toEqual([]);
  });

  it("S-012.1.2 waits for you without the key, and init writes it as ask", () => {
    expect(parseConfig(MINIMAL_CONFIG).config.autonomy.questions).toBe("ask");
    const yaml = configYaml({
      name: "shop",
      mode: "brownfield",
      languages: ["typescript"],
      packageManager: "pnpm",
      testRunner: "vitest",
      commands: { test: "pnpm test" },
      testGlobs: ["**/*.test.*"],
      usesPrettier: false,
    });
    expect(yaml.split("\n")).toContain(
      "  questions: ask # ask: only you answer; proceed: agents take their own recommendation on non-blocking questions",
    );
  });

  it("S-012.1.3 reports an unknown mode and falls back to ask", () => {
    const { config, problems } = parseConfig(`${MINIMAL_CONFIG}autonomy:\n  questions: maybe\n`);
    expect(problems).toEqual([
      expect.objectContaining({
        code: "E-SCHEMA",
        severity: "error",
        message: "autonomy.questions must be ask or proceed.",
      }),
    ]);
    expect(config.autonomy.questions).toBe("ask");
  });
});

describe("ST-012.2 answers record who gave them", () => {
  it("S-012.2.1 reads an answer written before F-012 as yours", () => {
    const tree = project({
      status: "answered",
      answer: '{option: a, text: "", answered_at: 2026-10-18T10:00:00Z}',
    });
    const model = loadProject(tree.root);
    const q = model.questions.find((x) => x.id === "Q-0001");
    expect(q?.answer).toEqual({
      option: "a",
      text: "",
      answered_at: "2026-10-18T10:00:00Z",
      by: "you",
    });
    expect(q?.review_ack_at).toBeNull();
    expect(model.problems).toEqual([]);
  });

  it("S-012.2.2 reads an agent's answer and its acknowledgement", () => {
    const tree = project({
      status: "answered",
      answer: '{option: a, text: "", answered_at: 2026-10-20T09:00:00Z, by: agent}',
      review_ack_at: "2026-10-20T10:00:00Z",
    });
    const model = loadProject(tree.root);
    const q = model.questions.find((x) => x.id === "Q-0001");
    expect(q?.answer?.by).toBe("agent");
    expect(q?.review_ack_at).toBe("2026-10-20T10:00:00Z");
    expect(model.problems).toEqual([]);
  });

  it("S-012.2.3 rejects an unknown answerer", () => {
    const tree = project({
      status: "answered",
      answer: '{option: a, text: "", answered_at: 2026-10-20T09:00:00Z, by: bot}',
    });
    const model = loadProject(tree.root);
    const errors = model.problems.filter((p) => p.code === "E-SCHEMA" && p.file === QUESTION_FILE);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(
      /^answer must be \{option, text, answered_at, by: you \| agent\}/,
    );
    expect(model.questions.some((x) => x.id === "Q-0001")).toBe(false);
  });
});

describe("ST-012.3 an agent's question is answered with its recommendation", () => {
  const read = (root: string, file: string) => readFileSync(join(root, file), "utf8");
  const q1 = (root: string) => loadProject(root).questions.find((x) => x.id === "Q-0001");

  it("S-012.3.1 answers a non-blocking question with its recommendation", () => {
    const tree = project();
    const result = proceedWithRecommendation(tree.root, "Q-0001", AGENT);
    const q = q1(tree.root);
    expect(q?.status).toBe("answered");
    expect(q?.answer).toEqual({
      option: "a",
      text: "",
      answered_at: "2026-10-20T09:00:00Z",
      by: "agent",
    });
    expect(result?.auto).toBe(true);
    expect(result?.message).toBe(
      "Q-0001: answered automatically with its recommendation (a: Lockfile)",
    );
    expect(read(tree.root, LOG_FILE)).toMatch(
      /\n## 2026-10-20T09:00:00Z · agent · note · SES-20261020-0900 · auto\nQ-0001 answered with its recommendation: Lockfile\n$/,
    );
  });

  it("S-012.3.3 leaves a blocking question for you", () => {
    const tree = project({ blocking: "true" });
    const log = read(tree.root, LOG_FILE);
    expect(proceedWithRecommendation(tree.root, "Q-0001", AGENT)).toBeNull();
    expect(q1(tree.root)).toMatchObject({ status: "open", answer: null });
    expect(read(tree.root, LOG_FILE)).toBe(log);
  });

  it("S-012.3.4 leaves a question without one recommendation for you", () => {
    const tree = project({
      options: [
        "",
        "  - key: a",
        "    label: Lockfile",
        "    detail: Simple",
        "  - key: b",
        "    label: Advisory lock",
        "    detail: Faster",
      ].join("\n"),
    });
    expect(proceedWithRecommendation(tree.root, "Q-0001", AGENT)).toBeNull();
    expect(q1(tree.root)).toMatchObject({ status: "open", answer: null });
  });

  it("S-012.3.6 leaves a question you create for you", () => {
    const tree = project();
    expect(proceedWithRecommendation(tree.root, "Q-0001", { ...AGENT, actor: "you" })).toBeNull();
    expect(q1(tree.root)).toMatchObject({ status: "open", answer: null });
  });

  it("S-012.3.7 answers a question without a feature and writes no log entry", () => {
    const tree = project({ feature: "null" });
    const log = read(tree.root, LOG_FILE);
    const result = proceedWithRecommendation(tree.root, "Q-0001", AGENT);
    expect(q1(tree.root)?.answer?.by).toBe("agent");
    expect(result?.changed).toEqual([QUESTION_FILE]);
    expect(read(tree.root, LOG_FILE)).toBe(log);
  });
});

describe("ST-012.5 you acknowledge or replace an agent's answer", () => {
  const AGENT_ANSWER = '{option: a, text: "", answered_at: 2026-10-20T09:00:00Z, by: agent}';
  const YOUR_ANSWER = '{option: a, text: "", answered_at: 2026-10-20T09:00:00Z, by: you}';
  const YOU = { actor: "you" as const, now: new Date("2026-10-20T10:00:00Z") };
  const q1 = (root: string) => loadProject(root).questions.find((x) => x.id === "Q-0001");
  const inboxRefs = (root: string) =>
    buildIndex(root, { now: new Date("2026-10-20T12:00:00Z") }).index.inbox.map((i) => i.ref);
  const read = (root: string) => readFileSync(join(root, QUESTION_FILE), "utf8");

  function errorOf(fn: () => unknown): AzimuthError {
    try {
      fn();
    } catch (e) {
      if (e instanceof AzimuthError) return e;
      throw e;
    }
    throw new Error("expected an AzimuthError");
  }

  it("S-012.5.1 acknowledges the agent's answer", () => {
    const tree = project({ status: "answered", answer: AGENT_ANSWER });
    const result = acknowledge(tree.root, "Q-0001", YOU);
    expect(q1(tree.root)?.review_ack_at).toBe("2026-10-20T10:00:00Z");
    expect(result.message).toBe("Q-0001: acknowledged");
    expect(inboxRefs(tree.root)).not.toContain("Q-0001");
  });

  it("S-012.5.2 refuses to acknowledge your own answer", () => {
    const tree = project({ status: "answered", answer: YOUR_ANSWER });
    const before = read(tree.root);
    const error = errorOf(() => acknowledge(tree.root, "Q-0001", YOU));
    expect(error.code).toBe("invalid");
    expect(error.message).toBe("Q-0001 has no automatic decision to acknowledge.");
    expect(read(tree.root)).toBe(before);
  });

  it("S-012.5.3 replaces the agent's answer with yours", () => {
    const tree = project({
      status: "answered",
      answer: AGENT_ANSWER,
      resolution: "{kind: assumption, ref: F-001}",
    });
    const result = answerQuestion(
      tree.root,
      "Q-0001",
      { option: "b", text: "Use the advisory lock" },
      YOU,
    );
    const q = q1(tree.root);
    expect(q?.answer).toEqual({
      option: "b",
      text: "Use the advisory lock",
      answered_at: "2026-10-20T10:00:00Z",
      by: "you",
    });
    expect(q?.resolution).toBeNull();
    expect(result.message).toBe("Q-0001: answered, replacing the agent's answer");
    expect(inboxRefs(tree.root)).not.toContain("Q-0001");
  });

  it("S-012.5.4 keeps your own answer final", () => {
    const tree = project({ status: "answered", answer: YOUR_ANSWER });
    const error = errorOf(() => answerQuestion(tree.root, "Q-0001", { option: "b" }, YOU));
    expect(error.code).toBe("conflict");
    expect(error.message).toBe("Q-0001 is already answered.");
  });

  it("S-012.5.5 doesn't let an agent replace an agent's answer", () => {
    const tree = project({ status: "answered", answer: AGENT_ANSWER });
    const error = errorOf(() =>
      answerQuestion(tree.root, "Q-0001", { option: "b" }, { ...YOU, actor: "agent" }),
    );
    expect(error.code).toBe("policy");
    expect(error.message).toBe("Only the user answers questions. Leave Q-0001 open and ask them.");
    expect(q1(tree.root)?.answer?.by).toBe("agent");
  });
});
