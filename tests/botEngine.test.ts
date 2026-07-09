import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCatalog, localBotReply } from "../botEngine";

const CATALOG = `- Nike Air Max 90: $120.000 (Talles 39 al 44, Negro y Blanco. Envíos gratis).
- Adidas Forum Low: $115.000 (Talles 37 al 43, Blanco puro).
- Puma Suede: $90.000 (Talles 36 al 45, Azul y Negro).`;

const cfg = (over = {}) => ({ businessName: "Zapas", tone: "Argentino/Cercano", catalog: CATALOG, ...over });

test("parseCatalog extrae nombre, precio y atributos, y limpia viñetas", () => {
  const items = parseCatalog(CATALOG);
  assert.equal(items.length, 3);
  assert.equal(items[0].name, "Nike Air Max 90");
  assert.equal(items[0].price, 120000);
  assert.equal(items[0].priceText, "$120.000");
  assert.match(items[0].attributes, /Talles 39 al 44/);
});

test("parseCatalog descarta los marcadores {foto:...}", () => {
  const items = parseCatalog("- Remera Negra: $10.000 {foto:https://x.com/r.jpg}");
  assert.equal(items[0].name, "Remera Negra");
  assert.ok(!items[0].raw.includes("foto:"));
});

test("greeting usa el saludo custom en el primer turno", () => {
  const r = localBotReply("hola", [], cfg({ customGreeting: "¡Bienvenido a Zapas!" }));
  assert.equal(r.text, "¡Bienvenido a Zapas!");
});

test("consulta de precio devuelve el precio y registra el lead", () => {
  const r = localBotReply("cuánto sale la nike air max?", [], cfg());
  assert.match(r.text, /\$120\.000/);
  assert.ok(r.actions.some((a) => a.type === "upsert_lead"));
});

test("intención de compra mueve el lead a Presupuestado", () => {
  const r = localBotReply("quiero las forum low, me llamo Juan", [], cfg());
  assert.ok(r.actions.some((a) => a.type === "upsert_lead"));
  const status = r.actions.find((a) => a.type === "update_lead_status");
  assert.ok(status);
  assert.equal(status!.payload.estado, "Presupuestado");
  assert.equal(status!.payload.nombre, "Juan"); // nombre extraído del mensaje
});

test("pago genera un link con el monto del producto", () => {
  const r = localBotReply("quiero pagar la puma por transferencia", [], cfg());
  const pay = r.actions.find((a) => a.type === "payment_link");
  assert.ok(pay);
  assert.equal(pay!.payload.monto, 90000);
  assert.match(pay!.payload.link, /monto=90000/);
});

test("tema prohibido se rechaza sin filtrar catálogo", () => {
  const r = localBotReply("qué opinás de política?", [], cfg({ forbiddenTopics: "política" }));
  assert.match(r.text.toLowerCase(), /no es algo que pueda tratar|no.*tratar/);
  assert.equal(r.actions.length, 0);
});

test("un follow-up corto mantiene el contexto del último producto", () => {
  const history = [
    { role: "user", text: "tenés la adidas forum low?" },
    { role: "model", text: "¡Sí! Tenemos Adidas Forum Low." },
  ];
  const r = localBotReply("cuánto sale?", history, cfg());
  assert.match(r.text, /\$115\.000/);
});

test("sin catálogo el bot sigue respondiendo (no crashea)", () => {
  const r = localBotReply("hola", [], cfg({ catalog: "" }));
  assert.ok(r.text.length > 0);
});
