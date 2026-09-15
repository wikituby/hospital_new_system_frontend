/**
 * Clinic-wide HTTPS gateway (lasting, multi-PC).
 * Run ON the clinic API machine (same LAN IP users type in Connect).
 *
 * All PCs: https://CLINIC-IP:8443/health_care/...
 * Gateway: http://127.0.0.1:8080/health_care/...  (or CLINIC_UPSTREAM)
 *
 * Trust certs once per PC: scripts/trust-clinic-https.ps1
 */
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CLINIC_BRIDGE_PORT || 8443);
const BIND = process.env.CLINIC_BRIDGE_BIND || '0.0.0.0';
const UPSTREAM = process.env.CLINIC_UPSTREAM || '127.0.0.1:8080';

function resolvePfx() {
  const candidates = [
    path.join(__dirname, '.clinic-bridge-certs', 'bridge.pfx'),
    path.join(__dirname, '..', '..', 'backend', 'hospital', 'hospital', 'certs', 'clinic-server.p12'),
    'D:\\from recent\\hospitaldesktop\\development\\backend\\hospital\\hospital\\certs\\clinic-server.p12',
  ];
  const passCandidates = [
    path.join(__dirname, '.clinic-bridge-certs', 'bridge.pass'),
    path.join(__dirname, '..', '..', 'backend', 'hospital', 'hospital', 'certs', 'clinic-server.pass'),
    'D:\\from recent\\hospitaldesktop\\development\\backend\\hospital\\hospital\\certs\\clinic-server.pass',
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i]) && fs.existsSync(passCandidates[i])) {
      return {
        pfx: fs.readFileSync(candidates[i]),
        passphrase: fs.readFileSync(passCandidates[i], 'utf8').trim(),
        file: candidates[i],
      };
    }
  }
  console.error('No TLS keystore found. Run backend scripts/generate-clinic-tls.ps1');
  process.exit(1);
}

function applyCors(req, headers) {
  const origin = req.headers.origin || '*';
  headers['access-control-allow-origin'] = origin;
  headers['access-control-allow-credentials'] = 'true';
  headers['access-control-allow-headers'] =
    req.headers['access-control-request-headers'] ||
    'accept,authorization,content-type,x-requested-with,x-skip-connection-modal';
  headers['access-control-allow-methods'] = 'GET,POST,PUT,DELETE,OPTIONS,PATCH,HEAD';
  headers['access-control-allow-private-network'] = 'true';
  headers['vary'] = 'Origin';
}

function parseUpstream() {
  const [host, portStr] = String(UPSTREAM).split(':');
  return { host: host || '127.0.0.1', port: Number(portStr || 8080) };
}

const upstream = parseUpstream();
const tls = resolvePfx();

function handler(req, res) {
  if (req.method === 'OPTIONS') {
    const headers = {};
    applyCors(req, headers);
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.url === '/bridge-health' || req.url === '/bridge-health/') {
    const headers = { 'content-type': 'text/plain' };
    applyCors(req, headers);
    res.writeHead(200, headers);
    res.end('OK');
    return;
  }

  const parsedUrl = new URL(req.url || '/', `https://127.0.0.1`);
  let upstreamPath = parsedUrl.pathname + (parsedUrl.search || '');

  // Legacy per-PC bridge paths still work: /to/host:port/health_care/...
  const m = /^\/to\/([^/:]+)(?::(\d+))?(\/.*)?$/.exec(parsedUrl.pathname);
  let targetHost = upstream.host;
  let targetPort = upstream.port;
  if (m) {
    targetHost = m[1];
    targetPort = Number(m[2] || 8080);
    upstreamPath = (m[3] || '/') + (parsedUrl.search || '');
  }

  const headers = { ...req.headers };
  delete headers.host;
  headers.host = `${targetHost}:${targetPort}`;

  const proxyReq = http.request(
    {
      hostname: targetHost,
      port: targetPort,
      path: upstreamPath,
      method: req.method,
      headers,
      timeout: 120000,
    },
    (proxyRes) => {
      const outHeaders = { ...proxyRes.headers };
      applyCors(req, outHeaders);
      res.writeHead(proxyRes.statusCode || 502, outHeaders);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      const h = { 'content-type': 'text/plain' };
      applyCors(req, h);
      res.writeHead(504, h);
      res.end('Upstream timeout');
    }
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      const h = { 'content-type': 'text/plain' };
      applyCors(req, h);
      res.writeHead(502, h);
      res.end(`Upstream error: ${err.message}`);
    }
  });

  req.pipe(proxyReq);
}

const server = https.createServer(tls, handler);
server.listen(PORT, BIND, () => {
  console.log(`Clinic HTTPS gateway on https://${BIND}:${PORT}`);
  console.log(`Upstream http://${upstream.host}:${upstream.port}`);
  console.log(`Keystore ${tls.file}`);
  console.log('Other PCs: trust scripts/clinic-ca.cer once, then use venerandahospital.org → this LAN IP');
});