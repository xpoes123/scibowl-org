export type PacketTextFlavor = "plain" | "texlite";

export type RichTextPart =
  | { kind: "text"; content: string }
  | { kind: "math"; latex: string }
  | { kind: "bold"; content: string };

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

/**
 * Splits text into rich parts: plain text, inline math ($...$), and bold (\textbf{...}).
 * Math content is passed as-is to KaTeX. Text content has TeX-lite scripts converted.
 */
export function splitRichParts(rawText: string): RichTextPart[] {
  const parts: RichTextPart[] = [];
  let i = 0;
  let pendingText = "";

  function flushText() {
    if (!pendingText) return;
    const processed = renderTeXLiteScriptsToUnicode(pendingText);
    if (processed) parts.push({ kind: "text", content: processed });
    pendingText = "";
  }

  while (i < rawText.length) {
    // $...$ inline math — skip $$ (display math not supported)
    if (rawText[i] === "$" && rawText[i + 1] !== "$") {
      const start = i + 1;
      const end = rawText.indexOf("$", start);
      if (end !== -1) {
        flushText();
        const latex = rawText.slice(start, end);
        if (latex) parts.push({ kind: "math", latex });
        i = end + 1;
        continue;
      }
    }

    // \textbf{...}
    if (rawText.startsWith("\\textbf{", i)) {
      flushText();
      const contentStart = i + 8; // length of \textbf{ = 8
      let depth = 1;
      let j = contentStart;
      while (j < rawText.length && depth > 0) {
        if (rawText[j] === "{") depth++;
        else if (rawText[j] === "}") depth--;
        j++;
      }
      const content = rawText.slice(contentStart, j - 1);
      if (content) parts.push({ kind: "bold", content: renderTeXLiteScriptsToUnicode(content) });
      i = j;
      continue;
    }

    pendingText += rawText[i];
    i++;
  }

  flushText();
  return parts;
}

function renderTeXLiteScriptsToUnicode(text: string): string {
  if (!text.includes("_") && !text.includes("^")) return text;

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
    if (isScriptMarker) {
      if (next === "{") {
        // Brace-enclosed: _{...} or ^{...}
        const close = text.indexOf("}", i + 2);
        if (close !== -1) {
          const inner = text.slice(i + 2, close);
          out += ch === "_" ? toSubscript(inner) : toSuperscript(inner);
          i = close + 1;
          continue;
        }
      } else if (next !== undefined && next !== " " && next !== "\n" && next !== "\t") {
        // Bare single-char: 2^x or 2_x (outside of $...$ blocks)
        out += ch === "_" ? toSubscript(next) : toSuperscript(next);
        i += 2;
        continue;
      }
    }

    out += ch;
    i += 1;
  }
  return out;
}

