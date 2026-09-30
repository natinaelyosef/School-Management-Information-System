import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BookOpen,
  Award,
  CalendarDays,
  Users,
  MessageSquare,
  Phone,
  School,
  LogIn,
  Layers,
  MapPin,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import { useSchool } from '../stores/SchoolContext';

const NAV_LINKS = [
  { to: '/', label: 'public.home' },
  { to: '/about', label: 'public.about' },
  { to: '/teachers', label: 'public.teachers' },
  { to: '/news', label: 'public.news' },
  { to: '/events', label: 'public.events' },
  { to: '/contact', label: 'public.contact' },
];

const PROGRAM_LINKS = [
  {
    to: '/preschool',
    titleKey: 'nav.preschool',
    desc: 'Ages 3–5 · Montessori & Early Exploration',
    icon: Sparkles,
    color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50',
  },
  {
    to: '/middle',
    titleKey: 'nav.middle',
    desc: 'Grades 1–8 · STEM & Foundational Growth',
    icon: BookOpen,
    color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/50',
  },
  {
    to: '/high',
    titleKey: 'nav.high',
    desc: 'Grades 9–12 · University Prep & Science Labs',
    icon: Award,
    color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50',
  },
  {
    to: '/programs',
    titleKey: 'public.programs',
    desc: 'View comprehensive K-12 academic pathway',
    icon: Layers,
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50',
  },
];

export default function Navbar() {
  const { t } = useTranslation();
  const { name, motto, phone, address } = useSchool();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [mobileProgramsOpen, setMobileProgramsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close menus when route changes
  useEffect(() => {
    setMobileOpen(false);
    setProgramsOpen(false);
    setMobileProgramsOpen(false);
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProgramsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center gap-2.5 group min-w-0 max-w-[210px] sm:max-w-xs md:max-w-sm lg:max-w-none">
          <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <GraduationCap size={20} className="sm:w-5 sm:h-5" />
          </span>
          <span className="leading-tight truncate">
            <span className="block text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
              {name}
            </span>
            <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {motto || t('public.motto')}
            </span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-1 xl:gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 lg:flex">
          <Link
            to="/"
            className={`rounded-lg px-2.5 py-1.5 transition hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:hover:text-blue-400 ${
              location.pathname === '/' ? 'text-blue-600 font-bold dark:text-blue-400' : ''
            }`}
          >
            {t('public.home')}
          </Link>

          <Link
            to="/about"
            className={`rounded-lg px-2.5 py-1.5 transition hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:hover:text-blue-400 ${
              location.pathname === '/about' ? 'text-blue-600 font-bold dark:text-blue-400' : ''
            }`}
          >
            {t('public.about')}
          </Link>

          {/* Programs Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProgramsOpen((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:hover:text-blue-400 ${
                ['/programs', '/preschool', '/middle', '/high'].includes(location.pathname)
                  ? 'text-blue-600 font-bold dark:text-blue-400'
                  : ''
              }`}
            >
              <span>{t('public.programs')}</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${programsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {programsOpen && (
              <div className="absolute left-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xl backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="space-y-1">
                  {PROGRAM_LINKS.map((p) => (
                    <Link
                      key={p.to}
                      to={p.to}
                      onClick={() => setProgramsOpen(false)}
                      className="group flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-blue-50/70 dark:hover:bg-slate-800"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${p.color}`}>
                        <p.icon size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                          {t(p.titleKey)}
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                          {p.desc}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {NAV_LINKS.slice(2).map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`rounded-lg px-2.5 py-1.5 transition hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/60 dark:hover:text-blue-400 ${
                location.pathname === l.to ? 'text-blue-600 font-bold dark:text-blue-400' : ''
              }`}
            >
              {t(l.label)}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-2 lg:flex">
          <LanguageSwitcher compact />
          <ThemeToggle />
          <button
            onClick={() => navigate('/track')}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            {t('public.track')}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
          >
            {t('auth.login')}
          </button>
          <button
            onClick={() => navigate('/apply')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all hover:scale-[1.02]"
          >
            <School size={14} />
            <span>{t('public.apply')}</span>
          </button>
        </div>

        {/* Mobile / Tablet Header Controls */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <LanguageSwitcher compact />
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Full Screen Off-Canvas Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Overlay with blur */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-in Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-right duration-250">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <GraduationCap size={18} />
                </span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate max-w-[180px]">
                  {name}
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label="Close navigation menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Buttons in Mobile Drawer */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 grid grid-cols-2 gap-2">
              <Link
                to="/apply"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-center text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              >
                <School size={14} />
                <span>{t('public.apply')}</span>
              </Link>
              <Link
                to="/track"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-center text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <CalendarDays size={14} />
                <span>{t('public.track')}</span>
              </Link>
            </div>

            {/* Scrollable Navigation Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span>{t('public.home')}</span>
                <ChevronRight size={15} className="text-slate-400" />
              </Link>

              <Link
                to="/about"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span>{t('public.about')}</span>
                <ChevronRight size={15} className="text-slate-400" />
              </Link>

              {/* Mobile Programs Accordion */}
              <div>
                <button
                  onClick={() => setMobileProgramsOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <span>{t('public.programs')}</span>
                    <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                      K-12
                    </span>
                  </span>
                  <ChevronDown
                    size={15}
                    className={`text-slate-400 transition-transform ${mobileProgramsOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {mobileProgramsOpen && (
                  <div className="ml-3 my-1 space-y-1 border-l-2 border-blue-500/30 pl-2">
                    {PROGRAM_LINKS.map((p) => (
                      <Link
                        key={p.to}
                        to={p.to}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <p.icon size={15} className="text-blue-500" />
                        <span>{t(p.titleKey)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {NAV_LINKS.slice(2).map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span>{t(l.label)}</span>
                  <ChevronRight size={15} className="text-slate-400" />
                </Link>
              ))}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800"
                >
                  <LogIn size={16} />
                  <span>{t('auth.login')} / Portal</span>
                </Link>
              </div>
            </div>

            {/* Mobile Drawer Footer with Contact details */}
            <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>{phone}</span>
                </div>
              )}
              {address && (
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">{address}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
