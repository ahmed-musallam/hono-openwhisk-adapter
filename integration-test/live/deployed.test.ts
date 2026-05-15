import { describe, it, expect, beforeAll } from "vitest";
import {
  actionUrl,
  BASE_URL,
  call,
  NAMESPACE,
  PACKAGE_NAME,
  PARAMS_INPUTS_CONFIGURED,
} from "./env";

beforeAll(() => {
  // eslint-disable-next-line no-console
  console.log(
    [
      "",
      "Deployed integration tests",
      "  namespace:    " + NAMESPACE,
      "  package:      " + PACKAGE_NAME,
      "  base url:     " + BASE_URL,
      "  params test:  " + (PARAMS_INPUTS_CONFIGURED ? "success path" : "validation-failure path"),
      "",
    ].join("\n"),
  );
});

// =============================================================================
// status action — status code matrix
// =============================================================================

describe("deployed status action", () => {
  it("GET / → 200 'ok'", async () => {
    const res = await call(actionUrl("status", "/"));
    expect(res.status).toBe(200);
    expect((await res.text()).trim()).toBe("ok");
  });

  it("POST /created → 201 with JSON body", async () => {
    const res = await call(actionUrl("status", "/created"), { method: "POST" });
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ created: true });
  });

  it("GET /no-content → 204 with empty body", async () => {
    const res = await call(actionUrl("status", "/no-content"));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  // 3xx responses are NOT applicationError per our adapter; OpenWhisk surfaces
  // them as real HTTP redirects with the Location header.
  for (const [code, path, location] of [
    [301, "/permanent-redirect", "https://example.com/moved"],
    [302, "/redirect", "https://example.com/redirected"],
    [303, "/see-other", "https://example.com/other"],
    [307, "/temporary-redirect", "https://example.com/temp"],
    [308, "/permanent-redirect-308", "https://example.com/perm308"],
  ] as const) {
    it(`GET ${path} → ${code} with Location header`, async () => {
      const res = await call(actionUrl("status", path));
      expect(res.status).toBe(code);
      expect(res.headers.get("location")).toBe(location);
    });
  }

  it("GET /bad-request → 400 with JSON error body", async () => {
    const res = await call(actionUrl("status", "/bad-request"));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: "bad input" });
  });

  // CRITICAL: verifies the "headers must live INSIDE error" fix end-to-end.
  // If headers were placed outside `error` in the action response, OpenWhisk
  // would discard them and the WWW-Authenticate header below would be missing.
  it("GET /unauthorized → 401 + WWW-Authenticate header reaches the client", async () => {
    const res = await call(actionUrl("status", "/unauthorized"));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe('Bearer realm="api"');
    expect((await res.text()).trim()).toBe("Unauthorized");
  });

  it("GET /not-found → 404", async () => {
    const res = await call(actionUrl("status", "/not-found"));
    expect(res.status).toBe(404);
    expect((await res.text()).trim()).toBe("nope");
  });

  it("GET /unmatched-route → 404 from Hono fallback", async () => {
    const res = await call(actionUrl("status", "/this-route-does-not-exist"));
    expect(res.status).toBe(404);
  });

  it("GET /server-error → 500", async () => {
    const res = await call(actionUrl("status", "/server-error"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "boom" });
  });

  it("GET /service-unavailable → 503 + Retry-After header reaches the client", async () => {
    const res = await call(actionUrl("status", "/service-unavailable"));
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("30");
    expect((await res.text()).trim()).toBe("Try again later");
  });

  it("GET /throws → 500 from uncaught handler exception", async () => {
    const res = await call(actionUrl("status", "/throws"));
    expect(res.status).toBe(500);
    expect((await res.text()).trim()).toBe("Internal Server Error");
  });
});

// =============================================================================
// headers action — preservation across success / redirect / error
// =============================================================================

describe("deployed headers action", () => {
  it("GET /single → custom header preserved on success", async () => {
    const res = await call(actionUrl("headers", "/single"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-custom")).toBe("alpha");
    expect((await res.text()).trim()).toBe("single");
  });

  it("GET /multi → multiple custom headers preserved on success", async () => {
    const res = await call(actionUrl("headers", "/multi"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-one")).toBe("1");
    expect(res.headers.get("x-two")).toBe("2");
    expect(res.headers.get("x-three")).toBe("3");
  });

  it("GET /content-type → handler-specified content-type wins", async () => {
    const res = await call(actionUrl("headers", "/content-type"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/markdown/);
    expect((await res.text()).trim()).toBe("# hello");
  });

  it("GET /echo → request headers reach the action via __ow_headers", async () => {
    const res = await call(actionUrl("headers", "/echo"), {
      headers: { "x-incoming": "hello-from-client" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { received: Record<string, string> };
    expect(body.received["x-incoming"]).toBe("hello-from-client");
  });

  // CRITICAL: error-path headers come from inside `error` per the adapter; if
  // the contract regressed, these custom headers would not reach the client.
  it("GET /error-with-headers → 401 + custom headers reach the client", async () => {
    const res = await call(actionUrl("headers", "/error-with-headers"));
    expect(res.status).toBe(401);
    expect(res.headers.get("x-trace-id")).toBe("trace-123");
    expect(res.headers.get("www-authenticate")).toBe('Bearer realm="api"');
    expect(await res.json()).toEqual({ error: "denied" });
  });

  it("GET /redirect-with-headers → 302 + custom headers preserved alongside Location", async () => {
    const res = await call(actionUrl("headers", "/redirect-with-headers"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/dest");
    expect(res.headers.get("x-correlation-id")).toBe("corr-42");
  });
});

// =============================================================================
// body action — text vs binary, request body decoding
// =============================================================================

describe("deployed body action", () => {
  it("GET /text → text/plain body", async () => {
    const res = await call(actionUrl("body", "/text"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
    expect((await res.text()).trim()).toBe("plain text body");
  });

  it("GET /json → application/json body", async () => {
    const res = await call(actionUrl("body", "/json"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ hello: "world", n: 42 });
  });

  it("GET /html → text/html body", async () => {
    const res = await call(actionUrl("body", "/html"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect((await res.text()).trim()).toBe("<h1>hi</h1>");
  });

  // Adapter base64-encodes binary bodies; OpenWhisk decodes back to bytes
  // before sending to the client. The wire response must be the raw bytes.
  it("GET /binary/png → image/png with original byte content", async () => {
    const res = await call(actionUrl("body", "/binary/png"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("GET /binary/octet → application/octet-stream with original bytes", async () => {
    const res = await call(actionUrl("body", "/binary/octet"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes)).toEqual([0x00, 0x01, 0x02, 0xff, 0xfe]);
  });

  it("POST /echo-text → request body decoded and echoed", async () => {
    const payload = "hello from the live integration test";
    const res = await call(actionUrl("body", "/echo-text"), {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect((await res.text()).trim()).toBe(payload);
  });

  it("POST /echo-json → JSON body decoded and roundtripped", async () => {
    const payload = { name: "Jane", roles: ["admin", "user"] };
    const res = await call(actionUrl("body", "/echo-json"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: payload });
  });
});

// =============================================================================
// params action — Zod-validated inputs (success OR validation-failure path)
// =============================================================================

describe("deployed params action", () => {
  if (PARAMS_INPUTS_CONFIGURED) {
    it("GET /config → returns the inputs configured at deploy time", async () => {
      const res = await call(actionUrl("params", "/config"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        myInput: process.env.MY_INPUT_VAR,
        myOther: process.env.MY_OTHER_INPUT,
      });
    });

    it("GET /method → exposes __ow_method", async () => {
      const res = await call(actionUrl("params", "/method"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ method: "get" });
    });

    it("GET /path → exposes __ow_path", async () => {
      const res = await call(actionUrl("params", "/path"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ path: "/path" });
    });

    it("GET /query?a=1&b=two → exposes parsed query", async () => {
      const res = await call(actionUrl("params", "/query?a=1&b=two"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ q: { a: "1", b: "two" } });
    });
  } else {
    it("GET /config → 500 with generic validation-failure body (inputs not configured)", async () => {
      const res = await call(actionUrl("params", "/config"));
      expect(res.status).toBe(500);
      expect((await res.text()).trim()).toBe(
        "Internal Server Error: action params validation failed",
      );
    });
  }
});
