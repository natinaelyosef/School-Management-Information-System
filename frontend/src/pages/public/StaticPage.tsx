import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, School } from 'lucide-react';

export default function StaticPage({
  title,
  body,
  image,
  children,
}: {
  title: string;
  body?: string;
  image?: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-[70vh] bg-slate-50 pb-20 pt-8 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 mb-6 transition"
        >
          <ArrowLeft size={14} /> Back to Home
        </Link>

        {image && (
          <div className="relative mb-8 h-64 sm:h-80 w-full overflow-hidden rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800">
            <img src={image} alt={title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-6 left-6 right-6">
              <h1 className="text-3xl sm:text-4xl font-black text-white drop-shadow-md">{title}</h1>
            </div>
          </div>
        )}

        {!image && (
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-50 mb-6">
            {title}
          </h1>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {body && (
            <p className="text-base sm:text-lg leading-relaxed text-slate-700 dark:text-slate-300">
              {body}
            </p>
          )}
          {children}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6 dark:border-slate-800">
            <Link
              to="/apply"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
            >
              <School size={16} /> Apply for this Program
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
            >
              Ask a question <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
