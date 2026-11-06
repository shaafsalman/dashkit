export const compactNumber = (value, { maximumFractionDigits = 1 } = {}) => {
  const number = Number(value || 0);
  const absolute = Math.abs(number);
  const sign = number < 0 ? "−" : "";
  const trim = (result) => result.replace(/\.0$/, "");

  if (absolute >= 1e9) return `${sign}${trim((absolute / 1e9).toFixed(maximumFractionDigits))}B`;
  if (absolute >= 1e6) return `${sign}${trim((absolute / 1e6).toFixed(maximumFractionDigits))}M`;
  if (absolute >= 1e3) return `${sign}${trim((absolute / 1e3).toFixed(maximumFractionDigits))}K`;
  return `${sign}${trim(absolute.toFixed(Number.isInteger(absolute) ? 0 : maximumFractionDigits))}`;
};

export const compactCurrency = (value, currency = "$") =>
  `${currency}${compactNumber(value)}`;

/**
 * Pick which category-axis ticks to draw so labels never overlap.
 * Uses the smallest regular step that fits, starting at the first label. The
 * last label is kept only when it lands on that rhythm — forcing it in made
 * uneven gaps (…Sep, Dec) that read as a misaligned axis.
 *  count     number of categories
 *  pitch     distance between neighbouring categories (same unit as fontSize)
 *  labels    array of label strings (width is estimated from the longest)
 *  fontSize  label font size
 * Returns a Set of indices to render.
 */
export const thinTickIndices = (count, pitch, labels = [], fontSize = 11, gap = 8) => {
  const out = new Set();
  if (count <= 0) return out;
  const longest = labels.reduce((m, l) => Math.max(m, String(l ?? "").length), 1);
  const need = longest * fontSize * 0.6 + gap; // centre-to-centre spacing needed
  const safePitch = Math.max(pitch, 0.0001);
  for (let step = 1; step <= count; step++) {
    if (step * safePitch < need && step < count) continue;
    for (let i = 0; i < count; i += step) out.add(i);
    return out;
  }
  out.add(0);
  out.add(count - 1);
  return out;
};
