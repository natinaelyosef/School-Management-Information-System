import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { LANGUAGES, type LanguageCode } from '../i18n';

/**
 * Language picker. The choice is remembered on the device, so a parent who
 * switches to Amharic keeps it on their next visit.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language) as LanguageCode;

  return (
    <label
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-600 dark:text-slate-300"
      title="Language / ቋንቋ"
    >
      <Languages size={16} className="shrink-0 text-slate-400" />
      <select
        value={LANGUAGES.some((l) => l.code === current) ? current : 'en'}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        aria-label="Language"
        className={`bg-transparent font-semibold outline-none ${compact ? 'text-xs' : 'text-sm'}`}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.native}
          </option>
        ))}
      </select>
    </label>
  );
}
