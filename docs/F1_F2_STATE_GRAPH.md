# F1/F2 — Observed state exploration and functional relationship graph

Scope: **fixed in-memory catalog/analytics Chrome fixtures only**. No interactions
with third-party pages or authenticated sites have been added.

## Evidence-driven planning

- Normalize browser-observed and permitted button actions into a finite directed
  graph. Nodes are bounded, sanitized interface state snapshots; edges are
  observed button clicks with before/after state and isolated API-request paths.
- Breadth-first search calculates shortest observed-state prefixes to each
  edge. An edge-covering greedy route planner minimizes repeated resets without
  claiming a globally minimal path.
- The previous manually specified source-flow fixture still *collects* initial
  observations. Crucially, **generated-app replay now follows computed graph
  routes** rather than the original hardcoded flow list.
- The second isolated Chrome verifies each planned action and destination,
  confirms observed-edge coverage, and enforces zero real network requests.
- Relationship summaries identify what fields each action changed and which
  synthetic in-memory API endpoint requests occurred. Causality is limited
  to isolated synthetic observations, not inferred external server logic.

## Artifacts

- Studio report records observed states, actions, planned routes and replay
  coverage. In permitted synthetic runs it saves `function-graph.json` only
  after verified replay.
- `GET /api/runs/:id/feature-graph` downloads the verified graph; no source
  website is revisited. Other modes or unverified runs return 404.
- The F3 evidence manifest and Studio interface display bounded functional
  relationships, explicitly annotated **synthetic-only**.

## Coverage meaning

`coverage_of_observed_edges_pct=100` indicates the generated replay covered
**100% of the transitions included in the observed fixture evidence**.
It says nothing about unseen states, undocumented buttons, real website
functionality, or remote API correctness. No arbitrary website exploration
or unsafe clicking is provided.