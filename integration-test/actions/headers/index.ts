import { Hono } from "hono/quick";
import { ToOpenWhiskAction, type OwEnv } from "hono-openwhisk-adapter";

const app = new Hono<OwEnv>();

app.get("/single", (c) => {
  c.header("x-custom", "alpha");
  return c.text("single");
});

app.get("/multi", (c) => {
  c.header("x-one", "1");
  c.header("x-two", "2");
  c.header("x-three", "3");
  return c.text("multi");
});

app.get("/content-type", (c) => {
  c.header("content-type", "text/markdown; charset=utf-8");
  return c.body("# hello");
});

app.get("/echo", (c) => {
  const incoming = c.env.params.__ow_headers ?? {};
  return c.json({ received: incoming });
});

app.get("/cors", (c) => {
  c.header("access-control-allow-origin", "*");
  c.header("access-control-allow-methods", "GET, POST, OPTIONS");
  return c.json({ cors: true });
});

// Headers MUST be preserved on the error path; OpenWhisk projects only the
// `error` field, so the adapter has to put them inside it.
app.get("/error-with-headers", (c) => {
  c.header("x-trace-id", "trace-123");
  c.header("WWW-Authenticate", 'Bearer realm="api"');
  return c.json({ error: "denied" }, 401);
});

app.get("/redirect-with-headers", (c) => {
  c.header("x-correlation-id", "corr-42");
  return c.redirect("https://example.com/dest", 302);
});

export const main = ToOpenWhiskAction(app);
