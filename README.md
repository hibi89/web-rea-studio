# Web REA Studio

Private local-first website analysis project. **Current project state, limits, latest verified code and next steps: [HANDOFF.md](HANDOFF.md)**. P1 controlled Windows fixture and P2 static HTTPS have been observed working; the real-site P2 passive-browser app rendering is **not** verified (`Failed to fetch`). Recent F1–F4 behavior work is synthetic-fixture-only.

## P4 compact CSS chart-bar geometry (offline)

The existing script-disabled P4 observer now optionally captures up to 48 **small solid-color `div` rectangles** (e.g. basic CSS chart bars) as inert geometry: coordinates, dimensions, background color and radius only. The independent static HTML paints the observed rectangles without copying scripts, chart values, labels, SVG/canvas data, private text or any external resource. Input geometry is bounded and validated, and old captures with no `primitives` continue to generate exactly the same legacy HTML.

This is a **static chart-shape approximation**, not Chart.js/D3/Recharts/ECharts reverse engineering, functional graph reconstruction, or live backend data retrieval. An offline real Chrome CI fixture with six visible bars measures independent screenshot improvement. See [P4 compact chart primitives](docs/P4_COMPACT_CHART_PRIMITIVES.md).

## P4 measured card-shadow fidelity (offline)

The read-only P4 geometry probe now optionally preserves **one safe, bounded CSS box shadow** for an observed card/panel, including a visible shadow-only div where appropriate. Each value is independently sanitized and only rendered in generated **scriptless standalone HTML**. CSS `url()`, multi-layer/inset shadows, out-of-bounds offsets and source scripts are never copied. Stored geometry lacking the optional key keeps its previous exact generated output.

This improves only **visual depth/edge resemblance**, not paragraphs, icons, live charts, backend functionality or real-site behavior. A required fully in-memory real Chrome fixture compares the original synthetic card against legacy and measured reconstructions; acceptance requires improved full-canvas RGB MAE. Details: [P4 card-shadow fidelity](docs/P4_CARD_SHADOW_FIDELITY.md).

## P4 observed heading layout fidelity (offline)

The script-disabled static visual capture now reuses already observed **H1/H2/H3** data to preserve bounded Chrome-computed `white-space`, `line-height` and `text-align` values in standalone HTML. Values are strictly sanitized; no additional text categories, input values or external resources are collected. Old saved analyses lacking these fields retain their original generator defaults and HTML compatibility.

The mandatory in-memory Chrome test creates a wrapped heading, independently renders a legacy reconstruction and a measured reconstruction, and requires the **measured version to have lower full-canvas RGB error**. This is typography-only fidelity for a controlled fixture, **not** real website behavior, responsive design or backend equivalence. See [P4 heading typography](docs/P4_HEADING_TYPOGRAPHY.md).

## Product quality standard

Our goal is independent, runnable website reconstruction on multiple **authorized real sites**, not a screen-only clone or synthetic-only demonstration. See [quality-first completion contract](docs/QUALITY_FIRST_ROADMAP.md) for F1–F5 evidence gates, security boundaries, closed-loop correction and acceptance milestones.

P5 comparison v2 measures the **full screenshot canvas**, penalizes missing/cropped areas and exposes a static visual-only quality gate. This does **not** certify real-site JavaScript, API behavior, server data or autonomous repairs. Existing historical P5 comparison files are not automatically upgraded or regraded.

## F4 bounded negative action coverage

The two in-memory synthetic F4 Chrome fixtures now verify both **observed action transitions** and that synthetically dispatched events on normally disabled, unobserved actions (with the DOM disabled flag temporarily bypassed) leave the independent app state and simulated API counters unchanged. This extends the existing generated-state-machine quality gate without calling an external site, opening permissions or changing original data. It is **not** proof of functionality for arbitrary external websites. See [F4 negative transition guard](docs/F4_NEGATIVE_TRANSITION_GUARD.md).

## F5 owner-triggered saved draft geometry review

A previously registered **independent P4 draft** can now be explicitly reviewed from local Studio. The action verifies the local HTML's SHA-256 and canonical scriptless template, uses a **fixed synthetic in-memory URL** for fresh Chrome draft evidence, uniquely aligns painted regions against the saved original and applies at most two measured static x/y/width/height corrections. It saves a separate result receipt; a downloadable improved HTML is exposed **only after independently accepted visual improvement**. Normal GET/read-only history causes no browser actions. This is still a static, single-viewport bounded experiment, **not** a complete functional clone or a new external API permission. See [F5 saved independent geometry review](docs/F5_SAVED_GEOMETRY_REPAIR.md).

## F5 safe independent draft intake (local, explicit)

Local Studio now provides a **Static Visual → F5 independent draft** workflow: download the sanitized P4 geometry JSON, modify the separate static layout draft, select the edited JSON and explicitly register it. Studio deterministically generates a scriptless standalone HTML and saves it **once per run**, without changing original analysis files, contacting the original website, executing uploaded HTML or expanding network permissions. Strict canonical HTML+geometry bundles are also accepted via the API; arbitrary HTML uploads are **rejected**. Receipt status remains **STORED_UNVERIFIED**; real Chrome visual identity, geometry repairs, behavior and backend equivalence must be proven separately. See [safe local draft intake](docs/F5_LOCAL_DRAFT_INTAKE.md).

## F5 observed independent source/draft correspondence

The [observed-region alignment gate](docs/F5_OBSERVED_ALIGNMENT.md) now accepts **independent source and scriptless-draft Chrome captures** even when the original uses `aside` or `main` and generated DOM uses reordered `div` elements. Only uniquely matched large painted rectangles may be projected into the existing bounded geometry repair engine, after a separate screenshot preflight proves the projected HTML matches the real observed draft. Ambiguous, mixed, changed, or multiple defects fail closed. This is still an isolated **synthetic** acceptance path, not yet a new local Studio UI action or evidence of external-site reconstruction.

## F5 bounded observed rectangle geometry repair

The new [position and size repair prototype](docs/F5_GEOMETRY_REPAIR.md) can correct one mismatched, independently observed **static P4 rectangle** field (`x`, `y`, width or height) at a time. It is fail-closed when region identity is ambiguous, the change exceeds 64px, a title/painted peer overlaps, a Chrome replay fails, visual quality does not improve or another supplied viewport regresses. This is an isolated engine with mandatory synthetic Chrome evidence, **not** automatic correction of arbitrary live responsive sites, nor currently another Studio UI action. The existing color-repair and real-site permission policies are unchanged.

## F5 independent cross-viewport guard

The bounded F5 engine can now receive **separately captured reference evidence for up to two other viewport sizes**. It replays the exact same proposed scriptless HTML at each size and rejects a desktop paint fix when any observed secondary view worsens (or cannot be independently measured). A new synthetic-only Chrome viewport override is permitted only for memory-relayed, script-disabled capture; real-site capture defaults and authorization are unchanged. **The ordinary local Studio still has only a single saved source viewport and does not claim multi-viewport verification.** See [independent viewport acceptance and scope](docs/F5_MULTIVIEWPORT_GUARD.md).

## F5 opt-in saved-only review in local Studio

A completed Static Visual run with existing P5 v2 evidence now offers **오프라인 색상 재검증 실행**. This is an explicit, one-time local Chrome replay of the **generated scriptless reconstruction** using a fixed synthetic interception URL. Loading run history or reading the result does not recapture the original site. No external host permissions, network relay or original run data change. The saved screenshot path can now infer **one paint color at a time** when a large, unobscured region differs strongly and is near-uniform in both original and independently rendered images. Gradients, textures, text-heavy areas and uncertain evidence remain unsupported; **NO_SAFE_COLOR_PATCH** stays an expected safe outcome. An improved HTML is downloadable only after a fresh replay proves a measurable benefit. See [limitations and acceptance](docs/F5_STUDIO_OFFLINE_REVIEW.md).

## F5 measured bounded repair (synthetic proof only)

The new [F5 bounded-repair experiment](docs/F5_BOUNDED_REPAIR.md) proposes at most **two** evidence-backed static color changes, re-renders every proposal in a new isolated Chrome capture, and keeps only measured improvements. Failed or non-improving proposals are rejected. This is a reusable **engine and CI experiment**, not yet a user-facing general repair button, an authorized real-site result, or proof of application/API/behavior equivalence.

## Q1 offline failure attribution (saved evidence only)

Failed passive browser runs now expose **Q1 실패 원인 판정 JSON** from
`GET /api/runs/:id/q1-assessment`. It cross-checks the existing redacted
support packet and permission checklist against the actual local same-origin
GET/CSP policy, and marks evidence as bounded, partial, or inconsistent.
A finding of `LOCAL_POLICY_BOUNDARY_COMPATIBLE_NOT_CAUSAL` means a rejected
off-origin fetch is **compatible** with current local policy; it does **not**
prove the remote server is reachable, CORS-correct, necessary, or authorized.
The export contains no original external hostnames/URLs/paths/credentials.
It makes no external request, changes no allowlist and never marks a product
functional. See [Q1 failure assessment](docs/Q1_FAILURE_ASSESSMENT.md).

## Q1 offline permission planning (read-only)

For an already failed/interrupted passive analysis, the local Studio failure inspector now offers **Q1 권한 사전 점검 JSON**. It reports saved evidence for rejected external hostnames, missing explicit authorization and path/method/budget requirements, with extra warnings for local/IP-coded DNS hostnames. The output is **never an executable allowlist** and every verdict blocks new external access pending approval. It makes **no outbound request**. See [Q1 preflight](docs/Q1_PERMISSION_PREFLIGHT.md). The user's original dashboard data-loading error remains unresolved.

## What it does today

| Mode | Site | Engine | Output |
|---|---|---|---|
| Controlled browser | `http://127.0.0.1:4317/` | pinned `rea-agents@6.5.0` / Chrome | Seven scripted actions, DOM/accessibility, network events, verified report, final screenshot |
| Authorized HTTPS static | Exact URLs in `WEB_REA_ALLOWED_URLS` | Restricted single HTTPS GET, **not REA** | HTML page title, headings, controls/forms, same-origin path summary, digest and limited report |

**Limitations:** The tool does **not** reconstruct private server source, analyze unauthorised domains, bypass authentication or make unrestricted external browser requests. Static external analysis does not execute JavaScript or take screenshots.

## Windows owner acceptance: isolated legacy data and safer diagnosis

On the owner's second local test the Node regressions **210/210** and npx launcher passed but the disposable `windows-studio-loopback` process failed. A real safety bug was found in that **smoke test**: the temporary Studio could import old results from the user's actual repository. The offline smoke now explicitly skips this migration and real approved-target file while still verifying the real loopback Studio endpoints. An allowlisted `diagnostic.phase`/`diagnostic.reason` is returned on failure, without raw private logs. [Windows Node 22/24 + Linux all-green CI](https://github.com/hibi89/web-rea-studio/actions/runs/39009659884) includes a seeded legacy-run case and **211/211 Node + 5/5 owner-style smoke** in each Windows environment. The user's third local `npm run accept:local` now reports **211/211 Node and 5/5 PASS** on their own PC. The specific cause of the earlier second failed run remains unverified.

## Owner Windows one-command offline self-test

The owner can run `npm run accept:local` **in the local Windows clone** to verify the actual machine's Node regression suite, locally installed npm/Chrome, loopback Studio startup and real synthetic P4/F5 Chrome repair. This is a **user-triggered offline check**, not a live-site replay, a third-party REA install or source API permission. Every run creates a new **private redacted** result JSON in `results/acceptance/` (already Git-ignored), with stage results and generic error codes but no site URLs, raw HTML, browser profile, token or local user path. CI separately exercises this same entrypoint, and the owner's third run has now provided **211/211 Node + 5/5 PASS** with real local Chrome P4/F5. External-site/API functionality remains unverified. [Detailed commands and limits](docs/WINDOWS_OWNER_ONE_COMMAND_ACCEPTANCE.md). The owner-PC regression probe now pins Node's TAP test reporter and also strictly recognizes Node 22/24 spec/TAP summaries to prevent a successful test run from being incorrectly labeled `CHECK_PROOF_MISSING`. The owner's first local attempt was blocked at this proof-parsing stage; a successful GitHub runner does not replace a new owner-PC acceptance result.

## Verified GitHub Windows offline compatibility (2026-10-17)

Beyond Linux, [both Windows and Linux CI jobs now pass](https://github.com/hibi89/web-rea-studio/actions/runs/39004521346) at code SHA `ee839bf2`: real Windows Node **205/205**, no-download npx launcher preflight, actual local Studio startup with a path containing spaces and loopback Host protection, real Windows Chrome P4 capture, and stored user P4 draft → Chrome F5 x/width correction (RGB MAE **2.41 → 1.61**, two accepted edits). No real third-party website or API is contacted.

This verifies the **GitHub Windows runner**, **not** the owner's **subsequently accepted offline laptop run**, real REA-provider capture, or the previously failed external dashboard. [Windows test scope and local steps](docs/WINDOWS_OFFLINE_ACCEPTANCE.md).

## Windows quick start

In the checked-out `hibi89/web-rea-studio` directory:

```powershell
git pull --ff-only
npm test
npm run check:launcher
npm run studio
```

Open `http://127.0.0.1:4320/`. Click **분석 실행** with the default local fixture URL to exercise the P1 browser workflow.

For a domain you own or have permission to analyze, stop Studio and set an exact HTTPS authorization in your PowerShell session **before** starting it:

```powershell
$env:WEB_REA_ALLOWED_URLS='https://your-approved-actual-site.example/'
npm run studio
```

The domain above is a placeholder; use an actual authorized URL. Copy that same exact URL into Studio. This performs a **single static HTML request** only. An unapproved URL is rejected.

Only one run executes at a time. Refresh and viewing history do not re-run the analyzer. On Windows, results stay in `%LOCALAPPDATA%\WebREAStudio\runs`, outside the OneDrive-synced source checkout.

## Tested vs untested

- **Owner Windows real P1 evidence**: `COMPLETED`, strict `PASS`, 7/7 steps, HTTP 200 observed, screenshot saved, inspector populated (2026-10-16; owner provided UI screenshots).
- **P2 static HTML**: offline local tests of scope, DNS filtering, TLS request parameters, redirect refusal, HTML size checks, extraction, and API persistence. **No live external HTTPS test on owner Windows yet.**
- REA 6.5.0 is pinned; direct Node → `npx-cli.js` launcher is used instead of Windows `cmd.exe /c` to avoid quoting failure.

## Documentation

- [P2 authorized static analyzer](docs/P2_STATIC.md)
- [P1 console and persistence](docs/P1_CONSOLE.md)
- [P1 evidence inspector](docs/P1_INSPECTOR.md)
- [P0 REA acceptance](docs/P0_CHECKLIST.md)
- [Architecture and requirements](REQUIREMENTS.md)

No unrelated GitHub repositories or Vercel projects are modified by this Studio.

## P2 first real HTTPS target

The user-selected exact HTTPS URL is listed in `config/approved-targets.json`.
`npm run studio` now loads it and pre-fills it in the analysis console.
This runs **one read-only static HTML GET**, not REA browser capture and not
website cloning. No extra `WEB_REA_ALLOWED_URLS` environment variable is
needed for the checked-in target. The existing REA-controlled fixture remains
available by entering `http://127.0.0.1:4317/` manually.

## P2-2a passive live-page browser preview

The approved HTTPS site can now be analyzed in **Static HTML** (unchanged default)
or an explicitly selected **Passive Browser** mode. The passive mode uses a fresh
Chrome DevTools session with restricted same-origin GET relay requests. It runs
page JavaScript and records a screenshot, basic DOM structure, blocked/fulfilled
resource metadata. No clicks, sign-in, full crawling, browser-source recovery,
or external-domain fetches are enabled. See [P2_DYNAMIC.md](docs/P2_DYNAMIC.md).

This is a first developer preview; real Windows end-to-end success has not been
established. The existing P1 REA fixture and P2 static HTML tests remain intact.


## P2-2 live site failure (2026-10-16)

The owner successfully captured a real PNG and DOM for the approved site, but the
captured page displayed `Failed to fetch` instead of the working dashboard.
Older P2-2a reports incorrectly used `PASS` to mean screenshot stored, even when
the application's report failed. The revised code marks visible fetch failure
or unsettled requests as `FAIL`, saves the diagnostic screenshot, and keeps
browser-only capture status separate from working application rendering.
A broken data request is **not yet repaired**. Inspect the saved network event
summary before allowing additional origins or changing the request policy.

## Local failure diagnostics

The public Vercel deployment is a **mock UI**. Actual browser analysis runs on
the Windows PC at `http://127.0.0.1:4320/`. Storage is local, outside OneDrive.

Pull the latest code, run `npm test`, then `npm run studio`. Select any
previous **FAILED** run from the left sidebar to see **실패 원인 진단**:
a bounded summary of failure codes, network request counts, path-only network
metadata and the recommended next check. **진단 복사** copies the sanitized
summary; it never includes raw stderr, request query strings, cookies or tokens.

This viewer makes no new browser request and never retries an analysis.
If the site displays `Failed to fetch`, the screenshot is diagnostic,
**not** proof that the site was successfully reconstructed.


## P2 cross-origin fetch diagnosis (local only, 2026-10-16)

When a previously recorded passive capture reports a rejected JavaScript fetch
to a different host, the local diagnosis panel now classifies the captured
evidence as `PASSIVE_EXTERNAL_FETCH_REJECTED`, without probing or authorizing
that host. The current Chrome CSP `connect-src 'self'` and the Node gateway's
same-origin policy can prevent such data requests. The diagnosis does **not**
establish that the remote server is reachable, that CORS is configured correctly,
or that the failure is solely attributable to CSP.

The owner must explicitly confirm authorization of any additional backend host
before introducing an opt-in cross-origin allowlist. Never weaken the current
gateway by a wildcard, accept raw URLs, expose cookies, or treat the browser's
requested URL as permission. Inspect failed runs first; no repeat capture needed.
