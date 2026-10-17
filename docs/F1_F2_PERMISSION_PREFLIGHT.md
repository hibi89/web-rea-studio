# F1/F2 local-only permission policy and action preflight

This phase extends the existing synthetic `catalog` and `analytics` browser
tests with explicit least-privilege control discovery, not third-party
autonomous clicking.

- Browser reads only structural DOM evidence: element type, fixed ID,
  visibility, disabled flag. It never reads input values, links, cookies,
  page text, credentials, form contents or private JavaScript.
- `fixtureActionPolicy` permits exactly 3 controls in each fixed fixture:
  the two approved synthetic actions and one reset control.
- Before the first action, after a reset and before each subsequent
  action, an allowlisted button is rechecked against fresh Chrome DOM.
- Decoy Delete (POST request), Submit, offsite link and password field
  are discovered but refused. No decoy is clicked. The existing network
  interceptor remains fail-closed for unknown hosts/methods.
- The synthetic-only action audit reports approved/denied counts, with
  exactly zero unauthorized actions. Only after this policy proof and
  replay verification does the Studio save generated HTML.
- The F3 manifest reports bounded policy summary values and explicitly
  labels the scope `in-memory-synthetic-only`.
- Unit tests and real Chrome CI check that unsafe elements stay unclicked
  and secrets or offsite URLs are never recorded.

**Crucial boundary:** External HTTPS targets remain read-only, and the
new policy cannot be enabled for user-provided URLs. This stage does
not authorize third-party clicks, downloads, forms or authenticated flows.

**Next step:** a separate, deliberate permission design for authorized
non-destructive interaction tests would require explicit owner-provided
permissions, safe request limits, and independent rollback validation.