import type { Role } from '../types';

export const APP_NAME = 'School Management & Information System';
export const API_FALLBACK = 'http://localhost:8000/api/v1';

export const ROLE_HOME: Record<Role, string> = {
  super_admin: '/dashboard/admin',
  school_admin: '/dashboard/admin',
  principal: '/dashboard/principal',
  academic: '/dashboard/academic',
  registrar: '/dashboard/registrar',
  registration: '/dashboard/registration',
  teacher: '/dashboard/teacher',
  accountant: '/dashboard/accountant',
  parent: '/dashboard/parent',
  student: '/dashboard/student',
  librarian: '/dashboard/library',
  nurse: '/dashboard/health',
};

export const PROGRAMS = ['Preschool', 'Middle School', 'High School'];
