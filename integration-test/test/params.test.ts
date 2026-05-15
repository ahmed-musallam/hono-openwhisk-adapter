import { describe, it, expect } from "vitest";
import { main } from "../actions/params/index";
import { expectError, expectSuccess, invoke, withSuppressedError } from "./helpers";

const validInputs = {
  MY_INPUT_VAR: "value-1",
  MY_OTHER_INPUT: "value-2",
};

describe("params action — Zod-validated inputs are exposed in c.env.params", () => {
  it("returns configured input values", async () => {
    const res = await invoke(main, { path: "/config", params: validInputs });
    expectSuccess(res, 200);
    expect(JSON.parse(res.body)).toEqual({
      myInput: "value-1",
      myOther: "value-2",
    });
  });

  it("exposes __ow_method", async () => {
    const res = await invoke(main, { path: "/method", params: validInputs });
    expectSuccess(res, 200);
    expect(JSON.parse(res.body)).toEqual({ method: "GET" });
  });

  it("exposes __ow_path", async () => {
    const res = await invoke(main, { path: "/path", params: validInputs });
    expectSuccess(res, 200);
    expect(JSON.parse(res.body)).toEqual({ path: "/path" });
  });

  it("exposes __ow_query as parsed query params", async () => {
    const res = await invoke(main, {
      path: "/query",
      query: "a=1&b=two",
      params: validInputs,
    });
    expectSuccess(res, 200);
    expect(JSON.parse(res.body)).toEqual({ q: { a: "1", b: "two" } });
  });

  it("exposes __ow_headers", async () => {
    const res = await invoke(main, {
      path: "/headers",
      headers: { "x-trace": "abc" },
      params: validInputs,
    });
    expectSuccess(res, 200);
    expect(JSON.parse(res.body)).toEqual({ headers: { "x-trace": "abc" } });
  });
});

describe("params action — validation failures return a generic 500 (no input leakage)", () => {
  it("missing required input → 500 with generic message, error logged", async () => {
    await withSuppressedError(/Error validating Action params:/, async () => {
      const res = await invoke(main, { path: "/config" }); // no inputs
      expectError(res, 500);
      expect(res.error.body).toBe("Internal Server Error: action params validation failed");
      // Verify the error response does NOT echo the failing input names
      expect(res.error.body).not.toMatch(/MY_INPUT_VAR|MY_OTHER_INPUT/);
    });
  });

  it("partially-missing input → 500 with generic message", async () => {
    await withSuppressedError(/Error validating Action params:/, async () => {
      const res = await invoke(main, {
        path: "/config",
        params: { MY_INPUT_VAR: "only-one" },
      });
      expectError(res, 500);
      expect(res.error.body).toBe("Internal Server Error: action params validation failed");
    });
  });
});
