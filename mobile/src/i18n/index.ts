import { STRINGS, type Language, type TranslationKey } from "./strings";

export type { Language, TranslationKey };
export { STRINGS };

export type LanguagePreference = Language | "system";

export type Translator = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => string;

/**
 * Turns the stored preference into the language actually used. "system" follows
 * the device locale, so a Chinese phone opens in Chinese without touching
 * settings.
 */
export function resolveLanguage(
  preference: LanguagePreference | undefined,
  systemLocale?: string | null
): Language {
  if (preference === "en" || preference === "zh") {
    return preference;
  }

  return (systemLocale ?? systemLocaleTag()).toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function translate(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const entry = STRINGS[key];
  const template = entry ? entry[language] || entry.en : key;
  return params ? interpolate(template, params) : template;
}

export function createTranslator(language: Language): Translator {
  return (key, params) => translate(language, key, params);
}

export function localeTag(language: Language) {
  return language === "zh" ? "zh-CN" : "en-US";
}

function interpolate(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

function systemLocaleTag() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? "en";
  } catch {
    return "en";
  }
}
