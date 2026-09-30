import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 py-8 px-4 sm:px-6">
      {/* Top Navigation Row in normal flow to avoid mobile overlap */}
      <div className="w-full max-w-md flex items-center justify-between mb-5">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ArrowLeft size={15} />
          <span>{t('backHome')}</span>
        </Link>

        <div className="rounded-xl bg-white/10 p-1 backdrop-blur-md">
          <LanguageSwitcher compact />
        </div>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900">
        <Outlet />
      </div>
    </div>
  );
}
