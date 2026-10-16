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
