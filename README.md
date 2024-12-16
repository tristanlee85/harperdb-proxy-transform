# HarperDB Express Proxy Transform

A [HarperDB Component](https://docs.harperdb.io/docs/developers/components) for proxying requests using an Express server.

## Usage

> [!NOTE]
> This guide assumes you're already familiar with [HarperDb Components](https://docs.harperdb.io/docs/developers/components). Check out [`harperdb-proxy-transform-example`](https://github.com/tristanlee85/harperdb-proxy-transform-example) for more information.

1. Install:

```sh
npm install git+ssh://git@github.com:tristanlee85/harperdb-proxy-transform.git --save
```

2. Add to `config.yaml`:

```yaml
'harperdb-proxy-transform':
  package: 'harperdb-proxy-transform'
  files: /*
  # Optional:
  # port: 3000 # default 3000
  # subPath: /api # default /
  # middlewarePath: middleware.js # default ''
  # transformerPath: transforms.js # default ''
  # staticPath: public # default ''
```

3. Run your app with HarperDB:

```sh
harperdb run .
```

## Extension Options

```ts
interface ExtensionOptions {
	port?: number;
	subPath?: string;
	middlewarePath?: string;
	transformerPath?: string;
	staticPath?: string;
}
```

### `port`

The port to run the Express server on. Defaults to `3000`.

### `subPath`

The subpath to proxy requests to. Defaults to `/`.

### `middlewarePath`

The path to the middleware file which exports an Express middleware function.
This middleware will be applied prior to the proxy transformation middleware. See [middleware.js](./middleware.js) for an example.

### `transformerPath`

The path to the transformer file. This file contain named exports that will be used to transform the request and response. See [transformer.js](./transformer.js) for an example.

### `staticPath`

The path to the static files. Defaults to `''`.
