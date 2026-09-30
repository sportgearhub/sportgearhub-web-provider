import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { RuPhoneInput } from '../../components/ui/RuPhoneInput';
import { useAuth } from '../../context/useAuth';
import { ApiError, authApi, type VerificationStarted } from '../../lib/api-client';
import { AuthLink, AuthShell, Notice, authControlClass } from './authShared';
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
      <AuthShell
        title="Введите код из SMS"
        subtitle={<>Отправили код на <span className="font-medium text-foreground">+7 {digits}</span>. Код действует 10 минут.</>}
        footer={
          <>
            <AuthLink onClick={() => void begin()}>Отправить код ещё раз</AuthLink>
            <AuthLink onClick={() => setStep('phone')} tone="muted">Изменить номер</AuthLink>
          </>
        }
      >
        {error && <Notice kind="error">{error}</Notice>}

        <form onSubmit={handleCodeSubmit} className="space-y-5">
          <PasscodeInput label="Код из SMS" value={code} onChange={setCode} length={started?.codeLength ?? 6} autoFocus disabled={loading} />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={code.length < (started?.codeLength ?? 6)}
            className={`w-full ${authControlClass}`}
          >
            Войти
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Кабинет продавца"
      subtitle="Войдите по номеру телефона — пришлём код в SMS. Пароль не нужен."
    >
      {error && <Notice kind="error">{error}</Notice>}

      <form onSubmit={handlePhoneSubmit} className="space-y-5">
        <RuPhoneInput label="Номер телефона" value={phone} onChange={setPhone} size="lg" />

        <Button type="submit" variant="primary" loading={loading} className={`w-full ${authControlClass}`}>
          Получить код
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
    <AuthShell
      title="Подтвердите вход"
      subtitle={<>Отправили запрос на <span className="font-medium text-foreground">+7 {phone}</span>.</>}
      /* The wait can run for a while and the number may simply be wrong, so there has to be a way
         out that is not waiting for a timeout. */
      footer={<AuthLink onClick={onBack} tone="muted">Изменить номер</AuthLink>}
    >
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm leading-5 text-muted-foreground">
          Подтвердите вход на мобильном устройстве. Если подтверждение не придёт, мы пришлём код в SMS.
        </p>
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
    <AuthShell
      title="С возвращением"
      subtitle="Введите код доступа, который вы задали на этом устройстве."
      footer={
        <AuthLink
          onClick={() => {
            authApi.forgetLocalDevice();
            onNavigate(authPath('/sign-in'), true);
          }}
        >
          Войти по коду из SMS
        </AuthLink>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <PasscodeInput label="Код доступа" value={passcode} onChange={setPasscode} length={length} autoFocus disabled={loading} />

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={passcode.length < length}
          className={`w-full ${authControlClass}`}
        >
          Войти
        </Button>
      </form>
    </AuthShell>
  );
}

// Offered right after a one-time-code sign-in: remember this browser so the next visit needs only a passcode.
export function PasscodeSetupPage({ onNavigate }: { onNavigate: Navigate }) {
  // Two steps rather than two fields: a code you are inventing should be typed once, then proved
  // from memory. Both on screen at the same time invites copying the first row into the second.
  const [step, setStep] = useState<'create' | 'repeat'>('create');
  const [passcode, setPasscode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [length, setLength] = useState(4);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void authApi.passcodePolicy().then(policy => setLength(policy.length)).catch(() => undefined);
  }, []);

  const save = async (code: string) => {
    setError('');
    setLoading(true);
    try {
      await authApi.enrolDevice(code, navigator.userAgent.slice(0, 100));
      onNavigate('/');
    } catch (err) {
      restart(err instanceof ApiError ? err.message || 'Не удалось сохранить код доступа.' : 'Ошибка в работе сервиса.');
    } finally {
      setLoading(false);
    }
  };

  const restart = (message: string) => {
    setPasscode('');
    setConfirmation('');
    setStep('create');
    setError(message);
  };

  const handleCreate = (next: string) => {
    setPasscode(next);
    setError('');
    if (next.length === length) setStep('repeat');
  };

  const handleRepeat = (next: string) => {
    setConfirmation(next);
    setError('');
    if (next.length < length) return;
    if (next !== passcode) {
      restart('Коды не совпали. Попробуйте ещё раз.');
      return;
    }
    void save(next);
  };

  return (
    <AuthShell
      title="Быстрый вход"
      subtitle={
        step === 'create'
          ? `Придумайте код из ${length} цифр, чтобы в следующий раз входить без SMS. Код работает только на этом устройстве.`
          : 'Введите код ещё раз, чтобы не ошибиться.'
      }
      footer={
        <>
          {step === 'repeat' ? (
            <AuthLink onClick={() => restart('')} disabled={loading} tone="muted">
              Ввести другой код
            </AuthLink>
          ) : (
            <AuthLink onClick={() => onNavigate('/')} tone="muted">
              Пропустить
            </AuthLink>
          )}
          {loading && <span className="text-sm text-muted-foreground">Сохраняем…</span>}
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}

      <PasscodeInput
        key={step}
        label={step === 'create' ? 'Придумайте код' : 'Повторите код'}
        value={step === 'create' ? passcode : confirmation}
        onChange={step === 'create' ? handleCreate : handleRepeat}
        length={length}
        autoFocus
        disabled={loading}
      />
    </AuthShell>
  );
}
