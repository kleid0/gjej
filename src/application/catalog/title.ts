// Clean a product family for DISPLAY.
//
//   "Celular Samsung Galaxy A26 128GB 6GB RAM bardhë"
//        → "Samsung Galaxy A26 128GB 6GB RAM"
//
// Colour is a variant, not the product's identity, so it doesn't belong in the
// title; store-category prefixes ("Celular", "Multistyler flokësh") are noise
// too. Specs (128GB, 6GB RAM) are kept. This is DISPLAY-ONLY — it never mutates
// stored data, so it can't corrupt matching/fusion keys and it applies to every
// product (old and new) the moment it renders.

// Leading store-category words some stores prepend.
const LEADING_STORE_PREFIX =
  /^(?:celular|telefon(?:i)?|televizor|laptop|notebook|konsol[ae]?|console|smartphone|tablet|monitor|multi-?st(?:y|aj)ler|stilues)\b[\s,]*(?:flok[eë]sh\b[\s,]*)?/i;

// Colour words (English + Albanian), multi-word first. Boundaries use lookahead
// (not \b) so a trailing "ë" doesn't break the match — JS \b is ASCII-only.
const COLOUR_RE = new RegExp(
  "(?:^|[\\s,(/])(?:" +
    // multi-word / named
    "mist\\s+blue|deep\\s+blue|sky\\s+blue|icy\\s+blue|storm\\s+blue|light\\s+blue|" +
    "space\\s+gr[ae]y|space\\s+black|phantom\\s+black|cosmic\\s+orange|cobalt\\s+violet|" +
    "rose\\s+gold|(?:natural|black|white|desert|blue|gray|grey|silver)\\s+titanium|" +
    // Samsung "Titanium <colour>". Only real colour words — never \w+, which
    // would swallow a model number ("Titanium TK101") or the brand "Titanium".
    "titanium\\s+(?:gray|grey|black|violet|yellow|blue|orange|green|silver|white|red|gold)|" +
    // single word (English)
    "black|white|silver|blue|green|purple|violet|red|yellow|gold|pink|rose|gr[ae]y|orange|" +
    "graphite|midnight|onyx|navy|teal|mint|sage|lavender|lila|starlight|moonstone|" +
    // Albanian
    "e\\s+zez[eë]|i\\s+zi|zez[eë]|e\\s+bardh[eë]|i\\s+bardh[eë]|bardh[eë]|" +
    "e\\s+kuqe|kuqe|e\\s+verdh[eë]|verdh[eë]|e\\s+gjelb[eë]r|gjelb[eë]r|" +
    "vjollc[eë]|roz[eë]|argjend[ti]?[eë]?|gri" +
    ")(?=[\\s,)/]|$)",
  "gi",
);

export function cleanTitle(family: string): string {
  if (!family) return family;
  let s = family.replace(LEADING_STORE_PREFIX, "");
  // Remove colour words wherever they appear; run twice to catch adjacent ones.
  s = s.replace(COLOUR_RE, " ").replace(COLOUR_RE, " ");
  s = s
    .replace(/\(\s*\)/g, " ")           // empty parens left by a removed colour
    .replace(/\s{2,}/g, " ")            // collapse whitespace
    .replace(/\s+([,)\/])/g, "$1")      // no space before punctuation
    .replace(/[\s,\-–—/]+$/g, "")       // trailing separators
    .replace(/^[\s,\-–—/]+/g, "")       // leading separators
    .trim();
  // Never return empty, and never return something with no letters left — e.g.
  // "Monitor 27" mustn't collapse to "27". Degenerate results fall back to the
  // original so a badly-named source product is shown verbatim rather than gutted.
  if (!s || !/[a-z]/i.test(s)) return family;
  return s;
}
