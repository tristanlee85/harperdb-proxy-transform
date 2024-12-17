import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import http from 'node:http';
import https from 'node:https';
import { pipeline } from 'node:stream';

declare const logger: any;

/**
 * Patch `logger` methods to include prefix
 */
const [logInfo, logDebug, logError, logWarn] = ['info', 'debug', 'error', 'warn'].map((method) => {
	const fn = logger[method];
	return (message: string) => {
		fn(`[harperdb-proxy-transform] ${message}`);
	};
});

/**
 * @typedef {Object} Transformer
 * @property {function(Request): void} transformRequest - Function to transform request.
 * @property {function(Response): void} transformResponse - Function to transform response.
 */

/**
 * Define a list of allowed hosts to validate an incoming `x-forwarded-host`
 * header that could be used to make this more dynamic in the future.
 *
 * Validating the incoming host should help prevent abuse by restricting
 * the passed host header to the allowedHosts list.
 */
const allowedHosts = new Set(['83c5-2600-1700-f2e0-b0f-74f7-c2c1-a4ad-e69d.ngrok-free.app']);

/**
 *
 * The 'proxy' library accepts a function to determine the proxy host.
 *
 * @param {IncomingMessage} param0
 * @returns {string} Hostname
 */
const determineProxyHost = ({ headers }: { headers: Record<string, string> }) => {
	// Return the hostname (TODO: make this more dynamic)
	return 'https://www.google.com';
};

/**
 * @typedef {Object} ExtensionOptions - The configuration options for the extension.
 * @property {string=} transformerPath - A path to a transformer file to be used by the Express.js server.
 */
export type ExtensionOptions = {
	transformerPath?: string;
};

/**
 * Assert that a given option is a specific type.
 * @param {string} name The name of the option.
 * @param {any=} option The option value.
 * @param {string} expectedType The expected type (i.e. `'string'`, `'number'`, `'boolean'`, etc.).
 */
function assertType(name: string, option: any, expectedType: string) {
	if (option) {
		const found = typeof option;
		assert.strictEqual(found, expectedType, `${name} must be type ${expectedType}. Received: ${found}`);
	}
}

/**
 * Resolves the incoming extension options into a config for use throughout the extension.
 * @param {ExtensionOptions} options - The options object to be resolved into a configuration.
 * @returns {Required<ExtensionOptions>}
 */
function resolveConfig(options: ExtensionOptions) {
	assertType('transformerPath', options.transformerPath, 'string');

	return {
		transformerPath: options.transformerPath ?? '',
	};
}

/**
 * This method is executed on each worker thread, and is responsible for
 * returning a Resource Extension that will subsequently be executed on each
 * worker thread.
 *
 * The Resource Extension is responsible for creating the Next.js server, and
 * hooking into the global HarperDB server.
 *
 * @param {ExtensionOptions} options
 * @returns
 */
export function start(options: any) {
	const config = resolveConfig(options);

	logInfo(`Starting extension...`);

	return {
		async handleDirectory(_: any, componentPath: string) {
			let transformReqFn: Function | undefined;
			let transformResFn: Function | undefined;

			if (!fs.existsSync(componentPath) || !fs.statSync(componentPath).isDirectory()) {
				throw new Error(`Invalid component path: ${componentPath}`);
			}

			// User-defined transformer
			if (!!config.transformerPath) {
				// Check to ensure the transformer path is a valid file
				const importPath = path.resolve(componentPath, config.transformerPath);
				if (!fs.existsSync(importPath) || !fs.statSync(importPath).isFile()) {
					throw new Error(`Invalid transformer path: ${importPath}`);
				}

				// Transformer must be be a module with named exports
				const { transformRequest, transformResponse } = await import(importPath);

				transformReqFn = transformRequest;
				transformResFn = transformResponse;
			}

			// Hook into `options.server.http`
			options.server.http(async (request: any, nextHandler: any) => {
				const { _nodeRequest: req, _nodeResponse: res } = request;

				try {
					logDebug(`Incoming request: ${req.url}`);

					if (transformReqFn) {
						await transformReqFn(req);
					}

					req.edgio = {
						scheme: 'https',
						host: 'www.google.com',
					};

					const protocol = req.edgio?.scheme === 'https' ? https : http;

					const upstreamOptions = {
						method: req.method,
						hostname: req.edgio?.host,
						port: req.edgio?.scheme === 'https' ? 443 : 80,
						path: req.url,
						headers: req.headers,
					};

					const proxyReq = protocol.request(upstreamOptions, async (proxyRes) => {
						if (transformResFn) {
							await transformResFn(proxyRes, proxyReq);
						}

						res.writeHead(proxyRes.statusCode, proxyRes.headers);
						pipeline(proxyRes, res, (err: any) => {
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
							res.end('Bad Gateway');
						}
					});

					proxyReq.on('error', (err: any) => {
						logError(`Proxy request error: ${err}`);
						res.statusCode = 502;
						res.end('Bad Gateway');
					});
				} catch (error) {
					// General error handling
					logError(`Error handling proxy request: ${error}`);
					res.statusCode = 500;
					res.end('Internal Server Error');
				}
			});

			return true;
		},
	};
}
