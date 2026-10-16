# F2 controlled Chrome action-to-API verification

This is a **fixed synthetic benchmark**, not automatic interaction with
the user's external website. It is intentionally separate from Passive Browser.

## Studio mode

- Select the controlled fixture target (`http://127.0.0.1:4317/` by default),
  then `F2 Controlled Chrome`. The Studio server rejects that mode for any
  approved external HTTPS URL, even when the user explicitly provides it.
- The runner uses an isolated headless Chrome profile. The only allowed
  document and API are synthetic HTTPS fixture bytes produced in memory.
- A fixed four-action plan clicks `period`, `sort`, `help`, then `refresh`.
  It observes the resulting synthetic DOM states and the number of
  in-memory `/api/rows` GET requests.
- The network interceptor fails closed on other resource URLs and methods.
  DNS and proxies are disabled, and no credentials, inputs, or remote
  responses are collected.

## Confirmed fixture effects

| Action | Changed state | `/api/rows` requests |
| --- | --- | --- |
| Period | period 7→30, rows 3→8 | 1 |
| Sort | order asc→desc | 0 |
| Help | view table→help | 0 |
| Refresh | no persistent view change | 1 |

These causal links are verified only within the serial isolated synthetic
benchmark and must **never** be transferred as claims about the analyzed
external site. Reports, inspection, and the downloadable F3 manifest
explicitly mark them `controlled-synthetic-only`.

The GitHub CI runs the existing 129 Node tests, the visual Chrome fixture,
and a second real Chrome that executes the synthetic F2 four-action plan.
Local Windows acceptance remains a separate check and is not silently claimed.