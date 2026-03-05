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

## Publishing to npm

Releases are automated with [semantic-release](https://github.com/semantic-release/semantic-release) via GitHub Actions.

### 1. Add NPM token

1. On [npmjs.com](https://www.npmjs.com/), go to **Access Tokens** → **Generate New Token**.
2. Choose **Automation** (for CI) or **Granular** with “Packages: Read and write”.
3. Copy the token.
4. In your GitHub repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
5. Name: `NPM_TOKEN`, Value: the token you copied.

### 2. Commit convention

Use [Conventional Commits](https://www.conventionalcommits.org/) so semantic-release can decide the next version:

- `feat: add something` → minor release (e.g. 1.1.0)
- `fix: repair something` → patch (e.g. 1.0.1)
- `feat!: breaking change` or footer `BREAKING CHANGE:` → major (e.g. 2.0.0)

### 3. Trigger a release

Push to `main` or `master`. The [Release workflow](.github/workflows/release.yml) will:

1. Run tests/build, then semantic-release.
2. Bump version, update `CHANGELOG.md`, create a git tag and GitHub release.
3. Publish the new version to npm (using `NPM_TOKEN`).
