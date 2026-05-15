import "dotenv/config";

/**
 * Resolves the base URL of the deployed App Builder package.
 *
 * Resolution order:
 *   1. DEPLOYED_BASE_URL          — explicit full URL override.
 *   2. AIO_runtime_namespace      — written by `aio app use` (preferred).
 *   3. AIO_RUNTIME_NAMESPACE      — uppercase fallback.
 *   4. RUNTIME_NAMESPACE          — last-resort generic fallback.
 *
 * The package name must match the one declared in app.config.yaml.
 */
export const PACKAGE_NAME = "adapter-integration-test";

const namespace =
  process.env.AIO_runtime_namespace ||
  process.env.AIO_RUNTIME_NAMESPACE ||
  process.env.RUNTIME_NAMESPACE;

const explicitBase = process.env.DEPLOYED_BASE_URL;

if (!explicitBase && !namespace) {
  throw new Error(
    [
      "Cannot resolve the deployed App Builder URL.",
      "",
      "Either:",
      "  - run `aio app use` (after selecting a project/workspace) to populate",
      "    AIO_runtime_namespace in .env, or",
      "  - set DEPLOYED_BASE_URL in .env to the full base URL, e.g.:",
      "      DEPLOYED_BASE_URL=https://<ns>.adobeioruntime.net/api/v1/web/adapter-integration-test",
      "",
      "See integration-test/.env.example for the full list of supported vars.",
    ].join("\n"),
  );
}

export const NAMESPACE = namespace ?? "(via DEPLOYED_BASE_URL)";

export const BASE_URL = (
  explicitBase ?? `https://${namespace}.adobeioruntime.net/api/v1/web/${PACKAGE_NAME}`
).replace(/\/+$/, "");

/** Build the full URL for an action route. */
export function actionUrl(action: string, path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}/${action}${p}`;
}

/** True if the params action's required inputs are configured locally too. */
export const PARAMS_INPUTS_CONFIGURED = !!process.env.MY_INPUT_VAR && !!process.env.MY_OTHER_INPUT;

/**
 * Convenience wrapper around fetch that disables redirect following so we can
 * assert on 3xx responses directly. Adds a generous timeout via AbortSignal.
 */
export async function call(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 25_000, ...rest } = init;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      ...rest,
    });
  } finally {
    clearTimeout(t);
  }
}
