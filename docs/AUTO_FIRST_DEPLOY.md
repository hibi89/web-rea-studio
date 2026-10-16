# One-time Vercel authorization -> automated first deployment for future projects

This **opt-in** workflow avoids repeatedly importing repositories through the Vercel dashboard. It uses the official Vercel API from a trusted GitHub Actions runner, not the ChatGPT Vercel connector that currently gets `403` on project creation. A GitHub Secret is needed once. Do not paste a token into ChatGPT or into Git-tracked files.

## One-time owner setup

1. Open <https://vercel.com/account/tokens>. Create a Vercel API token scoped to the **hibi89** team. Ensure its lifetime is appropriate; an expired or revoked token requires refreshing the secret later.
2. Open <https://github.com/hibi89/web-rea-studio/settings/secrets/actions/new>. Create repository secret **`VERCEL_TOKEN`**. Paste the value there, NOT in chat.
3. Tell the assistant **"VERCEL_TOKEN 등록함"**. The assistant can then cause an authorized `main` push to the manifest/workflow to run the automation. Alternatively, the owner can run `First-time Vercel project provisioning` using the GitHub Actions **Run workflow** control.
4. Inspect the GitHub Actions log and, after GitHub integration builds the project, verify the Vercel deployment URL. This is not complete merely because tests or the API returned success; the live UI must be checked.

## Ongoing usage

This repository is the current **deployment controller**. The assistant adds one explicit entry to [`deploy/vercel-queue.json`](../deploy/vercel-queue.json) for each new approved deployment (owner must be `hibi89`, Git branch `main`, project name, and root directory). A push of that manifest to `main` triggers the GitHub Action to provision only missing projects. Existing matching Git-linked projects are left alone; mismatched project names are rejected rather than overwritten. The script uses a single API token for the selected Vercel team. It does not copy or deploy other users' repositories.

The Vercel GitHub app must have access to each source repository. To support future repositories without repeated approvals, the owner may choose GitHub App `All repositories` **if they accept that broader access**; the safer minimal option is to add individually as needed.

## What remains unverified

Tests use deterministic fake HTTP responses. The actual GitHub Actions execution and Vercel API token path cannot be exercised until the owner stores the secret. The ChatGPT Vercel connector's 403 is not thereby repaired; this is an independent deployment channel. Subsequent edits to Git-linked projects should trigger Vercel's native Git auto-deploy. The local Chrome/REA service itself is not hosted by this static preview.

## Security guardrails

- GitHub Actions secrets, never plaintext Git commits or chat messages.
- The workflow has read-only GitHub contents permission and runs from the default branch, not pull requests.
- No arbitrary URLs or owner names in the manifest; strict `hibi89` and `main` allowlist.
- It checks existing project Git connection and doesn't overwrite unrelated projects.
- Use a scoped token; revoke it if no longer needed. GitHub Actions access to that token is powerful: review workflow changes before trusting them.
- The Vercel `GET /v9/projects`, `POST /v11/projects`, and `POST /v13/deployments` requests fail closed and do not print API bodies or token values.
