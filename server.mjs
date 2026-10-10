#!/usr/bin/env node
/**
 * deepseek-gateway — a local OpenAI/Anthropic-compatible shim for the DeepSeek API,
 * plus a small control panel at http://127.0.0.1:8787/
 *
 * Why the gateway exists: Cursor's "Override OpenAI Base URL" verifies the endpoint with a
 * POST {baseUrl}/chat/completions and then sends whatever model name is selected in the
 * model switcher. DeepSeek only accepts `deepseek-flash` / `deepseek-v4-pro` and answers 400
 * for anything else, so a direct base-URL override fails verification and every model name.
 * This gateway accepts *any* model name, maps it to a real DeepSeek model, injects the API
 * key, and streams the response back untouched.
 *
 * Endpoints:
 *   GET  /                     control panel (HTML)
 *   GET  /api/status           machine-readable state for the panel
 *   GET  /api/log?tail=N       tail of the request log
 *   POST /api/config           update config.json (key, models, port…)
 *   POST /api/action           run a named action (core + optional local module)
 *   GET  /v1/models            OpenAI-shaped model list
 *   POST /v1/chat/completions  → upstream /v1/chat/completions (streaming ok)
 *   POST /v1/messages          → upstream Anthropic /v1/messages
 *   POST /v1/embeddings        pass-through
 *   GET  /healthz              liveness + resolved config
 *   (* paths also work without the /v1 prefix)
 *
 * Config: config.json next to this file, overridable by GW_* env vars.
 *   usage:  node server.mjs            (serve)
 *           node server.mjs --probe    (self-test against the running instance, then exit)
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(DIR, 'config.json');
const PANEL_FILE = path.join(DIR, 'panel.html');
const LOCAL_ACTIONS = path.join(DIR, 'local-actions.mjs');

const DEFAULTS = {
  host: '127.0.0.1',
  port: 8787,
  apiKey: '',
  flashModel: 'deepseek-flash',
  proModel: 'deepseek-v4-pro',
  upstream: 'https://api.deepseek.com',
  anthropicUpstream: 'https://api.deepseek.com/anthropic',
  logFile: 'gateway.log',
};

// Params forwarded upstream. Everything else a client sends is dropped so the
// upstream never rejects a request for an unknown field.
const FORWARD_KEYS = new Set([
  'messages', 'stream', 'stream_options', 'temperature', 'top_p', 'max_tokens',
  'max_completion_tokens', 'stop', 'tools', 'tool_choice', 'response_format',
  'frequency_penalty', 'presence_penalty', 'seed', 'logprobs', 'top_logprobs',
  'n', 'user', 'reasoning_effort', 'thinking', 'parallel_tool_calls',
]);

const stats = { startedAt: Date.now(), requests: 0 };

function log(line) {
  const row = `[${new Date().toISOString()}] ${line}`;
  try { fs.appendFileSync(path.join(DIR, cfg.logFile), row + '\n'); } catch { /* best effort */ }
  process.stdout.write(row + '\n');
}

// ---------------------------------------------------------------- config ----

function readConfigFile() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}

const cfg = { ...DEFAULTS, ...readConfigFile() };
if (process.env.GW_PORT) cfg.port = Number(process.env.GW_PORT);
if (process.env.GW_HOST) cfg.host = process.env.GW_HOST;
if (process.env.GW_UPSTREAM) cfg.upstream = process.env.GW_UPSTREAM;
if (process.env.GW_ANTHROPIC) cfg.anthropicUpstream = process.env.GW_ANTHROPIC;
if (process.env.GW_MODEL_FLASH) cfg.flashModel = process.env.GW_MODEL_FLASH;
if (process.env.GW_MODEL_PRO) cfg.proModel = process.env.GW_MODEL_PRO;
if (process.env.GW_LOG) cfg.logFile = process.env.GW_LOG;

function saveConfig(patch) {
  const next = { ...readConfigFile(), ...patch };
  for (const [k, v] of Object.entries(next)) if (v === '' || v === null || v === undefined) delete next[k];
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2) + '\n');
  Object.assign(cfg, DEFAULTS, next, {
    host: process.env.GW_HOST || next.host || DEFAULTS.host,
    port: Number(process.env.GW_PORT || next.port || DEFAULTS.port),
  });
  return next;
}

/** Key priority: config.json → GW_API_KEY → the key dsh already keeps on disk. */
function resolveKey() {
  if (cfg.apiKey) return { key: cfg.apiKey, source: 'config.json' };
  if (process.env.GW_API_KEY) return { key: process.env.GW_API_KEY.trim(), source: 'env:GW_API_KEY' };
  const files = [
    path.join(os.homedir(), '.dsh', '.credentials.yaml'),
    process.env.DSH_HOME ? path.join(process.env.DSH_HOME, '.credentials.yaml') : '',
  ].filter((p) => p && fs.existsSync(p));
  for (const file of files) {
    const m = fs.readFileSync(file, 'utf8').match(/DEEPSEEK_API_KEY:\s*(\S+)/);
    if (m) return { key: m[1].trim(), source: '~/.dsh/.credentials.yaml' };
  }
  return { key: '', source: 'none' };
}

let keyState = resolveKey();
const refreshKey = () => { keyState = resolveKey(); return keyState; };

function mapModel(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('pro') || n.includes('reasoner') || n.includes('r1')) return cfg.proModel;
  return cfg.flashModel;
}

// ------------------------------------------------------------- utilities ----

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, init = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, ok: res.ok, json, text };
  } finally { clearTimeout(timer); }
}

function modelsPayload() {
  const now = Math.floor(Date.now() / 1000);
  return [cfg.flashModel, cfg.proModel].map((id) => ({
    id, object: 'model', created: now, owned_by: 'deepseek',
    name: id === cfg.flashModel ? 'DeepSeek-V4.1-Flash' : 'DeepSeek-V4-Pro',
    context_window: 1048576,
  }));
}

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
      timeout: 600000,
    },
    (upstreamRes) => {
      const out = { ...upstreamRes.headers };
      delete out['content-length'];
      delete out['transfer-encoding'];
      delete out['content-encoding'];
      res.writeHead(upstreamRes.statusCode || 502, out);
      upstreamRes.pipe(res);
      upstreamRes.on('end', () => log(`${label} -> ${upstreamRes.statusCode} (${Date.now() - started}ms)`));
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

// --------------------------------------------------------- local module ----

let local = { actions: {}, status: null };
if (fs.existsSync(LOCAL_ACTIONS)) {
  try {
    const mod = await import(new URL('./local-actions.mjs', import.meta.url).href);
    local = { actions: mod.actions ?? {}, status: mod.status ?? null };
  } catch (err) {
    log(`local-actions.mjs failed to load: ${err.message}`);
  }
}

const CORE_ACTIONS = {
  'test-upstream': { label: '测试 DeepSeek 连接', run: async () => testUpstream() },
  probe: { label: '网关自检', run: async () => probeSelf() },
  'autostart-install': { label: '注册开机自启', run: async () => runCmd('schtasks', ['/create', '/tn', 'deepseek-gateway-for-cursor', '/sc', 'onlogon', '/rl', 'limited', '/f', '/tr', `"${path.join(DIR, 'start-gateway.cmd')}"`]) },
  'autostart-remove': { label: '取消开机自启', run: async () => runCmd('schtasks', ['/delete', '/tn', 'deepseek-gateway-for-cursor', '/f']) },
  'restart-gateway': { label: '重启网关', confirm: true, run: async () => restartGateway() },
};

function runCmd(file, args) {
  return new Promise((resolve) => {
    const child = spawn(file, args, { windowsHide: true });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (err) => resolve({ ok: false, message: err.message }));
    child.on('close', (code) => resolve({ ok: code === 0, code, message: out.trim().slice(0, 800) }));
  });
}

async function testUpstream() {
  refreshKey();
  if (!keyState.key) return { ok: false, message: '没有可用的 API key' };
  const started = Date.now();
  const r = await fetchJson(`${cfg.upstream.replace(/\/+$/, '')}/v1/models`, {
    headers: { authorization: `Bearer ${keyState.key}` },
  }, 20000);
  const latency = Date.now() - started;
  if (!r.ok) return { ok: false, message: `DeepSeek 返回 ${r.status}: ${r.text.slice(0, 200)}`, latency };
  return { ok: true, latency, message: `可用模型：${(r.json?.data ?? []).map((m) => m.id).join(', ')}` };
}

async function probeSelf() {
  const base = `http://127.0.0.1:${cfg.port}`;
  const checks = [];
  const models = await fetchJson(`${base}/v1/models`).catch((e) => ({ ok: false, text: e.message }));
  checks.push({ name: 'GET /v1/models', ok: !!models.ok, detail: `${models.json?.data?.length ?? 0} 个模型` });
  for (const name of ['please-enable-some-models', 'gpt-4o-mini', 'claude-4.5-sonnet']) {
    const r = await fetchJson(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer probe' },
      body: JSON.stringify({ model: name, messages: [{ role: 'user', content: 'say OK' }], max_tokens: 10, stream: false }),
    }, 60000).catch((e) => ({ ok: false, status: 0, text: e.message }));
    checks.push({ name: `任意模型名映射 ${name}`, ok: r.status === 200, detail: r.status === 200 ? `→ ${cfg.flashModel}` : `HTTP ${r.status}` });
  }
  const s = await fetchJson(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer probe' },
    body: JSON.stringify({ model: 'gpt-4o', stream: true, messages: [{ role: 'user', content: 'count 1 to 3' }] }),
  }, 60000).catch((e) => ({ ok: false, text: e.message }));
  checks.push({ name: 'SSE 流式', ok: s.status === 200 && String(s.text).includes('data:'), detail: s.status === 200 ? 'ok' : `HTTP ${s.status}` });
  const ok = checks.every((c) => c.ok);
  return { ok, message: ok ? '全部通过' : '有失败项', checks };
}

async function restartGateway() {
  const starter = path.join(DIR, 'start-gateway.cmd');
  const child = spawn('cmd', ['/c', 'start', '""', starter], { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();
  await sleep(300);
  setTimeout(() => process.exit(0), 400);
  return { ok: true, message: '新实例已启动，本进程即将退出（页面会自动重连）' };
}

// --------------------------------------------------------------- routes ----

async function apiStatus() {
  const up = await fetchJson(`${cfg.upstream.replace(/\/+$/, '')}/v1/models`, {
    headers: keyState.key ? { authorization: `Bearer ${keyState.key}` } : {},
  }, 8000).catch((e) => ({ ok: false, status: 0, text: e.message }));

  const extra = local.status ? await local.status().catch((e) => ({ error: e.message })) : {};

  return {
    gateway: {
      baseUrl: `http://${cfg.host}:${cfg.port}/v1`,
      host: cfg.host,
      port: cfg.port,
      uptimeSec: Math.floor((Date.now() - stats.startedAt) / 1000),
      requests: stats.requests,
      pid: process.pid,
      version: process.version,
    },
    key: { present: !!keyState.key, source: keyState.source, length: keyState.key.length },
    models: { flash: cfg.flashModel, pro: cfg.proModel },
    upstream: {
      base: cfg.upstream,
      ok: !!up.ok,
      models: (up.json?.data ?? []).map((m) => m.id),
      error: up.ok ? undefined : `HTTP ${up.status || '-'} ${String(up.text || '').slice(0, 160)}`,
    },
    localActionsLoaded: fs.existsSync(LOCAL_ACTIONS),
    cursor: extra.cursor ?? null,
    actions: Object.entries({ ...CORE_ACTIONS, ...local.actions })
      .map(([name, a]) => ({ name, label: a.label, confirm: !!a.confirm, danger: !!a.danger, local: !!local.actions[name] })),
  };
}

function tail(file, n) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n').filter(Boolean);
    return lines.slice(-n).join('\n');
  } catch { return ''; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || cfg.host}`);
  const route = url.pathname.replace(/^\/v1(?=\/|$)/, '') || '/';
  const started = Date.now();
  const isGatewayCall = !route.startsWith('/api') && route !== '/' && route !== '/panel' && route !== '/ui' && route !== '/healthz';
  if (isGatewayCall) stats.requests += 1;

  if (req.method === 'POST') req.on('error', () => {});
  res.on('finish', () => {
    if (!route.startsWith('/api') && route !== '/healthz' && route !== '/') {
      log(`${req.method} ${url.pathname} -> ${res.statusCode} (${Date.now() - started}ms)`);
    }
  });

  // ---- panel + api -------------------------------------------------------
  if (req.method === 'GET' && (route === '/' || route === '/panel' || route === '/ui')) {
    try {
      const html = fs.readFileSync(PANEL_FILE, 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    } catch {
      return sendJson(res, 500, { error: 'panel.html missing' });
    }
  }

  if (req.method === 'GET' && route === '/api/status') {
    try { return sendJson(res, 200, await apiStatus()); }
    catch (err) { return sendJson(res, 500, { error: err.message }); }
  }

  if (req.method === 'GET' && route === '/api/log') {
    const n = Math.min(2000, Math.max(10, Number(url.searchParams.get('tail') || 200)));
    return sendJson(res, 200, { tail: tail(path.join(DIR, cfg.logFile), n) });
  }

  if (req.method === 'POST' && route === '/api/config') {
    const raw = await readBody(req).catch(() => Buffer.alloc(0));
    let patch;
    try { patch = JSON.parse(raw.toString('utf8') || '{}'); } catch (err) { return sendJson(res, 400, { ok: false, message: `无效 JSON: ${err.message}` }); }
    const allowed = ['apiKey', 'flashModel', 'proModel', 'port', 'host', 'upstream', 'anthropicUpstream'];
    const clean = {};
    for (const k of allowed) if (k in patch) clean[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
    if ('port' in clean) clean.port = Number(clean.port);
    if ('port' in clean && (!Number.isInteger(clean.port) || clean.port < 1 || clean.port > 65535)) return sendJson(res, 400, { ok: false, message: '端口不合法' });
    const saved = saveConfig(clean);
    refreshKey();
    const needRestart = ('port' in clean && clean.port !== cfg.port) || ('host' in clean && clean.host !== cfg.host);
    return sendJson(res, 200, { ok: true, saved: Object.keys(clean), needRestart, message: needRestart ? '已保存；端口/地址改动需重启网关生效' : '已保存并立即生效' });
  }

  if (req.method === 'POST' && route === '/api/action') {
    const raw = await readBody(req).catch(() => Buffer.alloc(0));
    let body;
    try { body = JSON.parse(raw.toString('utf8') || '{}'); } catch { return sendJson(res, 400, { ok: false, message: '无效 JSON' }); }
    const action = { ...CORE_ACTIONS, ...local.actions }[body.name];
    if (!action) return sendJson(res, 404, { ok: false, message: `未知动作 ${body.name}` });
    refreshKey();
    try {
      const out = await action.run(body);
      return sendJson(res, 200, { ok: out?.ok !== false, ...out });
    } catch (err) {
      return sendJson(res, 500, { ok: false, message: err.message });
    }
  }

  // ---- gateway -----------------------------------------------------------
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' });
    return res.end();
  }

  if (route === '/healthz') {
    return sendJson(res, 200, {
      ok: !!keyState.key, service: 'deepseek-gateway', upstream: cfg.upstream,
      anthropicUpstream: cfg.anthropicUpstream, models: [cfg.flashModel, cfg.proModel],
      baseUrlToUseInCursor: `http://${cfg.host}:${cfg.port}/v1`, keySource: keyState.source,
      uptimeSec: Math.floor((Date.now() - stats.startedAt) / 1000), requests: stats.requests,
    });
  }

  if (req.method === 'GET' && route === '/models') return sendJson(res, 200, { object: 'list', data: modelsPayload() });

  const raw = await readBody(req).catch(() => Buffer.alloc(0));

  if (req.method === 'POST' && route === '/chat/completions') {
    let parsed;
    try { parsed = JSON.parse(raw.toString('utf8') || '{}'); } catch (err) { return sendJson(res, 400, { error: { message: `invalid JSON body: ${err.message}`, type: 'invalid_request_error' } }); }
    const requested = parsed.model;
    const body = {};
    for (const [k, v] of Object.entries(parsed)) if (FORWARD_KEYS.has(k)) body[k] = v;
    body.model = mapModel(requested);
    if (body.max_completion_tokens && !body.max_tokens) { body.max_tokens = body.max_completion_tokens; delete body.max_completion_tokens; }
    if (body.stream) body.stream_options = { include_usage: true, ...(body.stream_options || {}) };
    const payload = Buffer.from(JSON.stringify(body));
    return forward({
      req, res, base: cfg.upstream, target: '/v1/chat/completions',
      headers: {
        'content-type': 'application/json',
        'content-length': payload.length,
        authorization: `Bearer ${keyState.key}`,
        accept: body.stream ? 'text/event-stream' : 'application/json',
      },
      body: payload,
      label: `chat model=${requested || '(none)'}->${body.model} stream=${!!body.stream} msgs=${(body.messages || []).length}`,
    });
  }

  if (req.method === 'POST' && route === '/messages') {
    let parsed;
    try { parsed = JSON.parse(raw.toString('utf8') || '{}'); } catch (err) { return sendJson(res, 400, { error: { message: `invalid JSON body: ${err.message}`, type: 'invalid_request_error' } }); }
    parsed.model = mapModel(parsed.model);
    const payload = Buffer.from(JSON.stringify(parsed));
    return forward({
      req, res, base: cfg.anthropicUpstream, target: '/v1/messages',
      headers: {
        'content-type': 'application/json',
        'content-length': payload.length,
        'x-api-key': keyState.key,
        'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
        accept: parsed.stream ? 'text/event-stream' : 'application/json',
      },
      body: payload,
      label: `messages model=${parsed.model}`,
    });
  }

  if (req.method === 'POST' && (route === '/embeddings' || route === '/completions')) {
    return forward({
      req, res, base: cfg.upstream, target: `/v1${route}`,
      headers: { 'content-type': 'application/json', 'content-length': raw.length, authorization: `Bearer ${keyState.key}` },
      body: raw, label: `passthrough ${route}`,
    });
  }

  sendJson(res, 404, { error: { message: `deepseek-gateway: no route for ${req.method} ${url.pathname}`, type: 'not_found' } });
});

// ------------------------------------------------------------------ boot ----

async function probe() {
  const base = `http://${cfg.host}:${cfg.port}`;
  const models = await fetchJson(`${base}/v1/models`).then((r) => r.json).catch(() => undefined);
  if (!models) { console.error(`probe: 网关未在本机 ${cfg.host}:${cfg.port} 监听（先运行 node server.mjs）`); process.exit(2); }
  const checks = [['GET /v1/models', models.data?.length === 2 ? 'ok' : 'FAIL', JSON.stringify(models.data?.map((m) => m.id))]];
  for (const name of ['please-enable-some-models', 'gpt-4o-mini', 'claude-4.5-sonnet', cfg.proModel]) {
    const r = await fetchJson(`${base}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer probe' },
      body: JSON.stringify({ model: name, messages: [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: 'Test prompt' }], temperature: 1, max_tokens: 10, stream: false }),
    }, 60000).catch((e) => ({ status: 0, text: e.message }));
    checks.push([`POST /v1/chat/completions model=${name}`, r.status === 200 ? 'ok' : `FAIL(${r.status})`, String(r.text).slice(0, 110)]);
  }
  const s = await fetchJson(`${base}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer probe' },
    body: JSON.stringify({ model: 'gpt-4o', stream: true, messages: [{ role: 'user', content: 'count 1 to 3' }] }),
  }, 60000).catch((e) => ({ status: 0, text: e.message }));
  checks.push(['POST /v1/chat/completions (SSE)', s.status === 200 && String(s.text).includes('data:') ? 'ok' : 'FAIL', `${String(s.text).split('\n').length} lines`]);
  const t = await fetchJson(`${base}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer probe' },
    body: JSON.stringify({
      model: 'claude-4.5-sonnet', stream: true, messages: [{ role: 'user', content: 'Weather in Beijing? Use the tool.' }],
      tools: [{ type: 'function', function: { name: 'get_weather', description: 'Get weather', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } } }],
      tool_choice: 'auto', stream_options: { include_usage: true },
    }),
  }, 60000).catch((e) => ({ status: 0, text: e.message }));
  checks.push(['POST /v1/chat/completions (tools + SSE)', t.status === 200 && String(t.text).includes('data:') ? 'ok' : `FAIL(${t.status})`, String(t.text).includes('tool_calls') ? 'tool_call returned' : `${String(t.text).split('\n').length} lines`]);
  for (const [name, status, detail] of checks) console.log(`${status.padEnd(10)} ${name}  ${detail}`);
  process.exit(checks.every((c) => c[1] === 'ok') ? 0 : 2);
}

if (process.argv.includes('--probe')) {
  probe().catch((err) => { console.error('probe failed:', err.message); process.exit(1); });
} else {
  if (!keyState.key) log('WARNING: 没有解析到 DeepSeek API key —— 在控制面板里填，或设置 GW_API_KEY');
  server.listen(cfg.port, cfg.host, () => {
    log(`deepseek-gateway listening on http://${cfg.host}:${cfg.port}  (控制面板 http://${cfg.host}:${cfg.port}/ ,客户端 base URL http://${cfg.host}:${cfg.port}/v1)`);
    log(`upstream=${cfg.upstream} flash=${cfg.flashModel} pro=${cfg.proModel} key=${keyState.key ? `present (${keyState.key.length} chars, ${keyState.source})` : '(missing)'}${fs.existsSync(LOCAL_ACTIONS) ? ' local-actions=loaded' : ''}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log(`端口 ${cfg.port} 已被占用 —— 可能网关已经在运行了（打开 http://${cfg.host}:${cfg.port}/ 看看）`);
      process.exit(3);
    }
    log(`server error: ${err.message}`);
  });
}
