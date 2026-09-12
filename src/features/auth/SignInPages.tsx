import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { RuPhoneInput } from '../../components/ui/RuPhoneInput';
import { useAuth } from '../../context/useAuth';
import { ApiError, authApi, type VerificationStarted } from '../../lib/api-client';
import { AuthShell, LoadingNotice, Notice } from './authShared';
import { PasscodeInput } from './PasscodeInput';
import { useVerificationStage } from './useVerificationStage';
import { authPath, type Navigate } from './authUtils';

// There are no passwords. A new session starts with a one-time code mailed to the address; a browser the
// user has already trusted can unlock with a short passcode instead (see PasscodeSignInPage).
export function SignInPage({ onNavigate }: { onNavigate: Navigate }) {
  const { verifyPhoneCode } = useAuth();
  const [step, setStep] = useState<'phone' | 'waiting' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [started, setStarted] = useState<VerificationStarted | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const digits = phone.replace(/\D/g, '');
  const e164 = `+7${digits}`;

  useEffect(() => {
    if (authApi.hasTrustedDevice()) onNavigate(authPath('/passcode'), true);
  }, [onNavigate]);

  const onProven = () => onNavigate(authApi.hasTrustedDevice() ? '/' : authPath('/passcode-setup'));

  const onRegistration = (registrationToken: string) =>
    onNavigate(`${authPath('/complete-registration')}?token=${encodeURIComponent(registrationToken)}`);

  const begin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await authApi.requestPhoneCode(e164);
      setStarted(result);
      setCode('');
      // The API says whether there is anything to type yet. With a SIM push there is not, until
      // and unless it falls back to SMS.
      setStep(result.stage === 'pending' ? 'waiting' : 'code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить код. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (digits.length !== 10) {
      setError('Укажите корректный номер телефона.');
      return;
    }
    await begin();
  };

  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await verifyPhoneCode(e164, code);
      if ('registrationToken' in result) return onRegistration(result.registrationToken);
      onProven();
    } catch (err) {
      setCode('');
      setError(err instanceof ApiError ? err.message || 'Неверный код.' : 'Ошибка в работе сервиса.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'waiting' && started) {
    return (
      <PushWaitingStep
        phone={digits}
        started={started}
        onNeedsCode={() => setStep('code')}
        onSignedIn={onProven}
        onNeedsRegistration={onRegistration}
        onRestart={notice => {
          setStep('phone');
          setStarted(null);
          setError(notice);
        }}
        onBack={() => {
          setStep('phone');
          setStarted(null);
          setError('');
        }}
      />
    );
  }

  if (step === 'code') {
    return (
      <AuthShell title="Введите код из SMS">
        {error && <Notice kind="error">{error}</Notice>}
        <p className="mb-4 text-xs text-gray-500">
          Отправили код на <span className="font-medium text-gray-700">+7 {digits}</span>. Код действует 10 минут.
        </p>

        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <PasscodeInput label="Код из SMS" value={code} onChange={setCode} length={started?.codeLength ?? 6} autoFocus disabled={loading} />

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            disabled={code.length < (started?.codeLength ?? 6)}
            className="w-full justify-center"
          >
            Войти
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => void begin()} className="font-medium text-blue-700 hover:text-blue-800">
            Отправить код ещё раз
          </button>
          <button type="button" onClick={() => setStep('phone')} className="font-medium text-blue-700 hover:text-blue-800">
            Изменить номер
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Введите номер телефона">
      {error && <Notice kind="error">{error}</Notice>}

      <form onSubmit={handlePhoneSubmit} className="space-y-4">
        <RuPhoneInput value={phone} onChange={setPhone} />

        <Button type="submit" variant="primary" size="md" loading={loading} className="w-full justify-center">
          Продолжить
        </Button>
      </form>
    </AuthShell>
  );
}

/**
 * The wait while a SIM push is with the user.
 *
 * Nothing here is driven by the browser: the user approves the push in the MTS app, the provider
 * tells the API, and this finds out by polling. Three things can happen and each is someone else's
 * decision — approved (sign in, no code ever typed), fallen back to SMS (show the keypad), or over.
 */
function PushWaitingStep({
  phone,
  started,
  onNeedsCode,
  onSignedIn,
  onNeedsRegistration,
  onRestart,
  onBack,
}: {
  phone: string;
  started: VerificationStarted;
  onNeedsCode: () => void;
  onSignedIn: () => void;
  onNeedsRegistration: (token: string) => void;
  onRestart: (notice: string) => void;
  onBack: () => void;
}) {
  const stage = useVerificationStage(started.verificationId, started.stage);

  // The stage settles once. Without this guard the effect re-runs whenever a parent render gives
  // the callbacks new identities, and the redeem would be sent twice.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || stage === 'pending') return;

    if (stage === 'code_required') {
      handled.current = true;
      onNeedsCode();
      return;
    }

    if (stage !== 'confirmed') {
      handled.current = true;
      onRestart(
        stage === 'expired'
          ? 'Время подтверждения истекло. Попробуйте ещё раз.'
          : 'Подтвердить вход не удалось. Попробуйте ещё раз.',
      );
      return;
    }

    handled.current = true;
    void (async () => {
      try {
        const result = await authApi.redeemConfirmedPhone(started.verificationId);
        if (result.status === 'registration_required') {
          onNeedsRegistration(result.registrationToken);
          return;
        }
        onSignedIn();
      } catch (err) {
        onRestart(err instanceof ApiError ? err.message : 'Подтвердить вход не удалось.');
      }
    })();
  }, [stage, started.verificationId, onNeedsCode, onSignedIn, onNeedsRegistration, onRestart]);

  return (
    <AuthShell title="Подтвердите вход">
      <p className="mb-4 text-xs text-gray-500">
        Отправили запрос на <span className="font-medium text-gray-700">+7 {phone}</span>.
      </p>

      <div className="grid justify-items-center gap-4 py-2">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
        <p className="text-center text-xs text-gray-500">
          Подтвердите вход в приложении МТС. Если подтверждение не придёт, мы пришлём код в SMS.
        </p>

        {/* The wait can run for a while and the number may simply be wrong, so there has to be a
            way out that is not waiting for a timeout. */}
        <button type="button" onClick={onBack} className="text-xs font-medium text-blue-700 hover:text-blue-800">
          Изменить номер
        </button>
      </div>
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
          Войти по коду из SMS
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
