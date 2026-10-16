# Draft storage model — not yet deployed

All tables use UUID identifiers and UTC timestamps.

- projects(project_id, name, authorized_origin, scope_json, created_at)
- runs(run_id, project_id, engine_name, engine_version, configuration_hash, idempotency_key, status, started_at, finished_at, last_checkpoint)
- evidence(evidence_id, run_id, source_kind, artifact_sha256, source_url_redacted, observation_kind, completeness, created_at)
- inferences(inference_id, run_id, claim, class[observed|inferred|unknown], confidence, evidence_refs_json)
- generated_projects(build_id, run_id, source_dir, manifest_sha256, validation_state)
- assertions(assertion_id, build_id, expected_evidence_id, actual_artifact_id, result, error_reason)
- job_events(event_id, run_id, sequence_no, event_type, detail_json, created_at)

Evidence binary content (e.g. PNGs and HARs) lives in a local content-addressed store, not the main database. Validate that redacted fields cannot be reconstructed through raw debug logs before saving artifacts.

## P1-1 actual temporary storage (implemented, JSON files)
`results/studio/runs/<uuid>/` contains:
- `metadata.json`: `{id,target_url,status,created_at,updated_at,engine,verdict?,error?}`.
- `scenario.json`: REA action and capture contract.
- `rea-capture.json`: complete local REA Evidence envelope (do not publish).
- `rea-stderr.log`: REA diagnostics (potentially sensitive, local only).
- `report.json`: curated P0 verification summary.
- `screenshot.png`: optional PNG, digest verified prior to saving.

The planned SQL schema above is **not deployed**. Migration will be defined after the P1-1 Windows test.
