import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/useAuth';
import { ApiError } from '../../lib/api-client';
import { AuthShell, authControlClass } from './authShared';
import { useToast } from '../../components/ui/Toast';
import type { AuthChannel, Navigate } from './authUtils';

type FieldErrors = { name?: string; surname?: string; birthday?: string };

/** A real past date, and not more than 120 years ago — the API's own rule. */
function birthdayError(value: string): string | undefined {
  if (!value) return 'Укажите дату рождения.';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Укажите дату в формате ДД.ММ.ГГГГ.';
  const now = new Date();
  if (date > now) return 'Дата рождения не может быть в будущем.';
  const oldest = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
  if (date < oldest) return 'Проверьте дату рождения.';
  return undefined;
}

// Reached when a one-time code proved a number that has no account yet. The number itself is
// carried by the registration token, so it is never re-submitted — and nothing else is asked for:
// an email is optional and attached later, from the profile, with its own confirmation.
export function CompleteRegistrationPage({
  token,
  channel = 'phone',
  onNavigate,
}: {
  token: string | null;
  /** Which credential proved them. Registration has to finish on the channel it started on. */
  channel?: AuthChannel;
  onNavigate: Navigate;
}) {
  const { completeRegistration } = useAuth();
  const [form, setForm] = useState({ name: '', surname: '', birthday: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <AuthShell title="Ссылка недействительна" subtitle="Она истекла или уже была использована. Начните вход заново.">
        <Button
          onClick={() => onNavigate('/auth/sign-in')}
          variant="primary"
          className={`w-full ${authControlClass}`}
        >
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
    next.birthday = birthdayError(form.birthday);

    Object.keys(next).forEach(key => {
      if (!next[key as keyof FieldErrors]) delete next[key as keyof FieldErrors];
    });

    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      await completeRegistration(channel, {
        token,
        name: form.name.trim(),
        surname: form.surname.trim(),
        birthday: form.birthday,
      });
      onNavigate('/auth/passcode-setup');
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: FieldErrors = {
          name: err.fieldError('name'),
          surname: err.fieldError('surname'),
          birthday: err.fieldError('birthday'),
        };
        const hasFieldError = Object.values(mapped).some(Boolean);
        setFieldErrors(mapped);
        toast.show(hasFieldError ? '' : err.message || 'Не удалось завершить регистрацию.');
        return;
      }

      toast.show('Не удалось завершить регистрацию.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Как вас зовут?"
      subtitle="Имя видят сотрудники кабинета и поддержка."
      busy={loading ? 'Создаём кабинет…' : undefined}
    >
      {toast.node}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label="Имя"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          autoComplete="given-name"
          error={fieldErrors.name}
          className={authControlClass}
        />
        <Input
          label="Фамилия"
          value={form.surname}
          onChange={e => setForm({ ...form, surname: e.target.value })}
          autoComplete="family-name"
          error={fieldErrors.surname}
          className={authControlClass}
        />

        <Input
          label="Дата рождения"
          type="date"
          value={form.birthday}
          onChange={e => setForm({ ...form, birthday: e.target.value })}
          autoComplete="bday"
          error={fieldErrors.birthday}
          max={new Date().toISOString().slice(0, 10)}
          className={authControlClass}
        />

        <Button type="submit" variant="primary" disabled={loading} className={`w-full ${authControlClass}`}>
          Продолжить
        </Button>
      </form>
    </AuthShell>
  );
}
