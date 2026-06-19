// Common country → dial code map. Lookup is case-insensitive and tolerates
// either ISO codes ("EG") or full names ("Egypt").
export const COUNTRY_DIAL_CODES: Record<string, string> = {
  EG: "+20", EGYPT: "+20",
  US: "+1", USA: "+1", "UNITED STATES": "+1",
  CA: "+1", CANADA: "+1",
  GB: "+44", UK: "+44", "UNITED KINGDOM": "+44",
  AE: "+971", "UNITED ARAB EMIRATES": "+971", UAE: "+971",
  SA: "+966", "SAUDI ARABIA": "+966",
  QA: "+974", QATAR: "+974",
  KW: "+965", KUWAIT: "+965",
  BH: "+973", BAHRAIN: "+973",
  OM: "+968", OMAN: "+968",
  JO: "+962", JORDAN: "+962",
  LB: "+961", LEBANON: "+961",
  TR: "+90", TURKEY: "+90",
  DE: "+49", GERMANY: "+49",
  FR: "+33", FRANCE: "+33",
  ES: "+34", SPAIN: "+34",
  IT: "+39", ITALY: "+39",
  NL: "+31", NETHERLANDS: "+31",
  BE: "+32", BELGIUM: "+32",
  CH: "+41", SWITZERLAND: "+41",
  SE: "+46", SWEDEN: "+46",
  NO: "+47", NORWAY: "+47",
  DK: "+45", DENMARK: "+45",
  FI: "+358", FINLAND: "+358",
  IE: "+353", IRELAND: "+353",
  PT: "+351", PORTUGAL: "+351",
  PL: "+48", POLAND: "+48",
  CZ: "+420", "CZECH REPUBLIC": "+420", CZECHIA: "+420",
  AT: "+43", AUSTRIA: "+43",
  GR: "+30", GREECE: "+30",
  RU: "+7", RUSSIA: "+7",
  UA: "+380", UKRAINE: "+380",
  CN: "+86", CHINA: "+86",
  JP: "+81", JAPAN: "+81",
  KR: "+82", "SOUTH KOREA": "+82",
  IN: "+91", INDIA: "+91",
  PK: "+92", PAKISTAN: "+92",
  BD: "+880", BANGLADESH: "+880",
  LK: "+94", "SRI LANKA": "+94",
  ID: "+62", INDONESIA: "+62",
  MY: "+60", MALAYSIA: "+60",
  SG: "+65", SINGAPORE: "+65",
  TH: "+66", THAILAND: "+66",
  VN: "+84", VIETNAM: "+84",
  PH: "+63", PHILIPPINES: "+63",
  AU: "+61", AUSTRALIA: "+61",
  NZ: "+64", "NEW ZEALAND": "+64",
  ZA: "+27", "SOUTH AFRICA": "+27",
  NG: "+234", NIGERIA: "+234",
  KE: "+254", KENYA: "+254",
  GH: "+233", GHANA: "+233",
  ET: "+251", ETHIOPIA: "+251",
  MA: "+212", MOROCCO: "+212",
  TN: "+216", TUNISIA: "+216",
  DZ: "+213", ALGERIA: "+213",
  LY: "+218", LIBYA: "+218",
  SD: "+249", SUDAN: "+249",
  BR: "+55", BRAZIL: "+55",
  MX: "+52", MEXICO: "+52",
  AR: "+54", ARGENTINA: "+54",
  CL: "+56", CHILE: "+56",
  CO: "+57", COLOMBIA: "+57",
  PE: "+51", PERU: "+51",
  IL: "+972", ISRAEL: "+972",
  IR: "+98", IRAN: "+98",
  IQ: "+964", IRAQ: "+964",
  SY: "+963", SYRIA: "+963",
  YE: "+967", YEMEN: "+967",
};

export const DIAL_CODE_OPTIONS = Array.from(
  new Map(
    Object.entries(COUNTRY_DIAL_CODES)
      .filter(([k]) => k.length > 2) // only the human-named ones
      .map(([name, code]) => [code, { code, label: `${code} (${titleCase(name)})` }]),
  ).values(),
).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function dialCodeForLocation(...candidates: (string | null | undefined)[]): string | null {
  for (const raw of candidates) {
    if (!raw) continue;
    const key = raw.trim().toUpperCase();
    if (COUNTRY_DIAL_CODES[key]) return COUNTRY_DIAL_CODES[key];
    // try last comma-separated token, e.g. "Cairo, Egypt"
    const parts = key.split(",").map((p) => p.trim()).filter(Boolean);
    for (const p of parts.reverse()) {
      if (COUNTRY_DIAL_CODES[p]) return COUNTRY_DIAL_CODES[p];
    }
  }
  return null;
}
