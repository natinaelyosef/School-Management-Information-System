import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../stores/AuthContext';
import type { Role } from '../types';

export default function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Role[];
}) {
  const token = localStorage.getItem('smis_token');
  const { isAuthenticated, role } = useAuth();

  const authed = isAuthenticated || Boolean(token);
  if (!authed) return <Navigate to="/login" replace />;

  const currentRole = role ?? (localStorage.getItem('smis_role') as Role | null);
  if (roles && currentRole && !roles.includes(currentRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
