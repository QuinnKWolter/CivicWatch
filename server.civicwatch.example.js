const fs = require('fs');
const https = require('https');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const isLocal = process.env.REACT_APP_LOCAL_ENV === 'true';
const civicwatchBase = '/CivicWatch';
const civicwatchApiTarget =
  process.env.CIVICWATCH_API_TARGET || 'http://127.0.0.1:4004';
const civicwatchWebTarget =
  process.env.CIVICWATCH_WEB_TARGET || 'http://127.0.0.1:3004';
const edgeLimitMax = Number(process.env.CIVICWATCH_EDGE_RATE_LIMIT_MAX || 600);
const edgeLimitWindowMs = Number(process.env.CIVICWATCH_EDGE_RATE_LIMIT_WINDOW_MS || 60000);
const edgeBuckets = new Map();

app.disable('x-powered-by');
app.set('trust proxy', true);

const sslOptions = !isLocal
  ? {
      key: fs.readFileSync('/home/qkw3/certs/picso101.sci.pitt.edu.new.key'),
      cert: fs.readFileSync('/home/qkw3/certs/6492815371_fullchain.pem')
    }
  : null;

const proxy = (mountPath, targetBase, backendPrefix = '', extra = {}) =>
  app.use(
    mountPath,
    createProxyMiddleware({
      target: targetBase,
      changeOrigin: true,
      xfwd: true,
      pathRewrite: (pathReq) => `${backendPrefix}${pathReq}`,
      onError: (err, req, res) => {
        console.error(`Proxy error (${mountPath} -> ${targetBase}):`, err.message);
        res.status(502).send(`Bad gateway (${mountPath})`);
      },
      ...extra
    })
  );

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return forwarded || req.ip || req.socket.remoteAddress || 'unknown';
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=()'
  );
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'"
    ].join('; ')
  );

  if (req.originalUrl.startsWith(`${civicwatchBase}/_app/immutable/`)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  next();
}

function accessLog(req, res, next) {
  const started = Date.now();

  res.on('finish', () => {
    console.info(
      JSON.stringify({
        time: new Date().toISOString(),
        ip: clientIp(req),
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ms: Date.now() - started,
        ua: req.headers['user-agent'] || ''
      })
    );
  });

  next();
}

function edgeRateLimit(req, res, next) {
  if (
    req.originalUrl.startsWith(`${civicwatchBase}/_app/immutable/`) ||
    req.originalUrl === '/robots.txt' ||
    req.originalUrl === '/favicon.ico' ||
    req.originalUrl === '/favicon.svg'
  ) {
    return next();
  }

  const now = Date.now();
  const key = clientIp(req);
  const bucket = edgeBuckets.get(key) || { resetAt: now + edgeLimitWindowMs, count: 0 };

  if (bucket.resetAt <= now) {
    bucket.resetAt = now + edgeLimitWindowMs;
    bucket.count = 0;
  }

  bucket.count += 1;
  edgeBuckets.set(key, bucket);

  if (bucket.count > edgeLimitMax) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).type('text/plain').send(`Too many requests. Try again in ${retryAfter} seconds.`);
  }

  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of edgeBuckets.entries()) {
    if (bucket.resetAt <= now) edgeBuckets.delete(key);
  }
}, edgeLimitWindowMs).unref();

app.use(securityHeaders);
app.use(accessLog);
app.use(edgeRateLimit);

app.use((req, res, next) => {
  const original = req.originalUrl;

  if (/^\/civicwatch(?:\/|$)/i.test(original) && !original.startsWith(civicwatchBase)) {
    return res.redirect(308, `${civicwatchBase}${original.slice('/civicwatch'.length) || '/'}`);
  }

  const normalized = original.replace(
    /^\/CivicWatch\/(Who|Place|Topic|Moment|About|Compare|Methods)(?=\/|\?|$)/,
    (_match, segment) => `${civicwatchBase}/${String(segment).toLowerCase()}`
  );

  if (normalized !== original) {
    return res.redirect(308, normalized);
  }

  next();
});

app.get('/', (_req, res) => {
  res.redirect(308, `${civicwatchBase}/`);
});

app.get('/robots.txt', (_req, res) => {
  res
    .type('text/plain')
    .send(
      [
        'User-agent: *',
        'Disallow: /CivicWatch/api/',
        'Disallow: /CivicWatch/compare',
        'Disallow: /*?*',
        'Crawl-delay: 10',
        'Sitemap: https://picso101.sci.pitt.edu/sitemap.xml',
        ''
      ].join('\n')
    );
});

app.get('/sitemap.xml', (_req, res) => {
  res
    .type('application/xml')
    .send(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url><loc>https://picso101.sci.pitt.edu/CivicWatch/</loc></url>',
        '  <url><loc>https://picso101.sci.pitt.edu/CivicWatch/who</loc></url>',
        '  <url><loc>https://picso101.sci.pitt.edu/CivicWatch/place</loc></url>',
        '  <url><loc>https://picso101.sci.pitt.edu/CivicWatch/topic</loc></url>',
        '  <url><loc>https://picso101.sci.pitt.edu/CivicWatch/moment</loc></url>',
        '  <url><loc>https://picso101.sci.pitt.edu/CivicWatch/about</loc></url>',
        '</urlset>',
        ''
      ].join('\n')
    );
});

app.get('/favicon.ico', (_req, res) => {
  res.redirect(308, `${civicwatchBase}/favicon.svg`);
});

app.get('/favicon.svg', (_req, res) => {
  res.redirect(308, `${civicwatchBase}/favicon.svg`);
});

proxy(`${civicwatchBase}/api`, civicwatchApiTarget, '/api');

app.use(
  civicwatchBase,
  createProxyMiddleware({
    target: civicwatchWebTarget,
    changeOrigin: true,
    ws: true,
    xfwd: true,
    pathRewrite: (_pathReq, req) => req.originalUrl,
    onError: (err, req, res) => {
      console.error(`Proxy error (${civicwatchBase} -> ${civicwatchWebTarget}):`, err.message);
      res.status(502).send(`Bad gateway (${civicwatchBase})`);
    }
  })
);

app.use((_req, res) => {
  res.redirect(308, `${civicwatchBase}/`);
});

if (isLocal) {
  app.listen(3000, () => console.log('CivicWatch proxy running on http://127.0.0.1:3000'));
} else {
  https.createServer(sslOptions, app).listen(443, '0.0.0.0', () => {
    console.log('CivicWatch HTTPS proxy running on port 443');
  });
}
