// Map country names (matching src/lib/countries.ts) to ISO 3166-1 alpha-2 codes.
const NAME_TO_ISO2: Record<string, string> = {
  Afghanistan: "AF", Albania: "AL", Algeria: "DZ", Andorra: "AD", Angola: "AO",
  Argentina: "AR", Armenia: "AM", Australia: "AU", Austria: "AT", Azerbaijan: "AZ",
  Bahamas: "BS", Bahrain: "BH", Bangladesh: "BD", Barbados: "BB", Belarus: "BY",
  Belgium: "BE", Belize: "BZ", Benin: "BJ", Bhutan: "BT", Bolivia: "BO",
  "Bosnia and Herzegovina": "BA", Botswana: "BW", Brazil: "BR", Brunei: "BN", Bulgaria: "BG",
  "Burkina Faso": "BF", Burundi: "BI", Cambodia: "KH", Cameroon: "CM", Canada: "CA",
  "Cape Verde": "CV", "Central African Republic": "CF", Chad: "TD", Chile: "CL", China: "CN",
  Colombia: "CO", Comoros: "KM", Congo: "CG", "Costa Rica": "CR", Croatia: "HR",
  Cuba: "CU", Cyprus: "CY", "Czech Republic": "CZ", Denmark: "DK", Djibouti: "DJ",
  Dominica: "DM", "Dominican Republic": "DO", Ecuador: "EC", Egypt: "EG", "El Salvador": "SV",
  "Equatorial Guinea": "GQ", Eritrea: "ER", Estonia: "EE", Eswatini: "SZ", Ethiopia: "ET",
  Fiji: "FJ", Finland: "FI", France: "FR", Gabon: "GA", Gambia: "GM",
  Georgia: "GE", Germany: "DE", Ghana: "GH", Greece: "GR", Guatemala: "GT",
  Guinea: "GN", Guyana: "GY", Haiti: "HT", Honduras: "HN", Hungary: "HU",
  Iceland: "IS", India: "IN", Indonesia: "ID", Iran: "IR", Iraq: "IQ",
  Ireland: "IE", Israel: "IL", Italy: "IT", Jamaica: "JM", Japan: "JP",
  Jordan: "JO", Kazakhstan: "KZ", Kenya: "KE", Kuwait: "KW", Kyrgyzstan: "KG",
  Laos: "LA", Latvia: "LV", Lebanon: "LB", Lesotho: "LS", Liberia: "LR",
  Libya: "LY", Lithuania: "LT", Luxembourg: "LU", Madagascar: "MG", Malawi: "MW",
  Malaysia: "MY", Maldives: "MV", Mali: "ML", Malta: "MT", Mauritania: "MR",
  Mauritius: "MU", Mexico: "MX", Moldova: "MD", Monaco: "MC", Mongolia: "MN",
  Montenegro: "ME", Morocco: "MA", Mozambique: "MZ", Myanmar: "MM", Namibia: "NA",
  Nepal: "NP", Netherlands: "NL", "New Zealand": "NZ", Nicaragua: "NI", Niger: "NE",
  Nigeria: "NG", "North Korea": "KP", "North Macedonia": "MK", Norway: "NO", Oman: "OM",
  Pakistan: "PK", Panama: "PA", "Papua New Guinea": "PG", Paraguay: "PY", Peru: "PE",
  Philippines: "PH", Poland: "PL", Portugal: "PT", Qatar: "QA", Romania: "RO",
  Russia: "RU", Rwanda: "RW", "Saudi Arabia": "SA", Senegal: "SN", Serbia: "RS",
  Seychelles: "SC", "Sierra Leone": "SL", Singapore: "SG", Slovakia: "SK", Slovenia: "SI",
  Somalia: "SO", "South Africa": "ZA", "South Korea": "KR", "South Sudan": "SS", Spain: "ES",
  "Sri Lanka": "LK", Sudan: "SD", Suriname: "SR", Sweden: "SE", Switzerland: "CH",
  Syria: "SY", Taiwan: "TW", Tajikistan: "TJ", Tanzania: "TZ", Thailand: "TH",
  "Timor-Leste": "TL", Togo: "TG", "Trinidad and Tobago": "TT", Tunisia: "TN", Turkey: "TR",
  Turkmenistan: "TM", Uganda: "UG", Ukraine: "UA", "United Arab Emirates": "AE",
  "United Kingdom": "GB", "United States": "US", Uruguay: "UY", Uzbekistan: "UZ",
  Venezuela: "VE", Vietnam: "VN", Yemen: "YE", Zambia: "ZM", Zimbabwe: "ZW",
};

export function countryFlag(name: string | null | undefined): string {
  if (!name) return "🏳️";
  const iso = NAME_TO_ISO2[name.trim()];
  if (!iso) return "🏳️";
  return String.fromCodePoint(...iso.toUpperCase().split("").map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
