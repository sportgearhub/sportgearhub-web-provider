import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { RuPhoneInput } from '../../components/ui/RuPhoneInput';
import { useAuth } from '../../context/useAuth';
import { ApiError, authApi, type VerificationStarted } from '../../lib/api-client';
import { Mail } from 'lucide-react';
import { AuthLink, AuthShell, IconInput, authControlClass } from './authShared';
import { useToast } from '../../components/ui/Toast';
import { PasscodeInput } from './PasscodeInput';
import { useVerificationStage } from './useVerificationStage';
import { authPath, type AuthChannel, type Navigate } from './authUtils';

// There are no passwords. A new session starts with a one-time code mailed to the address; a browser the
// user has already trusted can unlock with a short passcode instead (see PasscodeSignInPage).
export function SignInPage({ onNavigate }: { onNavigate: Navigate }) {
  const { verifyCode } = useAuth();
  const [step, setStep] = useState<'phone' | 'waiting' | 'code'>('phone');
  // Neither credential is the fallback: a seller who registered with an address and never gave a
  // number has only that door, and one who has both can use either.
  const [channel, setChannel] = useState<AuthChannel>('phone');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [started, setStarted] = useState<VerificationStarted | null>(null);
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const digits = phone.replace(/\D/g, '');
  const e164 = `+7${digits}`;
  const contact = channel === 'email' ? email.trim() : e164;

  useEffect(() => {
    if (authApi.hasTrustedDevice()) onNavigate(authPath('/passcode'), true);
  }, [onNavigate]);

  const onProven = () => onNavigate(authApi.hasTrustedDevice() ? '/' : authPath('/passcode-setup'));

  // The registration screen has to finish on the same channel it started on, so it is told which.
  const onRegistration = (registrationToken: string) =>
    onNavigate(
      `${authPath('/complete-registration')}?token=${encodeURIComponent(registrationToken)}&channel=${channel}`
    );

  const begin = async () => {
    setLoading(true);
    try {
      const result = channel === 'email'
        ? await authApi.requestEmailCode(contact)
        : await authApi.requestPhoneCode(contact);
      setStarted(result);
      setCode('');
      // The API says whether there is anything to type yet. With a SIM push there is not, until
      // and unless it falls back to SMS. An e-mail is always a code to type.
      setStep(channel === 'phone' && result.stage === 'pending' ? 'waiting' : 'code');
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Не удалось отправить код. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (channel === 'phone' && digits.length !== 10) {
      toast.show('Укажите корректный номер телефона.');
      return;
    }
    if (channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) {
      toast.show('Укажите корректный адрес почты.');
      return;
    }
    await begin();
  };

  const submitCode = async (value: string) => {
    setLoading(true);
    try {
      const result = await verifyCode(channel, contact, value);
      if ('registrationToken' in result) return onRegistration(result.registrationToken);
      onProven();
    } catch (err) {
      setCode('');
      toast.show(err instanceof ApiError ? err.message || 'Неверный код.' : 'Ошибка в работе сервиса.');
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
          toast.show(notice);
        }}
        onBack={() => {
          setStep('phone');
          setStarted(null);
        }}
      />
    );
  }

  if (step === 'code') {
    return (
      <AuthShell
        title={channel === 'email' ? 'Введите код из письма' : 'Введите код из SMS'}
        subtitle={<>Код отправлен на {channel === 'email' ? contact : `+7 ${digits}`}. Действует 10 минут.</>}
        busy={loading ? 'Проверяем код…' : undefined}
        footer={
          <>
            <AuthLink onClick={() => void begin()}>Отправить код ещё раз</AuthLink>
            <AuthLink onClick={() => setStep('phone')} tone="muted">
              {channel === 'email' ? 'Изменить адрес' : 'Изменить номер'}
            </AuthLink>
          </>
        }
      >
        {toast.node}
        <PasscodeInput
          label={channel === 'email' ? 'Код из письма' : 'Код из SMS'}
          value={code}
          onChange={next => {
            setCode(next);
                  if (next.length === (started?.codeLength ?? 6)) void submitCode(next);
          }}
          length={started?.codeLength ?? 6}
          autoFocus
          disabled={loading}
        />

      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Кабинет продавца"
      subtitle={channel === 'email' ? 'Пришлём код на почту.' : 'Пришлём код в SMS.'}
      busy={loading ? 'Отправляем код…' : undefined}
      footer={
        /* The other door, named rather than hidden behind «ещё». Nobody is signing in «by another
           method»; they are signing in with the credential they have. */
        <AuthLink
          onClick={() => setChannel(channel === 'email' ? 'phone' : 'email')}
          disabled={loading}
        >
          {channel === 'email' ? 'Войти по номеру телефона' : 'Войти по почте'}
        </AuthLink>
      }
    >
      {toast.node}
      <form onSubmit={handleSubmit} className="space-y-5">
        {channel === 'email' ? (
          <IconInput
            icon={Mail}
            label="Почта"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        ) : (
          <RuPhoneInput label="Номер телефона" value={phone} onChange={setPhone} size="lg" />
        )}

        {/* No spinner in the button: the bar across the top of the page is saying it, and this
            one is about to be replaced by the next step anyway. */}
        <Button type="submit" variant="primary" disabled={loading} className={`w-full ${authControlClass}`}>
          Войти
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
      busy="Ждём подтверждения…"
      /* The wait can run for a while and the number may simply be wrong, so there has to be a way
         out that is not waiting for a timeout. */
      footer={<AuthLink onClick={onBack} tone="muted">Изменить номер</AuthLink>}
    >
      <p className="text-center text-sm leading-5 text-muted-foreground lg:text-left">
        Подтвердите вход на мобильном устройстве. Если подтверждение не придёт, мы пришлём код в SMS.
      </p>
    </AuthShell>
  );
}

// Sign-in on a browser the user has trusted. The request carries no email — the account comes from the
// stored device credential — so the passcode cannot be sprayed at a leaked address list.
export function PasscodeSignInPage({ onNavigate }: { onNavigate: Navigate }) {
  const { passcodeSignIn } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [length, setLength] = useState(4);
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authApi.hasTrustedDevice()) {
      onNavigate(authPath('/sign-in'), true);
      return;
    }

    void authApi.passcodePolicy().then(policy => setLength(policy.length)).catch(() => undefined);
  }, [onNavigate]);

  // The last digit is the whole instruction. Asking for a button press afterwards adds a step that
  // says nothing the code did not already say.
  const submit = async (code: string) => {
    setLoading(true);
    try {
      await passcodeSignIn(code);
      onNavigate('/');
    } catch (err) {
      setPasscode('');

      // Device revoked or forgotten: the only way back is a fresh code by email.
      if (err instanceof ApiError
        && (err.code === 'auth.device_not_trusted' || err.code === 'auth.passcode_locked')) {
        toast.show(err.message);
        window.setTimeout(() => onNavigate(authPath('/sign-in'), true), 2500);
        return;
      }

      toast.show(err instanceof ApiError ? err.message || 'Неверный код доступа.' : 'Ошибка в работе сервиса.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (next: string) => {
    setPasscode(next);
    if (next.length === length) void submit(next);
  };

  return (
    <AuthShell
      title="С возвращением"
      subtitle="Код доступа этого устройства."
      busy={loading ? 'Входим…' : undefined}
      footer={
        <AuthLink
          onClick={() => {
            authApi.forgetLocalDevice();
            onNavigate(authPath('/sign-in'), true);
          }}
        >
          Войти по одноразовому коду
        </AuthLink>
      }
    >
      {toast.node}
      <PasscodeInput label="Код доступа" value={passcode} onChange={handleChange} length={length} autoFocus disabled={loading} />
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
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void authApi.passcodePolicy().then(policy => setLength(policy.length)).catch(() => undefined);
  }, []);

  const save = async (code: string) => {
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
    toast.show(message);
  };

  const handleCreate = (next: string) => {
    setPasscode(next);
    if (next.length === length) setStep('repeat');
  };

  const handleRepeat = (next: string) => {
    setConfirmation(next);
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
      busy={loading ? 'Сохраняем код…' : undefined}
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
        </>
      }
    >
      {toast.node}
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
