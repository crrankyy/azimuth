import { AzimuthError } from "./errors";
import { splitFrontmatter } from "./frontmatter";
import { globToRegExp, matchesAny } from "./glob";
import { featureOf, idKind } from "./ids";
import type { FeatureEntity, Model } from "./model";
import type { TaskRaw } from "./parse/feature";
import { OPEN_PLACEHOLDER, placeholderParts } from "./placeholders";

const FENCE = /^\s*(```|~~~)/;
const SCENARIO_HEADING = /^###\s+(S-\d{3}\.\d+\.\d+)/;
const SECTION_HEADING = /^#{2,3} /;
const CONTRACT_HEADING = /^#{1,5} /;

/** Asks for no report: the closing request does, so the request is made once. */
const OPEN_RULE =
  "- `{?}` marks a value the spec leaves to the first passing test: make the test assert the value the code produces.";

/** The rules every brief has; the closing request comes last, after the conditional ones. */
const STANDING_RULES = [
  "- Give every test a name that no other test in the project has.",
  "- Write the tests first and run them to see them fail for the right reason, then implement until the verify command passes. Keep to the contract and the invariants.",
  '- Change only the files under "Files you may change".',
  "- Never run git or azimuth, and never edit anything under .azimuth/.",
];

/** The rule for one shared path, e.g. sharedFileRule("src/registry.ts"). */
const sharedFileRule = (path: string) =>
  `- \`${path}\` is shared: other tasks may be adding to it at the same time. Add one complete insertion to it (a whole enum variant, match arm, registry entry or module line).`;

const SHARED_RULES = [
  "- Never edit or reorder another task's insertion in a shared file.",
  "- Don't run a formatter over a shared file or its package.",
];

const CLOSING_RULE =
  '- When you are done, report: the files you changed; the verify command\'s result; what the task taught that later tasks should know (a constraint the code revealed, a choice the spec left open); each file you had to change outside "Files you may change", and why.';

const CLOSING_OPEN_CLAUSE =
  "; the value each `{?}` took in a passing test, as `<scenario ID>: <value>`.";

const normalize = (text: string) => text.replace(/\r\n?/g, "\n");

/** Lines without the blank ones at either end. */
function trimBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && (lines[start] ?? "").trim() === "") start++;
  while (end > start && (lines[end - 1] ?? "").trim() === "") end--;
  return lines.slice(start, end);
}

/** A settled value prints as the value; an open placeholder stays as written. */
function resolvePlaceholders(line: string): string {
  return placeholderParts(line)
    .map((part) =>
      part.kind === "text" ? part.text : part.kind === "open" ? OPEN_PLACEHOLDER : part.value,
    )
    .join("");
}

interface ScenarioText {
  text: string;
  open: boolean;
}

/**
 * One scenario's stories.md lines from its `### ` heading to the next `## ` or `### ` heading
 * outside fenced code, without blank lines at either end; null when stories.md doesn't have it.
 */
function scenarioText(stories: string, scenarioId: string): ScenarioText | null {
  const kept: string[] = [];
  let inFence = false;
  let capturing = false;
  let open = false;
  for (const line of normalize(stories).split("\n")) {
    const fence = FENCE.test(line);
    const outside = !inFence && !fence;
    if (fence) inFence = !inFence;
    if (outside && SECTION_HEADING.test(line)) {
      if (capturing) break;
      capturing = SCENARIO_HEADING.exec(line)?.[1] === scenarioId;
    }
    if (!capturing) continue;
    if (!outside) {
      kept.push(line);
      continue;
    }
    open ||= line.includes(OPEN_PLACEHOLDER);
    kept.push(resolvePlaceholders(line));
  }
  return kept.length > 0 ? { text: trimBlankLines(kept).join("\n"), open } : null;
}

/**
 * contract.md without its frontmatter and its `# ` title line, trimmed, every heading outside
 * fenced code one level deeper so that it nests under the brief's `## Contract`.
 */
function contractText(contract: string): string {
  const lines = normalize(splitFrontmatter(contract).body).split("\n");
  const first = lines.findIndex((line) => line.trim() !== "");
  if (first !== -1 && (lines[first] ?? "").startsWith("# ")) lines.splice(first, 1);
  let inFence = false;
  const nested = lines.map((line) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      return line;
    }
    return !inFence && CONTRACT_HEADING.test(line) ? `#${line}` : line;
  });
  return nested.join("\n").trim();
}

/** The test-name rules for the project's languages, one per form, in a fixed order. */
function testNameRules(languages: string[], scenarioId: string): string[] {
  const names = languages.map((l) => l.toLowerCase());
  const rules: string[] = [];
  if (names.includes("typescript") || names.includes("javascript")) {
    rules.push(
      `- Start each test name with the scenario it covers: \`it("${scenarioId} <what it checks>", …)\`.`,
    );
  }
  if (names.includes("python")) {
    rules.push(
      `- Mark each test with the scenario it covers: \`@pytest.mark.scenario("${scenarioId}")\`.`,
    );
  }
  const other = (n: string) => !["typescript", "javascript", "python"].includes(n);
  if (names.length === 0 || names.some(other)) {
    rules.push(`- Put a \`// scenario: ${scenarioId}\` comment on the line above each test.`);
  }
  return rules;
}

function header(f: FeatureEntity, task: TaskRaw): string {
  const lines = [`# ${task.id} · ${task.title}`, "", `Feature: ${f.id} · ${f.title}`];
  if (task.after.length > 0) {
    const status = (id: string) => f.tasks.find((t) => t.id === id)?.status ?? "not in the plan";
    lines.push(`After: ${task.after.map((id) => `${id} (${status(id)})`).join(", ")}`);
  }
  return lines.join("\n");
}

/**
 * One rule per path of `files` that matches a glob of `sharedFiles`, in `files` order, each path
 * once; then SHARED_RULES. [] when none matches. Paths compare as written, the rule
 * parallelGroups uses, so the brief and `azimuth next` agree on which files are shared.
 */
function sharedFileRules(files: string[], sharedFiles: string[]): string[] {
  const shared = sharedFiles.map(globToRegExp);
  const paths = [...new Set(files.filter((path) => matchesAny(path, shared)))];
  if (paths.length === 0) return [];
  return [...paths.map(sharedFileRule), ...SHARED_RULES];
}

/** CLOSING_RULE; when `open`, its final "." replaced by CLOSING_OPEN_CLAUSE. */
function closingRule(open: boolean): string {
  if (!open) return CLOSING_RULE;
  return `${CLOSING_RULE.slice(0, -1)}${CLOSING_OPEN_CLAUSE}`;
}

const section = (title: string, body: string) => `## ${title}\n\n${body}`;

/**
 * The prompt for a subagent building one task, in Markdown, built from the model only (no git,
 * no clock): the same model gives the same text. No trailing newline.
 * Throws AzimuthError("not-found", …) for an unknown feature or task.
 */
export function taskBrief(model: Model, taskId: string): string {
  const featureId = featureOf(taskId);
  if (idKind(taskId) !== "task" || !featureId) {
    throw new AzimuthError("invalid", `${taskId} is not a task ID.`);
  }
  const f = model.features.find((x) => x.id === featureId);
  if (!f) throw new AzimuthError("not-found", `${featureId} does not exist.`);
  const task = f.tasks.find((t) => t.id === taskId);
  if (!task) {
    const plan = f.files.plan ?? `${f.dir}plan.md`;
    throw new AzimuthError("not-found", `${taskId} is not a task in ${plan}.`);
  }

  const parts = [header(f, task)];
  const scenarios = task.covers.map(
    (id) =>
      (f.spec && scenarioText(f.spec.stories, id)) || {
        text: `### ${id}\nNot in stories.md.`,
        open: false,
      },
  );
  if (scenarios.length > 0) {
    parts.push(section("Scenarios", scenarios.map((s) => s.text).join("\n\n")));
  }
  const contract = f.spec ? contractText(f.spec.contract) : "";
  if (contract) parts.push(section("Contract", contract));
  if (f.context.invariants) parts.push(section("Invariants", f.context.invariants));
  const files = task.files.length > 0 ? task.files.map((p) => `- ${p}`).join("\n") : "None listed.";
  parts.push(section("Files you may change", files));
  const verify = task.verify.trim();
  parts.push(section("Verify", verify ? `\`\`\`sh\n${verify}\n\`\`\`` : "None."));
  if (f.notes) parts.push(section("Notes from earlier tasks", f.notes));
  const open = scenarios.some((s) => s.open);
  const rules = [
    ...testNameRules(model.config.stack.languages, task.covers[0] ?? "S-NNN.1.1"),
    ...STANDING_RULES,
    ...sharedFileRules(task.files, model.config.parallel.shared_files),
    ...(open ? [OPEN_RULE] : []),
    closingRule(open),
  ];
  parts.push(section("Rules", rules.join("\n")));
  return parts.join("\n\n");
}
