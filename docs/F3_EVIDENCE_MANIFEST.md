# F3 structured evidence manifest and F4 local HTML export

F3 is a deterministic summary of one completed Studio inspection; it does not call an LLM
or infer undocumented source code and server logic.

- The local manifest.json contains analysis mode, trust scope, bounded control
  categories, passive network dependency groups, measured layout metadata,
  evidence limitations and artifact availability.
- All external control effects remain not-verified and causal_links_verified=0.
  Controlled local fixture steps are reported separately.
- Input values, credentials, raw HTML/JS, hrefs, URL query strings, response bodies
  and private API data are excluded.
- GET /api/runs/:id/manifest serves the stored JSON as a downloadable file.
- GET /api/runs/:id/reconstruction-download serves the independent,
  script-disabled P4 HTML as an attachment with a restrictive CSP.
- Reading saved files never re-runs the target website. Earlier runs without
  a manifest cannot be reconstructed retroactively from absent evidence.

This is an evidence-to-code intermediate format, not a verified functional clone.