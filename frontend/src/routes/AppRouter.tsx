import { createBrowserRouter } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';

import Home from '../pages/public/Home';
import StaticPage from '../pages/public/StaticPage';
import AboutPage from '../pages/public/AboutPage';
import Contact from '../pages/public/Contact';
import NewsPage from '../pages/public/NewsPage';
import EventsPage from '../pages/public/EventsPage';
import TeachersPage from '../pages/public/TeachersPage';
import Login from '../pages/auth/Login';
import Apply from '../pages/auth/Apply';
import Track from '../pages/auth/Track';

import DashboardHome from '../pages/dashboard/DashboardHome';
import AdminDashboard from '../pages/dashboard/AdminDashboard';
import PrincipalDashboard from '../pages/dashboard/PrincipalDashboard';
import AcademicDashboard from '../pages/dashboard/AcademicDashboard';
import RegistrarDashboard from '../pages/dashboard/RegistrarDashboard';
import TeacherDashboard from '../pages/dashboard/TeacherDashboard';
import AccountantDashboard from '../pages/dashboard/AccountantDashboard';
import ParentDashboard from '../pages/dashboard/ParentDashboard';
import StudentDashboard from '../pages/dashboard/StudentDashboard';

import StudentList from '../pages/students/StudentList';
import StudentTimeline from '../pages/students/StudentTimeline';
import ParentsPage from '../pages/students/ParentsPage';
import AttendanceMark from '../pages/attendance/AttendanceMark';
import FinancePage from '../pages/finance/FinancePage';
import UsersPage from '../pages/users/UsersPage';
import DepartmentsPage from '../pages/users/DepartmentsPage';
import MessagesPage from '../pages/messaging/MessagesPage';
import ApplicationsPage from '../pages/applications/ApplicationsPage';

import SubjectsPage from '../pages/academics/SubjectsPage';
import AssignmentsPage from '../pages/academics/AssignmentsPage';
import ExamsPage from '../pages/academics/ExamsPage';
import ReportCardsPage from '../pages/academics/ReportCardsPage';
import PreschoolAssessPage from '../pages/academics/PreschoolAssessPage';
import TimetablePage from '../pages/academics/TimetablePage';
import LibraryPage from '../pages/library/LibraryPage';
import DisciplinePage from '../pages/discipline/DisciplinePage';
import CampaignsPage from '../pages/campaigns/CampaignsPage';
import LeavePage from '../pages/leave/LeavePage';
import ReportsPage from '../pages/reports/ReportsPage';
import HealthPage from '../pages/health/HealthPage';
import TransportPage from '../pages/transport/TransportPage';
import SettingsPage from '../pages/settings/SettingsPage';
import AuditPage from '../pages/audit/AuditPage';
import EventsAdminPage from '../pages/content/EventsAdminPage';
import InquiriesPage from '../pages/content/InquiriesPage';
import PaymentTasksPage from '../pages/finance/PaymentTasksPage';

const guard = (node: React.ReactNode, roles?: Parameters<typeof ProtectedRoute>[0]['roles']) => (
  <ProtectedRoute roles={roles}>{node}</ProtectedRoute>
);

const ACADEMIC_ROLES = ['academic', 'teacher', 'principal', 'super_admin'] as const;

/** Anyone who records merits, demerits or incidents during the school day. */
const DISCIPLINE_ROLES = [
  'super_admin',
  'school_admin',
  'principal',
  'academic',
  'registrar',
  'teacher',
  'parent',
] as const;

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/programs', element: <StaticPage title="Academic Programs" image="/images/hero.jpg" body="Preschool (ages 3–5), Middle School (Grades 1–8), High School (Grades 9–12 with university entrance preparation), plus clubs, robotics, music, and athletics." /> },
      { path: '/preschool', element: <StaticPage title="Preschool & Kindergarten" image="/images/preschool.jpg" body="Play-based learning: phonics, numeracy through play, Amharic & English, motor skills, music and sensory exploration in small classes with dedicated assistants." /> },
      { path: '/middle', element: <StaticPage title="Middle School" image="/images/middle_school.jpg" body="Grades 1–8: literacy, mathematics, science labs, ICT, language arts, and civics with continuous assessment and a collaborative parent conference every term." /> },
      { path: '/high', element: <StaticPage title="High School" image="/images/high_school.jpg" body="Grades 9–12: University entrance examination preparation, modern physics/chemistry/biology laboratories, career guidance, and national Olympiad coaching." /> },
      { path: '/teachers', element: <TeachersPage /> },
      { path: '/news', element: <NewsPage /> },
      { path: '/events', element: <EventsPage /> },
      { path: '/contact', element: <Contact /> },
      { path: '/apply', element: <Apply /> },
      { path: '/track', element: <Track /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <Login /> }],
  },
  {
    path: '/dashboard',
    element: guard(<DashboardLayout />),
    children: [
      { index: true, element: <DashboardHome /> },
      { path: 'admin', element: guard(<AdminDashboard />, ['super_admin', 'school_admin']) },
      { path: 'principal', element: guard(<PrincipalDashboard />, ['principal', 'super_admin']) },
      { path: 'academic', element: guard(<AcademicDashboard />, ['academic', 'super_admin']) },
      { path: 'registrar', element: guard(<RegistrarDashboard />, ['registrar', 'super_admin']) },
      { path: 'registration', element: guard(<RegistrarDashboard />, ['registration', 'registrar', 'super_admin', 'school_admin']) },
      { path: 'teacher', element: guard(<TeacherDashboard />, ['teacher', 'super_admin']) },
      { path: 'accountant', element: guard(<AccountantDashboard />, ['accountant', 'super_admin']) },
      { path: 'parent', element: guard(<ParentDashboard />, ['parent', 'super_admin']) },
      { path: 'student', element: guard(<StudentDashboard />, ['student', 'super_admin']) },
      { path: 'students', element: guard(<StudentList />) },
      { path: 'students/:id/timeline', element: guard(<StudentTimeline />) },
      { path: 'parents', element: guard(<ParentsPage />, ['super_admin', 'school_admin', 'registrar', 'registration', 'principal']) },
      { path: 'attendance', element: guard(<AttendanceMark />) },
      { path: 'discipline', element: guard(<DisciplinePage />, [...DISCIPLINE_ROLES]) },
      { path: 'campaigns', element: guard(<CampaignsPage />, ['super_admin', 'school_admin', 'principal', 'registrar', 'registration']) },
      { path: 'leave', element: guard(<LeavePage />) },
      { path: 'finance', element: guard(<FinancePage />) },
      { path: 'users', element: guard(<UsersPage />, ['super_admin', 'school_admin', 'principal']) },
      { path: 'departments', element: guard(<DepartmentsPage />, ['super_admin', 'school_admin']) },
      { path: 'messages', element: guard(<MessagesPage />) },
      { path: 'applications', element: guard(<ApplicationsPage />, ['registration', 'registrar', 'super_admin', 'school_admin', 'principal']) },
      { path: 'subjects', element: guard(<SubjectsPage />, [...ACADEMIC_ROLES]) },
      { path: 'assignments', element: guard(<AssignmentsPage />, [...ACADEMIC_ROLES, 'student']) },
      { path: 'exams', element: guard(<ExamsPage />, [...ACADEMIC_ROLES]) },
      { path: 'report-cards', element: guard(<ReportCardsPage />, [...ACADEMIC_ROLES, 'registrar']) },
      { path: 'preschool-assessments', element: guard(<PreschoolAssessPage />, [...ACADEMIC_ROLES]) },
      { path: 'timetable', element: guard(<TimetablePage />, [...ACADEMIC_ROLES]) },
      { path: 'library', element: guard(<LibraryPage />, ['librarian', 'super_admin']) },
      { path: 'reports', element: guard(<ReportsPage />, ['super_admin', 'school_admin', 'principal', 'accountant']) },
      { path: 'health', element: guard(<HealthPage />, ['nurse', 'super_admin']) },
      { path: 'transport', element: guard(<TransportPage />, ['super_admin', 'school_admin']) },
      { path: 'events', element: guard(<EventsAdminPage />, ['super_admin', 'school_admin', 'principal', 'registrar', 'academic']) },
      { path: 'inquiries', element: guard(<InquiriesPage />, ['super_admin', 'school_admin', 'principal', 'registrar']) },
      { path: 'payment-tasks', element: guard(<PaymentTasksPage />, ['super_admin', 'school_admin', 'accountant', 'principal']) },
      { path: 'audit', element: guard(<AuditPage />, ['super_admin', 'principal']) },
      { path: 'settings', element: guard(<SettingsPage />, ['super_admin', 'school_admin', 'principal']) },
    ],
  },
  { path: '*', element: <StaticPage title="404 — Not Found" body="The page you are looking for does not exist." /> },
]);
