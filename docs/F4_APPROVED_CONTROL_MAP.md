# Approved Static Visual → F4 observed control map

Scope: static-visual mode on an explicitly approved HTTPS page. This is
**read-only evidence**, NOT functional cloning and NOT automated clicking.

- The existing Chrome inspection already captures bounded layout rectangles
  and a separate sanitized inventory of visible controls.
- After a successful independent P4 geometry reconstruction, Studio now
  builds an independent artifact `control-map.html` with disabled overlays.
- Up to 60 observed buttons, navigation links, tabs and field locations are
  painted at measured coordinates. There are no working hyperlinks, forms,
  input fields, scripts, event listeners or backend requests.
- Field contents are never collected. Only the names of buttons/tabs/links
  are included, after label sanitization. Credential-like strings and
  URLs are redacted. Offsite links have no destination in the artifact.
- `control-contract.json` explicitly labels every control
  `function_status=unverified`, `preview_behavior=disabled`.
- The ordinary P4 preview remains untouched, preserving the independent
  screenshot and P5 pixel comparison baseline.

Endpoints (saved-run only, no re-execution):

- `/api/runs/:id/control-map` — read-only preview
- `/api/runs/:id/control-map-download` — standalone HTML attachment
- `/api/runs/:id/control-contract` — position/evidence JSON attachment

Content Security Policy disables all JavaScript and network connections.
An offline Chrome acceptance check loads the generated artifact from memory,
verifies that every overlay button is disabled, and confirms zero external
requests. The regression suite also verifies that secrets, raw input values,
and link destinations are absent.

Limitations: the overlay coordinates and labels may be approximate or sparse;
they do not prove that a visible control works, that an API exists, or that
a reconstructed button can safely run. The next product step is to develop
separately authorized, reversible functional tests with clear evidence.