import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import translationEN from './locales/en.json';
import translationFR from './locales/fr.json';

const deviceLang = getLocales()[0]?.languageCode ?? 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: translationEN },
      fr: { translation: translationFR },
    },
    lng: deviceLang === 'fr' ? 'fr' : 'en',
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
