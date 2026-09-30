import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Clock } from 'lucide-react';
import { fetchPublicEvents, type PublicEvent } from '../../api/public';
import { apiErrorMessage } from '../../utils/errors';
import { useTranslation } from 'react-i18next';
import Badge from '../../components/ui/Badge';

const formatSlot = (event: PublicEvent): string => {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const time = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const endTime = end
    ? ` – ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    : '';
  return `${time}${endTime}`;
};

export default function EventsPage() {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ['public', 'events'],
    queryFn: () => fetchPublicEvents(),
    retry: 1,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="max-w-2xl">
        <Badge tone="blue">Calendar</Badge>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          {t('pages.events.title')}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Stay informed about campus open houses, academic deadlines, sports fixtures, and holidays.
        </p>
      </div>

      {query.isError && (
        <p className="mt-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
          {apiErrorMessage(query.error, 'The calendar could not be loaded.')}
        </p>
      )}

      <div className="mt-8 space-y-4">
        {query.isLoading && (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading upcoming events…
          </div>
        )}

        {!query.isLoading && (query.data?.length ?? 0) === 0 && !query.isError && (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 sm:p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            <CalendarDays size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              No upcoming events published
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Check back soon for upcoming calendar announcements.
            </p>
          </div>
        )}

        {query.data?.map((event: PublicEvent) => {
          const startDate = new Date(event.starts_at);
          const month = startDate.toLocaleString(undefined, { month: 'short' });
          const day = startDate.getDate();
          const weekday = startDate.toLocaleString(undefined, { weekday: 'short' });

          return (
            <article
              key={event.id}
              className="group flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm transition-all hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Date Block */}
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md">
                <span className="text-[10px] uppercase font-bold tracking-wider leading-none">
                  {month}
                </span>
                <span className="text-xl sm:text-2xl font-black leading-tight mt-0.5">{day}</span>
              </div>

              {/* Event Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {weekday}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Clock size={12} /> {formatSlot(event)}
                  </span>
                </div>

                <h2 className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  {event.title}
                </h2>

                {event.description && (
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {event.description}
                  </p>
                )}

                {event.location && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <MapPin size={13} className="text-blue-500 shrink-0" />
                    <span>{event.location}</span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
