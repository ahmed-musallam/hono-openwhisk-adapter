# integration-test

A real Adobe App Builder application that exercises
[`hono-openwhisk-adapter`](../) end-to-end. It serves two purposes:

1. **In-process integration tests** — invoke each action's `main` directly with
   the OpenWhisk raw-HTTP params shape and assert on the returned action
   response object.
2. **Live integration tests against a deployed App Builder app** — actually
   deploy via `aio app deploy` and verify the real HTTP responses your clients
   would see (status code, headers, body) for every interesting case.

The two test modes are independent; you can run either, both, or neither.

---

## What this verifies

- The OpenWhisk raw-HTTP request → Hono request transform (`__ow_path`,
  `__ow_method`, `__ow_query`, `__ow_headers`, `__ow_body` — base64 for
  `application/json` and binary `Content-Type`s, plain UTF-8 string for
  `text/plain` and other non-binary types, matching production).
- The Hono response → OpenWhisk action response transform, in particular the
  three response shapes the OpenWhisk controller cares about:
  - **2xx** → `{ statusCode, headers, body }` at the top level.
  - **3xx redirects** → `{ statusCode, headers, body }` at the top level
    (NOT wrapped in `error`, so they are not classified as application errors
    by the OpenWhisk controller).
  - **4xx / 5xx** → `{ error: { statusCode, headers, body } }` with headers
    **inside** `error`, because the controller projects only the `error` field
    on the application-error path.
- Header preservation across success, redirect, and error paths
  (`Set-Cookie`, `WWW-Authenticate`, `Retry-After`, custom CORS, custom trace
  headers, etc.).
- Body handling for text and binary content types (binary returned as base64
  by the adapter, decoded back to bytes by the OpenWhisk controller, delivered
  raw to the client).
- Action-level input validation via `zodOwParamsValidator` (generic 500 on
  failure, no input leakage in the response body).

---

## Layout

```
integration-test/
├── app.config.yaml             # App Builder manifest (web: "raw", nodejs:22)
├── webpack-config.cjs          # esbuild-loader for .ts actions (aio app build)
├── package.json
├── tsconfig.json
├── vitest.config.ts            # local test runner
├── vitest.deployed.config.ts   # live test runner (longer timeouts, sequential)
├── .env.example                # template for `aio app use` output
├── actions/
│   ├── status/index.ts         # 2xx, 3xx redirects, 4xx, 5xx, throws
│   ├── headers/index.ts        # custom headers on success / redirect / error
│   ├── body/index.ts           # text, json, html, binary (base64), POST echo
│   └── params/index.ts         # Zod-validated inputs, __ow_* exposure
├── test/                       # local in-process tests
│   ├── helpers.ts
│   ├── status.test.ts
│   ├── headers.test.ts
│   ├── body.test.ts
│   └── params.test.ts
└── live/                       # tests against a deployed App Builder app
    ├── env.ts                  # loads .env, computes deployed base URL
    └── deployed.test.ts
```

The actions are written exactly as you would write them for a real production
deployment (`function: actions/<name>/index.ts`, `web: "raw"`, runtime
`nodejs:22`, `require-adobe-auth: false` so they're publicly invokable for
testing).

### TypeScript bundling for `aio app build`

`aio app build` bundles each action with webpack. To support TypeScript action
sources (`.ts`), this directory ships a `webpack-config.cjs` that registers
`esbuild-loader` for `.ts`/`.tsx`/`.js`/`.jsx`:

- **Auto-discovered** by aio — the build walks up from each action's directory
  looking for `*webpack-config.js` / `*webpack-config.cjs`, so no reference in
  `app.config.yaml` is needed.
- **`.cjs` extension is required** here because `package.json` declares
  `"type": "module"`; `module.exports` syntax in a `.js` file would be a
  syntax error.
- **Output is `commonjs2`** because OpenWhisk's Node.js runtime expects a
  CommonJS bundle exposing `main`.
- **Minification is off** and `devtool: false` to keep stack traces readable
  in `aio rt:activation:logs`.

`esbuild-loader` is a dev-dependency of this package so aio's webpack can
resolve it from `integration-test/node_modules`.

---

## How the adapter is sourced

`package.json` declares:

```json
"hono-openwhisk-adapter": "file:.."
```

That resolves to the parent repo via npm symlink. The `pretest` hook always
runs `npm --prefix .. run build` first, so the integration test runs against
the freshly built `dist/` of the adapter — never the published npm package.

`hono` and `zod` are intentionally **not** declared as integration-test
dependencies; Node's directory-walk resolution finds the parent's installed
copies, which avoids the dual-package hazard (two physical copies → TypeScript
treats them as different types).

---

## 1. Local (in-process) tests

```bash
cd integration-test
npm install
npm test            # 37 tests, ~600ms
```

Or from the repo root:

```bash
npm run test:integration
```

These tests invoke each action's exported `main` with the same
`{ __ow_method, __ow_path, __ow_body, __ow_headers, __ow_query, ...inputs }`
payload that the OpenWhisk runtime would deliver (`test/helpers.ts` uses
`encodeOwRawHttpBody` from the adapter so `__ow_body` matches production
encoding), and assert the exact action response shape that the OpenWhisk
controller expects.

---

## 2. Deploying to Adobe App Builder

These steps assume you have a paid Adobe Developer Console account with App
Builder enabled.

### 2.1. Install the Adobe I/O CLI

```bash
npm install -g @adobe/aio-cli
aio --version
```

### 2.2. Sign in with your Adobe IMS account

```bash
aio login # use -f to force re-auth to different org if needed
```

A browser window opens; complete the IMS login. Starting with `aio` v11,
runtime-namespace auth is no longer supported — IMS auth is required.

### 2.3. Select organization, project, and workspace

```bash
# Pick the IMS org that owns your App Builder project.
aio console org select

# Either create a brand-new project (interactive picker for templates):
aio console project create -n honointegrationtest


# …or select an existing one:
aio console project select

# Pick a workspace inside the project (Stage / Production / a custom one).
aio console workspace select
```

### 2.4. Bind the project/workspace to this app directory

From inside `integration-test/`:

```bash
aio app use
```

`aio app use` writes a `.env` and `.aio` file populated with the credentials
of the selected workspace, including:

- `AIO_runtime_namespace` — the OpenWhisk namespace this app deploys to
- `AIO_runtime_auth` — the action-invocation token for that namespace
- the IMS client credentials needed by `aio app deploy`

> The live test script reads `AIO_runtime_namespace` from `.env` to compute
> the deployed base URL, so don't skip this step.

### 2.5. Configure the `params` action's inputs (optional)

The `params` action requires `MY_INPUT_VAR` and `MY_OTHER_INPUT` to be
present at deploy time. Add them to `.env`:

```bash
echo 'MY_INPUT_VAR=hello' >> .env
echo 'MY_OTHER_INPUT=world' >> .env
```

If you skip this, the action will deploy successfully but every invocation
will return `500 Internal Server Error: action params validation failed` —
the live test suite handles both cases automatically (see §3).

### 2.6. Deploy

```bash
aio app deploy
```

When deployment completes, `aio` prints the URLs of all four actions, e.g.:

```
→ https://<NAMESPACE>.adobeioruntime.net/api/v1/web/adapter-integration-test/status
→ https://<NAMESPACE>.adobeioruntime.net/api/v1/web/adapter-integration-test/headers
→ https://<NAMESPACE>.adobeioruntime.net/api/v1/web/adapter-integration-test/body
→ https://<NAMESPACE>.adobeioruntime.net/api/v1/web/adapter-integration-test/params
```

You can sanity-check one with `curl`:

```bash
curl -s -i "https://<NAMESPACE>.adobeioruntime.net/api/v1/web/adapter-integration-test/status/"
# HTTP/2 200
# content-type: text/plain; charset=UTF-8
# ...
# ok
```

---

## 3. Live tests against the deployed app

Once the app is deployed and `.env` is populated, run:

```bash
npm run test:deployed
```

Vitest **intercepts** `console.log` / `console.error` by default (it replays them through the reporter). To print them **live on the terminal** like a normal Node script, use either:

```bash
npm run test:deployed:logs
```

or the same flag directly:

```bash
npx vitest run --config vitest.deployed.config.ts --disableConsoleIntercept
```

Do **not** pass Vitest’s `--silent` (that hides console output from tests). To make this the default for the deployed suite, set `disableConsoleIntercept: true` under `test` in `vitest.deployed.config.ts`.

What it does:

- Loads `.env` via `dotenv`.
- Resolves the deployed base URL in this order:
  1. `DEPLOYED_BASE_URL` — explicit full URL override (handy for staging / prod
     or for testing behind a proxy).
  2. `AIO_runtime_namespace` (written by `aio app use`).
  3. `AIO_RUNTIME_NAMESPACE` (uppercase fallback).
- Hits every action route over HTTPS with `redirect: "manual"` (so 3xx
  responses are observable, not silently followed) and asserts the exact
  status code, headers, and body the client should receive.

The suite covers the full status/header/body matrix from the local tests,
plus the path-after-action-name routing semantics that only exercise on real
infrastructure. Two checks are particularly worth highlighting because they
are end-to-end verifications of the adapter's contract with the OpenWhisk
controller:

- **`/status/unauthorized` → 401 + `WWW-Authenticate` header reaches the
  client.** If the adapter regressed and put `headers` _outside_ the `error`
  object, the OpenWhisk controller would discard them on the application-error
  path and this header would be missing from the wire response.
- **`/status/redirect` → 302 + `Location` header.** If the adapter regressed
  and wrapped 3xx in `error`, the controller would mark the activation as an
  application error and (depending on workspace config) skew error metrics
  even though the redirect would still functionally work.

The `params` action test runs in one of two modes automatically:

- **Inputs configured** (`MY_INPUT_VAR` and `MY_OTHER_INPUT` present at deploy
  time): asserts the success path.
- **Inputs missing**: asserts the 500 validation-failure path with the
  generic, non-leaking error body.

### Required `.env` variables

| Variable                | Source                       | Purpose                                              |
| ----------------------- | ---------------------------- | ---------------------------------------------------- |
| `AIO_runtime_namespace` | `aio app use`                | Used to compute the deployed base URL                |
| `AIO_runtime_auth`      | `aio app use`                | Required by `aio app deploy` (not by the live tests) |
| `MY_INPUT_VAR`          | you, before `aio app deploy` | Input bound to the `params` action                   |
| `MY_OTHER_INPUT`        | you, before `aio app deploy` | Input bound to the `params` action                   |
| `DEPLOYED_BASE_URL`     | optional                     | Full URL override; bypasses namespace lookup         |

See `.env.example`.

---

## Re-deploy after changing actions

```bash
aio app deploy
npm run test:deployed
```

## Tear down

```bash
aio app undeploy
```
