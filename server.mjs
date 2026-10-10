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
import tls from 'node:tls';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(DIR, 'config.json');
const PANEL_FILE = path.join(DIR, 'panel.html');
const PANEL_DIST = path.join(DIR, 'panel', 'dist');
const LOCAL_ACTIONS = path.join(DIR, 'local-actions.mjs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/**
 * Serve a file out of panel/dist (the built React console). Returns false if absent.
 *
 * 压缩缓存只对带内容哈希的 assets/ 生效：其它文件（尤其是 index.html）改名不换路径，
 * 一旦缓存就会在重新构建后把旧 HTML 发出去，导致引用到已删除的旧 chunk。
 */
const gzipCache = new Map();          // key -> Buffer
const GZIP_TYPES = new Set(['.js', '.mjs', '.css', '.svg', '.json', '.html']);

function compressed(key, buf) {
  const hit = gzipCache.get(key);
  if (hit) return hit;
  const out = zlib.gzipSync(buf, { level: 6 });
  if (gzipCache.size > 32) gzipCache.clear();
  gzipCache.set(key, out);
  return out;
}

function serveDist(res, relPath, acceptEncoding = '') {
  const clean = decodeURIComponent(relPath).replace(/^\/+/, '');
  const file = path.join(PANEL_DIST, clean || 'index.html');
  if (!file.startsWith(PANEL_DIST)) return false;
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  const isHtml = ext === '.html';
  const isHashed = clean.startsWith('assets/');
  // 带哈希的构建产物可以长期强缓存；入口 HTML 永不缓存，保证改完刷新即生效
  const cacheControl = isHtml ? 'no-store' : isHashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';

  const headers = { 'cache-control': cacheControl };
  let body = fs.readFileSync(file);

  if (GZIP_TYPES.has(ext) && /\bgzip\b/i.test(acceptEncoding)) {
    body = isHashed ? compressed(`${clean}:${stat.size}`, body) : zlib.gzipSync(body, { level: 6 });
    headers['content-encoding'] = 'gzip';
    headers.vary = 'accept-encoding';
  }
  headers['content-type'] = MIME[ext] || 'application/octet-stream';
  headers['content-length'] = body.length;

  res.writeHead(200, headers);
  res.end(body);
  return true;
}

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

// ---------------------------------------------------------------- metrics ----
// Tiny in-process metrics: per-route counters, status buckets, a rolling
// one-minute series and a bounded latency sample buffer. No dependencies, no
// allocation churn on the hot path.
const METRIC_ROUTES = [
  '/v1/chat/completions', '/v1/messages', '/v1/models',
  '/v1/embeddings', '/v1/completions', '/healthz', 'other',
];
const metrics = {
  byRoute: new Map(METRIC_ROUTES.map((r) => [r, { route: r, count: 0, errors: 0, totalMs: 0 }])),
  byStatus: new Map(),
  minutes: Array.from({ length: 60 }, () => ({ count: 0, errors: 0 })),
  minuteStamp: new Date().getMinutes(),
  latencies: [],
  lastError: null,
};

function metricRoute(pathname) {
  const clean = pathname.replace(/^\/v1(?=\/|$)/, '/v1');
  return METRIC_ROUTES.includes(clean) ? clean : 'other';
}

function recordMetric(pathname, statusCode, ms) {
  const route = metricRoute(pathname);
  const bucket = metrics.byRoute.get(route);
  if (bucket) {
    bucket.count += 1;
    bucket.totalMs += ms;
    if (statusCode >= 400) bucket.errors += 1;
  }
  metrics.byStatus.set(statusCode, (metrics.byStatus.get(statusCode) ?? 0) + 1);

  const minute = new Date().getMinutes();
  if (minute !== metrics.minuteStamp) {
    const gap = (minute - metrics.minuteStamp + 60) % 60;
    for (let i = 0; i < gap; i += 1) metrics.minutes.push({ count: 0, errors: 0 });
    metrics.minutes.splice(0, Math.max(0, metrics.minutes.length - 60));
    metrics.minuteStamp = minute;
  }
  const now = metrics.minutes[metrics.minutes.length - 1];
  now.count += 1;
  if (statusCode >= 400) now.errors += 1;

  if (ms >= 0) {
    metrics.latencies.push(ms);
    if (metrics.latencies.length > 500) metrics.latencies.shift();
  }
}

function percentile(samples, p) {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

function metricsSnapshot() {
  const total = [...metrics.byRoute.values()].reduce((sum, r) => sum + r.count, 0);
  const errors = [...metrics.byRoute.values()].reduce((sum, r) => sum + r.errors, 0);
  const lastMinute = metrics.minutes[metrics.minutes.length - 1].count;
  const prevMinute = metrics.minutes[metrics.minutes.length - 2]?.count ?? 0;
  return {
    uptimeSec: Math.floor((Date.now() - stats.startedAt) / 1000),
    total,
    errors,
    errorRate: total ? +(errors / total).toFixed(4) : 0,
    rpm: lastMinute,
    rpmDelta: lastMinute - prevMinute,
    p50: percentile(metrics.latencies, 50),
    p95: percentile(metrics.latencies, 95),
    byRoute: [...metrics.byRoute.values()].map((r) => ({
      route: r.route,
      count: r.count,
      errors: r.errors,
      avgMs: r.count ? Math.round(r.totalMs / r.count) : 0,
    })),
    byStatus: [...metrics.byStatus.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => a.status - b.status),
    series: metrics.minutes.map((m, i) => ({
      offset: metrics.minutes.length - 1 - i,
      count: m.count,
      errors: m.errors,
    })),
    lastError: metrics.lastError,
  };
}

// ----------------------------------------------------------------- routes ----
// The routes this gateway actually serves, described for the console.
const ROUTE_TABLE = [
  { id: 'chat', methods: ['POST'], path: '/v1/chat/completions', upstream: 'openai', target: '/v1/chat/completions', note: 'OpenAI 兼容对话，支持流式与工具调用' },
  { id: 'messages', methods: ['POST'], path: '/v1/messages', upstream: 'anthropic', target: '/v1/messages', note: 'Anthropic Messages 协议' },
  { id: 'models', methods: ['GET'], path: '/v1/models', upstream: 'local', target: '—', note: '模型清单，供客户端校验端点' },
  { id: 'embeddings', methods: ['POST'], path: '/v1/embeddings', upstream: 'openai', target: '/v1/embeddings', note: '透传' },
  { id: 'completions', methods: ['POST'], path: '/v1/completions', upstream: 'openai', target: '/v1/completions', note: '透传' },
  { id: 'health', methods: ['GET'], path: '/healthz', upstream: 'local', target: '—', note: '存活与配置快照' },
];

// -------------------------------------------------------------------- tls ----
let tlsCache = { at: 0, data: null };

async function tlsInfo() {
  if (Date.now() - tlsCache.at < 10 * 60 * 1000 && tlsCache.data) return tlsCache.data;
  const host = new URL(cfg.upstream).hostname;
  const port = Number(new URL(cfg.upstream).port || 443);
  const data = await new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host, timeout: 8000 }, () => {
      try {
        const cert = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        const validTo = new Date(cert.valid_to);
        resolve({
          host,
          port,
          authorized: socket.authorized,
          authorizationError: socket.authorizationError ? String(socket.authorizationError) : null,
          protocol: socket.getProtocol(),
          cipher: cipher ? `${cipher.name} · ${cipher.version}` : null,
          subject: cert.subject?.CN ?? null,
          issuer: cert.issuer?.O ?? cert.issuer?.CN ?? null,
          altNames: (cert.subjectaltname ?? '').split(', ').filter(Boolean).slice(0, 12),
          validFrom: cert.valid_from ? new Date(cert.valid_from).toISOString() : null,
          validTo: validTo.toISOString(),
          daysLeft: Math.max(0, Math.round((validTo.getTime() - Date.now()) / 86400000)),
          serialNumber: cert.serialNumber ?? null,
          fingerprint: cert.fingerprint256 ?? null,
        });
      } catch (err) {
        resolve({ host, port, error: err.message });
      } finally {
        socket.destroy();
      }
    });
    socket.on('error', (err) => resolve({ host, port, error: err.message }));
    socket.on('timeout', () => { socket.destroy(); resolve({ host, port, error: 'TLS 握手超时' }); });
  });
  tlsCache = { at: Date.now(), data };
  return data;
}

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
  const upstreamStarted = Date.now();
  const up = await fetchJson(`${cfg.upstream.replace(/\/+$/, '')}/v1/models`, {
    headers: keyState.key ? { authorization: `Bearer ${keyState.key}` } : {},
  }, 8000).catch((e) => ({ ok: false, status: 0, text: e.message }));
  up.elapsedMs = Date.now() - upstreamStarted;

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
    runtime: {
      user: (() => { try { return os.userInfo().username; } catch { return 'unknown'; } })(),
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      configPath: CONFIG_FILE,
      logPath: path.join(DIR, cfg.logFile),
      dir: DIR,
    },
    key: { present: !!keyState.key, source: keyState.source, length: keyState.key.length },
    models: { flash: cfg.flashModel, pro: cfg.proModel },
    upstream: {
      base: cfg.upstream,
      ok: !!up.ok,
      models: (up.json?.data ?? []).map((m) => m.id),
      latencyMs: up.ok ? Math.max(1, Math.round(up.elapsedMs ?? 0)) : null,
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
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const isGatewayCall = !route.startsWith('/api') && route !== '/' && route !== '/panel' && route !== '/ui' && route !== '/healthz';
  if (isGatewayCall) stats.requests += 1;

  if (req.method === 'POST') req.on('error', () => {});
  res.on('finish', () => {
    // 静态资源（控制台产物、图标、底图）不算网关调用，别污染请求日志与指标
    const isStatic = /^\/assets\/|^\/art\/|^\/bg\//.test(url.pathname)
      || /\.(ico|png|jpe?g|webp|svg|woff2?|map)$/i.test(url.pathname);
    if (route.startsWith('/api') || isStatic || route === '/' || route === '/panel' || route === '/ui') return;
    recordMetric(url.pathname, res.statusCode, Date.now() - started);
    if (res.statusCode >= 400) {
      metrics.lastError = { at: new Date().toISOString(), status: res.statusCode, path: url.pathname, method: req.method };
    }
    if (route !== '/healthz') log(`${req.method} ${url.pathname} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });

  // ---- console data ------------------------------------------------------
  if (req.method === 'GET' && route === '/api/metrics') return sendJson(res, 200, metricsSnapshot());
  if (req.method === 'GET' && route === '/api/routes') {
    return sendJson(res, 200, {
      routes: ROUTE_TABLE,
      upstreams: [
        { id: 'openai', label: 'DeepSeek · OpenAI 兼容', base: cfg.upstream, protocol: 'HTTPS' },
        { id: 'anthropic', label: 'DeepSeek · Anthropic 兼容', base: cfg.anthropicUpstream, protocol: 'HTTPS' },
        { id: 'local', label: '网关内置', base: `http://${cfg.host}:${cfg.port}`, protocol: 'HTTP' },
      ],
    });
  }
  if (req.method === 'GET' && route === '/api/tls') {
    try { return sendJson(res, 200, await tlsInfo()); }
    catch (err) { return sendJson(res, 500, { ok: false, message: err.message }); }
  }

  // ---- panel + api -------------------------------------------------------
  if (req.method === 'GET' && (route === '/' || route === '/panel' || route === '/ui')) {
    // Built React panel (panel/dist) when it exists, else the single-file fallback.
    if (serveDist(res, 'index.html', acceptEncoding)) return;
    try {
      const html = fs.readFileSync(PANEL_FILE, 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    } catch {
      return sendJson(res, 500, { error: 'panel.html missing' });
    }
  }

  // static assets of the built panel: /assets/*, /favicon.svg, /bg/*
  if (req.method === 'GET' && !route.startsWith('/api') && route !== '/healthz' && route !== '/models') {
    if (serveDist(res, url.pathname, acceptEncoding)) return;
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
