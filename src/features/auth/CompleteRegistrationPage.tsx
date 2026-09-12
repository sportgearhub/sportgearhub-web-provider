import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/useAuth';
import { ApiError } from '../../lib/api-client';
import { AuthShell, Notice } from './authShared';
import type { Navigate } from './authUtils';

type FieldErrors = { name?: string; surname?: string };

// Reached when a one-time code proved a number that has no account yet. The number itself is
// carried by the registration token, so it is never re-submitted — and nothing else is asked for:
// an email is optional and attached later, from the profile, with its own confirmation.
export function CompleteRegistrationPage({ token, onNavigate }: { token: string | null; onNavigate: Navigate }) {
  const { completePhoneRegistration } = useAuth();
  const [form, setForm] = useState({ name: '', surname: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <AuthShell title="Регистрация">
        <Notice kind="error">Ссылка недействительна или истекла.</Notice>
        <Button onClick={() => onNavigate('/auth/sign-in')} variant="primary" className="w-full justify-center">
          Войти
        </Button>
      </AuthShell>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = 'Укажите имя.';
    if (!form.surname.trim()) next.surname = 'Укажите фамилию.';

    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      setError('');
      return;
    }

    setFieldErrors({});
    setError('');
    setLoading(true);
    try {
      const session = await completePhoneRegistration({
        token,
        name: form.name.trim(),
        surname: form.surname.trim(),
      });
      onNavigate(session.memberships.length > 0 ? '/auth/passcode-setup' : '/onboarding');
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: FieldErrors = {
          name: err.fieldError('name'),
          surname: err.fieldError('surname'),
        };
        const hasFieldError = Object.values(mapped).some(Boolean);
        setFieldErrors(mapped);
        setError(hasFieldError ? '' : err.message || 'Не удалось завершить регистрацию.');
        return;
      }

      setError('Не удалось завершить регистрацию.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Как вас зовут?">
      {error && <Notice kind="error">{error}</Notice>}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Имя"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          autoComplete="given-name"
          error={fieldErrors.name}
        />
        <Input
          label="Фамилия"
          value={form.surname}
          onChange={e => setForm({ ...form, surname: e.target.value })}
          autoComplete="family-name"
          error={fieldErrors.surname}
        />

        <Button type="submit" variant="primary" loading={loading} className="w-full justify-center">
          Продолжить
        </Button>
      </form>
    </AuthShell>
  );
}
