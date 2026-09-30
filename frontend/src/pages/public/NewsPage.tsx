import { useQuery } from '@tanstack/react-query';
import { Pin, Calendar, Newspaper } from 'lucide-react';
import { fetchPublicNews, type PublicNewsItem } from '../../api/public';
import { apiErrorMessage } from '../../utils/errors';
import { useTranslation } from 'react-i18next';
import Badge from '../../components/ui/Badge';
import { formatDate } from '../../utils/format';

const excerpt = (body?: string | null): string =>
  (body ?? '').length > 240 ? `${(body ?? '').slice(0, 240).trimEnd()}…` : body ?? '';

export default function NewsPage() {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ['public', 'news'],
    queryFn: () => fetchPublicNews(),
    retry: 1,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="max-w-2xl">
        <Badge tone="blue">School Bulletins</Badge>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          {t('pages.news.title')}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Official announcements, termly updates, and achievements from the administration.
        </p>
      </div>

      {query.isError && (
        <p className="mt-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
          {apiErrorMessage(query.error, 'News could not be loaded.')}
        </p>
      )}

      <div className="mt-8 space-y-4">
        {query.isLoading && (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading announcements…
          </div>
        )}

        {!query.isLoading && (query.data?.length ?? 0) === 0 && !query.isError && (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 sm:p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            <Newspaper size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              No news published yet
            </p>
            <p className="text-xs text-slate-400 mt-1">Check back soon for recent bulletins.</p>
          </div>
        )}

        {query.data?.map((item: PublicNewsItem) => (
          <article
            key={item.id}
            className="group rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm transition-all hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                {item.title}
              </h2>
              {item.is_pinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Pin size={12} /> Pinned
                </span>
              )}
            </div>

            <p className="mt-2.5 whitespace-pre-line text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {excerpt(item.body)}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              {item.published_at && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{formatDate(item.published_at)}</span>
                </span>
              )}
              {item.audience && item.audience !== 'all' && (
                <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 capitalize">
                  {item.audience}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
