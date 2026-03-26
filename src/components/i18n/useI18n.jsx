import { create} from 'zustand';
import { persist } from 'zustand/middleware';
import { translations, DEFAULT_LANGUAGE, LANGUAGES } from './translations';

export const useI18nStore = create(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'mooadon-language',
    }
  )
);

export const useI18n = () => {
  const { language, setLanguage } = useI18nStore();
  
  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      value = value?.[k];
      if (!value) break;
    }
    
    // Fallback to English if translation not found
    if (!value) {
      let fallback = translations[DEFAULT_LANGUAGE];
      for (const k of keys) {
        fallback = fallback?.[k];
        if (!fallback) break;
      }
      return fallback || key;
    }
    
    return value;
  };
  
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES.find(l => l.code === DEFAULT_LANGUAGE);
  
  return {
    t,
    language,
    setLanguage,
    dir: currentLang.dir,
    isRTL: currentLang.dir === 'rtl',
    currentLang
  };
};