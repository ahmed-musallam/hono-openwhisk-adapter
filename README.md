# hono-openwhisk-adapter

[Hono](https://hono.dev/) adapter for OpenWhisk. Build [OpenWhisk Actions](https://github.com/apache/openwhisk/blob/master/docs/webactions.md) (or [Adobe App Builder Actions](https://developer.adobe.com/app-builder/docs/guides/runtime_guides/creating-actions)) using Hono. Params are passed in `c.env.params`; optional validation is supported via a validator function (use any library: Zod, ArkType, Standard Schema, etc.).

## Installation

```bash
npm install hono-openwhisk-adapter hono
```

For runtime validation, install any schema/validation library you like (e.g. Zod, ArkType).

## How to use

### Setting `raw-http: true`

> [!IMPORTANT]
> This is essential for the hono adapter to work.

Your action must use the `raw-http: true` [annotation](https://github.com/apache/openwhisk/blob/master/docs/annotations.md) or the `web: raw` annotation so the adapter receives the raw HTTP params.

On Adobe App Builder, set it in your `*.config.yaml`:

```yaml
application:
  runtimeManifest:
    packages:
      my-package:
        actions:
          my-action:
            function: actions/my-action.ts
            web: "yes"
            runtime: nodejs:22
            annotations:
              raw-http: true
              web-export: raw
            inputs:
              MY_VAR_ONE: $ENV_VAR_ONE
              MY_VAR_TWO: $ENV_VAR_TWO
```

### Basic usage

```ts
import { Hono } from "hono";
import { ToOpenWhiskAction } from "hono-openwhisk-adapter";

const app = new Hono();
app.get("/hello", (c) => c.text("Hello"));
app.get("/*", (c) => c.text("Fallback"));

export const main = ToOpenWhiskAction(app);
```

### Params in context (`c.env.params`)

The original Action params (including `__ow_path`, `__ow_method`, ...etc) are available as `c.env.params`. Use the `OwEnv` type for typed params.

Example: in the sample yaml above, there are two `inputs`: `MY_VAR_ONE` and `MY_VAR_TWO`. which will be available in `c.env.params`:

```ts
import { Hono } from "hono";
import { ToOpenWhiskAction, type OwEnv, type OwRawHttpParams } from "hono-openwhisk-adapter";

// Params = Ow raw HTTP params + your own params (inputs in your *.config.yaml on Adobe App Builder)
type MyParams = OwRawHttpParams & {
  MY_VAR_ONE: string;
  MY_VAR_TWO: string;
};

const app = new Hono<OwEnv<MyParams>>();

app.get("/config", (c) => {
  return c.json({
    path: c.env.params.__ow_path,
    myVarOne: c.env.params.MY_VAR_ONE, // access to input params
    myVarTwo: c.env.params.MY_VAR_TWO, // access to input params
  });
});

export const main = ToOpenWhiskAction(app);
```

`OwEnv<TParams>` types `c.env.params` as `TParams & OwRawHttpParams`. Omit the generic for default `OwRawHttpParams`.

## Validating Action Params

Pass a **validator function** as the second argument. It receives raw action params. Throw error on failure. You can use any library: [Zod](https://zod.dev/), [ArkType](https://arktype.io/), [Standard Schema](https://standard-schema.com/), etc.

when validation fails, the error is logged, and a generic `500` `Internal Server Error: action params validation failed` to avoid exposing private inputs.

### With Zod (helper validator)

install zod `npm install zod`

Use `zodOwParamsValidator` to wrap a Zod schema; it validates params and throws on failure.

```ts
import { Hono } from "hono";
import { z } from "zod";
import { ToOpenWhiskAction, zodOwParamsValidator, type OwEnv } from "hono-openwhisk-adapter";

const ParamsSchema = z.object({
  MY_VAR_ONE: z.string().nonempty(),
  MY_VAR_TWO: z.string().nonempty(),
});

// Params type inferred from the Zod schema:
type Params = z.infer<typeof ParamsSchema>;

const app = new Hono<OwEnv<Params>>();

app.get("/me", (c) => c.json({ userId: c.env.params.userId }));

export const main = ToOpenWhiskAction(app, zodOwParamsValidator(ParamsSchema));
```

---

## Routing

### Path and routing

If your action is published at  
`https://workspace.adobeio-static.net/api/v1/web/my-package/my-action`,  
the path used for Hono routing is the segment after the action name:

```
https://workspace.adobeio-static.net/api/v1/web/my-package/my-action/pets/dragon/abilities
                                                                    |-------- path ------|
```

Example routes:

```ts
app.get("/pets", (c) => c.json({ count: pets.length, pets }));

app.get("/pets/:type", (c) => {
  const type = c.req.param("type").toLowerCase();
  return c.json(petStore[type] ?? { error: "Not found" }, 404);
});

app.get("/pets/:type/abilities", (c) => {
  const type = c.req.param("type");
  return c.json(getAbilities(type));
});
```

See [Hono routing](https://hono.dev/docs/api/routing).

---

## Motivation

OpenWhisk (and App Builder) actions use a custom input/output shape (`__ow_*` params, `{ statusCode, headers, body }`). This adapter lets you write actions using the standard [Fetch](https://fetch.spec.whatwg.org/) `Request`/`Response` model and Hono’s API, with TypeScript support and optional Zod validation.

---

## Local development

1. Clone this repo and build:

   ```bash
   npm run build
   npm link
   ```

2. In your project:

   ```bash
   npm link hono-openwhisk-adapter
   ```

   Run `npm run build` in this repo after changes so the linked package is up to date.

---

## Publishing to npm

Releases are automated with [semantic-release](https://github.com/semantic-release/semantic-release) via GitHub Actions. Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: ...` → minor
- `fix: ...` → patch
- `feat!: ...` or `BREAKING CHANGE:` → major
