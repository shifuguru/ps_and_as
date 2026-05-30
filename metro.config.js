const { getDefaultConfig } = require("expo/metro-config");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const config = getDefaultConfig(__dirname);

/** Socket.IO backend — keep in sync with server/index.js default PORT. */
const SOCKET_BACKEND =
  process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:4000";

function proxySocketIo(req, res) {
  let target;
  try {
    target = new URL(SOCKET_BACKEND);
  } catch {
    res.statusCode = 502;
    res.end("Invalid EXPO_PUBLIC_SERVER_URL");
    return;
  }

  const lib = target.protocol === "https:" ? https : http;
  const headers = { ...req.headers, host: target.host };

  const proxyReq = lib.request(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end(`Socket proxy error: ${err.message}`);
    }
  });

  req.pipe(proxyReq);
}

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    const url = req.url?.split("?")[0] ?? "";
    if (url.startsWith("/socket.io") || url.startsWith("/api/")) {
      proxySocketIo(req, res);
      return;
    }
    return middleware(req, res, next);
  };
};

module.exports = config;
