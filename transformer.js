/**
 * @see {import('express-http-proxy').ProxyOptions.proxyReqOptDecorator}
 * @param {import('http').RequestOptions} reqOptions
 * @returns {import('http').RequestOptions}
 */
export function transformRequestOptions(reqOptions) {
	return reqOptions;
}

/**
 * @see {import('express-http-proxy').ProxyOptions.proxyReqPathResolver}
 * @param {import('express').Request} req
 * @returns {string}
 */
export function transformRequestPath(req) {
	return req.url;
}

/**
 * @see {import('express-http-proxy').ProxyOptions.userResDecorator}
 * @param {import('http').IncomingMessage} proxyRes
 * @param {any} proxyResData
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {any}
 */
export function transformResponse(proxyRes, proxyResData, req, res) {
	return proxyResData;
}
