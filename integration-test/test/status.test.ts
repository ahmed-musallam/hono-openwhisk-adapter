import { describe, it, expect } from "vitest";
import { main } from "../actions/status/index";
import { expectError, expectSuccess, invoke, withSuppressedError } from "./helpers";

describe("status action — 2xx success responses", () => {
  it("200 OK with text body", async () => {
    const res = await invoke(main, { path: "/" });
    expectSuccess(res, 200);
    expect(res.body).toBe("ok");
  });

  it("201 Created with JSON body", async () => {
    const res = await invoke(main, { method: "POST", path: "/created" });
    expectSuccess(res, 201);
    expect(JSON.parse(res.body)).toEqual({ created: true });
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("204 No Content with empty body", async () => {
    const res = await invoke(main, { path: "/no-content" });
    expectSuccess(res, 204);
    expect(res.body).toBe("");
  });
});

describe("status action — 3xx redirects must NOT be wrapped in `error`", () => {
  for (const [code, path, location] of [
    [301, "/permanent-redirect", "https://example.com/moved"],
    [302, "/redirect", "https://example.com/redirected"],
    [303, "/see-other", "https://example.com/other"],
    [307, "/temporary-redirect", "https://example.com/temp"],
    [308, "/permanent-redirect-308", "https://example.com/perm308"],
  ] as const) {
    it(`${code} returns top-level success shape with Location header`, async () => {
      const res = await invoke(main, { path });
      expectSuccess(res, code);
      expect(res.headers.location).toBe(location);
    });
  }
});

describe("status action — 4xx/5xx are wrapped in `error` with headers inside", () => {
  it("400 Bad Request", async () => {
    const res = await invoke(main, { path: "/bad-request" });
    expectError(res, 400);
    expect(JSON.parse(res.error.body)).toEqual({ error: "bad input" });
  });

  it("401 Unauthorized preserves WWW-Authenticate header inside error", async () => {
    const res = await invoke(main, { path: "/unauthorized" });
    expectError(res, 401);
    expect(res.error.headers["www-authenticate"]).toBe('Bearer realm="api"');
    expect(res.error.body).toBe("Unauthorized");
  });

  it("404 Not Found from explicit handler", async () => {
    const res = await invoke(main, { path: "/not-found" });
    expectError(res, 404);
    expect(res.error.body).toBe("nope");
  });

  it("404 Not Found from unmatched route", async () => {
    const res = await invoke(main, { path: "/does-not-exist" });
    expectError(res, 404);
    expect(res.error.body).toMatch(/404 Not Found/i);
  });

  it("500 Internal Server Error", async () => {
    const res = await invoke(main, { path: "/server-error" });
    expectError(res, 500);
    expect(JSON.parse(res.error.body)).toEqual({ error: "boom" });
  });

  it("503 Service Unavailable preserves Retry-After header inside error", async () => {
    const res = await invoke(main, { path: "/service-unavailable" });
    expectError(res, 503);
    expect(res.error.headers["retry-after"]).toBe("30");
    expect(res.error.body).toBe("Try again later");
  });

  it("uncaught handler exception → 500", async () => {
    await withSuppressedError(/intentional failure for integration test/, async () => {
      const res = await invoke(main, { path: "/throws" });
      expectError(res, 500);
      expect(res.error.body).toBe("Internal Server Error");
    });
  });
});
