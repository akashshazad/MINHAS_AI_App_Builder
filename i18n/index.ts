
export const SUPPORTED_LOCALES = ["en", "ur", "ur-Roman"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const messages = {
  en: { common: { appName: "MINHAS AI App Builder", loading: "Loading", retry: "Retry", error: "Something went wrong" } },
  ur: { common: { appName: "MINHAS AI App Builder", loading: "لوڈ ہو رہا ہے", retry: "دوبارہ کوشش کریں", error: "کچھ غلط ہو گیا" } },
  "ur-Roman": { common: { appName: "MINHAS AI App Builder", loading: "Loading", retry: "Dobara koshish karein", error: "Kuch ghalat ho gaya" } },
} as const;

export type TranslationKey = `common.${keyof (typeof messages)["en"]["common"]}`;
export const isRTL = (locale: Locale) => locale === "ur";

export function translate(locale: Locale, key: TranslationKey): string {
  const [section, name] = key.split(".") as ["common", keyof (typeof messages)["en"]["common"]];
  return messages[locale][section][name] ?? messages.en[section][name];
}


