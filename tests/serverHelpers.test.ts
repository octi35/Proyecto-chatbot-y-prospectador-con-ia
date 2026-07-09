import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { formatTranscript, extractJsonArray, extractJsonObject, isInside24hWindow, verifyMetaSignature, normalizePhone } from "../serverHelpers";

test("normalizePhone deja solo dígitos (formato Meta)", () => {
  assert.equal(normalizePhone("+54 9 11 1234-5678"), "5491112345678");
  assert.equal(normalizePhone("(011) 4567-8900"), "01145678900");
  assert.equal(normalizePhone(""), "");
  assert.equal(normalizePhone(undefined as any), "");
});

const sign = (body: string, secret: string) =>
  "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

test("verifyMetaSignature acepta una firma válida sobre el body crudo", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  assert.equal(verifyMetaSignature(body, sign(body, "s3cr3t"), "s3cr3t"), true);
});

test("verifyMetaSignature rechaza una firma inválida", () => {
  const body = '{"a":1}';
  assert.equal(verifyMetaSignature(body, sign(body, "otra-clave"), "s3cr3t"), false);
});

test("verifyMetaSignature rechaza si falta el header pero hay secret", () => {
  assert.equal(verifyMetaSignature("{}", undefined, "s3cr3t"), false);
});

test("verifyMetaSignature omite la verificación si no hay secret (dev)", () => {
  assert.equal(verifyMetaSignature("{}", undefined, ""), true);
});

test("verifyMetaSignature es sensible a cualquier cambio en el body", () => {
  const secret = "k";
  const sig = sign('{"monto":100}', secret);
  assert.equal(verifyMetaSignature('{"monto":999}', sig, secret), false);
});

test("formatTranscript etiqueta cliente y agente", () => {
  const out = formatTranscript([
    { role: "user", text: "Hola" },
    { role: "model", text: "¡Hola! ¿En qué te ayudo?" },
  ]);
  assert.equal(out, "Cliente: Hola\nAgente: ¡Hola! ¿En qué te ayudo?");
});

test("formatTranscript tolera historial vacío", () => {
  assert.equal(formatTranscript([]), "");
});

test("extractJsonArray parsea un array JSON embebido en texto", () => {
  const out = extractJsonArray('Acá van: ["una", "dos", "tres"] listo.');
  assert.deepEqual(out, ["una", "dos", "tres"]);
});

test("extractJsonArray cae a líneas cuando no hay JSON", () => {
  const out = extractJsonArray("- primera opción\n- segunda opción\n- tercera\n- cuarta");
  assert.equal(out.length, 3);
  assert.equal(out[0], "primera opción");
});

test("extractJsonObject parsea objeto embebido", () => {
  const out = extractJsonObject('resultado: { "name": "Promo", "template": "Hola {{nombre}}" } fin');
  assert.equal(out.name, "Promo");
  assert.equal(out.template, "Hola {{nombre}}");
});

test("extractJsonObject devuelve null si no hay objeto", () => {
  assert.equal(extractJsonObject("sin json acá"), null);
});

test("isInside24hWindow true si el cliente escribió hace 1 hora", () => {
  const now = Date.now();
  const hist = [{ role: "user", text: "hola", timestamp: new Date(now - 60 * 60 * 1000).toISOString() }];
  assert.equal(isInside24hWindow(hist, now), true);
});

test("isInside24hWindow false si el último mensaje del cliente tiene más de 24h", () => {
  const now = Date.now();
  const hist = [
    { role: "user", text: "hola", timestamp: new Date(now - 25 * 60 * 60 * 1000).toISOString() },
    { role: "model", text: "respuesta", timestamp: new Date(now - 1000).toISOString() }, // la respuesta nuestra NO abre ventana
  ];
  assert.equal(isInside24hWindow(hist, now), false);
});

test("isInside24hWindow false sin mensajes del cliente", () => {
  assert.equal(isInside24hWindow([], Date.now()), false);
  assert.equal(isInside24hWindow([{ role: "model", text: "hola", timestamp: new Date().toISOString() }], Date.now()), false);
});
