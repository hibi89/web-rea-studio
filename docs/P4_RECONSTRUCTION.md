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
