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
