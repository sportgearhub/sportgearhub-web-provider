import { FormEvent, useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/useAuth';
import { ApiError, authApi } from '../../lib/api-client';
import { AuthShell, IconInput, LoadingNotice, Notice } from './authShared';
import { PasscodeInput } from './PasscodeInput';
import { authPath, type Navigate } from './authUtils';

// There are no passwords. A new session starts with a one-time code mailed to the address; a browser the
// user has already trusted can unlock with a short passcode instead (see PasscodeSignInPage).
export function SignInPage({ onNavigate }: { onNavigate: Navigate }) {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim();

  // A trusted browser goes straight to the passcode screen.
  useEffect(() => {
    if (authApi.hasTrustedDevice()) onNavigate(authPath('/passcode'), true);
  }, [onNavigate]);

  const sendCode = async () => {
    setError('');
    setLoading(true);
    try {
      await requestCode(normalizedEmail);
      setStep('code');
      setCode('');
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'auth.email_required' || err.code === 'auth.email_invalid')) {
        setError(err.message || 'Укажите корректный email.');
        return;
      }
      setError('Не удалось отправить код. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!normalizedEmail) {
      setError('Введите почту.');
      return;
    }
    await sendCode();
  };

  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await verifyCode(normalizedEmail, code);

      if ('registrationToken' in result) {
        onNavigate(`${authPath('/complete-registration')}?token=${encodeURIComponent(result.registrationToken)}`);
        return;
      }

      // Offer to remember this browser so the next visit only needs a passcode.
      onNavigate(authApi.hasTrustedDevice() ? '/' : authPath('/passcode-setup'));
    } catch (err) {
      setCode('');
      setError(err instanceof ApiError
        ? err.message || 'Неверный код.'
        : 'Ошибка в работе сервиса.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'code') {
    return (
      <AuthShell title="Введите код из письма">
        {error && <Notice kind="error">{error}</Notice>}
        <p className="mb-4 text-xs text-gray-500">
          Отправили код на <span className="font-medium text-gray-700">{normalizedEmail}</span>. Код действует 10 минут.
        </p>

        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <PasscodeInput label="Код из письма" value={code} onChange={setCode} length={6} autoFocus disabled={loading} />

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            disabled={code.length < 6}
            className="w-full justify-center"
          >
            Войти
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => void sendCode()} className="font-medium text-blue-700 hover:text-blue-800">
            Отправить код еще раз
          </button>
          <button type="button" onClick={() => setStep('email')} className="font-medium text-blue-700 hover:text-blue-800">
            Изменить почту
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Введите почту">
      {error && <Notice kind="error">{error}</Notice>}

      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <IconInput
          icon={Mail}
          label="Почта"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@provider.com"
          autoComplete="email"
          required
        />

        <Button type="submit" variant="primary" size="md" loading={loading} className="w-full justify-center">
          Получить код
        </Button>
      </form>
    </AuthShell>
  );
}

// Sign-in on a browser the user has trusted. The request carries no email — the account comes from the
// stored device credential — so the passcode cannot be sprayed at a leaked address list.
export function PasscodeSignInPage({ onNavigate }: { onNavigate: Navigate }) {
  const { passcodeSignIn } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [length, setLength] = useState(4);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authApi.hasTrustedDevice()) {
      onNavigate(authPath('/sign-in'), true);
      return;
    }

    void authApi.passcodePolicy().then(policy => setLength(policy.length)).catch(() => undefined);
  }, [onNavigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await passcodeSignIn(passcode);
      onNavigate('/');
    } catch (err) {
      setPasscode('');

      // Device revoked or forgotten: the only way back is a fresh code by email.
      if (err instanceof ApiError
        && (err.code === 'auth.device_not_trusted' || err.code === 'auth.passcode_locked')) {
        setError(err.message);
        window.setTimeout(() => onNavigate(authPath('/sign-in'), true), 2500);
        return;
      }

      setError(err instanceof ApiError ? err.message || 'Неверный код доступа.' : 'Ошибка в работе сервиса.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Введите код доступа">
      {error && <Notice kind="error">{error}</Notice>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasscodeInput label="Код доступа" value={passcode} onChange={setPasscode} length={length} autoFocus disabled={loading} />

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={loading}
          disabled={passcode.length < length}
          className="w-full justify-center"
        >
          Войти
        </Button>
      </form>

      <div className="mt-4 border-t border-gray-100 pt-4 text-xs">
        <button
          type="button"
          onClick={() => {
            authApi.forgetLocalDevice();
            onNavigate(authPath('/sign-in'), true);
          }}
          className="font-medium text-blue-700 hover:text-blue-800"
        >
          Войти по коду из почты
        </button>
      </div>
    </AuthShell>
  );
}

// Offered right after a one-time-code sign-in: remember this browser so the next visit needs only a passcode.
export function PasscodeSetupPage({ onNavigate }: { onNavigate: Navigate }) {
  const [passcode, setPasscode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [length, setLength] = useState(4);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void authApi.passcodePolicy().then(policy => setLength(policy.length)).catch(() => undefined);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (passcode !== confirmation) {
      setError('Коды не совпадают.');
      setConfirmation('');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await authApi.enrolDevice(passcode, navigator.userAgent.slice(0, 100));
      onNavigate('/');
    } catch (err) {
      setPasscode('');
      setConfirmation('');
      setError(err instanceof ApiError ? err.message || 'Не удалось сохранить код доступа.' : 'Ошибка в работе сервиса.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Быстрый вход">
      {error && <Notice kind="error">{error}</Notice>}
      <p className="mb-4 text-xs text-gray-500">
        Задайте код доступа из {length} цифр, чтобы в следующий раз входить без письма. Код работает только
        на этом устройстве.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasscodeInput label="Код доступа" value={passcode} onChange={setPasscode} length={length} autoFocus disabled={loading} />
        <PasscodeInput label="Повторите код" value={confirmation} onChange={setConfirmation} length={length} disabled={loading} />

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={loading}
          disabled={passcode.length < length || confirmation.length < length}
          className="w-full justify-center"
        >
          Сохранить
        </Button>
      </form>

      <div className="mt-4 border-t border-gray-100 pt-4 text-xs">
        <button type="button" onClick={() => onNavigate('/')} className="font-medium text-blue-700 hover:text-blue-800">
          Пропустить
        </button>
      </div>
    </AuthShell>
  );
}

export function MagicSignInPage({ token, onNavigate }: { token: string | null; onNavigate: Navigate }) {
  const { reloadUser } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const magicTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || magicTokenRef.current === token) return;
    magicTokenRef.current = token;

    const startedAt = Date.now();
    const minLoaderMs = 900;
    let cancelled = false;

    const finish = (nextStatus: 'success' | 'error') => {
      const elapsed = Date.now() - startedAt;
      window.setTimeout(() => {
        if (!cancelled) {
          setStatus(nextStatus);
        }
      }, Math.max(0, minLoaderMs - elapsed));
    };

    const signInWithToken = async () => {
      try {
        await authApi.magicSignIn(token);
        const session = await reloadUser();
        if (!session) {
          finish('error');
          return;
        }
        finish('success');
        window.setTimeout(() => {
          if (!cancelled) {
            onNavigate('/');
          }
        }, Math.max(700, minLoaderMs - (Date.now() - startedAt)));
      } catch {
        finish('error');
      }
    };

    void signInWithToken();

    return () => {
      cancelled = true;
    };
  }, [onNavigate, reloadUser, token]);

  return (
    <AuthShell title="Вход по ссылке">
      {status === 'loading' && <LoadingNotice>Входим в кабинет...</LoadingNotice>}
      {status === 'success' && <Notice kind="success">Готово. Открываем кабинет.</Notice>}
      {status === 'error' && <Notice kind="error">Ссылка недействительна или истекла.</Notice>}

      {status === 'error' && (
        <Button onClick={() => onNavigate('/auth/sign-in')} variant="primary" className="w-full justify-center">
          Войти
        </Button>
      )}
    </AuthShell>
  );
}
