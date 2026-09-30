import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Mail, GraduationCap } from 'lucide-react';
import { useSchool } from '../stores/SchoolContext';

const COPYRIGHT_YEAR = new Date().getFullYear();

export default function Footer() {
  const { t } = useTranslation();
  const { name, phone, email, address, motto } = useSchool();

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300 dark:text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:px-8 py-12 sm:py-16 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand statement */}
        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <GraduationCap size={18} />
            </span>
            <h4 className="text-base font-extrabold text-white">{name}</h4>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {motto ? `${motto}. ${t('public.blurb')}` : t('public.blurb')}
          </p>
        </div>

        {/* Quick Navigation */}
        <div>
          <h5 className="font-bold text-sm text-white tracking-wide uppercase text-[11px]">
            Navigation
          </h5>
          <ul className="mt-3 space-y-2 text-xs sm:text-sm">
            <li>
              <Link to="/about" className="hover:text-white transition inline-block py-0.5">
                {t('public.about')}
              </Link>
            </li>
            <li>
              <Link to="/programs" className="hover:text-white transition inline-block py-0.5">
                {t('public.programs')}
              </Link>
            </li>
            <li>
              <Link to="/teachers" className="hover:text-white transition inline-block py-0.5">
                {t('public.teachers')}
              </Link>
            </li>
            <li>
              <Link to="/news" className="hover:text-white transition inline-block py-0.5">
                {t('public.news')}
              </Link>
            </li>
            <li>
              <Link to="/events" className="hover:text-white transition inline-block py-0.5">
                {t('public.events')}
              </Link>
            </li>
          </ul>
        </div>

        {/* Programs */}
        <div>
          <h5 className="font-bold text-sm text-white tracking-wide uppercase text-[11px]">
            {t('public.programs')}
          </h5>
          <ul className="mt-3 space-y-2 text-xs sm:text-sm">
            <li>
              <Link to="/preschool" className="hover:text-white transition inline-block py-0.5">
                {t('public.preschool')}
              </Link>
            </li>
            <li>
              <Link to="/middle" className="hover:text-white transition inline-block py-0.5">
                {t('public.middle')}
              </Link>
            </li>
            <li>
              <Link to="/high" className="hover:text-white transition inline-block py-0.5">
                {t('public.high')}
              </Link>
            </li>
            <li>
              <Link to="/apply" className="text-blue-400 hover:text-blue-300 font-semibold transition inline-block py-0.5">
                {t('public.apply')} →
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <h5 className="font-bold text-sm text-white tracking-wide uppercase text-[11px]">
            {t('public.contact')}
          </h5>
          <ul className="mt-3 space-y-2 text-xs sm:text-sm text-slate-400">
            {address && (
              <li className="flex items-start gap-2">
                <MapPin size={14} className="text-blue-400 shrink-0 mt-0.5" />
                <span>{address}</span>
              </li>
            )}
            {phone && (
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-blue-400 shrink-0" />
                <span>{phone}</span>
              </li>
            )}
            {email && (
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-blue-400 shrink-0" />
                <span className="truncate">{email}</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-900 py-6 px-4 text-center text-xs text-slate-500">
        © {COPYRIGHT_YEAR} {name} — All Rights Reserved · School Management &amp; Information System
      </div>
    </footer>
  );
}
