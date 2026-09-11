import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { RuPhoneInput } from '../../components/ui/RuPhoneInput';
import { useAuth } from '../../context/useAuth';
import { ApiError, authApi } from '../../lib/api-client';
import { AuthShell, LoadingNotice, Notice } from './authShared';
import type { Navigate } from './authUtils';
import { useBackToSignIn } from './useBackToSignIn';

type RegisterForm = {
  name: string;
  surname: string;
  email: string;
  phone: string;
};

export function RegisterPage({ token, onNavigate }: { token?: string | null; onNavigate: Navigate }) {
  const { reloadUser } = useAuth();
  const { returning, backToSignIn } = useBackToSignIn(onNavigate);
  const [form, setForm] = useState<RegisterForm>({ name: '', surname: '', email: '', phone: '' });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitationStatus, setInvitationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(token ? 'loading' : 'idle');
  const isInvitationRegistration = Boolean(token);

  useEffect(() => {
    if (!token) {
      setInvitationStatus('idle');
      return;
    }

    let cancelled = false;
    setInvitationStatus('loading');
    setError('');

    authApi.registrationInvitation(token)
      .then(invitation => {
        if (cancelled) return;
        setForm(current => ({ ...current, email: invitation.email }));
        setInvitationStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setInvitationStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const updateForm = (patch: Partial<RegisterForm>) => {
    setForm(current => ({ ...current, ...patch }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const email = form.email.trim();
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (!form.name || !form.surname || !email || !phoneDigits) {
      setFieldErrors({});
      setError('Заполните все поля.');
      return;
    }
    if (phoneDigits.length !== 10) {
      setFieldErrors({ phone: 'Укажите корректный номер телефона.' });
      setError('');
      return;
    }

    const phone = `+7${phoneDigits}`;

    setFieldErrors({});
    setError('');
    setLoading(true);
    try {
      // Registering from an invitation already proves the address, so the API hands back a session.
      await authApi.register(isInvitationRegistration
        ? { token: token ?? undefined, name: form.name, surname: form.surname, phone }
        : { name: form.name, surname: form.surname, email, phone });

      if (isInvitationRegistration) {
        const session = await reloadUser();
        onNavigate(session && session.memberships.length > 0 ? '/' : '/onboarding');
        return;
      }

      onNavigate(`/auth/check-email?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'auth.email_required' || err.code === 'auth.email_already_exists')) {
        setFieldErrors({ email: err.message });
        return;
      }
      if (err instanceof ApiError && (err.code === 'auth.phone_required' || err.code === 'auth.phone_invalid' || err.code === 'auth.phone_already_exists')) {
        setFieldErrors({ phone: err.message });
        return;
      }
      if (err instanceof ApiError && (err.code === 'auth.token_invalid' || err.code === 'auth.token_invalid_or_expired')) {
        setInvitationStatus('error');
        return;
      }
      setError(err instanceof ApiError
        ? err.message
        : 'Не удалось зарегистрироваться. Проверьте данные и попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  if (invitationStatus === 'loading') {
    return (
      <AuthShell title="Регистрация владельца">
        <LoadingNotice>Проверяем ссылку...</LoadingNotice>
      </AuthShell>
    );
  }

  if (invitationStatus === 'error') {
    return (
      <AuthShell title="Регистрация владельца">
        <Notice kind="error">Ссылка недействительна или истекла.</Notice>
        <Button onClick={() => onNavigate('/auth/sign-in')} variant="primary" className="w-full justify-center">
          Войти
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Регистрация владельца">
      {error && <Notice kind="error">{error}</Notice>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Имя" value={form.name} onChange={e => updateForm({ name: e.target.value })} autoComplete="given-name" />
          <Input label="Фамилия" value={form.surname} onChange={e => updateForm({ surname: e.target.value })} autoComplete="family-name" />
        </div>
        <Input label="Почта" type="email" value={form.email} onChange={e => updateForm({ email: e.target.value })} autoComplete="email" error={fieldErrors.email} disabled={isInvitationRegistration} />
        <RuPhoneInput value={form.phone} onChange={value => updateForm({ phone: value })} error={fieldErrors.phone} />
        <Button type="submit" variant="primary" loading={loading} className="w-full justify-center">
          Создать аккаунт
        </Button>
      </form>

      <button onClick={backToSignIn} disabled={returning} className="mt-4 w-full text-center text-xs font-medium text-blue-700 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-gray-400">
        Вернуться ко входу
      </button>
    </AuthShell>
  );
}
