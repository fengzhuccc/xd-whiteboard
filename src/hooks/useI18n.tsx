import { createContext, useContext, ReactNode } from 'react'
import { useStore } from '../store/useStore'
import { translations, Language, Translations } from '../lib/i18n'

interface I18nContextType {
  t: Translations
  language: Language
  setLanguage: (lang: Language) => void
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const preferences = useStore((state) => state.preferences)
  const setPreferences = useStore((state) => state.setPreferences)

  const language = preferences.language || 'zh'
  
  const setLanguage = (lang: Language) => {
    setPreferences({
      ...preferences,
      language: lang,
    })
    useStore.getState().savePreferences()
  }

  const t = translations[language]

  return (
    <I18nContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
