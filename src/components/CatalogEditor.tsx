import React, { useState, useMemo } from "react";
import { Plus, Trash2, ShoppingBag, LayoutGrid, FileText, ImageIcon } from "lucide-react";

interface Product {
  name: string;
  price: string;       // kept as string so the user can type freely
  attributes: string;  // stock, sizes, colors, rules…
  photo: string;       // optional image URL
}

interface CatalogEditorProps {
  value: string;                       // raw catalog text (source of truth for the bot)
  onChange: (catalog: string) => void;
}

// Parse the catalog text into structured products.
function parse(text: string): Product[] {
  return (text || "")
    .split("\n")
    .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean)
    .map((raw) => {
      // Extract optional photo marker {foto:URL}
      let photo = "";
      const photoMatch = raw.match(/\{foto:([^}]+)\}/i);
      if (photoMatch) { photo = photoMatch[1].trim(); raw = raw.replace(photoMatch[0], "").trim(); }

      const colonIdx = raw.indexOf(":");
      const name = colonIdx > -1 ? raw.slice(0, colonIdx).trim() : raw.trim();
      const rest = colonIdx > -1 ? raw.slice(colonIdx + 1).trim() : "";

      const priceMatch = rest.match(/\$\s?[\d.]+/) || raw.match(/\$\s?[\d.]+/);
      const price = priceMatch ? priceMatch[0].replace(/\s/g, "").replace("$", "") : "";

      const parenMatch = rest.match(/\(([^)]+)\)/);
      const attributes = parenMatch ? parenMatch[1].trim() : rest.replace(priceMatch?.[0] || "", "").trim();

      return { name, price, attributes, photo };
    });
}

// Serialize products back into the catalog text the bot reads.
function serialize(products: Product[]): string {
  return products
    .filter((p) => p.name.trim())
    .map((p) => {
      let line = `- ${p.name.trim()}`;
      if (p.price.trim()) line += `: $${p.price.trim().replace(/^\$/, "")}`;
      if (p.attributes.trim()) line += ` (${p.attributes.trim()})`;
      if (p.photo.trim()) line += ` {foto:${p.photo.trim()}}`;
      return line;
    })
    .join("\n");
}

export default function CatalogEditor({ value, onChange }: CatalogEditorProps) {
  const [mode, setMode] = useState<"visual" | "text">("visual");
  const products = useMemo(() => parse(value), [value]);

  const update = (next: Product[]) => onChange(serialize(next));

  const setField = (i: number, field: keyof Product, v: string) => {
    const next = products.map((p, idx) => (idx === i ? { ...p, [field]: v } : p));
    update(next);
  };
  const addProduct = () => update([...products, { name: "", price: "", attributes: "", photo: "" }]);
  const removeProduct = (i: number) => update(products.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-medium text-[#6b7280] flex items-center">
          <ShoppingBag size={13} className="mr-1 text-[#4f6ef7]" /> Catálogo de Productos
        </label>
        {/* Visual / Text toggle */}
        <div className="flex bg-[#f3f4f8] p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setMode("visual")}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md flex items-center gap-1 transition-all cursor-pointer ${mode === "visual" ? "bg-white text-[#111111] ds-shadow" : "text-[#6b7280]"}`}
          >
            <LayoutGrid size={11} /> Visual
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md flex items-center gap-1 transition-all cursor-pointer ${mode === "text" ? "bg-white text-[#111111] ds-shadow" : "text-[#6b7280]"}`}
          >
            <FileText size={11} /> Texto
          </button>
        </div>
      </div>

      {mode === "text" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={7}
          className="w-full bg-[#f3f4f8] border border-transparent rounded-xl p-3 text-xs font-mono text-[#374151] focus:outline-none focus:border-[#4f6ef7] transition-colors resize-y leading-relaxed"
          placeholder="- Producto: $precio (talles, colores, stock). Una línea por producto."
        />
      ) : (
        <div className="space-y-2">
          {products.length === 0 && (
            <div className="text-center py-6 px-4 bg-[#f7f8fc]/70 border border-dashed border-[#e5e7eb] rounded-2xl">
              <ShoppingBag size={22} className="text-[#d1d5db] mx-auto mb-1.5" />
              <p className="text-[12px] text-[#6b7280]">Agregá tu primer producto para entrenar al bot</p>
            </div>
          )}

          {products.map((p, i) => (
            <div key={i} className="bg-white rounded-2xl p-3 ds-shadow flex gap-3">
              {/* Photo */}
              <div className="shrink-0">
                <div className="w-14 h-14 rounded-xl bg-[#f7f8fc] overflow-hidden flex items-center justify-center">
                  {p.photo ? (
                    <img src={p.photo} alt={p.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                  ) : (
                    <ImageIcon size={18} className="text-[#d1d5db]" />
                  )}
                </div>
              </div>
              {/* Fields */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => setField(i, "name", e.target.value)}
                    placeholder="Nombre del producto"
                    className="flex-1 bg-[#f7f8fc] rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[#111111] focus:outline-none focus:border-[#4f6ef7]"
                  />
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#9aa0ab]">$</span>
                    <input
                      type="text"
                      value={p.price}
                      onChange={(e) => setField(i, "price", e.target.value)}
                      placeholder="Precio"
                      className="w-full bg-[#f7f8fc] rounded-lg pl-5 pr-2 py-1.5 text-[12px] text-[#111111] focus:outline-none focus:border-[#4f6ef7]"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  value={p.attributes}
                  onChange={(e) => setField(i, "attributes", e.target.value)}
                  placeholder="Talles, colores, stock, envío…"
                  className="w-full bg-[#f7f8fc] rounded-lg px-2.5 py-1.5 text-[11px] text-[#6b7280] focus:outline-none focus:border-[#4f6ef7]"
                />
                <input
                  type="url"
                  value={p.photo}
                  onChange={(e) => setField(i, "photo", e.target.value)}
                  placeholder="URL de la foto (opcional)"
                  className="w-full bg-[#f7f8fc] rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-[#6b7280] focus:outline-none focus:border-[#4f6ef7]"
                />
              </div>
              <button
                type="button"
                onClick={() => removeProduct(i)}
                className="p-1.5 text-[#d1d5db] hover:text-[#e26562] transition-colors cursor-pointer shrink-0 self-start"
                title="Eliminar producto"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addProduct}
            className="w-full py-2.5 border border-dashed border-[#e5e7eb] rounded-xl text-[12px] font-semibold text-[#4f6ef7] hover:bg-[#f3f5fe]/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus size={14} /> Agregar producto
          </button>
        </div>
      )}
      <p className="text-[10px] text-[#9aa0ab]">Es el núcleo de respuestas del bot. Cuantos más datos, mejor vende.</p>
    </div>
  );
}
