# Substrate Elements — Hands-on Course

## Objective
Build a small answer-first agent website in which visitors can inspect **what agents actually did**, distinguish model text from evidence, and approve or reject the next step.

## 1. Run the local demo
Run `npm install && npm run dev`, open http://127.0.0.1:5173 and run the sample Release Review. No account or API key is necessary in demo mode. Inspect the agent event log.

## 2. Define nested agents
In `src/main.jsx`, nest an `<Agent role="critic">` under a researcher. Compare the order of agent execution in the expandable trace. The runtime limits plan depth and step count.

## 3. Pause for human approval
Insert `<Review>Approve before release report</Review>` before the reporter. Run the example; inspect the pending review gate. Choose Approve or Reject and observe whether the reporter executes. This is **local demo review** and not a cryptographically authenticated Substrate decision.

## 4. Try plain HTML
Open /examples/plain-html.html and inspect `<substrate-flow>`, `<agent-step>`, `<agent-prompt>` and `<human-review>`. Custom elements must contain a hyphen. Compare their interaction with React.

## 5. Switch to a model
Set `RUNNER_MODE=openai-compatible` and configure the provider URL, model and API key in the Node server's `.env`. Run again. Never put secrets into frontend JavaScript.

## 6. Record provenance
Connect an authorized disposable Substrate workspace with `SUBSTRATE_MCP_URL`, `SUBSTRATE_MCP_BEARER`, and `SUBSTRATE_WORKSPACE_ID`. Run a step, inspect whether `record_tool_result` actually returned a record ID. A recorded model output is *still not independently verified external truth*.

## 7. Explore capsules and audits
The server demonstrates `secure_observe`, `create_evidence_capsule`, and `verify_evidence_capsule` adapter calls. Capsule hash validity establishes content integrity, not authenticated authorship or empirical correctness.

## 8. Threat-model the sample
Explain why a publicly exposed local review endpoint is unsafe without an authenticated user session, CSRF protections, workspace-scoped authorization and persistent approval state. Use a properly authenticated Substrate review workflow for genuine independent approval.

## Quiz
1. Does an Agent React tag create an independently authenticated agent? **No.**
2. Are model-generated statements considered verified tool evidence? **No.**
3. Does a passing capsule hash prove a claim true? **No.**
4. Does clicking Approve produce an independent Substrate review? **No.**
5. Where must MCP credentials live? **Only on a trusted server.**

## Extension projects
Build claim-to-evidence links, display typed Prolog goal results, implement independently authenticated human reviewer gates, and add portable signed capsule verification. Report whether each result was simulated, recorded, verified or still pending.
