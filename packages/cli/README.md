# Cyberzavod

Cyberzavod is a local-first, model-agnostic development harness for AI-assisted software projects. It does not write code and it is not an agent: it gives the agent you already use a process to follow, checks that the work is green before the agent stops, and keeps a journal of sessions and decisions next to your project.

## Quickstart

You need Node 22+, git and Claude Code. The project must be a git repository.

1. `npx cyberzavod init` in the project root. Commit the files it lists.
2. Open Claude Code in the project **after** `init` and run `/setup`. It fills in `AGENTS.md` from your repository and runs the checks once. Commit the files it changed.
3. `/feature <task>`. The task goes through the stages: plan, code, review, verify, record. You approve the plan; at the end you get commits.
4. `/publish-recording` in the same session. It turns the session into a recording and, with your consent, sends it to your gallery on [cyberzavod.com](https://cyberzavod.com).

If something doesn't work, run `npx cyberzavod doctor`: it checks the setup and says how to fix each problem.

The full guide: https://cyberzavod.com/guides/connect-project/. Commands, the record format and the source: [github.com/bysavelii/cyberzavod](https://github.com/bysavelii/cyberzavod).
