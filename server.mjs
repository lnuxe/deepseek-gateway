#!/usr/bin/env node
/**
 * deepseek-gateway — a local OpenAI/Anthropic-compatible shim that lets Cursor
 * (or any OpenAI-compatible client) talk to the DeepSeek API.
 *
 * Why it exists: Cursor's "Override OpenAI Base URL" verifies the endpoint with a
 * POST {baseUrl}/chat/completions and then sends whatever model name is selected
 * in the model switcher. DeepSeek only accepts the model ids
 * `deepseek-flash` / `deepseek-v4-pro` and answers 400 for anything else, so a
 * direct base-URL override fails verification and every Cursor model name.
 * This gateway accepts *any* model name, maps it to a real DeepSeek model,
 * injects the API key, and streams the response back untouched.
 *
 * Endpoints served:
 *   GET  /v1/models                 -> OpenAI-shaped model list
 *   POST /v1/chat/completions       -> DeepSeek /v1/chat/completions (streaming ok)
 *   POST /v1/messages               -> DeepSeek /anthropic/v1/messages
 *   POST /v1/embeddings             -> upstream passthrough
 *   GET  /healthz                   -> liveness + resolved config
 *   (* paths also work without the /v1 prefix)
 *
 * Config (env, all optional):
 *   GW_PORT            listen port                (default 8787)
 *   GW_HOST            listen address             (default 127.0.0.1)
 *   GW_API_KEY         DeepSeek key; default is read from ~/.dsh/.credentials.yaml
 *   GW_UPSTREAM        OpenAI upstream            (default https://api.deepseek.com)
 *   GW_ANTHROPIC       Anthropic upstream         (default https://api.deepseek.com/anthropic)
 *   GW_MODEL_FLASH     model for "normal" names   (default deepseek-flash)
 *   GW_MODEL_PRO       model used for pro/reasoner-ish names (default deepseek-v4-pro)
 *
 * Usage:  node server.mjs            (serve)
 *         node server.mjs --probe    (self-test against the upstream, then exit)
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.GW_PORT || 8787);
const HOST = process.env.GW_HOST || '127.0.0.1';
const UPSTREAM = (process.env.GW_UPSTREAM || 'https://api.deepseek.com').replace(/\/+$/, '');
const ANTHROPIC_UPSTREAM = (process.env.GW_ANTHROPIC || 'https://api.deepseek.com/anthropic').replace(/\/+$/, '');
const FLASH = process.env.GW_MODEL_FLASH || 'deepseek-flash';
const PRO = process.env.GW_MODEL_PRO || 'deepseek-v4-pro';
const LOG_FILE = process.env.GW_LOG || path.join(DIR, 'gateway.log');

// Params forwarded upstream. Everything else a client sends is dropped so the
// upstream never rejects a request for an unknown field.
const FORWARD_KEYS = new Set([
  'messages', 'stream', 'stream_options', 'temperature', 'top_p', 'max_tokens',
  'max_completion_tokens', 'stop', 'tools', 'tool_choice', 'response_format',
  'frequency_penalty', 'presence_penalty', 'seed', 'logprobs', 'top_logprobs',
  'n', 'user', 'reasoning_effort', 'thinking', 'parallel_tool_calls',
]);

function log(line) {
  const row = `[${new Date().toISOString()}] ${line}`;
  try { fs.appendFileSync(LOG_FILE, row + '\n'); } catch { /* logging is best-effort */ }
  process.stdout.write(row + '\n');
}

/** Resolve the DeepSeek key: env first, then the key dsh already has on disk. */
function resolveApiKey() {
  if (process.env.GW_API_KEY) return process.env.GW_API_KEY.trim();
  const files = [
    path.join(os.homedir(), '.dsh', '.credentials.yaml'),
    process.env.DSH_HOME ? path.join(process.env.DSH_HOME, '.credentials.yaml') : '',
  ].filter((p) => p && fs.existsSync(p));
  for (const file of files) {
    const m = fs.readFileSync(file, 'utf8').match(/DEEPSEEK_API_KEY:\s*(\S+)/);
    if (m) return m[1].trim();
  }
  return '';
}

const API_KEY = resolveApiKey();

/** Any client-side model name (claude-*, gpt-*, o3, please-enable-some-models, ...) -> a real DeepSeek id. */
function mapModel(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('pro') || n.includes('reasoner') || n.includes('r1')) return PRO;
  return FLASH;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

function modelList() {
  const now = Math.floor(Date.now() / 1000);
  return [FLASH, PRO].map((id) => ({
    id, object: 'model', created: now, owned_by: 'deepseek',
    name: id === FLASH ? 'DeepSeek-V4.1-Flash' : 'DeepSeek-V4-Pro',
    context_window: 1048576,
  }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Forward a request to `base + target` and pipe the answer back. */
function forward({ req, res, base, target, headers, body, label }) {
  const url = new URL(base + target);
  const started = Date.now();
  const upstreamReq = https.request(
    {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const out = { ...upstreamRes.headers };
      // Never let upstream framing headers fight with our own chunked stream.
      delete out['content-length'];
      delete out['transfer-encoding'];
      delete out['content-encoding'];
      res.writeHead(upstreamRes.statusCode || 502, out);
      upstreamRes.pipe(res);
      upstreamRes.on('end', () =>
        log(`${label} -> ${upstreamRes.statusCode} (${Date.now() - started}ms)`));
    },
  );
  upstreamReq.on('error', (err) => {
    log(`${label} !! ${err.message}`);
    if (!res.headersSent) sendJson(res, 502, { error: { message: `gateway upstream error: ${err.message}`, type: 'gateway_error' } });
    else res.end();
  });
  if (body && body.length) upstreamReq.write(body);
  upstreamReq.end();
}

function handleChatCompletions(req, res, raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8') || '{}');
  } catch (err) {
    return sendJson(res, 400, { error: { message: `invalid JSON body: ${err.message}`, type: 'invalid_request_error' } });
  }

  const requested = parsed.model;
  const body = {};
  for (const [k, v] of Object.entries(parsed)) if (FORWARD_KEYS.has(k)) body[k] = v;
  body.model = mapModel(requested);
  if (body.max_completion_tokens && !body.max_tokens) {
    body.max_tokens = body.max_completion_tokens;
    delete body.max_completion_tokens;
  }
  // Cursor's connectivity check asks for a 10-token completion; keep it cheap.
  if (body.stream) body.stream_options = { include_usage: true, ...(body.stream_options || {}) };

  const payload = Buffer.from(JSON.stringify(body));
  forward({
    req, res,
    base: UPSTREAM,
    target: '/v1/chat/completions',
    headers: {
      'content-type': 'application/json',
      'content-length': payload.length,
      authorization: `Bearer ${API_KEY}`,
      accept: body.stream ? 'text/event-stream' : 'application/json',
    },
    body: payload,
    label: `chat model=${requested || '(none)'}->${body.model} stream=${!!body.stream} msgs=${(body.messages || []).length}`,
  });
}

function handleAnthropicMessages(req, res, raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8') || '{}');
  } catch (err) {
    return sendJson(res, 400, { error: { message: `invalid JSON body: ${err.message}`, type: 'invalid_request_error' } });
  }
  parsed.model = mapModel(parsed.model);
  const payload = Buffer.from(JSON.stringify(parsed));
  forward({
    req, res,
    base: ANTHROPIC_UPSTREAM,
    target: '/v1/messages',
    headers: {
      'content-type': 'application/json',
      'content-length': payload.length,
      'x-api-key': API_KEY,
      'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
      accept: parsed.stream ? 'text/event-stream' : 'application/json',
    },
    body: payload,
    label: `messages model=${parsed.model}`,
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const route = url.pathname.replace(/^\/v1(?=\/|$)/, '') || '/';
  const started = Date.now();
  res.on('finish', () => {
    // Log every request so client traffic (model list probes, health checks) is visible too.
    if (route !== '/healthz') log(`${req.method} ${url.pathname} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    });
    return res.end();
  }

  if (route === '/healthz' || route === '/' || route === '/v1') {
    return sendJson(res, 200, {
      ok: Boolean(API_KEY), service: 'deepseek-gateway', upstream: UPSTREAM,
      anthropicUpstream: ANTHROPIC_UPSTREAM, models: [FLASH, PRO],
      baseUrlToUseInCursor: `http://${HOST}:${PORT}/v1`,
      keySource: process.env.GW_API_KEY ? 'env:GW_API_KEY' : 'file:~/.dsh/.credentials.yaml',
    });
  }

  if (req.method === 'GET' && route === '/models') {
    return sendJson(res, 200, { object: 'list', data: modelList() });
  }

  const raw = await readBody(req).catch(() => Buffer.alloc(0));
  if (req.method === 'POST' && route === '/chat/completions') return handleChatCompletions(req, res, raw);
  if (req.method === 'POST' && route === '/messages') return handleAnthropicMessages(req, res, raw);
  if (req.method === 'POST' && (route === '/embeddings' || route === '/completions')) {
    return forward({
      req, res, base: UPSTREAM, target: `/v1${route}`,
      headers: { 'content-type': 'application/json', 'content-length': raw.length, authorization: `Bearer ${API_KEY}` },
      body: raw, label: `passthrough ${route}`,
    });
  }

  sendJson(res, 404, { error: { message: `deepseek-gateway: no route for ${req.method} ${url.pathname}`, type: 'not_found' } });
});

async function probe() {
  if (!API_KEY) { console.error('probe: no DeepSeek key found (env GW_API_KEY or ~/.dsh/.credentials.yaml)'); process.exit(1); }
  const base = `http://${HOST}:${PORT}`;
  const checks = [];

  const models = await fetch(`${base}/v1/models`).then((r) => r.json());
  checks.push(['GET /v1/models', models.data?.length === 2 ? 'ok' : 'FAIL', JSON.stringify(models.data?.map((m) => m.id))]);

  // Exactly what Cursor's "Verify" button sends, plus the sentinel model name it
  // falls back to when no gpt-* model is enabled.
  for (const name of ['please-enable-some-models', 'gpt-4o-mini', 'claude-4.5-sonnet', 'deepseek-v4-pro']) {
    const r = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer probe' },
      body: JSON.stringify({ model: name, messages: [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: 'Test prompt' }], temperature: 1, max_tokens: 10, stream: false }),
    });
    const text = await r.text();
    checks.push([`POST /v1/chat/completions model=${name}`, r.status === 200 ? 'ok' : `FAIL(${r.status})`, text.slice(0, 120)]);
  }

  const s = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer probe' },
    body: JSON.stringify({ model: 'gpt-4o', stream: true, messages: [{ role: 'user', content: 'count 1 to 3' }] }),
  });
  const streamText = await s.text();
  checks.push(['POST /v1/chat/completions (SSE)', s.status === 200 && streamText.includes('data:') ? 'ok' : 'FAIL', `${streamText.split('\n').length} lines`]);

  // Cursor also ships tool definitions with the request; DeepSeek must answer
  // with a normal (or tool-call) completion instead of rejecting the payload.
  const t = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer probe' },
    body: JSON.stringify({
      model: 'claude-4.5-sonnet',
      stream: true,
      messages: [{ role: 'user', content: 'What is the weather in Beijing? Use the tool.' }],
      tools: [{ type: 'function', function: { name: 'get_weather', description: 'Get weather', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } } }],
      tool_choice: 'auto',
      stream_options: { include_usage: true },
    }),
  });
  const toolText = await t.text();
  checks.push(['POST /v1/chat/completions (tools + SSE)', t.status === 200 && toolText.includes('data:') ? 'ok' : `FAIL(${t.status})`, toolText.includes('tool_calls') ? 'tool_call returned' : `${toolText.split('\n').length} lines`]);

  for (const [name, status, detail] of checks) console.log(`${status.padEnd(10)} ${name}  ${detail}`);
  process.exit(checks.every((c) => c[1] === 'ok') ? 0 : 2);
}

if (process.argv.includes('--probe')) {
  probe().catch((err) => { console.error('probe failed:', err); process.exit(1); });
} else {
  if (!API_KEY) log('WARNING: no DeepSeek API key resolved — set GW_API_KEY or configure ~/.dsh/.credentials.yaml');
  server.listen(PORT, HOST, () => {
    log(`deepseek-gateway listening on http://${HOST}:${PORT}  (Cursor base URL: http://${HOST}:${PORT}/v1)`);
    log(`upstream=${UPSTREAM} flash=${FLASH} pro=${PRO} key=${API_KEY ? `present (${API_KEY.length} chars)` : '(missing)'}`);
  });
}
