import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Mail, Users } from 'lucide-react';
import { fetchPublicTeachers, type PublicTeacher } from '../../api/public';
import { apiErrorMessage } from '../../utils/errors';
import { useTranslation } from 'react-i18next';
import Badge from '../../components/ui/Badge';

const initials = (t: PublicTeacher): string =>
  `${t.first_name?.[0] ?? ''}${t.last_name?.[0] ?? ''}`.toUpperCase();

export default function TeachersPage() {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ['public', 'teachers'],
    queryFn: () => fetchPublicTeachers(),
    retry: 1,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="max-w-2xl">
        <Badge tone="blue">Academic Faculty</Badge>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          {t('pages.teachers.title')}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Meet our dedicated, certified educators across Preschool, Middle School, and High School.
        </p>
      </div>

      {query.isError && (
        <p className="mt-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
          {apiErrorMessage(query.error, 'The staff directory could not be loaded.')}
        </p>
      )}

      <div className="mt-8">
        {query.isLoading && (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading directory…
          </div>
        )}

        {!query.isLoading && (query.data?.length ?? 0) === 0 && !query.isError && (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 sm:p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            <Users size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Staff profiles have not been published yet
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Teacher profiles will appear here once published by the administration.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {query.data?.map((teacher: PublicTeacher, idx) => {
            const gradients = [
              'from-blue-600 to-indigo-600',
              'from-emerald-600 to-teal-600',
              'from-purple-600 to-pink-600',
              'from-amber-500 to-orange-600',
            ];
            const gradient = gradients[idx % gradients.length];

            return (
              <article
                key={teacher.id}
                className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-sm font-extrabold text-white shadow-md`}
                    >
                      {initials(teacher)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-bold text-sm sm:text-base text-slate-900 dark:text-slate-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        {teacher.first_name} {teacher.last_name}
                      </h2>
                      <p className="truncate text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                        {teacher.specialization ?? 'Faculty Member'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                    {teacher.qualification && (
                      <p className="flex items-center gap-2">
                        <GraduationCap size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{teacher.qualification}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">faculty@school.edu.et</span>
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
