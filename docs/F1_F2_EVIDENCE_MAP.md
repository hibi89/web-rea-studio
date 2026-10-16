# F1/F2 evidence-based interaction mapping (first implementation)

Purpose: make **control presence** and **network dependencies** visible without
pretending to know hidden website code or causing unauthorized mutations.

- F1: a read-only Chrome DOM probe inspects at most 500 candidate nodes and
  persists at most 100 visible buttons, links, inputs, selects, tabs and
  accessibility roles. It records role, short sanitized label (not for fields),
  on-screen rectangle, optional link *classification*, disabled/expanded state.
- **No field values, cookies, tokens, URL paths/queries, browser storage,
  page scripts or event handlers are collected by the F1 probe.** No
  automatic navigation, button clicks, form submissions or page state mutations.
- F2: consolidate already-sanitized passive browser request events into
  same-origin vs external host groups. Explicitly assign zero verified
  control-to-API causal links; observed requests do not prove button effects.
- Controlled fixture REA runs are a distinct executed behavior source:
  expose previously captured scenario steps and sanitized endpoint paths.
  Do not assign individual network events to specific controls without
  per-step timestamp/trace evidence.
- This is a **first step**, not autonomous general-site crawling, API schema
  recovery, or functional clone verification. The controlled fixture is the
  only interactive test target. Real external sites remain read-only under
  the exact allowlist.
- The Chrome CI includes a synthetic credential field, navigation links,
  buttons and ARIA tab and checks that secret field values and offsite links
  never enter the stored inventory. Unit tests verify redaction and
  separation of observed behavior versus unverified causal inference.
