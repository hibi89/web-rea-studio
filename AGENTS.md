# Web REA Studio project rules

- ChatGPT designs, codes, tests and reviews; owner approves consequential steps and runs software on their own Windows machine.
- GitHub single source of truth: private repository `hibi89/web-rea-studio`. Do not modify other repositories or deployment connections.
- Before edits: inspect source, branches, backups and privacy. Avoid force pushes and history rewriting.
- P0 scope is an explicitly owned 127.0.0.1 fixture. No third-party site probing or auth bypass.
- Passive CDP evidence and active Playwright scenarios are different security boundaries. REA scenario provider does not itself implement an origin allowlist.
- Never commit credentials, cookies, session tokens or raw private evidence. Exclude results via .gitignore.
- Separate analysis jobs from read-only dashboards. Duplicate suppression, checkpoints and bounded action/API budgets for future phases.
- Two failed attempts without verified progress require diagnosis and a materially different alternative.
- Only claim capabilities backed by actual test outputs. Local HTTP tests do not prove a real REA browser run.

## Mandatory per-work-unit GitHub handoff (2026-10-17)

- **Read `HANDOFF.md` first at the start of every new chat/task.** Check the actual current `main` HEAD, relevant code and tests before deciding what is done.
- After **every completed bounded feature, bug fix, test, deployment or documentation task**, update `HANDOFF.md` **in the same work session** with what changed, evidence and limitations, exact tests/CI, unfinished work, the next action and any approval needed.
- Commit the handoff with the code or immediately afterward, then verify the published file, branch HEAD and actual CI/deployment status. If the GitHub documentation update fails, report that blocker and do not call the work fully complete.
- Keep current-status summaries in `README.md` and `STATUS.md` consistent with the handoff; preserve historical detail instead of erasing it.
- Do not insert a yet-unknown self-referential commit SHA into handoff content. Report the resulting SHA after GitHub returns it, and distinguish documentation-only CI from a code test run.
- Never treat reading older chat messages or a previous agent's report as verification of current code or deployed production.
