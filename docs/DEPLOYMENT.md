# v0.4 isolated server validation

**Do not expose this local demo API publicly.** It lacks production session authentication and durable review state.

## On substrate-prod-01

The existing test instance may be on port 18789. To start a complete backend+frontend stack with matching ports, use one separate SSH session:

```bash
cd /opt/substrate-elements
git pull --ff-only
npm install --no-audit --no-fund
npm test && npm run build
npm run dev
```

The default backend is 127.0.0.1:8789 and the Vite frontend is 127.0.0.1:5173; Vite proxies `/api` to 8789. Avoid running another process on either port.

## On the Mac (separate Terminal)

```bash
ssh -N -L 15173:127.0.0.1:5173 lee@95.217.167.72
```

Open http://127.0.0.1:15173 and click **Run workflow**. The UI shows the latest result and MCP recording status. In demo mode outputs are synthetic.

## Real MCP recording

The server process needs an OAuth or service credential **authorized for the disposable test workspace**. Do not paste credentials into logs, GitHub or chat. Use a protected environment file or a secrets manager.

```bash
curl -fsS http://127.0.0.1:8789/api/substrate/health
```

The response distinguishes **configured** from **connected**. An MCP-configured true response alone does not prove access. Then submit a new demo run and check `results[].recording`: require `recorded:true`, `mode:recorded`, `toolResult` and ideally `evidenceId`. Recorded synthetic results are *not* empirical evidence.

Capsule integrity is separate from authorship, source validation or logical proof. A verified capsule cannot turn a synthetic result into a true claim.
