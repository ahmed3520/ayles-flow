/**
 * LSP Bridge — self-contained Node.js script injected into E2B sandboxes.
 *
 * Spawns typescript-language-server, handles JSON-RPC over stdio,
 * exposes a simple HTTP API on port 9119 for diagnostics queries.
 */

export const LSP_BRIDGE_PORT = 9119
export const LSP_BRIDGE_PATH = '/home/user/.lsp-bridge.mjs'

export const LSP_BRIDGE_SCRIPT = `#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const PORT = 9119;
const WORKDIR = '/home/user/app';

// Resolve npm global bin — not always in PATH inside E2B sandboxes
const NPM_GLOBAL_BIN = (() => {
  try { return execSync('npm prefix -g', { encoding: 'utf-8' }).trim() + '/bin'; }
  catch { return '/home/user/.npm-global/bin'; }
})();
const PATH = [NPM_GLOBAL_BIN, '/usr/local/bin', '/usr/bin', '/bin'].join(':');

// ─── JSON-RPC framing ───────────────────────────────────────────────

let msgId = 0;
const pending = new Map();   // id -> { resolve }
const diagnosticsStore = new Map(); // uri -> { items, ts }
const fileVersions = new Map(); // uri -> version
let buffer = '';

function sendMessage(writable, msg) {
  const body = JSON.stringify(msg);
  const header = 'Content-Length: ' + Buffer.byteLength(body) + '\\r\\n\\r\\n';
  writable.write(header + body);
}

function sendRequest(writable, method, params) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('LSP timeout: ' + method));
    }, 10000);
    pending.set(id, (result) => {
      clearTimeout(timeout);
      resolve(result);
    });
    sendMessage(writable, { jsonrpc: '2.0', id, method, params });
  });
}

function sendNotification(writable, method, params) {
  sendMessage(writable, { jsonrpc: '2.0', method, params });
}

function parseMessages(data, handler) {
  buffer += data;
  while (true) {
    const headerEnd = buffer.indexOf('\\r\\n\\r\\n');
    if (headerEnd === -1) break;
    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\\s*(\\d+)/i);
    if (!match) { buffer = buffer.slice(headerEnd + 4); continue; }
    const len = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) break;
    const body = buffer.slice(bodyStart, bodyStart + len);
    buffer = buffer.slice(bodyStart + len);
    try { handler(JSON.parse(body)); } catch {}
  }
}

// ─── Language detection ─────────────────────────────────────────────

function detectLanguage(filePath) {
  const ext = extname(filePath).toLowerCase();
  const map = {
    '.ts': 'typescript', '.tsx': 'typescriptreact',
    '.js': 'javascript', '.jsx': 'javascriptreact',
    '.json': 'json', '.css': 'css', '.html': 'html',
  };
  return map[ext] || 'plaintext';
}

// ─── LSP lifecycle ──────────────────────────────────────────────────

const lsp = spawn('typescript-language-server', ['--stdio'], {
  cwd: WORKDIR,
  env: { ...process.env, PATH, NODE_OPTIONS: '' },
});

lsp.stderr.on('data', (d) => process.stderr.write('[lsp] ' + d));
lsp.on('exit', (code) => {
  console.error('[lsp-bridge] LSP process exited with code', code);
  process.exit(1);
});

lsp.stdout.on('data', (chunk) => {
  parseMessages(chunk.toString(), (msg) => {
    // Response to our request
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
    // Diagnostics notification
    if (msg.method === 'textDocument/publishDiagnostics' && msg.params) {
      diagnosticsStore.set(msg.params.uri, {
        items: msg.params.diagnostics || [],
        ts: Date.now(),
      });
    }
  });
});

async function initialize() {
  await sendRequest(lsp.stdin, 'initialize', {
    processId: process.pid,
    rootUri: 'file://' + WORKDIR,
    workspaceFolders: [{ uri: 'file://' + WORKDIR, name: 'app' }],
    capabilities: {
      textDocument: {
        publishDiagnostics: { relatedInformation: true },
        synchronization: { didOpen: true, didChange: true },
      },
    },
  });
  sendNotification(lsp.stdin, 'initialized', {});
}

// ─── File operations ────────────────────────────────────────────────

function openOrUpdateFile(filePath) {
  const absPath = filePath.startsWith('/') ? filePath : resolve(WORKDIR, filePath);
  const uri = 'file://' + absPath;
  let content;
  try { content = readFileSync(absPath, 'utf-8'); } catch { return null; }

  const version = (fileVersions.get(uri) || 0) + 1;
  fileVersions.set(uri, version);

  if (version === 1) {
    sendNotification(lsp.stdin, 'textDocument/didOpen', {
      textDocument: { uri, languageId: detectLanguage(absPath), version, text: content },
    });
  } else {
    sendNotification(lsp.stdin, 'textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text: content }],
    });
  }
  return uri;
}

async function waitForDiagnostics(uri, sinceTs, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const entry = diagnosticsStore.get(uri);
    if (entry && entry.ts > sinceTs) return entry.items;
    await new Promise((r) => setTimeout(r, 200));
  }
  return diagnosticsStore.get(uri)?.items || [];
}

// ─── HTTP server ────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => resolve(body));
  });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', files: fileVersions.size }));
      return;
    }

    if (req.method === 'POST' && req.url === '/diagnostics') {
      const body = await readBody(req);
      const { path: filePath } = JSON.parse(body);

      const beforeTs = Date.now();
      const uri = openOrUpdateFile(filePath);
      if (!uri) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ path: filePath, diagnostics: [] }));
        return;
      }

      const items = await waitForDiagnostics(uri, beforeTs);

      // Filter to errors and warnings, format for LLM
      const formatted = items
        .filter((d) => d.severity <= 2)
        .map((d) => ({
          line: (d.range?.start?.line || 0) + 1,
          col: (d.range?.start?.character || 0) + 1,
          severity: d.severity === 1 ? 'error' : 'warning',
          message: d.message,
          ...(d.code !== undefined && { code: d.code }),
        }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: filePath, diagnostics: formatted }));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

// ─── Start ──────────────────────────────────────────────────────────

initialize()
  .then(() => {
    server.listen(PORT, () => console.log('[lsp-bridge] listening on :' + PORT));
  })
  .catch((err) => {
    console.error('[lsp-bridge] init failed:', err);
    process.exit(1);
  });
`
