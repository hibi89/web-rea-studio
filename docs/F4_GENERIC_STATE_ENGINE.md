# F4 v2: bounded generic state-machine reconstruction

Goal: progress beyond hardcoded four-button replay without claiming arbitrary website replication.

## What is generated

- `studio/generic-behavior.mjs` validates a typed, bounded **observation graph**
  consisting of synthetic app title, named state fields, button labels,
  before/after state snapshots, action/network attribution and endpoint categories.
- Allowed graphs support 2–12 observed edges, 2–10 non-sensitive state
  fields, independent branch paths, repeated buttons when the starting state differs,
  and only states reachable from the captured initial state.
- Every edge must be backed by `controlled-single-action-window` evidence;
  input values, URLs, raw DOM, cookie/token fields, arbitrary unobserved actions
  and invalid transitions are rejected.
- The generated single-file HTML embeds a small original JavaScript state
  machine rather than copied website JS. Only observed transitions are enabled.
  Network calls are **simulated counters**; `connect-src 'none'` is enforced.

## Real Chrome proof

- Two structurally distinct synthetic browser apps: `catalog` and `analytics`.
- Each is served entirely from an in-memory Chrome interception relay.
  Chrome records three state transitions across two separate branch paths.
- The generated HTML is then loaded in another isolated Chrome and its
  branch behavior and simulated request counts are compared with observed states.
- Actual external requests: zero. Credentials and remote sites are not used.
- CI runs this e2e suite after the existing browser checks; unit tests reject
  unsafe state fields, unsupported endpoints and unverified provenance.

## Studio

Select the local controlled fixture URL (normally `http://127.0.0.1:4317/`)
and choose `F4 Generic · 상품 목록` or `F4 Generic · 분석 대시보드`.
The server refuses both modes for ANY external HTTPS URL.

On success, the run stores `generic-prototype.html`, a report and a
downloadable F3 evidence manifest. Read-only preview/download endpoints are
`/api/runs/:id/generic-prototype` and `.../generic-prototype-download`.
No analysis is rerun when these saved artifacts are opened.

## Known limitations

- Only the two controlled synthetic sites have been Chrome-validated.
- Real website state effects, data schemas, API writes, authentication,
  variable user input, arbitrary branching and navigation remain unverified.
- This is a reusable **schema and renderer** backed by two real test apps,
  NOT general autonomous crawling or verified functional cloning of public sites.
## Follow-up negative-action verification

The isolated generated F4 app must also reject events on buttons that are disabled for the current observed state, even when Chrome temporarily bypasses DOM `disabled` and dispatches an artificial click event directly (restoring the flag immediately). `studio/generic-fixture-browser.mjs` compares the current state, completed-action counter, simulated API counter and intercepted fixture API requests before and after each synthetic event; any change fails the Chrome acceptance. This uses the **same in-memory Chrome replay** with no new origin or user-site contact. The mandatory `tests/f4-generic-chrome-e2e.mjs` on Linux Chrome requires at least four such denied probes in each of `catalog` and `analytics` (see `docs/F4_NEGATIVE_TRANSITION_GUARD.md`). It establishes only bounded negative-path fidelity for the two known synthetic fixtures, not arbitrary website support.

### Final required CI proof

[Actions 39013744143](https://github.com/hibi89/web-rea-studio/actions/runs/39013744143), code SHA `da27ef6`: all three required Linux/Windows jobs `SUCCESS`, 216/216 Node on Linux22 and Windows22/24. The Linux real Chrome F4 logs report **five denied unobserved actions** on each of `catalog` and `analytics` alongside all three positive transitions, with real API calls zero. Windows jobs verify the established local Node/Chrome P4/F5 safety smoke but do **not** directly run the F4-specific Chrome test.
