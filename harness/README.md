# Harness

The development process that Cyberzavod gives every project, regardless of language, framework, or model. An agent adapter (the first is Claude Code) turns these texts into files its agent understands; the rules of a specific project live in its AGENTS.md.

- `principles/` — principles shared by all stages: engineering, code readability, architecture, change scope, safety.
- `stages/` — stages: what the stage's role does, what it receives, and in what form it answers. File header: `role` — the role name (a stage without an agent has none), `title` — the name for humans, `description` — one line about the role, `access` — `read` (only reads) or `write` (changes files).
- `workflows/` — workflows: the order of stages. `default` — Plan → Code → Review → Verify → Record.
- `conductor.md` — how the lead takes a task through the stages of the workflow.

A new stage is a new file in `stages/` and a new member of `STAGES` in `packages/core/src/stage.ts`; a new workflow is a new file in `workflows/`.
