// src/extension.ts
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import http from "node:http";
import https from "node:https";
import { pipeline } from "node:stream";
var [logInfo, logDebug, logError, logWarn] = ["info", "debug", "error", "warn"].map((method) => {
  const fn = logger[method];
  return (message) => {
    fn(`[harperdb-proxy-transform] ${message}`);
  };
});
var allowedHosts = new Set(["83c5-2600-1700-f2e0-b0f-74f7-c2c1-a4ad-e69d.ngrok-free.app"]);
function assertType(name, option, expectedType) {
  if (option) {
    const found = typeof option;
    assert.strictEqual(found, expectedType, `${name} must be type ${expectedType}. Received: ${found}`);
  }
}
function resolveConfig(options) {
  assertType("transformerPath", options.transformerPath, "string");
  return {
    transformerPath: options.transformerPath ?? ""
  };
}
function start(options) {
  const config = resolveConfig(options);
  logInfo(`Starting extension...`);
  return {
    async handleDirectory(_, componentPath) {
      let transformReqFn;
      let transformResFn;
      if (!fs.existsSync(componentPath) || !fs.statSync(componentPath).isDirectory()) {
        throw new Error(`Invalid component path: ${componentPath}`);
      }
      if (!!config.transformerPath) {
        const importPath = path.resolve(componentPath, config.transformerPath);
        if (!fs.existsSync(importPath) || !fs.statSync(importPath).isFile()) {
          throw new Error(`Invalid transformer path: ${importPath}`);
        }
        const { transformRequest, transformResponse } = await import(importPath);
        transformReqFn = transformRequest;
        transformResFn = transformResponse;
      }
      options.server.http(async (request, nextHandler) => {
        const { _nodeRequest: req, _nodeResponse: res } = request;
        try {
          logDebug(`Incoming request: ${req.url}`);
          if (transformReqFn) {
            await transformReqFn(req);
          }
          req.edgio = {
            scheme: "https",
            host: "www.google.com"
          };
          const protocol = req.edgio?.scheme === "https" ? https : http;
          const upstreamOptions = {
            method: req.method,
            hostname: req.edgio?.host,
            port: req.edgio?.scheme === "https" ? 443 : 80,
            path: req.url,
            headers: req.headers
          };
          const proxyReq = protocol.request(upstreamOptions, async (proxyRes) => {
            if (transformResFn) {
              await transformResFn(proxyRes, proxyReq);
            }
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            pipeline(proxyRes, res, (err) => {
              if (err) {
                logError(`Error piping response: ${err}`);
                res.end();
              }
            });
          });
          pipeline(req, proxyReq, (err) => {
            if (err) {
              logError(`Error piping request to origin: ${err}`);
              res.statusCode = 502;
              res.end("Bad Gateway");
            }
          });
          proxyReq.on("error", (err) => {
            logError(`Proxy request error: ${err}`);
            res.statusCode = 502;
            res.end("Bad Gateway");
          });
        } catch (error) {
          logError(`Error handling proxy request: ${error}`);
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      });
      return true;
    }
  };
}
export {
  start
};
