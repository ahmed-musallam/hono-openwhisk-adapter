import { Hono } from "hono/quick";
import { z } from "zod";
import { ToOpenWhiskAction, zodOwParamsValidator, type OwEnv } from "hono-openwhisk-adapter";

const ParamsSchema = z.object({
  MY_INPUT_VAR: z.string().min(1),
  MY_OTHER_INPUT: z.string().min(1),
});

type Params = z.infer<typeof ParamsSchema>;

const app = new Hono<OwEnv<Params>>();

app.get("/config", (c) =>
  c.json({
    myInput: c.env.params.MY_INPUT_VAR,
    myOther: c.env.params.MY_OTHER_INPUT,
  }),
);

app.get("/method", (c) => c.json({ method: c.env.params.__ow_method }));

app.get("/path", (c) => c.json({ path: c.env.params.__ow_path }));

app.get("/query", (c) => c.json({ q: c.req.query() }));

app.get("/headers", (c) => c.json({ headers: c.env.params.__ow_headers ?? {} }));

export const main = ToOpenWhiskAction<Params>(app, zodOwParamsValidator(ParamsSchema));
