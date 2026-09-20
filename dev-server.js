#!/usr/bin/env node
/* ============================================================
   Local dev server
   ------------------------------------------------------------
   Serves the static site AND runs the /api handlers, so you can
   test the real Cal.com booking flow on your machine exactly as
   it will behave in production.

       CAL_API_KEY=cal_live_… node dev-server.js
       → http://localhost:3000

   Without CAL_API_KEY the endpoints return 503 and the page
   falls back to local mode, which is also worth testing.
   ============================================================ */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var PORT = process.env.PORT || 3000;
var ROOT = __dirname;

var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2'
};

var handlers = {
  '/api/slots': require('./api/slots.js'),
  '/api/request': require('./api/request.js'),
  '/api/admin': require('./api/admin.js')
};

/** Minimal Vercel-compatible res shim. */
function shimRes(res) {
  res.status = function (code) { res.statusCode = code; return res; };
  res.setHeader = res.setHeader.bind(res);
  res.json = function (obj) {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

function readBody(req) {
  return new Promise(function (resolve) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
  });
}

http.createServer(async function (req, res) {
  var parsed = url.parse(req.url, true);
  var pathname = parsed.pathname;

  var handler = handlers[pathname];
  if (handler) {
    req.query = parsed.query;
    if (req.method === 'POST') {
      var raw = await readBody(req);
      try { req.body = JSON.parse(raw || '{}'); } catch (e) { req.body = {}; }
    }
    try {
      await handler(req, shimRes(res));
    } catch (err) {
      shimRes(res).status(500).json({ ok: false, message: err.message });
    }
    return;
  }

  /* static files */
  var rel = pathname === '/' ? '/index.html' : pathname;
  var file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));

  if (!file.startsWith(ROOT)) { res.statusCode = 403; res.end('Forbidden'); return; }

  /* a directory serves its index.html, so /admin works as well as
     /admin/ and /admin/index.html — same as any real static host */
  fs.stat(file, function (statErr, stat) {
    /* normalise /admin to /admin/ the way a real static host does */
    if (!statErr && stat.isDirectory() && !pathname.endsWith('/')) {
      res.statusCode = 301;
      res.setHeader('Location', pathname + '/');
      res.end();
      return;
    }

    var target = (!statErr && stat.isDirectory()) ? path.join(file, 'index.html') : file;

    fs.readFile(target, function (err, buf) {
      if (err) { res.statusCode = 404; res.end('Not found'); return; }
      res.setHeader('Content-Type', TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream');
      res.end(buf);
    });
  });
}).listen(PORT, function () {
  var mode = process.env.CAL_API_KEY ? 'Cal.com connected' : 'LOCAL MODE (no CAL_API_KEY)';
  console.log('dr.dalal → http://localhost:' + PORT + '   [' + mode + ']');
});
