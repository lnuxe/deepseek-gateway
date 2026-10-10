# deepseek-gateway

A tiny local HTTP gateway that exposes your **DeepSeek** API as an
**OpenAI-compatible** (and **Anthropic-compatible**) endpoint, so any client that
speaks those protocols can use DeepSeek models.

Zero dependencies — Node.js built-in modules only.

```
your client ──► http://127.0.0.1:8787/v1 ──► https://api.deepseek.com
                (this gateway)
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

Then point your client at:

```
Base URL : http://127.0.0.1:8787/v1
API Key  : anything (the gateway injects your real DeepSeek key)
Model    : deepseek-flash   or   deepseek-v4-pro
```

Self-test (models list, probe request, unknown model names, streaming, tool calls):

```cmd
node server.mjs --probe
```

Liveness and config:

```cmd
curl http://127.0.0.1:8787/healthz
```

## Endpoints

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/v1/models` | OpenAI-shaped model list (`deepseek-flash`, `deepseek-v4-pro`) |
| `POST` | `/v1/chat/completions` | Forwarded to DeepSeek, streaming and tool calls supported |
| `POST` | `/v1/messages` | Anthropic format → `https://api.deepseek.com/anthropic/v1/messages` |
| `POST` | `/v1/embeddings`, `/v1/completions` | Passthrough |
| `GET` | `/healthz` | Liveness, upstream, resolved key source |

Paths also work without the `/v1` prefix. Every request is appended to
`gateway.log` as `METHOD /path -> status (ms)`.

## Configuration (all optional, environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `GW_PORT` | `8787` | Listen port |
| `GW_HOST` | `127.0.0.1` | Listen address (loopback only by default) |
| `GW_API_KEY` | — | DeepSeek key; else read from `~/.dsh/.credentials.yaml` |
| `GW_UPSTREAM` | `https://api.deepseek.com` | OpenAI-format upstream |
| `GW_ANTHROPIC` | `https://api.deepseek.com/anthropic` | Anthropic-format upstream |
| `GW_MODEL_FLASH` | `deepseek-flash` | Model used for ordinary names |
| `GW_MODEL_PRO` | `deepseek-v4-pro` | Model used for pro/reasoner-ish names |
| `GW_LOG` | `gateway.log` | Log file path |

### Model name mapping

| Client sends | Dispatched to |
| --- | --- |
| any name containing `pro`, `reasoner` or `r1` | `deepseek-v4-pro` |
| everything else (`claude-*`, `gpt-*`, `o3`, vendor-specific ids, …) | `deepseek-flash` |

Request bodies are filtered against a whitelist (`messages`, `stream`,
`stream_options`, `tools`, `tool_choice`, `temperature`, `max_tokens`, …) so
unknown client-side fields never cause an upstream `400`.

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

- The gateway **never** stores or embeds your API key — it reads it from
  `GW_API_KEY` or from `~/.dsh/.credentials.yaml` at startup. Nothing in this
  repository contains a credential.
- It binds to `127.0.0.1` by default, so it is not reachable from the network.
  Change `GW_HOST` only if you understand the consequences.
- Logs contain request paths, model names and status codes — no prompts, no
  keys. Rotate or delete `gateway.log` freely.
- If a client sends an `Authorization` header, it is ignored and replaced with
  your real key upstream.

## Autostart (optional, Windows)

```cmd
install-autostart.cmd          :: register a logon task
install-autostart.cmd remove   :: delete it
```

## License

MIT — see [LICENSE](LICENSE).
