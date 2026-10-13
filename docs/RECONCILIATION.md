# Reconciliation record: archived v0.3 vs GitHub starter

The public repository was initially reconstructed as a **smaller derivative** of the v0.3 ZIP, not imported byte-for-byte. This branch restores documented capabilities as independently reviewable changes.

| Archived v0.3 capability | Public initial state | Reconciliation |
| --- | --- | --- |
| Synthetic agent execution | Present | Retained |
| React and HTML declarative workflow | Present | Retained |
| Recursive agents and review gates | Present | Retained |
| OpenAI-compatible provider | Present | Retained |
| Webhook BYO agent runner | Missing | Restored |
| SSE event stream per run | Missing | Restored |
| JSON trace export endpoint | Different | Restored |
| Asynchronous workflow execution / polling | Mismatched | Fixed |
| Per-run Evidence Capsule create, verify, import | Missing | Restored |
| Application-shared-secret review guard | Missing | Restored (still not independent auth) |
| Node tests | 6 | Added two plain HTML tests |
| React/Vite build CI | Missing | Added GitHub Actions |

## Deviations that remain

The current public code is still not an exact file-for-file replacement for the ZIP. UI styling, component file structure, adapter argument shapes and some event names differ. Comparison is therefore a **feature reconciliation**, not a verified byte-for-byte restoration. Runtime tests and CI results determine what can be claimed to work.

## Security and trust

- The review shared secret is demonstration-only and not a user OAuth identity.
- No agent output can be called independently verified solely because it was logged.
- A capsule hash confirms integrity, not authorship or truth.
- The HTTP server binds to loopback and must not be exposed as a production service.
- No private Thought Substrate implementation source is included.
