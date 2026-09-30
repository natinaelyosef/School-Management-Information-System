import { NavLink } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileText,
  GraduationCap,
  HeartPulse,
  History,
  LayoutDashboard,
  Library,
  MailOpen,
  Megaphone,
  MessagesSquare,
  BarChart3,
  PenSquare,
  PhoneCall,
  Settings,
  Users,
} from 'lucide-react';
import type { Role } from '../types';
import { useTranslation } from 'react-i18next';

interface Item {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const COMMON: Item[] = [{ to: '/dashboard', label: 'nav.overview', icon: LayoutDashboard }];

const ACADEMICS: Item[] = [
  { to: '/dashboard/subjects', label: 'nav.subjects', icon: BookOpen },
  { to: '/dashboard/assignments', label: 'nav.assignments', icon: PenSquare },
  { to: '/dashboard/exams', label: 'nav.exams', icon: ClipboardList },
  { to: '/dashboard/report-cards', label: 'nav.reportCards', icon: FileText },
  { to: '/dashboard/timetable', label: 'nav.timetable', icon: CalendarDays },
];

const REPORTS: Item = { to: '/dashboard/reports', label: 'nav.reports', icon: BarChart3 };

const BEHAVIOUR: Item = { to: '/dashboard/discipline', label: 'nav.discipline', icon: Award };

const LEAVE: Item = { to: '/dashboard/leave', label: 'nav.leave', icon: CalendarCheck };

const CAMPAIGNS: Item = { to: '/dashboard/campaigns', label: 'nav.campaigns', icon: Megaphone };

const BY_ROLE: Record<Role, Item[]> = {
  super_admin: [
    { to: '/dashboard/admin', label: 'nav.adminHome', icon: LayoutDashboard },
    { to: '/dashboard/students', label: 'nav.students', icon: GraduationCap },
    { to: '/dashboard/parents', label: 'nav.parents', icon: Users },
    { to: '/dashboard/users', label: 'nav.users', icon: Users },
    { to: '/dashboard/departments', label: 'nav.departments', icon: Building2 },
    { to: '/dashboard/applications', label: 'nav.applications', icon: ClipboardList },
    { to: '/dashboard/finance', label: 'nav.finance', icon: DollarSign },
    { to: '/dashboard/payment-tasks', label: 'nav.paymentTasks', icon: PhoneCall },
    { to: '/dashboard/events', label: 'nav.events', icon: CalendarDays },
    { to: '/dashboard/inquiries', label: 'nav.inquiries', icon: MailOpen },
    BEHAVIOUR,
    LEAVE,
    CAMPAIGNS,
    ...ACADEMICS,
    REPORTS,
    { to: '/dashboard/transport', label: 'nav.transport', icon: Bus },
    { to: '/dashboard/audit', label: 'nav.audit', icon: History },
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
    { to: '/dashboard/settings', label: 'nav.settings', icon: Settings },
  ],
  school_admin: [
    { to: '/dashboard/admin', label: 'nav.adminHome', icon: LayoutDashboard },
    { to: '/dashboard/students', label: 'nav.students', icon: GraduationCap },
    { to: '/dashboard/parents', label: 'nav.parents', icon: Users },
    { to: '/dashboard/users', label: 'nav.users', icon: Users },
    { to: '/dashboard/departments', label: 'nav.departments', icon: Building2 },
    { to: '/dashboard/applications', label: 'nav.applications', icon: ClipboardList },
    { to: '/dashboard/finance', label: 'nav.finance', icon: DollarSign },
    { to: '/dashboard/payment-tasks', label: 'nav.paymentTasks', icon: PhoneCall },
    { to: '/dashboard/events', label: 'nav.events', icon: CalendarDays },
    { to: '/dashboard/inquiries', label: 'nav.inquiries', icon: MailOpen },
    BEHAVIOUR,
    LEAVE,
    CAMPAIGNS,
    ...ACADEMICS,
    REPORTS,
    { to: '/dashboard/transport', label: 'nav.transport', icon: Bus },
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
    { to: '/dashboard/settings', label: 'nav.settings', icon: Settings },
  ],
  principal: [
    { to: '/dashboard/principal', label: 'nav.principalHome', icon: LayoutDashboard },
    { to: '/dashboard/students', label: 'nav.students', icon: Users },
    { to: '/dashboard/users', label: 'nav.users', icon: Users },
    { to: '/dashboard/parents', label: 'nav.parents', icon: Users },
    { to: '/dashboard/attendance', label: 'nav.attendance', icon: CalendarCheck },
    ...ACADEMICS,
    REPORTS,
    { to: '/dashboard/finance', label: 'nav.finance', icon: DollarSign },
    { to: '/dashboard/payment-tasks', label: 'nav.paymentTasks', icon: PhoneCall },
    { to: '/dashboard/events', label: 'nav.events', icon: CalendarDays },
    { to: '/dashboard/inquiries', label: 'nav.inquiries', icon: MailOpen },
    { to: '/dashboard/audit', label: 'nav.audit', icon: History },
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
  ],
  academic: [
    { to: '/dashboard/academic', label: 'nav.academicHome', icon: BookOpen },
    { to: '/dashboard/students', label: 'nav.students', icon: Users },
    { to: '/dashboard/attendance', label: 'nav.attendance', icon: CalendarCheck },
    BEHAVIOUR,
    LEAVE,
    ...ACADEMICS,
    { to: '/dashboard/events', label: 'nav.events', icon: CalendarDays },
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
  ],
  registrar: [
    { to: '/dashboard/registrar', label: 'nav.registrarHome', icon: LayoutDashboard },
    { to: '/dashboard/students', label: 'nav.students', icon: Users },
    { to: '/dashboard/parents', label: 'nav.parents', icon: Users },
    BEHAVIOUR,
    { to: '/dashboard/applications', label: 'nav.applications', icon: ClipboardList },
    { to: '/dashboard/events', label: 'nav.events', icon: CalendarDays },
    { to: '/dashboard/inquiries', label: 'nav.inquiries', icon: MailOpen },
    CAMPAIGNS,
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
  ],
  registration: [
    { to: '/dashboard/registration', label: 'nav.registrationHome', icon: LayoutDashboard },
    { to: '/dashboard/applications', label: 'nav.applications', icon: ClipboardList },
    { to: '/dashboard/students', label: 'nav.students', icon: Users },
    { to: '/dashboard/parents', label: 'nav.parents', icon: Users },
    { to: '/dashboard/finance', label: 'nav.fees', icon: DollarSign },
    CAMPAIGNS,
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
  ],
  teacher: [
    { to: '/dashboard/teacher', label: 'nav.teacherHome', icon: LayoutDashboard },
    { to: '/dashboard/attendance', label: 'nav.markAttendance', icon: CalendarCheck },
    { to: '/dashboard/students', label: 'nav.myStudents', icon: Users },
    BEHAVIOUR,
    LEAVE,
    ...ACADEMICS,
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
  ],
  accountant: [
    { to: '/dashboard/accountant', label: 'nav.accountantHome', icon: LayoutDashboard },
    { to: '/dashboard/finance', label: 'nav.invoicesProofs', icon: DollarSign },
    { to: '/dashboard/payment-tasks', label: 'nav.paymentTasks', icon: PhoneCall },
    LEAVE,
    REPORTS,
    { to: '/dashboard/students', label: 'nav.students', icon: Users },
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
  ],
  parent: [
    { to: '/dashboard/parent', label: 'nav.parentHome', icon: LayoutDashboard },
    { to: '/dashboard/finance', label: 'nav.fees', icon: DollarSign },
    { to: '/dashboard/attendance', label: 'nav.attendance', icon: CalendarCheck },
    BEHAVIOUR,
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
  ],
  student: [
    { to: '/dashboard/student', label: 'nav.studentHome', icon: LayoutDashboard },
    { to: '/dashboard/assignments', label: 'nav.assignments', icon: PenSquare },
    { to: '/dashboard/attendance', label: 'nav.attendance', icon: CalendarCheck },
    { to: '/dashboard/finance', label: 'nav.fees', icon: DollarSign },
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
  ],
  librarian: [
    { to: '/dashboard/library', label: 'nav.library', icon: Library },
    LEAVE,
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
  ],
  nurse: [
    { to: '/dashboard/health', label: 'nav.health', icon: HeartPulse },
    LEAVE,
    { to: '/dashboard/messages', label: 'nav.messages', icon: MessagesSquare },
  ],
};

export default function Sidebar({
  role,
  onClose,
}: {
  role: Role | null;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  // Custom departments created at runtime have no nav map entry — fall back to Overview only.
  const items = [...COMMON, ...(role && BY_ROLE[role] ? BY_ROLE[role] : [])];
  // de-duplicate /dashboard overview when role home equals overview
  const seen = new Set<string>();
  const unique = items.filter((i) => {
    if (seen.has(i.to)) return false;
    seen.add(i.to);
    return true;
  });
  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 overflow-y-auto">
      {onClose && (
        <div className="mb-4 flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 lg:hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Menu</span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close menu"
          >
            <span className="font-bold text-sm">✕</span>
          </button>
        </div>
      )}
      <nav className="flex-1 space-y-1">
        {unique.map((item) => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            }
          >
            <item.icon size={18} className="shrink-0" />
            <span className="truncate">{t(item.label)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-6 rounded-xl bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <p className="font-bold">{t('auth.helpTitle')}</p>
        <p className="mt-1 leading-relaxed">{t('auth.helpBody')}</p>
      </div>
    </aside>
  );
}
