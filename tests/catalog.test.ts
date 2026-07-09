import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeCatalog, catalogCleanupDelta } from "../src/lib/catalog";

test("sanitizeCatalog normaliza viñetas y descarta líneas vacías", () => {
  const out = sanitizeCatalog("* Remera: $10.000\n\n•  Buzo:   $20.000\n");
  assert.equal(out, "- Remera: $10.000\n- Buzo: $20.000");
});

test("sanitizeCatalog deduplica por nombre (sin distinguir mayúsculas/acentos)", () => {
  const out = sanitizeCatalog("- Remera Ática: $10.000\n- remera atica: $12.000\n- Buzo: $20.000");
  assert.equal(out, "- Remera Ática: $10.000\n- Buzo: $20.000"); // conserva la primera
});

test("sanitizeCatalog agrega viñeta a líneas sin prefijo", () => {
  assert.equal(sanitizeCatalog("Zapatillas: $50.000"), "- Zapatillas: $50.000");
});

test("sanitizeCatalog preserva marcadores {foto:...}", () => {
  const out = sanitizeCatalog("- Remera: $10.000 {foto:https://x.com/r.jpg}");
  assert.match(out, /\{foto:https:\/\/x\.com\/r\.jpg\}/);
});

test("catalogCleanupDelta cuenta las líneas que se limpiarían", () => {
  assert.equal(catalogCleanupDelta("- A: $1\n- a: $2\n\n- B: $3"), 1); // 1 duplicado
  assert.equal(catalogCleanupDelta("- A: $1\n- B: $2"), 0);
});
