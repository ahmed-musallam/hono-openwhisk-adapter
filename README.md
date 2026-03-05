# hono-openwhisk-adapter

Hono adapter for OpenWhisk. Exposes a handler that accepts OpenWhisk HTTP params, builds a `Request`, runs your Hono app's `fetch`, and returns an `ActionResponse`.

## Installation

### From npm (when published)

```bash
npm install hono-openwhisk-adapter hono
```

### Using `npm link`

1. In this repo:

   ```bash
   npm run build
   npm link
   ```

2. In your project:

   ```bash
   npm link hono-openwhisk-adapter
   ```

   After changing the adapter code, run `npm run build` in this repo so the linked package is up to date.

## Usage

```ts
import { Hono } from "hono";
import { honoToOpenWhiskAction } from "hono-openwhisk-adapter";

const app = new Hono();
app.get("/hello", (c) => c.text("Hello"));

export const main = honoToOpenWhiskAction(app);
```

Options:

```ts
honoToOpenWhiskAction(app, { baseUrl: "https://api.example.com" });
```
