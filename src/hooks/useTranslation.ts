import { useChatStore } from '../store/useChatStore';
import { translations } from '../utils/i18n';

export const useTranslation = () => {
  const language = useChatStore((state) => state.language);
  const t = translations[language] || translations.ja;
  return { t, language };
};
