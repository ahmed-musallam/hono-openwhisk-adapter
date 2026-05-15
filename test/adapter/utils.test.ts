import { describe, expect, it } from "vitest";
import {
  buildOwResponse,
  encodeOwRawHttpBody,
  isOwRawHttpBodyBase64Encoded,
  paramsToRequest,
  responseToActionResponse,
} from "../../src/adapter/utils";

describe("paramsToRequest", () => {
  it("builds Request with path and method", async () => {
    const request = paramsToRequest({
      __ow_path: "/hello",
      __ow_method: "GET",
    });
    expect(request.url).toContain("/hello");
    expect(request.method).toBe("GET");
  });

  it("defaults to GET and / when missing", () => {
    const request = paramsToRequest({});
    expect(request.method).toBe("GET");
    expect(request.url).toContain("/");
  });

  it("includes query string from __ow_query (string)", () => {
    const request = paramsToRequest({
      __ow_path: "/search",
      __ow_query: "q=test&page=1",
    });
    const url = new URL(request.url);
    expect(url.searchParams.get("q")).toBe("test");
    expect(url.searchParams.get("page")).toBe("1");
  });

  it("includes query string from __ow_query (object)", () => {
    const request = paramsToRequest({
      __ow_path: "/search",
      __ow_query: { q: "test", page: "1" } as unknown as string,
    });
    const url = new URL(request.url);
    expect(url.searchParams.get("q")).toBe("test");
    expect(url.searchParams.get("page")).toBe("1");
  });

  it("handles undefined __ow_query", () => {
    const request = paramsToRequest({ __ow_path: "/" });
    expect(new URL(request.url).search).toBe("");
  });

  it("resolves Content-Type when __ow_headers is omitted (plain __ow_body)", async () => {
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_method: "POST",
      __ow_body: "no-headers-plain",
    });
    expect(await request.text()).toBe("no-headers-plain");
  });

  it("finds Content-Type with case-insensitive header name", async () => {
    const body = JSON.stringify({ ok: true });
    const encoded = Buffer.from(body, "utf-8").toString("base64");
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_method: "POST",
      __ow_body: encoded,
      __ow_headers: { "CONTENT-type": "application/json" },
    });
    expect(await request.text()).toBe(body);
  });

  it("includes headers from __ow_headers", () => {
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_headers: { "x-custom": "value", accept: "application/json" },
    });
    expect(request.headers.get("x-custom")).toBe("value");
    expect(request.headers.get("accept")).toBe("application/json");
  });

  it("decodes base64 body for POST when Content-Type is application/json", async () => {
    const body = JSON.stringify({ foo: "bar" });
    const encoded = Buffer.from(body, "utf-8").toString("base64");
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_method: "POST",
      __ow_body: encoded,
      __ow_headers: { "content-type": "application/json" },
    });
    expect(request.method).toBe("POST");
    expect(request.body).toBeTruthy();
    const text = await request.text();
    expect(text).toBe(body);
  });

  it("uses plain __ow_body for text/plain (OpenWhisk passes UTF-8 string, not base64)", async () => {
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_method: "POST",
      __ow_body: "hello from the live integration test",
      __ow_headers: { "content-type": "text/plain; charset=UTF-8" },
    });
    expect(await request.text()).toBe("hello from the live integration test");
  });

  it("omits body when __ow_body is undefined", () => {
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_method: "POST",
    });
    expect(request.body).toBeNull();
  });

  it("omits body when __ow_body is empty string", () => {
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_method: "POST",
      __ow_body: "",
    });
    expect(request.body).toBeNull();
  });

  it("adds body for PUT and PATCH with application/json (base64 in __ow_body)", async () => {
    const body = "data";
    const encoded = Buffer.from(body, "utf-8").toString("base64");
    for (const method of ["PUT", "PATCH"] as const) {
      const request = paramsToRequest({
        __ow_path: "/",
        __ow_method: method,
        __ow_body: encoded,
        __ow_headers: { "content-type": "application/json" },
      });
      expect(request.method).toBe(method);
      expect(await request.text()).toBe(body);
    }
  });

  it("decodes binary body from base64 when Content-Type is application/octet-stream", async () => {
    const bytes = Buffer.from([0x00, 0x01, 0x02, 0xff]);
    const encoded = bytes.toString("base64");
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_method: "POST",
      __ow_body: encoded,
      __ow_headers: { "content-type": "application/octet-stream" },
    });
    const out = Buffer.from(await request.arrayBuffer());
    expect(out).toEqual(bytes);
  });

  it("omits body for GET even with __ow_body", () => {
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_method: "GET",
      __ow_body: Buffer.from("x", "utf-8").toString("base64"),
    });
    expect(request.body).toBeNull();
  });
});

describe("responseToActionResponse", () => {
  it("maps status, headers, and body", async () => {
    const res = new Response("hello", {
      status: 200,
      headers: { "content-type": "text/plain", "x-custom": "v" },
    });
    const out = await responseToActionResponse(res);
    expect(out.statusCode).toBe(200);
    expect(out.body).toBe("hello");
    expect(out.headers?.["content-type"]).toBe("text/plain");
    expect(out.headers?.["x-custom"]).toBe("v");
  });

  it("maps status and body (headers may be set by Response)", async () => {
    const res = new Response("ok", { status: 200 });
    const out = await responseToActionResponse(res);
    expect(out.statusCode).toBe(200);
    expect(out.body).toBe("ok");
  });

  it("omits headers when response has no header entries", async () => {
    const buf = Buffer.from("ok", "utf-8");
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const res = {
      status: 200,
      headers: { get: () => null, forEach: () => {} },
      arrayBuffer: () => Promise.resolve(arrayBuf),
    } as unknown as Response;
    const out = await responseToActionResponse(res);
    expect(out.statusCode).toBe(200);
    expect(out.body).toBe("ok");
    expect(out.headers).toEqual({});
  });

  it("returns body as base64 for binary content-type", async () => {
    const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const res = new Response(binary, {
      status: 200,
      headers: { "content-type": "image/png" },
    });
    const out = await responseToActionResponse(res);
    expect(out.statusCode).toBe(200);
    expect(out.body).toBe(binary.toString("base64"));
    expect(out.headers?.["content-type"]).toBe("image/png");
  });

  it("returns body as UTF-8 string for application/json", async () => {
    const json = '{"a":1}';
    const res = new Response(json, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const out = await responseToActionResponse(res);
    expect(out.statusCode).toBe(200);
    expect(out.body).toBe(json);
  });
});

describe("encodeOwRawHttpBody / isOwRawHttpBodyBase64Encoded", () => {
  it.each([
    ["application/json"],
    ["application/json; charset=utf-8"],
    ["image/png"],
    ["image/svg+xml"],
    ["video/mp4"],
    ["audio/mpeg"],
    ["font/woff2"],
    ["application/octet-stream"],
    ["application/pdf"],
    ["application/zip"],
    ["application/gzip"],
    ["application/x-gzip"],
    ["application/x-tar"],
    ["application/wasm"],
  ])("base64 mode for %s", (ct) => {
    expect(isOwRawHttpBodyBase64Encoded(ct)).toBe(true);
    expect(encodeOwRawHttpBody("x", ct)).toBe(Buffer.from("x", "utf-8").toString("base64"));
  });

  it("uses Buffer body for base64 output when Content-Type is binary", () => {
    const buf = Buffer.from([0xde, 0xad]);
    expect(encodeOwRawHttpBody(buf, "application/octet-stream")).toBe(buf.toString("base64"));
  });

  it("treats text/plain as plain UTF-8 string in params", () => {
    expect(isOwRawHttpBodyBase64Encoded("text/plain")).toBe(false);
    expect(encodeOwRawHttpBody("hello", "text/plain")).toBe("hello");
  });

  it("treats empty or missing Content-Type as not base64", () => {
    expect(isOwRawHttpBodyBase64Encoded("")).toBe(false);
    expect(isOwRawHttpBodyBase64Encoded(undefined)).toBe(false);
  });
});

describe("buildOwResponse", () => {
  it("returns top-level success shape for 2xx", () => {
    const out = buildOwResponse(200, { "content-type": "text/plain" }, "ok");
    expect(out).toEqual({
      statusCode: 200,
      headers: { "content-type": "text/plain" },
      body: "ok",
    });
    expect(out.error).toBeUndefined();
  });

  // 3xx are NOT application errors; OpenWhisk's own webactions docs model
  // redirects as success responses with a Location header and 3xx statusCode.
  it("returns top-level success shape for 3xx redirects (not error-wrapped)", () => {
    const out = buildOwResponse(302, { location: "https://example.com" }, "");
    expect(out).toEqual({
      statusCode: 302,
      headers: { location: "https://example.com" },
      body: "",
    });
    expect(out.error).toBeUndefined();
  });

  // The OpenWhisk controller projects ONLY the `error` field on the error
  // path, so headers must live INSIDE error to reach the HTTP client.
  it("wraps 4xx in error with headers inside the error object", () => {
    const out = buildOwResponse(404, { "content-type": "text/plain" }, "Not Found");
    expect(out).toEqual({
      error: {
        statusCode: 404,
        headers: { "content-type": "text/plain" },
        body: "Not Found",
      },
    });
    expect(out.statusCode).toBeUndefined();
    expect(out.headers).toBeUndefined();
  });

  it("wraps 5xx in error with headers inside the error object", () => {
    const out = buildOwResponse(500, { "x-trace": "abc" }, "boom");
    expect(out).toEqual({
      error: {
        statusCode: 500,
        headers: { "x-trace": "abc" },
        body: "boom",
      },
    });
    expect(out.statusCode).toBeUndefined();
    expect(out.headers).toBeUndefined();
  });
});
