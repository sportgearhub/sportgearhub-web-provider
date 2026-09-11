import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { RuPhoneInput } from '../../components/ui/RuPhoneInput';
import { useAuth } from '../../context/useAuth';
import { ApiError } from '../../lib/api-client';
import { AuthShell, Notice } from './authShared';
import type { Navigate } from './authUtils';

// Reached when a one-time code was verified for an address that has no account yet. The email is carried
// by the registration token, so it is never re-submitted by the client.
export function CompleteRegistrationPage({ token, onNavigate }: { token: string | null; onNavigate: Navigate }) {
  const { completeRegistration } = useAuth();
  const [form, setForm] = useState({ name: '', surname: '', phone: '' });
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string }>({});
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
    const phoneDigits = form.phone.replace(/\D/g, '');

    if (!form.name || !form.surname || !phoneDigits) {
      setFieldErrors({});
      setError('Заполните все поля.');
      return;
    }
    if (phoneDigits.length !== 10) {
      setFieldErrors({ phone: 'Укажите корректный номер телефона.' });
      setError('');
      return;
    }

    setFieldErrors({});
    setError('');
    setLoading(true);
    try {
      const session = await completeRegistration({
        token,
        name: form.name,
        surname: form.surname,
        phone: `+7${phoneDigits}`,
      });
      onNavigate(session.memberships.length > 0 ? '/auth/passcode-setup' : '/onboarding');
    } catch (err) {
      if (err instanceof ApiError
        && (err.code === 'auth.phone_required' || err.code === 'auth.phone_invalid' || err.code === 'auth.phone_already_exists')) {
        setFieldErrors({ phone: err.message });
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Не удалось завершить регистрацию.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Расскажите о себе">
      {error && <Notice kind="error">{error}</Notice>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Имя" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="given-name" />
          <Input label="Фамилия" value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} autoComplete="family-name" />
        </div>
        <RuPhoneInput value={form.phone} onChange={value => setForm({ ...form, phone: value })} error={fieldErrors.phone} />

        <Button type="submit" variant="primary" loading={loading} className="w-full justify-center">
          Продолжить
        </Button>
      </form>
    </AuthShell>
  );
}
