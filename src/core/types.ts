/**
 * The index contract: the single object the viewer renders and `azimuth status --json` emits.
 * It is the §18 shape from the design spec plus the v0.1 additions (live sessions, review-auto,
 * file paths, autonomy, approval bookkeeping). Field names are snake_case to match the files
 * on disk. Everything here is plain data so the viewer can import it without Node.
 */

export type Id = string;
export type Sha = string;
export type ISODate = string;
export type ISODateTime = string;
export type Markdown = string;

export const FEATURE_STATUSES = [
  "idea",
  "draft",
  "approved",
  "in-progress",
  "verifying",
  "done",
  "deferred",
  "cancelled",
  "superseded",
] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const TASK_STATUSES = ["todo", "in-progress", "done", "blocked", "skipped"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const QUESTION_STATUSES = ["open", "answered", "obsolete"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const DECISION_STATUSES = ["proposed", "accepted", "rejected", "superseded"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const MILESTONE_STATUSES = ["planned", "active", "released"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const ISSUE_STATUSES = ["open", "in-progress", "resolved", "wontfix"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_TYPES = ["bug", "debt", "risk"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const LEVELS = ["low", "medium", "high"] as const;
export type Level = (typeof LEVELS)[number];

export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SIZES = ["S", "M", "L", "XL"] as const;
export type Size = (typeof SIZES)[number];

export const SCENARIO_KINDS = ["happy", "negative", "edge"] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

export const IMPACT_CHANGES = ["create", "modify", "read", "test"] as const;
export type ImpactChange = (typeof IMPACT_CHANGES)[number];

export const LOG_TYPES = ["note", "transition", "review", "override"] as const;
export type LogType = (typeof LOG_TYPES)[number];

export type ProjectMode = "greenfield" | "brownfield";
export type CoverageStatus = "passing" | "failing" | "not-run" | "untested";
export type Actor = "you" | "agent";
export type AutonomyLevel = "auto" | "manual";

export const QUESTION_AUTONOMY = ["ask", "proceed"] as const;
export type QuestionAutonomy = (typeof QUESTION_AUTONOMY)[number];
export type Urgency = "high" | "normal" | "low";

export const INBOX_KINDS = [
  "answer-question",
  "failing-verify",
  "reapprove-spec",
  "approve-spec",
  "review-adr",
  "stale",
  "check-errors",
  "review-auto",
] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

export interface Index {
  schema: 1;
  generated_at: ISODateTime;
  mode: "live" | "export";
  /** Content hash of everything except `live`, `server` and `generated_at`. */
  rev: string;
  /** Present only when served by `azimuth view`. */
  server: { instance: string; version: string } | null;
  project: Project;
  knowledge: Knowledge;
  milestones: Milestone[];
  features: Feature[];
  decisions: Decision[];
  questions: Question[];
  issues: Issue[];
  sessions: Session[];
  commits: Commit[];
  runs: VerifyRun[];
  live: LiveSession[];
  inbox: InboxItem[];
  problems: Problem[];
}

export interface Autonomy {
  approve_specs: AutonomyLevel;
  accept_adrs: AutonomyLevel;
  /**
   * ask: only you answer questions. proceed: a new non-blocking question an agent raises with
   * exactly one recommended option is answered with it at once (answer.by: agent).
   */
  questions: QuestionAutonomy;
  /** When true, auto-approval also requires zero warnings in the feature, hints aside. */
  strict: boolean;
}

export interface Project {
  name: string;
  description: string;
  mode: ProjectMode;
  stack: string[];
  commands: Record<string, string>;
  git: { branch: string | null; head: Sha | null; dirty: boolean };
  autonomy: Autonomy;
  editor_url: string | null;
  /** Absolute repo root in live mode; null in exports. */
  root: string | null;
  /** config.parallel.shared_files, as written. */
  shared_files: string[];
}

export interface KnowledgeDoc {
  file: string;
  updated: ISODate | null;
  body: Markdown;
}

export interface Module {
  name: string;
  path: string;
  responsibility: string;
  depends_on: string[];
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  aliases: string[];
}

export interface Knowledge {
  vision: KnowledgeDoc;
  architecture: KnowledgeDoc & {
    reconciled_at: Sha | null;
    commits_since_reconciled: number;
    modules: Module[];
  };
  conventions: KnowledgeDoc;
  glossary: GlossaryTerm[];
  glossary_file: string;
}

export interface Milestone {
  id: Id;
  title: string;
  status: MilestoneStatus;
  target: ISODate | null;
  released_at: ISODate | null;
  goal: string;
  features: Id[];
  progress: { done: number; total: number; by_status: Partial<Record<FeatureStatus, number>> };
  file: string;
}

export interface GateCheck {
  /** Stable identifier (e.g. `approve.no-blocking-questions`); `rule` is display text. */
  id: string;
  rule: string;
  ok: boolean;
  detail?: string;
}

export interface Gate {
  to: FeatureStatus;
  checks: GateCheck[];
}

export interface Coverage {
  passing: number;
  failing: number;
  not_run: number;
  untested: number;
  total: number;
}

export interface ApprovalChange {
  path: string;
  /** Commit that changed the file after approval; null for an uncommitted working-tree change. */
  commit: Sha | null;
  at: ISODateTime | null;
  session: Id | null;
}

export interface FeatureDerived {
  blocks: Id[];
  blocked_by: { kind: "question" | "dependency"; id: Id }[];
  modified_since_approval: boolean;
  stale: boolean;
  progress: { done: number; total: number };
  coverage: Coverage;
  next_gate: Gate | null;
  last_activity: ISODateTime | null;
  file_conflicts: { path: string; with: Id }[];
  approval_changes: ApprovalChange[];
}

export interface Feature {
  id: Id;
  slug: string;
  title: string;
  summary: string;
  status: FeatureStatus;
  priority: Priority;
  size: Size | null;
  mode: ProjectMode;
  milestone: Id | null;
  depends_on: Id[];
  superseded_by: Id | null;
  tags: string[];
  created: ISODate;
  updated: ISODate;
  approved_at: ISODate | null;
  approved_by: Actor | null;
  approved_commit: Sha | null;
  review_ack_at: ISODateTime | null;
  /** Feature directory, repo-relative, with a trailing slash. */
  file: string;
  derived: FeatureDerived;
  detail?: FeatureDetail;
}

export interface ImpactEntry {
  path: string;
  change: ImpactChange;
  note: string;
  symbols: string[];
  exists: boolean;
}

export interface ScenarioTest {
  file: string;
  name: string;
  status: CoverageStatus;
  confidence: "marker" | "fallback";
  /** False when the test is only in the working tree; the done gate doesn't count it. */
  committed: boolean;
}

export interface Scenario {
  id: Id;
  title: string;
  kind: ScenarioKind;
  given: string;
  when: string;
  then: string;
  coverage: { status: CoverageStatus; tests: ScenarioTest[] };
}

export interface Story {
  id: Id;
  title: string;
  intent: string;
  scenarios: Scenario[];
}

export interface Task {
  id: Id;
  title: string;
  status: TaskStatus;
  after: Id[];
  covers: Id[];
  files: string[];
  verify: string;
  note: string | null;
  last_run: { run: Id; ok: boolean; at: ISODateTime } | null;
}

export interface LogEntry {
  at: ISODateTime;
  actor: Actor;
  type: LogType;
  session: Id | null;
  body: Markdown;
  /** Parsed from a transition body's first line (`draft → approved`). */
  transition: { from: string; to: string } | null;
  /** True when the entry records an automatic decision (autonomy: auto). */
  auto: boolean;
}

export interface AsBuilt {
  completed_at: ISODate;
  files_changed: { path: string; change: string }[];
  deviations: { path: string; kind: string; reason: string }[];
  follow_ups: Id[];
  body: Markdown;
}

export interface FeatureDetail {
  context: {
    objective: Markdown;
    out_of_scope: Markdown;
    integration_points: Markdown;
    invariants: Markdown;
    assumptions: Markdown;
  };
  impact: ImpactEntry[];
  stories: Story[];
  contract: { language: string; sections: { title: string; body: Markdown }[] };
  tasks: Task[];
  log: LogEntry[];
  as_built: AsBuilt | null;
  /** notes.md without its first "# " title line, trimmed; null without the file or content. */
  notes: Markdown | null;
}

export interface Decision {
  id: Id;
  title: string;
  status: DecisionStatus;
  date: ISODate;
  supersedes: Id | null;
  superseded_by: Id | null;
  resolves: Id[];
  links: Id[];
  body: { context: Markdown; options: Markdown; decision: Markdown; consequences: Markdown };
  decided_by: Actor | null;
  decided_at: ISODateTime | null;
  /** Your note to the agent when you accepted or rejected it. */
  decision_note: string | null;
  review_ack_at: ISODateTime | null;
  file: string;
}

export interface QuestionOption {
  key: string;
  label: string;
  detail: string;
  recommended: boolean;
}

export interface Question {
  id: Id;
  title: string;
  status: QuestionStatus;
  /** The feature this question was raised for; only that feature is blocked by it. */
  feature: Id | null;
  blocking: boolean;
  raised_by: Id | "you" | "agent";
  raised_at: ISODateTime;
  links: Id[];
  context: Markdown;
  options: QuestionOption[];
  answer: null | {
    option: string | null;
    text: string;
    answered_at: ISODateTime;
    /** Who answered. Files written before F-012 have no `by`, which means you. */
    by: Actor;
  };
  resolution: null | { kind: "assumption" | "adr"; ref: Id };
  /** Set when you acknowledge an agent's answer; null otherwise (also when the key is absent). */
  review_ack_at: ISODateTime | null;
  file: string;
}

export interface Issue {
  id: Id;
  type: IssueType;
  title: string;
  status: IssueStatus;
  severity: Severity | null;
  likelihood: Level | null;
  impact: Level | null;
  links: Id[];
  files: string[];
  found_by: Id | "you" | "agent";
  created: ISODate;
  resolved_at: ISODate | null;
  body: Markdown;
  file: string;
}

export interface Session {
  id: Id;
  agent: string;
  skill: string | null;
  started_at: ISODateTime;
  ended_at: ISODateTime | null;
  goal: string;
  touched: Id[];
  commits: Sha[];
  raised: Id[];
  summary: Markdown;
  handoff: Markdown;
  /**
   * The `## Goals` section: one `- HH:MM · <skill> · <goal>` bullet per reusing start; "" when
   * absent.
   */
  goals: Markdown;
  /** The `## Notes` section: one `- HH:MM · <text>` bullet per `session note`; "" when absent. */
  notes: Markdown;
  file: string;
}

export interface Commit {
  sha: Sha;
  at: ISODateTime;
  actor: Actor;
  session: Id | null;
  subject: string;
  refs: Id[];
  files_changed: number;
}

/** The prebuild that ran before a verify run, in the same `azimuth verify` or finish call. */
export interface RunPrebuild {
  /** false only under verify.prebuild_failure: continue; otherwise a failed prebuild records no run. */
  ok: boolean;
  duration_ms: number;
}

export interface VerifyRun {
  id: Id;
  target: Id;
  command: string;
  ok: boolean;
  exit_code: number;
  duration_ms: number;
  at: ISODateTime;
  commit: Sha | null;
  output_tail: string;
  scenarios: { id: Id; status: CoverageStatus }[];
  junit: { tests: number; failures: number; errors: number; skipped: number } | null;
  /** How long the call waited for another verify's lock before it started; 0 when it didn't. */
  waited_ms?: number;
  /** The Azimuth session current when the run was made; null outside a session. */
  ses?: Id | null;
  /**
   * null when no prebuild ran (none configured, a blank command, `--no-prebuild`), and for run
   * files without the key or with a malformed value. Always present in the model and the index.
   */
  prebuild: RunPrebuild | null;
}

export type AgentStatus = "running" | "waiting" | "done";

/** What an agent waits on you for, and since when. */
export interface LiveWait {
  /** "Permission prompt: Bash pnpm vitest run" | "Permission prompt: <notification message>" | "Waiting for your next prompt" */
  reason: string;
  since: ISODateTime;
}

/** A stretch of time an agent waited on you; `to` is null while it lasts. */
export interface LiveWaitSpan {
  from: ISODateTime;
  to: ISODateTime | null;
  reason: string;
}

/** One successful Edit, MultiEdit, Write or NotebookEdit. */
export interface LiveEdit {
  file: string;
  at: ISODateTime;
  /** Null when the hook couldn't count (NotebookEdit, logs written before F-014). */
  added: number | null;
  removed: number | null;
}

export interface LiveEvent {
  at: ISODateTime;
  tool: string;
  file: string | null;
  summary: string;
  agent_id: string | null;
  /** Lines an Edit, MultiEdit or Write added and removed; null otherwise. */
  added: number | null;
  removed: number | null;
  /** First line of the error of a failed tool (PostToolUseFailure); null otherwise. */
  error: string | null;
}

/** What one agent is doing: a session's main agent (LiveSession.main) or a subagent. */
export interface LiveActivity {
  status: AgentStatus;
  /** Set exactly when status is "waiting". */
  waiting: LiveWait | null;
  /** This agent's latest tool event. */
  current: LiveEvent | null;
  /** Main agent: the session's started_at. Subagent: its `subagent` record, else its first record. */
  started_at: ISODateTime;
  /** Set exactly when status is "done": the end, the subagent's stop, or its last record. */
  ended_at: ISODateTime | null;
  /** Its last MAX_EDITS edits, oldest first. */
  edits: LiveEdit[];
  /** Its last MAX_WAITS wait spans, oldest first (permission waits; idle spans for the main agent). */
  waits: LiveWaitSpan[];
  /** Whether a transcript path is recorded (or derived) and the file exists. */
  transcript: boolean;
}

export interface LiveAgent extends LiveActivity {
  agent_id: string;
  agent_type: string | null;
  last_seen_at: ISODateTime;
  /** What the orchestrator asked for (the Agent tool's description), when known. */
  description: string | null;
  task: Id | null;
  feature: Id | null;
  /** Set once the subagent has finished. */
  stopped_at: ISODateTime | null;
}

export interface LiveSession {
  claude_session: string;
  ses: Id | null;
  started_at: ISODateTime;
  last_seen_at: ISODateTime;
  /** Last time Claude finished a turn (Stop hook); the session is idle while this is newest. */
  stopped_at: ISODateTime | null;
  ended_at: ISODateTime | null;
  agents: LiveAgent[];
  /** The latest tool event of any agent. */
  current: LiveEvent | null;
  feature: Id | null;
  task: Id | null;
  /** Features the main agent or a running subagent is working on, sorted by ID. */
  features: Id[];
  events: LiveEvent[];
  /** The main agent's own activity. */
  main: LiveActivity;
  /** The session as a whole: waiting on you, else running, else idle-waiting, else done. */
  status: AgentStatus;
  /** The earliest open permission wait of any agent, else the main agent's idle wait; null unless status is "waiting". */
  waiting: LiveWait | null;
  /** The Azimuth session's latest goal and skill (latestGoal); null without a session file. */
  goal: string | null;
  skill: string | null;
}

// Transcript API (GET /api/transcript), here so the viewer can import the types.
export type TranscriptStatus = "running" | "ok" | "error";

export interface TranscriptText {
  lines: string[];
  /** More lines existed than the cap. */
  truncated: boolean;
}

export interface TranscriptDiff extends TranscriptText {
  /** "+" and "-" lines over the whole patch, before the cap. */
  added: number;
  removed: number;
}

export type TranscriptEntry =
  | { kind: "message"; role: "user" | "assistant"; text: string; at: string | null }
  | {
      kind: "tool";
      tool_use_id: string;
      name: string;
      /** toolTarget of the call. */
      target: string;
      /** The call's `description` input (Bash), else null. */
      summary: string | null;
      status: TranscriptStatus;
      /** Edit, MultiEdit, Write: from the result's structuredPatch (a created file: its content as "+" lines). */
      diff: TranscriptDiff | null;
      /** Bash: stdout then stderr (tail); a failed tool: its result text (tail); otherwise null. */
      output: TranscriptText | null;
      at: string | null;
    }
  | {
      /** An Agent (or Task) call: a subagent card. */
      kind: "spawn";
      tool_use_id: string;
      description: string;
      /** The call's `subagent_type`. */
      agent_type: string | null;
      /** The result's `toolUseResult.agentId`, when known. */
      agent_id: string | null;
      status: TranscriptStatus;
      /** The subagent's returned text (head). */
      output: TranscriptText | null;
      at: string | null;
    }
  | {
      /** A tool result whose call isn't in this page (the viewer updates the earlier entry). */
      kind: "result";
      tool_use_id: string;
      status: "ok" | "error";
      diff: TranscriptDiff | null;
      output: TranscriptText | null;
      agent_id: string | null;
      at: string | null;
    };

export interface TranscriptPage {
  ok: true;
  claude_session: string;
  agent: string | null;
  entries: TranscriptEntry[];
  /** Byte offset to pass as `after` for the next page. */
  next: number;
  /** Content between the start (byte 0, or `after`) and the first line read was not returned. */
  skipped: boolean;
}

export interface InboxItem {
  kind: InboxKind;
  ref: Id | null;
  title: string;
  detail: string;
  since: ISODateTime;
  urgency: Urgency;
}

export interface Problem {
  code: string;
  severity: "error" | "warning";
  file: string;
  line: number | null;
  ref: Id | null;
  message: string;
}
