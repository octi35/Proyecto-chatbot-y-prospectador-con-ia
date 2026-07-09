import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Import the Express app WITHOUT letting it call app.listen / mount Vite.
process.env.RESPONDO_NO_LISTEN = "1";
process.env.WEBHOOK_VERIFY_TOKEN = "test-verify";

let server: Server;
let base: string;

before(async () => {
  const { app } = await import("../server");
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("GET /api/health responde ok con integraciones", async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.ok(body.integrations && typeof body.integrations.supabase === "boolean");
  assert.ok(["gemini", "openrouter", "local"].includes(body.botEngine));
});

test("GET /api/leads sin token → 401", async () => {
  const res = await fetch(`${base}/api/leads`);
  assert.equal(res.status, 401);
});

test("GET /api/team sin token → 401", async () => {
  const res = await fetch(`${base}/api/team`);
  assert.equal(res.status, 401);
});

test("POST /api/auth/login con body inválido → 400", async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test("webhook GET verify: token correcto devuelve el challenge", async () => {
  const res = await fetch(`${base}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=XYZ`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "XYZ");
});

test("webhook GET verify: token incorrecto → 403", async () => {
  const res = await fetch(`${base}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=XYZ`);
  assert.equal(res.status, 403);
});

test("cada respuesta trae un X-Request-Id", async () => {
  const res = await fetch(`${base}/api/health`);
  assert.ok(res.headers.get("x-request-id"));
});
