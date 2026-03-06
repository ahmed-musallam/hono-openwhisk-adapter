import { describe, expect, it } from "vitest";
import { paramsToRequest, responseToActionResponse } from "../../src/adapter/utils";

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

  it("includes headers from __ow_headers", () => {
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_headers: { "x-custom": "value", accept: "application/json" },
    });
    expect(request.headers.get("x-custom")).toBe("value");
    expect(request.headers.get("accept")).toBe("application/json");
  });

  it("decodes base64 body for POST", async () => {
    const body = JSON.stringify({ foo: "bar" });
    const encoded = Buffer.from(body, "utf-8").toString("base64");
    const request = paramsToRequest({
      __ow_path: "/",
      __ow_method: "POST",
      __ow_body: encoded,
    });
    expect(request.method).toBe("POST");
    expect(request.body).toBeTruthy();
    const text = await request.text();
    expect(text).toBe(body);
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

  it("adds body for PUT and PATCH", async () => {
    const body = "data";
    const encoded = Buffer.from(body, "utf-8").toString("base64");
    for (const method of ["PUT", "PATCH"] as const) {
      const request = paramsToRequest({
        __ow_path: "/",
        __ow_method: method,
        __ow_body: encoded,
      });
      expect(request.method).toBe(method);
      expect(await request.text()).toBe(body);
    }
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
