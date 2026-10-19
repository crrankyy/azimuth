# F-008: Stories

Notation: in this file ⟦?⟧ stands for the open placeholder (an opening brace, a question mark and
a closing brace) and ⟦=v⟧ for the value v settled (an opening brace, an equals sign, v and a
closing brace); tests write the real characters. Written literally here they would be live
placeholders in this repository's own stories. Unless a scenario says otherwise, F-001 is a
feature in progress in `.azimuth/features/F-001-thing/` titled "Feature F-001", whose plan has
task T-001.1.

## ST-008.1 · Notes record what a task taught
**Intent:** As an orchestrator, I want to write what a task taught into the feature's notes.md, so that the next lanes can read it and the approval stays current.

### S-008.1.1 · The first note creates notes.md {happy}
- **GIVEN** F-001 without notes.md
- **WHEN** `addNote(root, "T-001.1", "Counts the BOM.", { actor: "agent", now: new Date("2026-10-20T09:00:00Z") })` runs
- **THEN** `.azimuth/features/F-001-thing/notes.md` is `# F-001: Notes\n\n### T-001.1 · 2026-10-20\n\nCounts the BOM.\n`, and the result has `changed: [".azimuth/features/F-001-thing/notes.md"]` and `message: "T-001.1: note added"`

### S-008.1.2 · A later note is appended as its own section {happy}
- **GIVEN** F-001 with the notes.md of S-008.1.1
- **WHEN** `addNote(root, "F-001", "  Split the parser in two.\n", { actor: "you", now: new Date("2026-10-21T08:00:00Z") })` runs
- **THEN** notes.md is `# F-001: Notes\n\n### T-001.1 · 2026-10-20\n\nCounts the BOM.\n\n### F-001 · 2026-10-21\n\nSplit the parser in two.\n`

### S-008.1.3 · A task that isn't in the plan {negative}
- **GIVEN** F-001 without notes.md
- **WHEN** `addNote(root, "T-001.9", "Counts the BOM.", { actor: "agent" })` runs
- **THEN** it throws an `AzimuthError` with code `not-found` and message `T-001.9 is not a task in .azimuth/features/F-001-thing/plan.md.`, and notes.md doesn't exist

### S-008.1.4 · A feature that doesn't exist {negative}
- **GIVEN** a project whose only feature is F-001
- **WHEN** `addNote(root, "F-009", "Counts the BOM.", { actor: "agent" })` runs
- **THEN** it throws an `AzimuthError` with code `not-found` and message `F-009 does not exist.`

### S-008.1.5 · A scenario ID or a blank note is refused {negative}
- **GIVEN** F-001 without notes.md
- **WHEN** `addNote` runs with ref `S-001.1.1` and text `Counts the BOM.`, and separately with ref `T-001.1` and text `"  "`
- **THEN** the first throws code `invalid` with message `S-001.1.1 is not a feature or task.`, the second throws code `invalid` with message `A note needs some text.`, and notes.md doesn't exist

## ST-008.2 · azimuth note on the command line
**Intent:** As an agent, I want one command that records a note and the session it came from, so that I never edit feature.md to keep a record.

### S-008.2.1 · A note is added and recorded in the session {happy}
- **GIVEN** F-001 and an open session `SES-20261020-0900` whose `touched` is `[]`, selected with `AZIMUTH_SESSION`
- **WHEN** `azimuth note T-001.1 "Counts the BOM."` runs as agent
- **THEN** it exits 0 with stdout `T-001.1: note added\n`, notes.md ends with `### T-001.1 · <today's UTC date>\n\nCounts the BOM.\n`, and the session's `touched` is `["F-001", "T-001.1"]`

### S-008.2.2 · An unknown task exits 1 {negative}
- **GIVEN** F-001
- **WHEN** `azimuth note T-001.9 "Counts the BOM."` runs
- **THEN** it exits 1 with empty stdout and stderr `✗ T-001.9 is not a task in .azimuth/features/F-001-thing/plan.md.\n`

## ST-008.3 · Notes stay outside the spec and inside the index
**Intent:** As the viewer, I want the index to carry each feature's notes while checks and the approval ignore them, so that notes can be read anywhere and cost nothing.

### S-008.3.1 · The index carries notes without their title {happy}
- **GIVEN** F-001 whose notes.md is `# F-001: Notes\n\n### T-001.1 · 2026-10-20\n\nCounts the BOM.\n`
- **WHEN** the index is built
- **THEN** F-001's `detail.notes` is `### T-001.1 · 2026-10-20\n\nCounts the BOM.`

### S-008.3.2 · No notes is null {edge}
- **GIVEN** F-001 without notes.md, and F-002 whose notes.md is `# F-002: Notes\n`
- **WHEN** the index is built
- **THEN** both features' `detail.notes` is `null`

### S-008.3.3 · check accepts notes.md {edge}
- **GIVEN** F-001 with the notes.md of S-008.3.1
- **WHEN** `analyzeProject` runs
- **THEN** its `problems` equal those of the same project without notes.md

### S-008.3.4 · A note never makes the approval stale {happy}
- **GIVEN** F-001 in progress with `approved_by: agent` and `approved_hash` equal to `specHash` of its spec, and the notes.md of S-008.3.1 written after approval
- **WHEN** the project is analysed and the inbox built
- **THEN** F-001's `modified_since_approval` is `false`, its `approval_changes` is `[]`, and the inbox has no `reapprove-spec` item

## ST-008.4 · Notes in the As-built tab
**Intent:** As the developer, I want to read a feature's notes in its As-built tab while it is being built, so that I see what each task taught without opening files.

### S-008.4.1 · Notes before close-out {happy}
- **GIVEN** F-001 whose `detail.as_built` is `null` and `detail.notes` is `### T-001.1 · 2026-10-20\n\nCounts the BOM.`
- **WHEN** `AsBuiltTab` renders
- **THEN** its HTML contains `As-built is written at close-out, once F-001 reaches verifying.`, then `<h2 class="fd-sec-title">Notes</h2>`, then `<p>Counts the BOM.</p>`, and doesn't contain `Not written yet`

### S-008.4.2 · Notes follow the as-built sections {happy}
- **GIVEN** F-001 whose `detail.as_built` has `completed_at: "2026-10-21"`, `files_changed: [{ path: "src/a.ts", change: "modify" }]`, no deviations or follow-ups and an empty body, and the notes of S-008.4.1
- **WHEN** `AsBuiltTab` renders
- **THEN** its HTML contains `Completed`, then `>Files changed</h2>`, then `<h2 class="fd-sec-title">Notes</h2>`, then `<p>Counts the BOM.</p>`

### S-008.4.3 · Without notes the tab is unchanged {edge}
- **GIVEN** F-001 whose `detail.as_built` and `detail.notes` are both `null`
- **WHEN** `AsBuiltTab` renders
- **THEN** its HTML contains `Not written yet` and doesn't contain `>Notes</h2>`

### S-008.4.4 · The tab opens once there are notes {edge}
- **GIVEN** three features: one with notes and no as-built, one with an as-built and no notes, one with neither
- **WHEN** `asBuiltOpen` is called for each
- **THEN** it returns `true`, `true` and `false`

## ST-008.5 · Placeholders in scenarios
**Intent:** As a spec writer, I want to leave a value the code will measure open in a THEN line, so that a guessed constant doesn't need a story correction later.

### S-008.5.1 · A placeholder THEN raises no warning {happy}
- **GIVEN** a stories.md for F-001 whose S-001.1.1 · Finds the heading {happy} has GIVEN `the text # Hi`, WHEN `it is parsed` and THEN `the heading starts at byte ⟦?⟧`
- **WHEN** `parseStories` reads it
- **THEN** `problems` is `[]` and the scenario's `then` is `the heading starts at byte ⟦?⟧`

### S-008.5.2 · Scenarios with an open placeholder, in file order {happy}
- **GIVEN** a stories.md where S-001.1.1's THEN holds ⟦?⟧, S-001.1.2's THEN holds only ⟦=17⟧, and S-001.2.1's AND line after its THEN holds ⟦?⟧
- **WHEN** `openPlaceholderScenarios` reads it
- **THEN** it returns `["S-001.1.1", "S-001.2.1"]`

### S-008.5.3 · A placeholder in a fenced block doesn't count {edge}
- **GIVEN** a stories.md whose S-001.1.1 has a THEN without placeholders, followed by a fenced code block (three backticks) containing a line with ⟦?⟧
- **WHEN** `openPlaceholderScenarios` reads it
- **THEN** it returns `[]`

### S-008.5.4 · Text splits into plain text, settled values and open placeholders {happy}
- **GIVEN** the text `starts at ⟦=17⟧, ends at ⟦?⟧`
- **WHEN** `placeholderParts` splits it
- **THEN** it returns `[{ kind: "text", text: "starts at " }, { kind: "settled", value: "17" }, { kind: "text", text: ", ends at " }, { kind: "open" }]`

### S-008.5.5 · Other braces stay text {edge}
- **GIVEN** the text `returns { a: 1 }, {x}, {=} and {=a{b}`, whose last two are not settled values (one is empty, the other holds a brace)
- **WHEN** `placeholderParts` splits it
- **THEN** it returns `[{ kind: "text", text: "returns { a: 1 }, {x}, {=} and {=a{b}" }]`

## ST-008.6 · Settling replaces one placeholder
**Intent:** As an agent, I want to settle the first open value of a scenario with what the test proved, so that the story records the measured value without being rewritten.

### S-008.6.1 · The first open placeholder of the scenario is settled {happy}
- **GIVEN** a stories.md where S-001.1.1 has `- **THEN** the heading starts at byte ⟦?⟧` and `- **AND** it ends at byte ⟦?⟧`, and S-001.1.2's THEN holds ⟦?⟧
- **WHEN** `settleText(text, "S-001.1.1", " 17 ")` runs
- **THEN** it returns `ok: true` and `left: 1`, and its `text` equals the input with only the THEN line changed, to `- **THEN** the heading starts at byte ⟦=17⟧`

### S-008.6.2 · Line endings are kept {edge}
- **GIVEN** the stories.md of S-008.6.1 with CRLF line endings
- **WHEN** `settleText(text, "S-001.1.1", "17")` runs
- **THEN** its `text` equals the input with the first ⟦?⟧ replaced by ⟦=17⟧, every line still ending in `\r\n`

### S-008.6.3 · No placeholder left in the scenario {negative}
- **GIVEN** a stories.md where S-001.1.1 holds only ⟦=17⟧ and S-001.1.2 holds ⟦?⟧
- **WHEN** `settleText(text, "S-001.1.1", "18")` runs
- **THEN** it returns `{ ok: false, reason: "no-placeholder" }`

### S-008.6.4 · An unknown scenario {negative}
- **GIVEN** the stories.md of S-008.6.1
- **WHEN** `settleText(text, "S-001.1.9", "17")` runs
- **THEN** it returns `{ ok: false, reason: "no-scenario" }`

### S-008.6.5 · A value that can't be written {negative}
- **GIVEN** the stories.md of S-008.6.1
- **WHEN** `settleText` runs for S-001.1.1 with each of the values `""`, `"  "`, `"a}b"`, `"a{b"` and `"a\nb"`
- **THEN** each returns `{ ok: false, reason: "bad-value" }`

## ST-008.7 · azimuth settle records the value
**Intent:** As an agent, I want `azimuth settle` to write the value and log it in one step, so that the change is traceable and needs no reapproval.

### S-008.7.1 · settleValue writes the story and the log {happy}
- **GIVEN** F-001 whose S-001.1.1 has `- **THEN** the heading starts at byte ⟦?⟧`
- **WHEN** `settleValue(root, "S-001.1.1", "17..30", { actor: "agent", session: "SES-20261020-0900", now: new Date("2026-10-20T10:00:00Z") })` runs
- **THEN** that line reads `- **THEN** the heading starts at byte ⟦=17..30⟧`, log.md ends with `## 2026-10-20T10:00:00Z · agent · note · SES-20261020-0900\nSettled S-001.1.1: ⟦=17..30⟧\n`, `changed` is `[".azimuth/features/F-001-thing/stories.md", ".azimuth/features/F-001-thing/log.md"]` and `message` is `S-001.1.1: settled 17..30`

### S-008.7.2 · The CLI says how many are left and records the session {happy}
- **GIVEN** F-001 whose S-001.1.1 has a THEN and an AND line each holding ⟦?⟧, and an open session `SES-20261020-0900` whose `touched` is `[]`, selected with `AZIMUTH_SESSION`
- **WHEN** `azimuth settle S-001.1.1 17` runs as agent
- **THEN** it exits 0 with stdout `S-001.1.1: settled 17 (1 placeholder left)\n`, and the session's `touched` is `["F-001", "S-001.1.1"]`

### S-008.7.3 · Nothing left to settle exits 1 {negative}
- **GIVEN** F-001 whose S-001.1.1 holds only ⟦=17⟧
- **WHEN** `azimuth settle S-001.1.1 18` runs
- **THEN** it exits 1 with stderr `✗ S-001.1.1 has no ⟦?⟧ left to settle.\n`, and stories.md and log.md are byte for byte as before

### S-008.7.4 · An unknown scenario exits 1 {negative}
- **GIVEN** F-001, whose stories have no S-001.1.9
- **WHEN** `azimuth settle S-001.1.9 17` runs
- **THEN** it exits 1 with stderr `✗ S-001.1.9 is not a scenario in .azimuth/features/F-001-thing/stories.md.\n`, and log.md is unchanged

### S-008.7.5 · A value with a brace exits 1 {negative}
- **GIVEN** F-001 whose S-001.1.1 holds ⟦?⟧
- **WHEN** `azimuth settle S-001.1.1 "a}b"` runs
- **THEN** it exits 1 with stderr `✗ A settled value can't be empty or contain {, } or a line break.\n`, and stories.md is unchanged

## ST-008.8 · Settling never changes the spec hash
**Intent:** As an orchestrator, I want settling to keep the approval current while every other story edit still makes it stale, so that I reapprove only real spec changes.

### S-008.8.1 · A spec without placeholders hashes as before {happy}
- **GIVEN** the spec parts `{ featureBody: "# F-001: Thing", impact: "", stories: "- **THEN** the heading starts at byte 2", contract: "" }`
- **WHEN** `specHash` hashes them
- **THEN** it returns `sha256:2e83d331006685ad63a4722db1efadad5b7aabc05d45310978dcabf6f81144d8`, the value before this feature

### S-008.8.2 · Open and settled hash the same {happy}
- **GIVEN** the parts of S-008.8.1 with stories `- **THEN** the heading starts at byte ⟦?⟧`, and the same parts with stories `- **THEN** the heading starts at byte ⟦=17⟧`
- **WHEN** `specHash` hashes both
- **THEN** both return `sha256:3baf12d6f9859469eb98f904a0b41062042a98d091e4bfdd56065e3cd4a0dc9e`

### S-008.8.3 · Other story edits still change the hash {negative}
- **GIVEN** the parts of S-008.8.1 with stories `- **THEN** the heading ends at byte ⟦=17⟧`
- **WHEN** `specHash` hashes them
- **THEN** it returns `sha256:cb99dbcda60bb011c0c9ba28a15a82412644218d64ca7510ad1f41592bd49a67`, not the hash of S-008.8.2

### S-008.8.4 · Placeholders outside stories.md are hashed as written {edge}
- **GIVEN** the parts `{ featureBody: "# F-001: Thing ⟦?⟧", impact: "", stories: "", contract: "" }`, and the same parts with featureBody `# F-001: Thing ⟦=17⟧`
- **WHEN** `specHash` hashes both
- **THEN** they return `sha256:d494e36babaaa75cb5cc626c1f49a831e828e088c484be0f0749ed70918c1925` and `sha256:8d1e97734010805a125333174976e4cf4f04afda20ca4185d6d349a4c6aa73c3`

### S-008.8.5 · A settled feature isn't modified since approval {happy}
- **GIVEN** F-001 in progress whose S-001.1.1 holds ⟦?⟧, approved with `approved_hash` equal to `specHash` of that spec
- **WHEN** `settleValue(root, "S-001.1.1", "17", { actor: "agent" })` runs and the project is analysed
- **THEN** F-001's `modified_since_approval` is `false` and the inbox has no `reapprove-spec` item

## ST-008.9 · The done gate waits for every placeholder
**Intent:** As the developer, I want a feature to finish only once every open value has been settled, so that done stories name only measured values.

### S-008.9.1 · Open placeholders fail the check and are named {negative}
- **GIVEN** F-001 in verifying whose S-001.1.1's THEN and S-001.2.1's AND line hold ⟦?⟧, and whose S-001.1.2 holds only ⟦=17⟧
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.placeholders-settled` has rule `Every placeholder value settled`, `ok: false` and detail `S-001.1.1, S-001.2.1`

### S-008.9.2 · Settled values pass {happy}
- **GIVEN** F-001 in verifying whose stories hold ⟦=17⟧ and ⟦=3..5⟧ and no ⟦?⟧
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.placeholders-settled` has `ok: true` and no detail

### S-008.9.3 · The check sits after the scenarios check {edge}
- **GIVEN** F-001 in verifying without placeholders
- **WHEN** F-001's done gate is evaluated
- **THEN** its check IDs are `["done.verify-passed", "done.scenarios-passing", "done.placeholders-settled", "done.as-built", "done.architecture-reconciled"]`

## ST-008.10 · You review the values an agent settled
**Intent:** As the developer, I want the values an agent settled after my last review to show up in the inbox's Review list, whoever approved the spec, so that I see what the tests decided.

### S-008.10.1 · Values settled after the acknowledgement get a Review item {happy}
- **GIVEN** F-001 in progress with `approved_by: agent` and `review_ack_at: 2026-10-19T20:00:00Z`, and agent log notes `Settled S-001.1.1: ⟦=17⟧` at 2026-10-20T10:00:00Z and `Settled S-001.2.1: ⟦=3..5⟧` at 2026-10-20T10:05:00Z
- **WHEN** the inbox is built
- **THEN** it has exactly one `review-auto` item for F-001, with title `Feature F-001: 2 values settled by an agent`, detail `Settled S-001.1.1: 17; S-001.2.1: 3..5. Acknowledge them or send the spec back to draft.`, since `2026-10-20T10:00:00Z` and urgency `low`

### S-008.10.2 · Earlier settles, yours and other notes don't count {negative}
- **GIVEN** F-001 of S-008.10.1 whose log instead has an agent note `Settled S-001.1.1: ⟦=17⟧` at 2026-10-19T19:00:00Z, the same note by you at 2026-10-20T11:00:00Z, and an agent note `Settled the open questions` at 2026-10-20T11:30:00Z
- **WHEN** the inbox is built
- **THEN** it has no `review-auto` item for F-001

### S-008.10.3 · An unacknowledged automatic approval lists the values {edge}
- **GIVEN** F-001 in progress with `approved_by: agent`, `review_ack_at: null`, and an agent log note `Settled S-001.1.1: ⟦=17⟧` at 2026-10-20T10:00:00Z
- **WHEN** the inbox is built
- **THEN** it has exactly one `review-auto` item for F-001, with title `Feature F-001 was approved automatically` and detail `An agent approved this spec when every check passed. Acknowledge it or send it back to draft. Settled by an agent: S-001.1.1: 17.`

### S-008.10.4 · Acknowledging the feature clears them {happy}
- **GIVEN** F-001 of S-008.10.1
- **WHEN** `acknowledge(root, "F-001", { actor: "you", now: new Date("2026-10-20T12:00:00Z") })` runs and the inbox is built again
- **THEN** F-001's `review_ack_at` is `2026-10-20T12:00:00Z` and the inbox has no `review-auto` item for F-001

### S-008.10.5 · A feature you approved gets an item too {happy}
- **GIVEN** F-001 in progress with `approved_by: you`, `review_ack_at: null`, and an agent log note `Settled S-001.1.1: ⟦=17⟧` at 2026-10-20T10:00:00Z
- **WHEN** the inbox is built
- **THEN** it has exactly one `review-auto` item for F-001, with title `Feature F-001: 1 value settled by an agent`, detail `Settled S-001.1.1: 17. Acknowledge it or send the spec back to draft.`, since `2026-10-20T10:00:00Z` and urgency `low`

### S-008.10.6 · Acknowledging a feature you approved clears its item {happy}
- **GIVEN** F-001 of S-008.10.5
- **WHEN** `acknowledge(root, "F-001", { actor: "you", now: new Date("2026-10-20T12:00:00Z") })` runs and the inbox is built again
- **THEN** it returns `message: "F-001: acknowledged"`, F-001's `review_ack_at` is `2026-10-20T12:00:00Z`, and the inbox has no `review-auto` item for F-001

### S-008.10.7 · A feature you approved with nothing to review is refused {negative}
- **GIVEN** F-001 in progress with `approved_by: you`, `review_ack_at: 2026-10-20T12:00:00Z`, and an agent log note `Settled S-001.1.1: ⟦=17⟧` at 2026-10-20T10:00:00Z
- **WHEN** `acknowledge(root, "F-001", { actor: "you" })` runs
- **THEN** it throws an `AzimuthError` with code `invalid` and message `F-001 has no automatic decision to acknowledge.`, and feature.md is byte for byte as before

### S-008.10.8 · The prompt delta says what you acknowledged {edge}
- **GIVEN** F-001 with `approved_by: you` and `review_ack_at: 2026-10-20T12:00:00Z`, and F-002 with `approved_by: agent` and `review_ack_at: 2026-10-20T12:05:00Z`, and no log entries by you
- **WHEN** `userEventsSince(model, { at: "2026-10-20T00:00:00Z", keys: [] })` runs
- **THEN** the events' texts are `["acknowledged the values settled in F-001", "acknowledged the automatic approval of F-002"]`

## ST-008.11 · The viewer marks settled and open values
**Intent:** As the developer, I want the Stories tab to show which values a test settled and which are still open, without relying on colour, so that I can tell measured values from specified ones.

### S-008.11.1 · A settled value has a mark and a title {happy}
- **GIVEN** a scenario whose THEN is `the heading starts at byte ⟦=17⟧`
- **WHEN** `ScenarioCard` renders
- **THEN** its HTML contains `the heading starts at byte <span class="fd-ph settled" title="settled by test">17<span class="fd-ph-mark" aria-hidden="true">✓</span><span class="sr-only"> (settled by test)</span></span>`

### S-008.11.2 · An open placeholder reads "to be settled" {happy}
- **GIVEN** a scenario whose THEN is `it ends at byte ⟦?⟧`
- **WHEN** `ScenarioCard` renders
- **THEN** its HTML contains `it ends at byte <span class="fd-ph open" title="to be settled by the first passing test">to be settled</span>` and no `?}`

### S-008.11.3 · Placeholders inside code spans {edge}
- **GIVEN** a scenario whose THEN is `it returns ` followed by a code span holding `{ start: ⟦=17⟧ }`
- **WHEN** `ScenarioCard` renders
- **THEN** its HTML contains `<code class="az-c">{ start: <span class="fd-ph settled" title="settled by test">17<span class="fd-ph-mark" aria-hidden="true">✓</span><span class="sr-only"> (settled by test)</span></span> }</code>`

### S-008.11.4 · Text without placeholders renders as before {edge}
- **GIVEN** a scenario whose THEN is `it returns ` followed by a code span holding `{ a: 1 }`, then ` and {x}`
- **WHEN** `ScenarioCard` renders
- **THEN** its HTML contains `it returns <code class="az-c">{ a: 1 }</code> and {x}` and no `fd-ph`
