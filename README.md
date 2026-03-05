# hono-openwhisk-adapter

[Hono](https://hono.dev/) adapter for OpenWhisk. Allows you to use Hono to build [OpenWhisk Actions](https://github.com/apache/openwhisk/blob/master/docs/webactions.md) (or [Adobe App Builder Actions](https://developer.adobe.com/app-builder/docs/guides/runtime_guides/creating-actions); App Builder is built on OpenWhisk)

## Usage

### Setting the Actions `raw-http: true` annotation.

Your action must use the `raw-http: true` [annotation](https://github.com/apache/openwhisk/blob/master/docs/annotations.md).

On Adobe App Builder, this can be set in your `*.config.yaml` file, here's an example

> This ensures the request body and query are processed by this library and available in the Request interface in hono.

```yaml
application:
  ....
  runtimeManifest:
    packages:
      my-package:
        actions:
          my-action:
            function: actions/my-action.ts
            web: "yes"
            runtime: nodejs:22
            inputs:
              LOG_LEVEL: debug
              MY_VAR_ONE: $MY_VAR_ONE
              MY_VAR_TWO: $MY_VAR_TWO
            annotations:
              raw-http: true # <=========== add this.
              web-export: raw # <========== also this
```

### Sample Action

```ts
// actions/my-action.ts
import { Hono } from "hono/quick"; // see presets: https://hono.dev/docs/api/presets#which-preset-should-i-use
import { OWRawHttpParams, ToOpenWhiskAction } from "hono-openwhisk-adapter";

const app = new Hono();
// see routing: https://hono.dev/docs/api/routing
app.get("/*", (c) => c.text("Hello"));

// convert the hono app to open whisk action.
export const main = honoToOpenWhiskAction(app);
```

### Using Typed Params/Inputs

if you want to access the original `params` where you might have passed some `inputs` (like in the `*.config.yaml` example abobe)

_this is common for env variables_

```ts
// actions/my-action.ts
import { Hono } from "hono/quick"; // see presets: https://hono.dev/docs/api/presets#which-preset-should-i-use
import { OWRawHttpParams, ToOpenWhiskAction } from "hono-openwhisk-adapter";

// types of your params
type Params = OWRawHttpParams & {
  MY_VAR_ONE: string; // params passed to openwhisk action
  MY_VAR_ONE: string; // params passed  to openwhisk action
};

const app = new Hono<{Bindings: { params: Params };}>();

app.get("/*", (c) => {
   return  c.json({
      myVarOne: c.env.params.MY_VAR_ONE, // your typed params
      myVarTwo: c.env.params.MY_VAR_TWO, // your typed params
   });
};

// convert the hono app to open whisk action.
export const main = honoToOpenWhiskAction(app);
```

## Honon Routing

suppose your action is published at `https://workspace.adobeio-static.net/api/v1/web/my-package/my-action`

the `path` for hono routing purpose is the segment after your published action location

```
https://workspace.adobeio-static.net/api/v1/web/my-package/my-action/pets/dragon/abilities
                                                                    |-------- path ------|
```

and you can write the sample hono routes

_read more on [hono routes](https://hono.dev/docs/api/routing)_

```ts

app.get('/pets', (c) => {
  const pets = Object.values(petStore)
  return c.json({ count: pets.length, pets })
})

app.get('/pets/:type', (c) => {
  const type = c.req.param('type').toLowerCase()
  const meta = petStore[type]
  if (!meta) return c.json({ error: 'Pet type not found' }, 404)
  return c.json(meta)
})

app.get('/pets/:type/abilities', (c) => {
   const type = c.req.param('type')
   ...
})

```

## Motivation

Openwhisk (and App Builder) actions use non-standard input/outpus for Actions.
A simple OpenWhisk action can look like this:

```ts
(params: {
  __ow_query,
  __ow_headers,
  __ow_body,
  ...
}) => ({
  statusCode: 200;
  headers: { 'content-type': `application/json`};
  body: {
   text: 'hello world'
  };
})
```

While in modern standards, like the [WinterTc minimum common API](https://min-common-api.proposal.wintertc.org/), it would use interfaces defined in [Fetch Standard](https://fetch.spec.whatwg.org/) like `Request` `Response` ..etc.

This repo allows writing actions such they are [portable](https://www.infoworld.com/article/4133640/wintertc-write-once-run-anywhere-for-real-this-time.html) with a clean API and have first class Typescript support and [many other features Hono offers!](https://hono.dev/docs/#features)

## Installation

### From npm (when published)

```bash
npm install hono-openwhisk-adapter hono
```

## Local Development of this repo

1. clone this repo
2. In this repo directory:

   ```bash
   npm run build
   npm link
   ```

3. In your project:

   ```bash
   npm link hono-openwhisk-adapter
   ```

   After changing the adapter code, run `npm run build` in this repo so the linked package is up to date.

## Publishing to npm

Releases are automated with [semantic-release](https://github.com/semantic-release/semantic-release) via GitHub Actions.

## Commit convention

Use [Conventional Commits](https://www.conventionalcommits.org/) so semantic-release can decide the next version:

- `feat: add something` → minor release (e.g. 1.1.0)
- `fix: repair something` → patch (e.g. 1.0.1)
- `feat!: breaking change` or footer `BREAKING CHANGE:` → major (e.g. 2.0.0)
