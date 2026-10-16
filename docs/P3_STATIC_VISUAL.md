# P3-2 Static Visual — initial HTML without page scripts

This is an **opt-in mode** for one explicitly approved public HTTPS URL.

- It reuses the isolated Chrome profile, CDP interception, Node HTTPS GET
  gateway, and existing exact-site/same-origin resource restrictions.
  No login, cookies, additional hosts, button clicks, POST, form submission
  or cross-origin API calls are enabled.
- The document response enforces \`script-src 'none'\` and \`connect-src 'none'\`.
  Browser JavaScript from the analyzed page is therefore not executed, so
  its failed external data request should not overwrite initial HTML.
  Inline CSS and approved same-origin static resources can render.
- A **PASS** means the HTML-only screenshot was successfully captured, not
  that the original web application or charts function. Reports identify
  \`scripts_executed=false\`, \`application_render_status=not-executed\`,
  \`render_fidelity=static-html-only\` and the captured DOM geometry.
- This mode can reveal a fuller dashboard outline only when the received
  HTML already contains it. Apps that construct all content via JS may show
  blank or incomplete output. Cross-origin fonts/images still may not load.
- Static HTML and Passive Browser modes remain available and unchanged.
- Node regression tests do **not** prove that Chrome on Windows will render
  the target correctly. Inspect the new screenshot before claiming visual parity.
