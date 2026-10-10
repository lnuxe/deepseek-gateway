# deepseek-gateway

A tiny local HTTP gateway that exposes your **DeepSeek** API as an
**OpenAI-compatible** (and **Anthropic-compatible**) endpoint, plus a small
control panel — so any client that speaks those protocols can use DeepSeek models.

Zero dependencies — Node.js built-in modules only.

```
your client ──► http://127.0.0.1:8787/v1 ──► https://api.deepseek.com
                (this gateway)
control panel ─► http://127.0.0.1:8787/
```

## Why it exists

Two small incompatibilities trip people up when pointing a client straight at
`https://api.deepseek.com`:

1. **Model names are strict.** DeepSeek only accepts `deepseek-flash` and
   `deepseek-v4-pro`; anything else returns
   `400 ... The supported API model names are deepseek-flash, deepseek-v4-pro`.
   Clients that send their own model ids (or verify an endpoint by sending a
   probe model name) fail immediately.
2. **The base URL must include `/v1`**, otherwise requests land on
   `https://api.deepseek.com/chat/completions` → 404.

The gateway accepts *any* model name, maps it to a real DeepSeek model, injects
your API key, and streams the answer back untouched.

## Quick start

```cmd
:: Windows — double-click friendly, prints status and keeps the window open
start-gateway.cmd

:: or directly
node server.mjs
```

Open **http://127.0.0.1:8787/** for the control panel, then point your client at:

```
Base URL : http://127.0.0.1:8787/v1
API Key  : anything (the gateway injects your real DeepSeek key)
Model    : deepseek-flash   or   deepseek-v4-pro
```

## Control panel — 网关控制台

The gateway serves a console from `panel/dist`. It is a Vite + React + Tailwind
app, organised as a console shell with nine sections:

```
概览 Overview            KPIs, dependency health, throughput, recent requests
网关路由 Routes           the routes this gateway serves + live per-route counters
上游服务 Upstreams        upstream health, latency, model catalogue
消费者 Consumers          which local clients are wired up (Cursor, extensions, SDKs)
插件 Plugins              the fixed request pipeline, read-only
证书 Certificates         upstream TLS chain, ciphers, expiry countdown
日志 Logs                 live request log with filters and export
监控 Metrics              rpm, P50/P95, error rate, per-route and per-status breakdown
系统设置 Settings         upstream key, listen port, autostart, client patching, runtime
```

Shell: collapsible left navigation, top bar with breadcrumb, environment chip,
`⌘K` section search, status notifications and the local user. Sections are
reachable as links (`/#/logs`).

Manually configurable: the upstream key, the listen port, autostart, and the
local client-patch actions. Everything else is read from the running gateway —
there is no model-name mapping UI, the gateway does that internally.

```cmd
cd panel
npm install
npm run build        :: -> panel/dist, which server.mjs serves at /
npm run dev          :: hot-reload dev server on :5199 (proxies /api to :8787)
```

If `panel/dist` is absent the gateway falls back to the zero-build `panel.html`,
so the tool keeps working without a Node build chain.

### Look & feel

Dark graphite console with a low-saturation blue-green accent, warm-white text,
system font stack. Background is a fine grid, paper noise and a low-opacity
topology that breathes — pure CSS/SVG, no canvas, no particles, no video.

A local artwork layer sits on top of that: `panel/public/art/horizon.jpg` is
blended with `mix-blend-mode: screen` and masked to the lower edge, so only its
warm horizon glow reaches the UI, plus `horizon-band.jpg` as the illustrated
strip in the overview banner. Drop any 16:9 image in `panel/public/art/` to swap
it (that folder is gitignored — third-party art stays out of the repo, and the
interface degrades to the plain grid when the files are absent).

Hand-drawn artwork is confined to icons, empty states, dividers and the title
scribble: single-colour thin strokes with a `feTurbulence` + `feDisplacementMap`
filter for the slight pen wobble (`sk-rough`). Icons are an original SVG set;
the favicon ships as `favicon.svg` plus transparent 16/32/180 PNG renditions.

Motion is limited to 150–300 ms `ease-out` transitions on tint, border and
opacity, plus small `fade-up` entrances; everything is disabled under
`prefers-reduced-motion`.

### Performance

| | |
| --- | --- |
| First load | ~67 KB gzip (html + React + shell + CSS), sections load on demand |
| Per section | 1–3 KB gzip, split into its own chunk (`React.lazy`) |
| Caching | hashed assets `immutable, max-age=31536000`; `index.html` `no-store` |
| Transfer | gzip on the fly for JS/CSS/SVG/JSON, cached in memory per file |
| No | chart library, animation library, web font request, CDN, canvas, video |
| Polling | visibility-aware, only the active section, 4–10 s intervals |
| Rendering | transform/opacity-only animations, `content-visibility` for long lists |

Panel API (scriptable):

```
GET  /api/status                       machine-readable state
GET  /api/metrics                      in-process counters, rolling minute series, P50/P95
GET  /api/routes                       route table + upstream list
GET  /api/tls                          upstream TLS certificate details (10 min cache)
GET  /api/log?tail=200                 request log tail
POST /api/config   {apiKey?, port?, flashModel?, proModel?, upstream?}
POST /api/action   {name: "probe" | "test-upstream" | "autostart-install" | "autostart-remove" | "restart-gateway"}
```

### Optional local extension

If a file named `local-actions.mjs` exists next to `server.mjs`, the panel loads
it and adds whatever it exports — extra status fields and extra action buttons
(for example editor-integration helpers that only make sense on that machine):

```js
export const actions = {
  'my-action': { label: 'Do the thing', confirm: true, danger: false, run: async (body) => ({ ok: true, message: 'done' }) },
};
export async function status() { return { cursor: { /* extra fields for the panel */ } }; }
```

`local-actions.mjs` is git-ignored on purpose: keep machine-specific tooling out
of the published repo.

## Endpoints

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/` | Control panel (HTML) |
| `GET` | `/api/status`, `/api/log` | Panel data |
| `POST` | `/api/config`, `/api/action` | Panel writes |
| `GET` | `/v1/models` | OpenAI-shaped model list (`deepseek-flash`, `deepseek-v4-pro`) |
| `POST` | `/v1/chat/completions` | Forwarded to DeepSeek, streaming and tool calls supported |
| `POST` | `/v1/messages` | Anthropic format → `https://api.deepseek.com/anthropic/v1/messages` |
| `POST` | `/v1/embeddings`, `/v1/completions` | Passthrough |
| `GET` | `/healthz` | Liveness, upstream, resolved key source |

Paths also work without the `/v1` prefix. Every client request is appended to
`gateway.log` as `METHOD /path -> status (ms)` (panel/API calls are not logged).

## Configuration

Settings live in `config.json` next to `server.mjs` (written by the panel, git-ignored).
Environment variables override the file:

| Variable | config.json key | Default | Meaning |
| --- | --- | --- | --- |
| `GW_PORT` | `port` | `8787` | Listen port |
| `GW_HOST` | `host` | `127.0.0.1` | Listen address (loopback by default) |
| `GW_API_KEY` | `apiKey` | — | DeepSeek key; else read from `~/.dsh/.credentials.yaml` |
| `GW_UPSTREAM` | `upstream` | `https://api.deepseek.com` | OpenAI-format upstream |
| `GW_ANTHROPIC` | `anthropicUpstream` | `https://api.deepseek.com/anthropic` | Anthropic-format upstream |
| `GW_MODEL_FLASH` | `flashModel` | `deepseek-flash` | Model used for ordinary names |
| `GW_MODEL_PRO` | `proModel` | `deepseek-v4-pro` | Model used for pro/reasoner-ish names |
| `GW_LOG` | `logFile` | `gateway.log` | Log file name |

Key resolution order: `config.json` → `GW_API_KEY` → `~/.dsh/.credentials.yaml`.

### Model name mapping

| Client sends | Dispatched to |
| --- | --- |
| any name containing `pro`, `reasoner` or `r1` | `deepseek-v4-pro` |
| everything else (`claude-*`, `gpt-*`, `o3`, vendor-specific ids, …) | `deepseek-flash` |

Request bodies are filtered against a whitelist (`messages`, `stream`,
`stream_options`, `tools`, `tool_choice`, `temperature`, `max_tokens`, …) so
unknown client-side fields never cause an upstream `400`.

### Self-test

```cmd
node server.mjs --probe
```

Checks the model list, three arbitrary model names, SSE streaming and tool calls
against the running instance. The panel runs the same checks from the **Actions** card.

## Client configuration

**Cursor** — `Ctrl+Shift+J` → *Models*:

- **OpenAI API Key**: paste your DeepSeek key (`sk-…`)
- **Override OpenAI Base URL**: enable, set `http://127.0.0.1:8787/v1`
- add the model name you want (e.g. `deepseek-flash`) to the model switcher, select it

**Continue / Cline / any OpenAI-compatible extension**: pick the "OpenAI
compatible" provider, set the base URL above and model id `deepseek-flash`
(or `deepseek-v4-pro`). The key may be any non-empty string — the gateway
substitutes the real one.

**Anything else** that accepts an OpenAI `base_url` works the same way.

## Security notes

- The gateway **never** ships a credential. The key comes from `config.json`
  (git-ignored), `GW_API_KEY`, or `~/.dsh/.credentials.yaml`, and the startup log
  only prints whether a key is present plus its length.
- It binds to `127.0.0.1` by default, so it is not reachable from the network.
  Change `GW_HOST` only if you understand the consequences.
- The panel writes only `config.json` and runs the actions listed above; both are
  loopback-only. Logs contain request paths, model names and status codes — no
  prompts, no keys.
- If a client sends an `Authorization` header, it is ignored and replaced with
  your real key upstream.

## Autostart (optional, Windows)

```cmd
install-autostart.cmd          :: register a logon task
install-autostart.cmd remove   :: delete it
```

## License

MIT — see [LICENSE](LICENSE).
