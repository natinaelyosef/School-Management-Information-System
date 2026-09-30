import { useTranslation } from 'react-i18next';
import StaticPage from './StaticPage';
import { useSchool } from '../../stores/SchoolContext';

/**
 * The about page describes the school itself, so its name, age and figures come
 * from School Settings rather than from copy typed into the markup.
 */
export default function AboutPage() {
  const { t } = useTranslation();
  const { name, established, stats, motto } = useSchool();
  const founded = established?.trim();

  return (
    <StaticPage title={t('public.about')} image="/images/hero.jpg">
      <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
        {t('public.aboutBody', { name, years: stats.years, students: stats.students, teachers: stats.teachers })}
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t('settings.schoolName')}
          </dt>
          <dd className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{name}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t('public.established')}
          </dt>
          <dd className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
            {founded || stats.years}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t('nav.students')}
          </dt>
          <dd className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{stats.students}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t('public.expertTeachers')}
          </dt>
          <dd className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{stats.teachers}</dd>
        </div>
      </dl>
      {motto && (
        <p className="mt-6 text-lg font-semibold text-blue-800 dark:text-blue-200">{motto}</p>
      )}
    </StaticPage>
  );
}
