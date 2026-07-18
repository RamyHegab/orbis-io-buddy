export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", AED: "AED ", INR: "₹", CNY: "¥", JPY: "¥",
  AUD: "A$", CAD: "C$", NZD: "NZ$", SGD: "S$", HKD: "HK$", CHF: "CHF ",
  SAR: "SAR ", QAR: "QAR ", TRY: "₺", ZAR: "R", THB: "฿", VND: "₫",
  IDR: "Rp", MYR: "RM", PHP: "₱", KRW: "₩", BRL: "R$", MXN: "MX$",
  EGP: "E£", NGN: "₦", KES: "KSh",
};

export function currencySymbol(code?: string | null): string {
  const c = (code || "GBP").toUpperCase();
  return CURRENCY_SYMBOLS[c] ?? `${c} `;
}

export function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  const n = Number(amount);
  const code = (currency || "GBP").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currencySymbol(code)}${n.toFixed(2)}`;
  }
}

export const CURRENCY_OPTIONS = [
  "GBP", "USD", "EUR", "AED", "AUD", "CAD", "CHF", "CNY", "INR", "JPY",
  "SGD", "SAR", "HKD", "NZD", "QAR", "TRY", "ZAR", "THB", "VND", "IDR",
  "MYR", "PHP", "KRW", "BRL", "MXN", "EGP", "NGN", "KES",
];
