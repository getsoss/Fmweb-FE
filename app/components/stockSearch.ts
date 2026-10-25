export type LookupStock = { name: string; ticker: string };
type IndexedStock = { stock: LookupStock; name: string; length: number };

export function normalizeStockName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

export function indexStocks(stocks: LookupStock[]): IndexedStock[] {
  return stocks.map(stock => ({ stock, name: normalizeStockName(stock.name), length: Array.from(stock.name).length }));
}

export function suggestStocks(index: IndexedStock[], value: string, limit = 10): LookupStock[] {
  const query = normalizeStockName(value);
  if (!query) return [];
  // Compatibility consonants (ㅅ) normalize to leading jamo (ᄉ). Expand each
  // initial into its Hangul syllable range, including mixed text such as 삼성ㅈ.
  let hasInitial = false;
  const pattern = Array.from(query, character => {
    const initial = character.charCodeAt(0) - 0x1100;
    if (initial >= 0 && initial < 19) {
      hasInitial = true;
      const first = 0xac00 + initial * 588;
      return `[${String.fromCharCode(first)}-${String.fromCharCode(first + 587)}]`;
    }
    return character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  const includes = new RegExp(pattern);
  const startsWith = new RegExp(`^${pattern}`);
  const shortest: IndexedStock[] = [];
  const exact: LookupStock[] = [], prefix: LookupStock[] = [], rest: LookupStock[] = [];
  for (const item of index) {
    if (!includes.test(item.name)) continue;
    if (hasInitial) {
      // Select the shortest names before applying the display limit. Keep only
      // the best candidates and preserve response order for equal lengths.
      const position = shortest.findIndex(candidate => item.length < candidate.length);
      if (position >= 0) shortest.splice(position, 0, item);
      else if (shortest.length < limit) shortest.push(item);
      if (shortest.length > limit) shortest.pop();
      continue;
    }
    const matches = item.name === query ? exact : startsWith.test(item.name) ? prefix : rest;
    if (matches.length < limit) matches.push(item.stock);
  }
  return hasInitial ? shortest.map(item => item.stock) : [...exact, ...prefix, ...rest].slice(0, limit);
}
