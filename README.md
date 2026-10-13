# Substrate Elements

**AI answers first. Evidence underneath. Humans in control.**

Open-source, MIT-licensed React and browser Web Components starter for building recursive multi-agent web workflows, with human-in-the-loop gates and optional Substrate MCP provenance.

> **Status: experimental demonstration, not a production security or multi-tenant framework.** The sample's approval gate is local application state, not independent Substrate reviewer authorization. Model output is not verified evidence.

## Quick start

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5173** (React example) or **http://127.0.0.1:5173/examples/plain-html.html** (HTML custom element). The backend listens on localhost port 8789. Both examples work without credentials using explicitly synthetic agents.

## React DSL

```jsx
<Substrate title="Substrate Elements — Release Review">

  <Agent role="researcher">
    <Prompt>
      Assess deployment readiness from available information.
    </Prompt>

    <Agent role="critic">
      <Prompt>
        Challenge assumptions and unsupported claims.
      </Prompt>
    </Agent>
  </Agent>

  <Review>
    Approve the agent findings before the final report
  </Review>

  <Agent role="reporter">
    <Prompt>
      Summarize a cautious release recommendation.
    </Prompt>
  </Agent>

</Substrate>
```

**What each element does:** `Substrate` names the workflow; `Agent` creates an execution step; `Prompt` supplies instructions. The critic is nested beneath the researcher and runs before the review gate. `Review` pauses execution for approval or rejection; only approval allows the reporter to run. In demo mode, results are synthetic and the human review is an application-local gate, **not** a Substrate-authenticated approval.

The JSX component definitions are in `src/main.jsx`; for a real reusable package, extract them into a dedicated library entry point before publishing to npm.

## No React: native HTML custom elements

```html
<substrate-flow title="Release Review">
  <agent-step role="researcher">
    <agent-prompt>Collect release evidence.</agent-prompt>
    <agent-step role="critic">
      <agent-prompt>Challenge unsupported claims.</agent-prompt>
    </agent-step>
  </agent-step>
  <human-review>Approve or reject the findings</human-review>
  <agent-step role="reporter"><agent-prompt>Write the final report.</agent-prompt></agent-step>
</substrate-flow>
<script type="module" src="/src/custom-element.js"></script>
```

Browser custom elements require a hyphen, so `<substrate-flow>` is used instead of `<SUBSTRATE>`.

## Real model runner

Copy `.env.example` to `.env` and configure an OpenAI-compatible server-side API:

```env
RUNNER_MODE=openai-compatible
MODEL_BASE_URL=https://your-provider.example/v1
MODEL_NAME=your-model
MODEL_API_KEY=your-key
```

Keep all credentials server-side. A separate user's existing ChatGPT agent sessions are **not** automatically discoverable or executable by this starter.

## Optional Substrate MCP

```env
SUBSTRATE_MCP_URL=https://your-authorized-host.example/mcp
SUBSTRATE_MCP_BEARER=your-authorized-server-side-oauth-token
SUBSTRATE_WORKSPACE_ID=your-disposable-workspace
```

Agent-step outputs are optionally recorded using `record_tool_result`. The UI makes the recording outcome inspectable: if Substrate is unavailable it cannot claim the work was audited. Server API examples also include workspace observe and Evidence Capsule create/verify endpoints. Do not expose this demonstration HTTP server directly to the Internet: it has **no application authentication, CSRF controls or durable approved-run store**.

## What developers see

The page shows the most recent result at the top, then an expandable event/evidence trail with agent and nested subagent steps, MCP record identifiers (if returned), and approval outcomes. A JSON trace export is **not** a certified Evidence Capsule, and a hash is not proof of empirical truth.

## Training

See [the hands-on Academy course](docs/COURSE.md) for agent trees, provenance, human review and trust-boundary exercises.

## Tests

```bash
npm test
npm run build
```

The first commit was published through the connected GitHub integration. The full dependency install and production MCP integration have **not** been verified in this GitHub environment.

## License

MIT. This public sample is separate from the private `thought-substrate` backend, which is **not** copied into this repository.


## Two browser demos

- `/` — overview and links to both demos.
- `/demo/basics` — minimal JSX `<Substrate>`, nested `<Agent>`, `<Prompt>`, and `<Review>` example. Demo mode uses **synthetic** agent responses, clearly labeled.
- `/demo/investigation` — fictional production-outage fixture with **real authenticated MCP** evidence recording, proposed evidence challenge, fresh workspace observation, and Evidence Capsule request. The UI deliberately does not claim a real replacement AI agent, Prolog proof, or accepted challenge exists.

The investigation requires server-side `SUBSTRATE_MCP_URL`, `SUBSTRATE_MCP_BEARER`, `SUBSTRATE_WORKSPACE_ID`, and `REVIEW_API_KEY`. Keep it bound to localhost and reach it through SSH; do not publish the demo API unauthenticated. Enter the review key on the locally forwarded UI only. Prefer a **dedicated disposable workspace**: creating a capsule snapshots the configured workspace, which may contain records unrelated to this single demo. The server must be restarted after changing environment configuration.
