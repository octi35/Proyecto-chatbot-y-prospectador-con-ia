import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTranscript, extractJsonArray, extractJsonObject, isInside24hWindow } from "../serverHelpers";

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
