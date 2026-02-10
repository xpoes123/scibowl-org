export type PacketTextFlavor = "plain" | "texlite";

export type RenderPacketTextOptions = {
  flavor?: PacketTextFlavor;
};

/**
 * Minimal packet text renderer.
 *
 * Today it only supports a TeX-lite subset used in existing packets:
 * - `_{...}` subscripts
 * - `^{...}` superscripts
 *
 * The intent is to keep formatting logic isolated so it can be swapped out
 * later (e.g., for full LaTeX rendering).
 */
export function renderPacketText(text: string, opts?: RenderPacketTextOptions): string {
  const flavor: PacketTextFlavor = opts?.flavor ?? "texlite";
  if (flavor === "plain") return text;
  return renderTeXLiteScriptsToUnicode(text);
}

const SUBSCRIPT_MAP: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  s: "ₛ",
  t: "ₜ",
  x: "ₓ",
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  i: "ⁱ",
  n: "ⁿ",
  x: "ˣ",
  y: "ʸ",
};

function toSubscript(text: string): string {
  let out = "";
  for (const ch of text) {
    out += SUBSCRIPT_MAP[ch] ?? SUBSCRIPT_MAP[ch.toLowerCase()] ?? ch;
  }
  return out;
}

function toSuperscript(text: string): string {
  let out = "";
  for (const ch of text) {
    out += SUPERSCRIPT_MAP[ch] ?? SUPERSCRIPT_MAP[ch.toLowerCase()] ?? ch;
  }
  return out;
}

function renderTeXLiteScriptsToUnicode(text: string): string {
  if (!text.includes("_{") && !text.includes("^{")) return text;

  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    // Keep simple escapes intact (e.g. \_ or \^).
    if (ch === "\\" && next) {
      out += next;
      i += 2;
      continue;
    }

    const isScriptMarker = ch === "_" || ch === "^";
    if (isScriptMarker && next === "{") {
      const close = text.indexOf("}", i + 2);
      if (close !== -1) {
        const inner = text.slice(i + 2, close);
        out += ch === "_" ? toSubscript(inner) : toSuperscript(inner);
        i = close + 1;
        continue;
      }
    }

    out += ch;
    i += 1;
  }
  return out;
}

