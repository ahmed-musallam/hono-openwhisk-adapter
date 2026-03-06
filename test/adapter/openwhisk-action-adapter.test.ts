import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ToOpenWhiskAction } from "../../src/adapter/openwhisk-action-adapter";
import type { OwAction, OwEnv } from "../../src/types";
import { zodOwParamsValidator } from "../../src/validator/zod-ow-params-validator";
import { z } from "zod";

/**
 * Executes the provided function while capturing console.error calls that match the given regex.
 * ensures the regex error is not logged to console, but has been called.
 */
const withConsoleErrorCapture = async (expectedRegex: RegExp, fn: () => Promise<void>) => {
  const matchingCalls: any[][] = [];
  const originalError = console.error;

  const spy = vi.spyOn(console, "error").mockImplementation(function (...args: any[]) {
    if (expectedRegex.test(args[0])) {
      matchingCalls.push(args);
      return; // match, don't log it.
    }
    originalError.apply(console, args); // no match, log it.
  });

  try {
    await fn();
    expect(matchingCalls.length).toBe(1);
  } finally {
    spy.mockRestore();
  }
};

// helper to execute OpenWhisk actions
class OwHelper {
  static invoke = (main: OwAction, { method = "GET", path = "/", body = undefined, params = {} }) =>
    main({
      __ow_path: path,
      __ow_method: method,
      __ow_body: body,
      ...params,
    });

  static get = (main: OwAction<any>, { path = "/", params = {} }) =>
    this.invoke(main, { method: "GET", path, params });
  static post = (main: OwAction<any>, { path = "/", body, params = {} }) =>
    this.invoke(main, { method: "POST", path, body, params });
  static put = (main: OwAction<any>, { path = "/", body, params = {} }) =>
    this.invoke(main, { method: "PUT", path, body, params });
  static patch = (main: OwAction<any>, { path = "/", body, params = {} }) =>
    this.invoke(main, { method: "PATCH", path, body, params });
  static delete = (main: OwAction<any>, { path = "/", body, params = {} }) =>
    this.invoke(main, { method: "DELETE", path, body, params });

  static successResponse = (statusCode: number, body: string) => {
    return expect.objectContaining({
      statusCode,
      body,
      headers: expect.any(Object),
    });
  };
  static errorResponse = (statusCode: number, body: string) => {
    return {
      headers: expect.any(Object),
      error: {
        statusCode,
        body,
      },
    };
  };
}

describe("ToOpenWhiskAction", () => {
  it("invokes app and returns ActionResponse", async () => {
    const app = new Hono().get("/hello", (c) => c.text("Hello"));
    const main = ToOpenWhiskAction(app);

    const result = await OwHelper.get(main, { path: "/hello" });

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe("Hello");
  });

  it("passes params in env so handler can read c.env.params", async () => {
    const app = new Hono<OwEnv>().get("/echo", (c) =>
      c.json({ path: c.env.params?.__ow_path, method: c.env.params?.__ow_method }),
    );
    const main = ToOpenWhiskAction(app);

    const result = await OwHelper.get(main, { path: "/echo" });

    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ path: "/echo", method: "GET" }),
    });
  });

  it("passes params with arbitrary extra keys in env so handler can read them", async () => {
    const app = new Hono<
      OwEnv<{ userId: string; tenantId: string; metadata?: { source: string } }>
    >().get("/me", (c) =>
      c.json({
        path: c.env.params.__ow_path,
        userId: c.env.params.userId,
        tenantId: c.env.params.tenantId,
        source: c.env.params.metadata?.source,
      }),
    );
    const main = ToOpenWhiskAction(app);

    const result = await OwHelper.get(main, {
      path: "/me",
      params: {
        userId: "u-123",
        tenantId: "t-456",
        metadata: { source: "api" },
      },
    });

    expect(result).toEqual(
      OwHelper.successResponse(
        200,
        JSON.stringify({
          path: "/me",
          userId: "u-123",
          tenantId: "t-456",
          source: "api",
        }),
      ),
    );
  });

  it("handles POST with body", async () => {
    const app = new Hono().post("/body", async (c) => {
      const text = await c.req.text();
      return c.json({ received: text });
    });
    const main = ToOpenWhiskAction(app);
    const body = JSON.stringify({ name: "world" });
    const encoded = Buffer.from(body, "utf-8").toString("base64");

    const result = await OwHelper.post(main, {
      path: "/body",
      body: encoded,
    });

    expect(result).toEqual(
      OwHelper.successResponse(
        200,
        JSON.stringify({
          received: body,
        }),
      ),
    );
  });

  it("returns body as base64 for binary response (e.g. image/png)", async () => {
    const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const app = new Hono().get(
      "/image",
      () =>
        new Response(binary, {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    const main = ToOpenWhiskAction(app);

    const result = await OwHelper.get(main, {
      path: "/image",
    });

    expect(result).toEqual(OwHelper.successResponse(200, binary.toString("base64")));
  });

  it("returns 404 for unknown path", async () => {
    const app = new Hono().get("/hello", (c) => c.text("Hello"));
    const main = ToOpenWhiskAction(app);

    const result = await OwHelper.get(main, {
      path: "/unknown",
    });

    expect(result).toEqual(OwHelper.errorResponse(404, "404 Not Found"));
  });

  it("returns 500 when route handler throws", async () => {
    const app = new Hono().get("/boom", () => {
      throw new Error("route error");
    });
    const main = ToOpenWhiskAction(app);

    // ensure console.error is called but not logged while testing
    withConsoleErrorCapture(/Error: route error/, async () => {
      const result = await main({
        __ow_path: "/boom",
        __ow_method: "GET",
      });

      expect(result).toEqual(OwHelper.errorResponse(500, "Internal Server Error"));
    });
  });

  it("returns status and body from Hono HTTPException", async () => {
    const app = new Hono().get("/auth", () => {
      throw new HTTPException(401, { message: "Unauthorized" });
    });
    const main = ToOpenWhiskAction(app);

    const result = await OwHelper.get(main, {
      path: "/auth",
    });

    expect(result).toEqual(OwHelper.errorResponse(401, "Unauthorized"));
  });

  it("validates params when validator is provided", async () => {
    const app = new Hono().get("/hello", (c) => c.text("Hello"));
    const schema = z.object({
      myParam: z.string(),
    });
    const main = ToOpenWhiskAction(app, zodOwParamsValidator(schema));

    const result = await OwHelper.get(main, {
      path: "/hello",
      params: { myParam: "myParamValue" },
    });

    expect(result).toEqual(OwHelper.successResponse(200, "Hello"));

    // ensure console.error is called but not logged while testing
    withConsoleErrorCapture(/Error validating Action params:/, async () => {
      await expect(
        OwHelper.get(main, {
          path: "/hello",
        }),
      ).resolves.toEqual(
        OwHelper.errorResponse(500, "Internal Server Error: action params validation failed"),
      );
    });
  });

  it("rejects when validator fails (invalid type)", async () => {
    const app = new Hono().get("/hello", (c) => c.text("Hello"));
    const main = ToOpenWhiskAction<{
      myParam: string;
    }>(app, (params) => {
      if (!params.myParam) {
        throw new Error("myParam is required");
      }
    });

    // ensure console.error is called but not logged while testing
    withConsoleErrorCapture(/Error validating Action params:/, async () => {
      await expect(
        OwHelper.get(main, {}), // specifically no myParam provided to fail validation
      ).resolves.toEqual(
        OwHelper.errorResponse(500, "Internal Server Error: action params validation failed"),
      );
    });
  });

  it("rejects when validator fails (missing required field)", async () => {
    const app = new Hono<OwEnv<{ user: { name: string; age: number } }>>().get("/hello", (c) =>
      c.json({ user: c.env.params.user }),
    );
    const schema = z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });
    const main = ToOpenWhiskAction<z.infer<typeof schema>>(app, zodOwParamsValidator(schema));

    await expect(
      OwHelper.get(main, { path: "/hello", params: { user: { name: "John", age: 26 } } }),
    ).resolves.toEqual({
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ user: { name: "John", age: 26 } }),
    });

    // ensure console.error is called but not logged while testing
    withConsoleErrorCapture(/Error validating Action params:/, async () => {
      await expect(
        OwHelper.get(main, { path: "/hello", params: { user: { name: "John" } } }),
      ).resolves.toEqual(
        OwHelper.errorResponse(500, "Internal Server Error: action params validation failed"),
      );
    });
  });
});
