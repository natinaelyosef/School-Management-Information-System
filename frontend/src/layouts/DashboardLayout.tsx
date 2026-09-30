import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Sidebar from '../components/Sidebar';
import ChildSwitcher from '../components/ChildSwitcher';
import MyTasksWidget from '../components/MyTasksWidget';
import NotificationsBell from '../components/NotificationsBell';
import { OnlineStatusPill } from '../components/OfflineBanner';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAuth } from '../stores/AuthContext';

export default function DashboardLayout() {
  const { user, role, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNav, setMobileNav] = useState(false);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileNav) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNav]);

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 sm:px-4 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 lg:hidden transition"
            onClick={() => setMobileNav((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileNav}
          >
            <Menu size={19} />
          </button>

          <Link to="/dashboard" className="flex items-center gap-1.5 min-w-0">
            <span className="text-base font-black tracking-tight text-blue-600 dark:text-blue-400">
              SMIS
            </span>
            <span className="truncate rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 max-w-[120px] sm:max-w-none">
              {role ? t(`roles.${role}`, { defaultValue: role.replace(/_/g, ' ') }) : t('nav.overview')}
            </span>
          </Link>
        </div>

        {/* Global Search Bar (Hidden on Mobile, Visible on Tablet+) */}
        <div className="hidden max-w-xs flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400 md:flex mx-4">
          <Search size={15} />
          <input
            placeholder="Search students, invoices…"
            className="w-full bg-transparent outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Actions & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {role === 'parent' && (
            <div className="max-w-[130px] sm:max-w-none">
              <ChildSwitcher />
            </div>
          )}
          <div className="hidden sm:block">
            <OnlineStatusPill />
          </div>
          <LanguageSwitcher compact />
          <ThemeToggle />
          <NotificationsBell />

          <div className="hidden h-5 w-[1px] bg-slate-200 dark:bg-slate-800 sm:block mx-1" />

          {/* User & Logout */}
          <span className="hidden text-xs font-semibold text-slate-700 dark:text-slate-300 md:block max-w-[100px] truncate">
            {user?.name ?? 'User'}
          </span>
          <button
            onClick={handleLogout}
            title={t('auth.signOut')}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">{t('auth.signOut')}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="relative flex flex-1 min-w-0">
        {/* Desktop Permanent Sidebar */}
        <div className="hidden lg:block">
          <Sidebar role={role} />
        </div>

        {/* Mobile & Tablet Drawer with Backdrop */}
        {mobileNav && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileNav(false)}
              aria-hidden="true"
            />
            {/* Slide-in sidebar drawer */}
            <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 animate-in slide-in-from-left duration-250">
              <Sidebar role={role} onClose={() => setMobileNav(false)} />
            </div>
          </div>
        )}

        {/* Main Content View */}
        <main className="min-w-0 flex-1 p-3.5 sm:p-5 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>

        {/* Desktop Task Widget (xl screens) */}
        <div className="hidden w-80 shrink-0 p-6 pl-0 xl:block">
          <MyTasksWidget role={role} />
        </div>
      </div>
    </div>
  );
}
