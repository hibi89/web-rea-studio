# P4 geometry-based independent UI preview

P4 is an opt-in extension of **Static Visual**. It does not log in to any
backend or clone original site source code.

1. After the script-disabled Chrome page is captured, a read-only DOM probe
   collects at most 180 semantic or visually distinguished regions and 32 short
   headings. It records bounded rectangles, background colors, border radii,
   and limited heading typography. Inputs, cookies, forms, network payloads,
   page JavaScript and arbitrary attributes are not collected.
2. The server sanitizes all of this evidence and writes a standalone
   `reconstruction.html` file under the same local run directory.
   Elements are positioned absolutely according to measured page coordinates
   and parent depth. No original JS, backend data, linked font, remote image,
   stylesheet or network access appears in the generated page.
3. The saved local Studio run offers **독립 미리보기 열기**. The
   `/api/runs/<id>/reconstruction` route is read-only and returns strict
   HTTP CSP with `script-src 'none'` and `connect-src 'none'`.
4. Original screenshot vs generated geometry is **not yet quantitatively
   compared**. Labels and geometry may be incomplete or approximate; this
   is a nonfunctional UI skeleton, not a verified full reproduction.
5. If there are no usable region measurements, no preview file is created
   and the analysis remains available for inspection.

Existing historical captures cannot be retroactively reconstructed without
P4 geometry evidence. A new authorized Static Visual run is needed. Node
mock tests verify geometry sanitization, scriptless output, route security and
stored run behavior; actual local Windows Chrome remains the acceptance gate.


## P5 automated local screenshot comparison

For future Static Visual runs that have a stored reference PNG and a generated
independent HTML skeleton, the local server optionally launches **one additional
isolated Chrome**. Its network relay serves only the in-memory generated HTML
at the already-approved exact URL; no remote backend/API request is made.

Two PNGs are then compared offline, on an 8px RGB sampling grid. The recorded
`rgb_mae` runs from 0 (identical RGB values) to 255 (maximal error), and
`pixel_match_pct` uses a per-sample RGB MAE tolerance of 18. The fixed
explanatory overlay is excluded from comparison. Different screenshot sizes
are explicitly flagged and only the overlapping area is compared. Metrics
describe **visual similarity of these static screenshots**, not feature parity,
live data, HTML/CSS semantics, or success of the original web application.

The original screenshot, reconstruction screenshot, and comparison JSON are
persisted only under the selected run's private local directory. The UI
displays both images with metrics. If replay, PNG parsing, or comparison fails,
the original capture and the independent HTML preview remain accessible;
no false visual-quality claim is made. No remote hosts are auto-approved.
