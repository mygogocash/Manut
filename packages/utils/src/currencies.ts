// ISO 4217 active currency codes. Source: ISO 4217:2015 amendment 175
// (Jan 2026). Excludes funds (e.g. XBA), precious-metal codes (XAU/XAG),
// and the supranational testing codes (XTS / XXX) since those have no
// business meaning for a travel-budget field.
//
// Names are the English short names from the same standard. Keep this
// list alphabetised by code so the dropdown is scannable.

export interface CurrencyOption {
  /** ISO 4217 alpha code (USD, EUR, …). */
  code: string;
  /** English short name as published by ISO. */
  name: string;
  /** Common UI symbol where one exists. Optional. */
  symbol?: string;
}

export const ISO_CURRENCIES: readonly CurrencyOption[] = [
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "AFN", name: "Afghani", symbol: "؋" },
  { code: "ALL", name: "Lek", symbol: "L" },
  { code: "AMD", name: "Armenian Dram", symbol: "֏" },
  { code: "ANG", name: "Netherlands Antillean Guilder", symbol: "ƒ" },
  { code: "AOA", name: "Kwanza", symbol: "Kz" },
  { code: "ARS", name: "Argentine Peso", symbol: "$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "AWG", name: "Aruban Florin", symbol: "ƒ" },
  { code: "AZN", name: "Azerbaijan Manat", symbol: "₼" },
  { code: "BAM", name: "Convertible Mark", symbol: "KM" },
  { code: "BBD", name: "Barbados Dollar", symbol: "$" },
  { code: "BDT", name: "Taka", symbol: "৳" },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв" },
  { code: "BHD", name: "Bahraini Dinar", symbol: ".د.ب" },
  { code: "BIF", name: "Burundi Franc", symbol: "FBu" },
  { code: "BMD", name: "Bermudian Dollar", symbol: "$" },
  { code: "BND", name: "Brunei Dollar", symbol: "$" },
  { code: "BOB", name: "Boliviano", symbol: "Bs." },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "BSD", name: "Bahamian Dollar", symbol: "$" },
  { code: "BTN", name: "Ngultrum", symbol: "Nu." },
  { code: "BWP", name: "Pula", symbol: "P" },
  { code: "BYN", name: "Belarusian Ruble", symbol: "Br" },
  { code: "BZD", name: "Belize Dollar", symbol: "BZ$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CDF", name: "Congolese Franc", symbol: "FC" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CLP", name: "Chilean Peso", symbol: "$" },
  { code: "CNY", name: "Yuan Renminbi", symbol: "¥" },
  { code: "COP", name: "Colombian Peso", symbol: "$" },
  { code: "CRC", name: "Costa Rican Colon", symbol: "₡" },
  { code: "CUP", name: "Cuban Peso", symbol: "$" },
  { code: "CVE", name: "Cabo Verde Escudo", symbol: "$" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "DJF", name: "Djibouti Franc", symbol: "Fdj" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "DOP", name: "Dominican Peso", symbol: "RD$" },
  { code: "DZD", name: "Algerian Dinar", symbol: "د.ج" },
  { code: "EGP", name: "Egyptian Pound", symbol: "£" },
  { code: "ERN", name: "Nakfa", symbol: "Nfk" },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "FJD", name: "Fiji Dollar", symbol: "$" },
  { code: "FKP", name: "Falkland Islands Pound", symbol: "£" },
  { code: "GBP", name: "Pound Sterling", symbol: "£" },
  { code: "GEL", name: "Lari", symbol: "₾" },
  { code: "GHS", name: "Ghana Cedi", symbol: "₵" },
  { code: "GIP", name: "Gibraltar Pound", symbol: "£" },
  { code: "GMD", name: "Dalasi", symbol: "D" },
  { code: "GNF", name: "Guinean Franc", symbol: "FG" },
  { code: "GTQ", name: "Quetzal", symbol: "Q" },
  { code: "GYD", name: "Guyana Dollar", symbol: "$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "HNL", name: "Lempira", symbol: "L" },
  { code: "HTG", name: "Gourde", symbol: "G" },
  { code: "HUF", name: "Forint", symbol: "Ft" },
  { code: "IDR", name: "Rupiah", symbol: "Rp" },
  { code: "ILS", name: "New Israeli Sheqel", symbol: "₪" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "IQD", name: "Iraqi Dinar", symbol: "ع.د" },
  { code: "IRR", name: "Iranian Rial", symbol: "﷼" },
  { code: "ISK", name: "Iceland Krona", symbol: "kr" },
  { code: "JMD", name: "Jamaican Dollar", symbol: "J$" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.ا" },
  { code: "JPY", name: "Yen", symbol: "¥" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "KGS", name: "Som", symbol: "с" },
  { code: "KHR", name: "Riel", symbol: "៛" },
  { code: "KMF", name: "Comorian Franc", symbol: "CF" },
  { code: "KPW", name: "North Korean Won", symbol: "₩" },
  { code: "KRW", name: "Won", symbol: "₩" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك" },
  { code: "KYD", name: "Cayman Islands Dollar", symbol: "$" },
  { code: "KZT", name: "Tenge", symbol: "₸" },
  { code: "LAK", name: "Lao Kip", symbol: "₭" },
  { code: "LBP", name: "Lebanese Pound", symbol: "ل.ل" },
  { code: "LKR", name: "Sri Lanka Rupee", symbol: "Rs" },
  { code: "LRD", name: "Liberian Dollar", symbol: "$" },
  { code: "LSL", name: "Loti", symbol: "L" },
  { code: "LYD", name: "Libyan Dinar", symbol: "ل.د" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "د.م." },
  { code: "MDL", name: "Moldovan Leu", symbol: "L" },
  { code: "MGA", name: "Malagasy Ariary", symbol: "Ar" },
  { code: "MKD", name: "Denar", symbol: "ден" },
  { code: "MMK", name: "Kyat", symbol: "K" },
  { code: "MNT", name: "Tugrik", symbol: "₮" },
  { code: "MOP", name: "Pataca", symbol: "MOP$" },
  { code: "MRU", name: "Ouguiya", symbol: "UM" },
  { code: "MUR", name: "Mauritius Rupee", symbol: "₨" },
  { code: "MVR", name: "Rufiyaa", symbol: "Rf" },
  { code: "MWK", name: "Malawi Kwacha", symbol: "MK" },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "MZN", name: "Mozambique Metical", symbol: "MT" },
  { code: "NAD", name: "Namibia Dollar", symbol: "$" },
  { code: "NGN", name: "Naira", symbol: "₦" },
  { code: "NIO", name: "Cordoba Oro", symbol: "C$" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "NPR", name: "Nepalese Rupee", symbol: "₨" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "OMR", name: "Rial Omani", symbol: "ر.ع." },
  { code: "PAB", name: "Balboa", symbol: "B/." },
  { code: "PEN", name: "Sol", symbol: "S/" },
  { code: "PGK", name: "Kina", symbol: "K" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "PKR", name: "Pakistan Rupee", symbol: "₨" },
  { code: "PLN", name: "Zloty", symbol: "zł" },
  { code: "PYG", name: "Guarani", symbol: "₲" },
  { code: "QAR", name: "Qatari Rial", symbol: "ر.ق" },
  { code: "RON", name: "Romanian Leu", symbol: "lei" },
  { code: "RSD", name: "Serbian Dinar", symbol: "дин" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽" },
  { code: "RWF", name: "Rwanda Franc", symbol: "FRw" },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س" },
  { code: "SBD", name: "Solomon Islands Dollar", symbol: "$" },
  { code: "SCR", name: "Seychelles Rupee", symbol: "₨" },
  { code: "SDG", name: "Sudanese Pound", symbol: "ج.س." },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "SHP", name: "Saint Helena Pound", symbol: "£" },
  { code: "SLE", name: "Leone", symbol: "Le" },
  { code: "SOS", name: "Somali Shilling", symbol: "S" },
  { code: "SRD", name: "Surinam Dollar", symbol: "$" },
  { code: "SSP", name: "South Sudanese Pound", symbol: "£" },
  { code: "STN", name: "Dobra", symbol: "Db" },
  { code: "SVC", name: "El Salvador Colon", symbol: "₡" },
  { code: "SYP", name: "Syrian Pound", symbol: "£" },
  { code: "SZL", name: "Lilangeni", symbol: "L" },
  { code: "THB", name: "Baht", symbol: "฿" },
  { code: "TJS", name: "Somoni", symbol: "ЅМ" },
  { code: "TMT", name: "Turkmenistan New Manat", symbol: "m" },
  { code: "TND", name: "Tunisian Dinar", symbol: "د.ت" },
  { code: "TOP", name: "Pa’anga", symbol: "T$" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "TTD", name: "Trinidad and Tobago Dollar", symbol: "TT$" },
  { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
  { code: "UAH", name: "Hryvnia", symbol: "₴" },
  { code: "UGX", name: "Uganda Shilling", symbol: "USh" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "UYU", name: "Peso Uruguayo", symbol: "$U" },
  { code: "UZS", name: "Uzbekistan Sum", symbol: "soʻm" },
  { code: "VES", name: "Bolívar Soberano", symbol: "Bs.S" },
  { code: "VND", name: "Dong", symbol: "₫" },
  { code: "VUV", name: "Vatu", symbol: "VT" },
  { code: "WST", name: "Tala", symbol: "WS$" },
  { code: "XAF", name: "CFA Franc BEAC", symbol: "FCFA" },
  { code: "XCD", name: "East Caribbean Dollar", symbol: "$" },
  { code: "XOF", name: "CFA Franc BCEAO", symbol: "CFA" },
  { code: "XPF", name: "CFP Franc", symbol: "₣" },
  { code: "YER", name: "Yemeni Rial", symbol: "﷼" },
  { code: "ZAR", name: "Rand", symbol: "R" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK" },
  { code: "ZWG", name: "Zimbabwe Gold", symbol: "ZiG" },
];

export const ISO_CURRENCY_CODES = ISO_CURRENCIES.map((c) => c.code);

const CURRENCY_CODE_SET = new Set(ISO_CURRENCY_CODES);

export function isIsoCurrencyCode(value: string): boolean {
  return CURRENCY_CODE_SET.has(value);
}

/**
 * Currencies the FX sync pulls a THB rate for by default.
 *
 * Shared rather than declared in the API, because two things need to agree:
 * the job that fetches rates, and any picker that offers a currency to file
 * an expense in. They did not agree — the My Portal claim form offered a
 * hardcoded AED/USD/EUR/GBP and defaulted to AED, which had no rate at all,
 * so a claim left on the default could never be converted and surfaced later
 * as a missing-rate line on the report.
 *
 * AED is included deliberately: the form has been defaulting to it, so real
 * AED rows already exist and need a rate to convert.
 *
 * THB is absent because it is the base — a THB line needs no conversion.
 *
 * Caveat: the API's `BOT_FX_CURRENCIES` env var can override this at runtime,
 * and a picker built from this constant would not know. That is tolerable —
 * the list is a convenience and the API accepts any currency string — but if
 * that variable ever gets set, this is the thing that goes stale.
 */
/**
 * Non-ISO currency strings people actually type, mapped to the ISO code that
 * prices them.
 *
 * Expense lines hold whatever was entered, and no rate provider can quote a
 * string that is not an ISO code — so a line filed as "RMB" or "₹" stayed
 * unconvertible and dropped out of the report total, which is how a THB total
 * ends up quietly excluding real spend.
 *
 * Only unambiguous mappings belong here. A wrong guess does not fail loudly; it
 * prices money at the wrong rate.
 */
const WRITTEN_CURRENCY_ALIASES: Readonly<Record<string, string>> = {
  // Renminbi is the currency, yuan the unit. "RMB" is what people write and is
  // not an ISO code; CNY is.
  RMB: "CNY",
  // Offshore yuan quotes under CNH but is the same currency onshore CNY prices.
  CNH: "CNY",
};

/**
 * Symbol → ISO code, but ONLY for symbols that identify exactly one currency.
 *
 * Derived from the table above rather than hand-written, so it cannot drift from
 * it. The exclusions are the point:
 *  - "¥" is BOTH CNY and JPY. Guessing would misprice by roughly twenty times.
 *  - "$" is nineteen currencies, "£" seven, "₩" two.
 *  - "Rs" is ISO's symbol for LKR, NOT INR — the obvious guess is the wrong one.
 * Those stay unresolved and keep showing as a missing rate, which is honest.
 * "₹", "€" and "฿" are unique, so they resolve.
 */
const SYMBOL_TO_CURRENCY_CODE: Readonly<Record<string, string>> = (() => {
  const bySymbol = new Map<string, string[]>();
  for (const c of ISO_CURRENCIES) {
    if (!c.symbol) continue;
    const codes = bySymbol.get(c.symbol) ?? [];
    codes.push(c.code);
    bySymbol.set(c.symbol, codes);
  }
  const out: Record<string, string> = {};
  for (const [symbol, codes] of bySymbol) {
    if (codes.length === 1 && codes[0]) out[symbol] = codes[0];
  }
  return out;
})();

/**
 * The ISO code a stored currency value should be priced as.
 *
 * Returns the input's trimmed upper-case form when nothing maps it, so an
 * unknown value stays visible as itself in a missing-rate warning rather than
 * being silently coerced into something wrong.
 */
export function normaliseCurrencyCode(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";
  // Symbols are matched before upper-casing: some are non-alphabetic, and
  // upper-casing them is meaningless.
  const bySymbol = SYMBOL_TO_CURRENCY_CODE[trimmed];
  if (bySymbol) return bySymbol;
  const upper = trimmed.toUpperCase();
  return WRITTEN_CURRENCY_ALIASES[upper] ?? upper;
}

export const FX_DEFAULT_CURRENCY_CODES: readonly string[] = [
  "AED",
  "AUD",
  "CNY",
  "EUR",
  "GBP",
  "HKD",
  "IDR",
  "INR",
  "JPY",
  "KRW",
  "MYR",
  "SGD",
  "USD",
];
