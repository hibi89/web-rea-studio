# F4 evidence-to-behavior standalone prototype

This iteration generates and verifies an **interactive, standalone HTML demo**
from previously confirmed four-step F2 Chrome evidence. The scope is
strictly `fixture-causal` for a controlled synthetic page. An authorized
external HTTPS page cannot trigger or claim this feature.

## Generation

- Validate provenance, exact action order, before/after state continuity,
  network call counts and known path `/api/rows` (2 API-linked actions).
- Generate a self-contained HTML file with a generic inlined state-machine;
  no source site's JavaScript is reused.
- Expose only the observed serial action sequence. Buttons outside the next
  verified step stay disabled. After four steps the demo can reset.
- Display deterministic state values and a **simulated** API request counter.
  No fetch, XHR, external scripts, images, fonts, storage or backend access.
- HTTP and meta CSP enforce `connect-src 'none'`; no network is needed.

## Chrome acceptance

- First isolated Chrome verifies 4 actual synthetic actions and two
  intercepted API GET requests. No real website is contacted.
- Generate the prototype from that evidence, then launch a second isolated
  Chrome. Replay the 4 steps, compare five state fields after each action,
  verify two *simulated* API increments and zero real API requests.
- Only after real replay agrees does the Studio mark
  `behavior_reconstruction_available=true` and persist the generated HTML.
- On generator or replay failure, the prior F2 evidence remains saved
  but the prototype is not offered as a verified artifact.

## Studio artifacts

- `GET /api/runs/:id/behavior-prototype` opens the saved local demo.
- `GET /api/runs/:id/behavior-prototype-download` downloads it.
- Both routes enforce original fixture mode and an explicitly verified
  report; they do not run the site again.
- The F3 manifest marks `interactive_prototype=true` only when this
  synthetic-only verification passes.

**Not implemented:** arbitrary third-party site behavior reconstruction,
API implementation inference, arbitrary order of interactions, UI parity.