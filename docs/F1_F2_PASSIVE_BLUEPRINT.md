# F1/F2 saved passive observation blueprint (2026-10-17)

## Design decision

- Option A: Automatically click buttons on external websites and infer API effects from nearby requests. Not selected; prior permission, isolated action evidence and safety controls are missing.
- Option B: Merge existing sanitized F1 control inventory and F2 network groups from a *previously stored* passive Chrome run. Selected; no additional network traffic or paid services.

## Implementation

- studio/passive-blueprint.mjs combines F3's sanitized evidence manifest with the existing sanitized passive dependency review.
- GET /api/runs/:id/passive-blueprint is a read-only, downloadable JSON endpoint for saved dynamic-passive runs. Wrong modes return 404 and mismatched inspection modes return 409.
- The local Studio F1/F2 inspector shows a download link when a finished passive run is selected, including a run whose app rendering failed.
- Every observed control has presence-only status, every network group is observed-only, control_to_api_links is always an empty array and causal_links_verified is zero. Hostnames marked for review are not permissions.
- All preexisting run files remain untouched, and GET never launches a new analyzer or remote request.
- No raw page JavaScript, source code, cookie, authorization header, external path/query or API body is added by this export.

## Validation

- Added Node unit tests for zero causal links, unknown legacy evidence, and mode restrictions.
- Added local Studio route and UI element tests for downloadable JSON, denial of unrelated runs, and no GET-induced recapture.
- GitHub CI exercises Node tests and isolated synthetic Chrome benchmarks; real Windows UI, real external API functionality and app rendering remain to be verified.

## Next step

Open the saved Failed dynamic-passive capture on the user's Windows PC, download F1/F2 evidence JSON, and review the API dependency groups. Confirm permission separately before changing allowed origins. The prior Failed to fetch screen is not repaired by this feature.
