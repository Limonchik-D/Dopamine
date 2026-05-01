/**
 * Fuzzy name matching utilities for cross-API exercise identity.
 *
 * Strategy:
 *   1. Normalize both names (lowercase, strip punctuation, collapse spaces)
 *   2. Exact match → confidence 1.0
 *   3. One name contains the other → confidence 0.85
 *   4. Token overlap (Jaccard similarity) → confidence proportional to overlap
 *   5. Below threshold (0.5) → no match
 */

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")   // strip punctuation
    .replace(/\s+/g, " ")            // collapse spaces
    .trim();
}

function tokenize(name: string): Set<string> {
  const stopWords = new Set(["with", "and", "the", "a", "an", "of", "on", "in", "for", "to"]);
  return new Set(
    normalizeName(name)
      .split(" ")
      .filter((t) => t.length > 1 && !stopWords.has(t))
  );
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);

  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const ta = tokenize(a);
  const tb = tokenize(b);

  if (ta.size === 0 || tb.size === 0) return 0;

  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }

  // Jaccard
  const union = ta.size + tb.size - intersection;
  return intersection / union;
}

/** Find best match from a list of candidate names. Returns null if below threshold. */
export function bestMatch(
  needle: string,
  candidates: { id: string; name: string }[],
  threshold = 0.5
): { id: string; name: string; confidence: number } | null {
  let best: { id: string; name: string; confidence: number } | null = null;

  for (const c of candidates) {
    const score = nameSimilarity(needle, c.name);
    if (score >= threshold && (!best || score > best.confidence)) {
      best = { id: c.id, name: c.name, confidence: score };
    }
  }

  return best;
}
