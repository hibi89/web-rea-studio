# Draft schema (not implemented)
- projects(project_id, authorized_origin, allowed_scope_json, created_at)
- runs(run_id, project_id, engine, version, config_hash, idempotency_key, status, checkpoint, timestamps)
- evidence(evidence_id, run_id, source, artifact_sha256, completeness, observed_at)
- inferences(inference_id, run_id, claim, class[observed|inferred|unknown], evidence_refs)
- generated_projects(build_id, run_id, source_dir, validation_state)
- assertions(assertion_id, build_id, expected_evidence, observed_evidence, result)
- job_events(event_id, run_id, sequence, type, redacted_detail)

Binary screenshots and network evidence are stored locally by content digest. This is a design draft, not a deployed DB.
