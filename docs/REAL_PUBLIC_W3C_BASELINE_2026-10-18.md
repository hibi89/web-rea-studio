# First real public website benchmark — W3C homepage (2026-10-18)

## Scope and outcome
- User explicitly authorized trying a different public URL after the prior target failed.
- Fixed, one-time URL: `https://www.w3.org/`. Scriptless, read-only, same-origin GET only, no cookies or credentials, redirects and cross-origin resources denied, no click/form submissions.
- Functional capture code SHA: `0c453b71e19d7f6b518d4ec098248bd5332c1235` (prior workflow YAML syntax-only attempt `ce18abbd42a99f36e8698997a5b7fbc65e0d8cdf` failed before any jobs; fixed by quoting the YAML `if` expression).
- [GitHub Actions run #39100919436](https://github.com/hibi89/web-rea-studio/actions/runs/39100919436), public benchmark job 117596838292 **SUCCESS**; one-time private CI artifact ID 12125939895, `rea-w3c-public-visual-once`, expires 2026-10-19 05:33 UTC. Public source screenshot is not committed to Git.
- Original actual W3C Chrome capture: `PASS`, no source failures, no blocked resources, 1440×3572 PNG, not truncated, JS disabled.
- Independent REA faithful HTML generated from sanitized saved geometry (16 boxes, 10 headings), separately rendered in Chrome without any external requests; exact same screenshot dimensions 1440×3572.

## Metrics and artifact hashes
- **Sampled full-page pixel match: 83.88%**, RGB MAE **23.29** (0 best), coverage **100%**, dimensions equal, 80,460 8-pixel-spaced samples; method `downsampled-rgb-mae-union-penalized` and RGB delta threshold 18.
- First 900px viewport (same 8px sample grid): **88.15%** match, MAE **19.59**. 900–1800px: **80.24%**, MAE **28.09**; 1800–2700px: **75.09%**, MAE **33.81**; 2700–3572px: **94.66%**, MAE **7.80**.
- Independent diagnostic, **not a project-certified metric**: among source image pixels whose PIL `FIND_EDGES` grayscale value exceeds 30 (7.38% of 8px sample grid), only **53.28%** satisfy the same RGB delta ≤18 threshold; MAE **54.78**. Background-dominated 83.88% must NOT be presented as 83.88% perceived visual fidelity.
- Source screenshot SHA256: `31d9c98452d9dd476a15544b4f583283b288dbad4ae1424b4157db9610c3bd88`.
- REA screenshot SHA256: `7211d39906663cc057af4f39cbcfb07c0bb7387ea4e76272f7206a1ad70ba013`.
- Generated faithful HTML SHA256: `e4d9850c82abe01d60ca5946b31581f58980ac64109071d54944064b5e266a90`.

## Visual diagnosis
Actual side-by-side review: REA approximates the large section backgrounds and some cards, but fails to reproduce W3C's header/logo, hero illustration, multiple prominent editorial images, iconography, paragraph content, buttons, fine typography and much of the visual hierarchy. Bottom news cards match relatively well in their large block shapes, inflating the global match. **This is a successful real-site benchmark and a weak visual reconstruction**, not proof that the user's requested 70–80% human-perceived similarity target has been met.

## Follow-up priority
1. Add safe, bounded **visual asset reconstruction** for images/logo/iconography observed in approved scriptless DOM; preserve original asset source metadata only within consent and privacy boundaries, avoid bundling third-party assets for redistribution by default.
2. Extend extracted **body text and text geometry** beyond the current 10 headings; reconstruct paragraph/button typography and spacing.
3. Add **region-aware quality metrics** (foreground/edge-weighted plus full-page) so blank backgrounds cannot conceal poor fidelity.
4. Repeat a one-time authorized public benchmark after improvements, and compare against this saved baseline without claiming functional or backend parity.

No original JavaScript, API or database functionality was observed, copied or verified. No Production deployment. `main` remains untouched.
