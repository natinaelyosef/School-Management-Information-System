import { Navigate } from 'react-router-dom';
import { useAuth } from '../../stores/AuthContext';
import { ROLE_HOME } from '../../utils/constants';

export default function DashboardHome() {
  const { role } = useAuth();
  if (!role) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[role] ?? '/dashboard/students'} replace />;
}
