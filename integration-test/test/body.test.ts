import { describe, it, expect } from "vitest";
import { main } from "../actions/body/index";
import { expectSuccess, invoke } from "./helpers";

describe("body action — text content types are returned as utf-8 strings", () => {
  it("text/plain", async () => {
    const res = await invoke(main, { path: "/text" });
    expectSuccess(res, 200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.body).toBe("plain text body");
  });

  it("application/json", async () => {
    const res = await invoke(main, { path: "/json" });
    expectSuccess(res, 200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(JSON.parse(res.body)).toEqual({ hello: "world", n: 42 });
  });

  it("text/html", async () => {
    const res = await invoke(main, { path: "/html" });
    expectSuccess(res, 200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.body).toBe("<h1>hi</h1>");
  });

  it("empty body", async () => {
    const res = await invoke(main, { path: "/empty" });
    expectSuccess(res, 200);
    expect(res.body).toBe("");
  });
});

describe("body action — binary content types are base64-encoded", () => {
  it("image/png is base64-encoded and decodes to the original bytes", async () => {
    const res = await invoke(main, { path: "/binary/png" });
    expectSuccess(res, 200);
    expect(res.headers["content-type"]).toBe("image/png");
    const decoded = Buffer.from(res.body, "base64");
    expect(decoded).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("application/octet-stream is base64-encoded", async () => {
    const res = await invoke(main, { path: "/binary/octet" });
    expectSuccess(res, 200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    const decoded = Buffer.from(res.body, "base64");
    expect(decoded).toEqual(Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]));
  });
});

describe("body action — request body is base64-decoded by the adapter", () => {
  it("POST with text body is decoded and reachable via c.req.text()", async () => {
    const res = await invoke(main, {
      method: "POST",
      path: "/echo-text",
      body: "hello from raw http",
      headers: { "content-type": "text/plain" },
    });
    expectSuccess(res, 200);
    expect(res.body).toBe("hello from raw http");
  });

  it("POST with JSON body is decoded and parsable via c.req.json()", async () => {
    const payload = { name: "Jane", roles: ["admin", "user"] };
    const res = await invoke(main, {
      method: "POST",
      path: "/echo-json",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    expectSuccess(res, 200);
    expect(JSON.parse(res.body)).toEqual({ received: payload });
  });
});
