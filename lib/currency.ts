// Currency formatting utility
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
};

export const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  INR: "en-IN",
};

/**
 * Format a currency value with proper locale and symbol
 * @param value - The numeric value to format
 * @param currency - The currency code (USD, EUR, GBP, INR)
 * @returns Formatted currency string (e.g., "$1,250.50", "€1.250,50")
 */
export function formatCurrency(
  value: number,
  currency: string = "USD",
): string {
  const locale = CURRENCY_LOCALES[currency] || "en-US";
  const symbol = CURRENCY_SYMBOLS[currency] || "$";

  try {
    // Use toLocaleString for proper formatting per locale
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);

    return formatted;
  } catch {
    // Fallback if currency code is invalid
    return `${symbol}${value.toLocaleString()}`;
  }
}

/**
 * Format a simple number without currency symbol
 * @param value - The numeric value to format
 * @param currency - The currency code (for locale-specific formatting)
 * @returns Formatted number string
 */
export function formatNumber(value: number, currency: string = "USD"): string {
  const locale = CURRENCY_LOCALES[currency] || "en-US";

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toLocaleString();
  }
}
