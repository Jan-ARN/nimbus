import { createI18n } from 'vue-i18n'
import de from '@/locales/de'
import en from '@/locales/en'

export type Locale = 'de' | 'en'
const STORAGE_KEY = 'nimbus-locale'

// Gespeicherte Wahl → sonst Browser-Sprache → sonst Deutsch (Köln-App).
function initialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'de' || saved === 'en') return saved
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'de'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale(),
  fallbackLocale: 'de',
  messages: { de, en },
})

// Sprache wechseln + in localStorage merken. <html lang> zieht mit.
export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
}

// Intl-Locale-Tag für Datum/Zeit-Formatierung, abgeleitet aus der aktiven Sprache.
export function localeTag(): string {
  return i18n.global.locale.value === 'en' ? 'en-GB' : 'de-DE'
}

document.documentElement.setAttribute('lang', i18n.global.locale.value)
