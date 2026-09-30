import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Role, User } from '../types';

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  token: string | null;
  isAuthenticated: boolean;
  can: (permission: string) => boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
}

const FALLBACK_PERMISSIONS: Partial<Record<Role, string[]>> = {
  super_admin: ['students.view', 'students.create', 'students.edit', 'students.promote', 'students.delete', 'roles.manage'],
  school_admin: [
    'users.view', 'users.create', 'users.edit', 'users.delete', 'users.activate', 'users.reset_password',
    'roles.manage', 'settings.view', 'settings.edit', 'students.view', 'students.create', 'students.edit',
    'parents.view', 'parents.create', 'parents.edit', 'applications.view', 'applications.review', 'applications.decide',
    'reports.view', 'reports.export',
  ],
  registrar: ['students.view', 'students.create', 'students.edit', 'students.promote', 'parents.view', 'parents.create', 'parents.edit'],
  registration: [
    'applications.view', 'applications.create', 'applications.review', 'applications.decide',
    'students.view', 'students.create', 'students.edit', 'parents.view', 'parents.create', 'parents.edit',
    'fees.view', 'invoices.view', 'invoices.create', 'payments.view', 'payments.receive', 'messaging.send',
  ],
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(): { user: User | null; token: string | null } {
  try {
    const rawUser = localStorage.getItem('smis_user');
    const token = localStorage.getItem('smis_token');
    return {
      user: rawUser ? (JSON.parse(rawUser) as User) : null,
      token,
    };
  } catch {
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(readStored);
  const [user, setUser] = useState<User | null>(stored.user);
  const [token, setToken] = useState<string | null>(stored.token);

  const signIn = useCallback((nextToken: string, nextUser: User) => {
    localStorage.setItem('smis_token', nextToken);
    localStorage.setItem('smis_user', JSON.stringify(nextUser));
    localStorage.setItem('smis_role', nextUser.role);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('smis_token');
    localStorage.removeItem('smis_user');
    localStorage.removeItem('smis_role');
    setToken(null);
    setUser(null);
  }, []);

  const can = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      const perms = user.permissions;
      if (perms && perms.length > 0) return perms.includes(permission);
      return (FALLBACK_PERMISSIONS[user.role] ?? []).includes(permission);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      token,
      isAuthenticated: Boolean(token && user),
      can,
      signIn,
      signOut,
    }),
    [user, token, can, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
