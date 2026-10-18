# Mechanism Skills MVP runbook

Scope: standalone template-derived filter, group-by-sum, crossfilter dashboard from local CSV/JSON. No third-party dashboard source or styling is included.

Run:

```sh
npm run build:mechanisms
node --test tests/mechanism-*.test.mjs
```

Open `output/dashboard.html` offline. Generated `output/mechanism-spec.json` records template mechanisms and unknown source API. Sample KPI expectations: ALL=870; KR=450; US=270; JP=150. Chart month totals must change with selected region.

For a custom CSV file, run:

```sh
node scripts/build-mechanism-dashboard.mjs --input ./my.csv --dimension region --group month --measure revenue --out ./output/mine.html
```

HTML page permits a local CSV/JSON file and explicitly confirmed column mapping before exporting. HTML exports embed the local data. File size limit 300 KB and row limit 2,000.

Local prototype Node 22.16.0 focused tests: 10 passed, 0 failed, including simulated DOM behavior. The GitHub-committed source and its CI have not been separately proven to pass; physical Chrome acceptance remains unverified. No Production deploy or main merge.
