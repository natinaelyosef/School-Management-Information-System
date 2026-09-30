import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { login } from '../../api/auth';
import { apiErrorMessage } from '../../utils/errors';
import { useAuth } from '../../stores/AuthContext';
import { ROLE_HOME } from '../../utils/constants';

const QUICK_ACCOUNTS: Record<string, { email: string; password: string }> = {
  super_admin: { email: 'admin@school.et', password: 'password' },
  principal: { email: 'principal@school.et', password: 'password' },
  teacher: { email: 'teacher@school.et', password: 'password' },
  parent: { email: 'parent@school.et', password: 'password' },
  librarian: { email: 'librarian@school.et', password: 'password' },
  nurse: { email: 'nurse@school.et', password: 'password' },
};

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('admin@school.et');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      signIn(res.token, res.user);
      navigate(ROLE_HOME[res.user.role] ?? '/dashboard', { replace: true });
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          t('auth.invalidCredentials'),
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('auth.welcome')}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('auth.loginSubtitle')}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Input label={t('auth.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label={t('auth.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t('auth.signingIn') : t('auth.login')}
        </Button>
      </form>
      <div className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-900 p-4">
        <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{t('login.demoHint')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(QUICK_ACCOUNTS).map(([role, v]) => (
            <button
              key={role}
              onClick={() => { setEmail(v.email); setPassword(v.password); }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t(`roles.${role}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <Link to="/apply" className="font-bold text-blue-700 hover:underline dark:text-blue-300">
          {t('auth.applyNow')}
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-bold text-blue-700 hover:underline dark:text-blue-300"
        >
          <ArrowLeft size={15} />
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}
