import { Hono } from "hono/quick";
import { ToOpenWhiskAction } from "hono-openwhisk-adapter";

const app = new Hono<any>();

app.get("/", (c) => c.text("ok"));

app.post("/created", (c) => c.json({ created: true }, 201));

app.get("/no-content", (c) => c.body(null, 204));

app.get("/redirect", (c) => c.redirect("https://example.com/redirected", 302));

app.get("/permanent-redirect", (c) => c.redirect("https://example.com/moved", 301));

app.get("/see-other", (c) => c.redirect("https://example.com/other", 303));

app.get("/temporary-redirect", (c) => c.redirect("https://example.com/temp", 307));

app.get("/permanent-redirect-308", (c) => c.redirect("https://example.com/perm308", 308));

app.get("/bad-request", (c) => c.json({ error: "bad input" }, 400));

app.get("/unauthorized", (c) => {
  c.header("WWW-Authenticate", 'Bearer realm="api"');
  return c.text("Unauthorized", 401);
});

app.get("/not-found", (c) => c.text("nope", 404));

app.get("/server-error", (c) => c.json({ error: "boom" }, 500));

app.get("/service-unavailable", (c) => {
  c.header("Retry-After", "30");
  return c.text("Try again later", 503);
});

app.get("/throws", () => {
  throw new Error("intentional failure for integration test");
});

export const main = ToOpenWhiskAction(app);
