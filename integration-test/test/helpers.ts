import { vi, expect } from "vitest";
import type { OwAction, OwActionResponse } from "hono-openwhisk-adapter";
import { encodeOwRawHttpBody } from "hono-openwhisk-adapter";

export type InvokeOptions = {
  method?: string;
  path?: string;
  body?: string | Buffer;
  headers?: Record<string, string>;
  query?: string;
  params?: Record<string, unknown>;
};

function contentTypeFromHeaders(headers: Record<string, string> | undefined): string | undefined {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === "content-type");
  return key !== undefined ? headers[key] : undefined;
}

/**
 * Build OpenWhisk raw HTTP params and invoke the action's `main` exactly the
 * way the OpenWhisk / Adobe I/O Runtime runtime would. `__ow_body` is packed with
 * {@link encodeOwRawHttpBody} so it matches production: base64 for
 * `application/json` and binary media types, plain UTF-8 string for `text/plain`
 * and other non-binary types.
 */
export async function invoke(
  main: OwAction<any>,
  opts: InvokeOptions = {},
): Promise<OwActionResponse> {
  const { method = "GET", path = "/", body, headers, query, params = {} } = opts;
  const ct = contentTypeFromHeaders(headers);
  const owBody =
    body !== undefined
      ? encodeOwRawHttpBody(typeof body === "string" ? body : body, ct)
      : undefined;

  return main({
    __ow_path: path,
    __ow_method: method,
    __ow_body: owBody,
    __ow_headers: headers,
    __ow_query: query,
    ...params,
  });
}

/**
 * Convenience assertion: success-shape (statusCode/headers/body at top level).
 * Used for 1xx/2xx/3xx responses.
 */
export function expectSuccess(
  res: OwActionResponse,
  statusCode: number,
): asserts res is OwActionResponse & {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  expect(res.error).toBeUndefined();
  expect(res.statusCode).toBe(statusCode);
  expect(res.headers).toBeDefined();
  expect(typeof res.body).toBe("string");
}

/**
 * Convenience assertion: error-shape (statusCode/headers/body INSIDE `error`).
 * Used for 4xx/5xx responses.
 */
export function expectError(
  res: OwActionResponse,
  statusCode: number,
): asserts res is OwActionResponse & {
  error: { statusCode: number; headers: Record<string, string>; body: string };
} {
  expect(res.statusCode).toBeUndefined();
  expect(res.headers).toBeUndefined();
  expect(res.error).toBeDefined();
  expect(res.error?.statusCode).toBe(statusCode);
  expect(res.error?.headers).toBeDefined();
  expect(typeof res.error?.body).toBe("string");
}

/**
 * Run `fn` while suppressing console.error calls whose first arg matches
 * `pattern`. Asserts at least one match was captured.
 */
export async function withSuppressedError(pattern: RegExp, fn: () => Promise<void>): Promise<void> {
  const originalError = console.error;
  let matched = 0;
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const haystack = args
      .map((a) => (a instanceof Error ? `${a.name}: ${a.message}\n${a.stack ?? ""}` : String(a)))
      .join(" ");
    if (pattern.test(haystack)) {
      matched++;
      return;
    }
    originalError.apply(console, args as never);
  });
  try {
    await fn();
    expect(matched).toBeGreaterThan(0);
  } finally {
    spy.mockRestore();
  }
}
