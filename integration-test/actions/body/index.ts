import { Hono } from "hono/quick";
import { ToOpenWhiskAction } from "hono-openwhisk-adapter";

const app = new Hono();

app.get("/text", (c) => c.text("plain text body"));

app.get("/json", (c) => c.json({ hello: "world", n: 42 }));

app.get("/html", (c) => c.html("<h1>hi</h1>"));

app.get("/empty", (c) => c.body(null, 200));

app.get("/binary/png", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new Response(png, {
    status: 200,
    headers: { "content-type": "image/png" },
  });
});

app.get("/binary/octet", () => {
  const bytes = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
  return new Response(bytes, {
    status: 200,
    headers: { "content-type": "application/octet-stream" },
  });
});

app.post("/echo-text", async (c) => {
  const text = await c.req.text();
  return c.text(text);
});

app.post("/echo-json", async (c) => {
  const json = await c.req.json<{ name?: string }>();
  return c.json({ received: json });
});

export const main = ToOpenWhiskAction(app);
