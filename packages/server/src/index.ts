import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { HexputClient } from "hexput";

const client = new HexputClient();
const app = new Hono();

(async () => {

  await client.connect();

  client.registerFunction("print", (...args) => {
    let stringArgs = args.filter((arg) => typeof arg === "string");
    console.log(...stringArgs);

    return null;
  });
})();

app.post('/execute', async (c) => {
  let code = await c.req.json().then((data) => data.code);

  if (typeof code !== "string") {
    return c.json({ ok: false, error: "Code must be a string" });
  }

  let result = await client.execute(code).catch((e) => {
    return { error: e.message };
  });

  if (typeof result == "object" && result && "error" in result) {
    return c.json({ ok: false, error: result.error });
  }
  
  return c.json({ result, ok: true });
});

serve({
  fetch: app.fetch,
  port: 4341
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
