import { describe, it, expect } from "vitest";
import { main } from "../actions/headers/index";
import { expectError, expectSuccess, invoke } from "./helpers";

describe("headers action — success path", () => {
  it("preserves a single custom header", async () => {
    const res = await invoke(main, { path: "/single" });
    expectSuccess(res, 200);
    expect(res.headers["x-custom"]).toBe("alpha");
    expect(res.body).toBe("single");
  });

  it("preserves multiple custom headers", async () => {
    const res = await invoke(main, { path: "/multi" });
    expectSuccess(res, 200);
    expect(res.headers["x-one"]).toBe("1");
    expect(res.headers["x-two"]).toBe("2");
    expect(res.headers["x-three"]).toBe("3");
  });

  it("respects an explicit content-type set by the handler", async () => {
    const res = await invoke(main, { path: "/content-type" });
    expectSuccess(res, 200);
    expect(res.headers["content-type"]).toMatch(/text\/markdown/);
    expect(res.body).toBe("# hello");
  });

  it("forwards request __ow_headers into the Hono request", async () => {
    const res = await invoke(main, {
      path: "/echo",
      headers: { "x-incoming": "value-1", accept: "application/json" },
    });
    expectSuccess(res, 200);
    expect(JSON.parse(res.body)).toEqual({
      received: { "x-incoming": "value-1", accept: "application/json" },
    });
  });

  it("preserves CORS headers on success", async () => {
    const res = await invoke(main, { path: "/cors" });
    expectSuccess(res, 200);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-methods"]).toBe("GET, POST, OPTIONS");
  });
});

describe("headers action — error path keeps headers INSIDE `error`", () => {
  it("401 with custom headers — headers must be inside error so OpenWhisk delivers them", async () => {
    const res = await invoke(main, { path: "/error-with-headers" });
    expectError(res, 401);
    expect(res.error.headers["x-trace-id"]).toBe("trace-123");
    expect(res.error.headers["www-authenticate"]).toBe('Bearer realm="api"');
    expect(JSON.parse(res.error.body)).toEqual({ error: "denied" });
  });
});

describe("headers action — redirect (3xx) keeps headers at TOP level (not error-wrapped)", () => {
  it("302 with custom headers", async () => {
    const res = await invoke(main, { path: "/redirect-with-headers" });
    expectSuccess(res, 302);
    expect(res.headers.location).toBe("https://example.com/dest");
    expect(res.headers["x-correlation-id"]).toBe("corr-42");
  });
});
