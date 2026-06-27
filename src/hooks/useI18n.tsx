import { createContext, useContext, ReactNode, useCallback, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { translations, Language, Translations } from '../lib/i18n'

interface I18nContextType {
  t: Translations
  language: Language
  setLanguage: (lang: Language) => void
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useStore((state) => state.preferences.language || 'zh')
  const setPreferences = useStore((state) => state.setPreferences)

  const setLanguage = useCallback(
    (lang: Language) => {
      setPreferences({
        ...useStore.getState().preferences,
        language: lang,
      })
      useStore.getState().savePreferences()
    },
    [setPreferences]
  )

  const value = useMemo<I18nContextType>(
    () => ({ t: translations[language], language, setLanguage }),
    [language, setLanguage]
  )

  return (
    <I18nContext.Provider value={value}>
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
