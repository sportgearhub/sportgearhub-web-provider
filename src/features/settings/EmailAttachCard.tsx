import { FormEvent, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/useAuth';
import { ApiError, authApi } from '../../lib/api-client';

/**
 * Attaching an email to an account that signs in by phone.
 *
 * Typing an address proves nothing, so it is never stored on its own: the address is only written
 * once a code sent to it comes back. Until then the field is just a draft, and the account keeps
 * whatever verified address it already had.
 */
export function EmailAttachCard() {
  const { user, reloadUser } = useAuth();
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeLength, setCodeLength] = useState(6);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const current = user?.email ?? null;
  const verified = current !== null && user?.emailVerified !== false;

  const sendCode = async (address: string) => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const started = await authApi.startEmailAttach(address);
      setCodeLength(started.codeLength);
      setCode('');
      setStep('code');
      setNotice(`Отправили код на ${address}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить код.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();

    if (!address) {
      setError('Укажите почту.');
      return;
    }

    await sendCode(address);
  };

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.confirmEmailAttach(email.trim(), code);
      await reloadUser();
      setStep('idle');
      setEmail('');
      setCode('');
      setNotice('Почта подтверждена.');
    } catch (err) {
      setCode('');
      setError(err instanceof ApiError ? err.message || 'Неверный код.' : 'Ошибка в работе сервиса.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-none border-0 border-t border-gray-100 p-6 shadow-none">
      <h2 className="text-sm font-semibold text-gray-900">Почта</h2>
      <p className="mt-1 text-xs text-gray-500">
        Нужна для счетов, актов и уведомлений. Вход выполняется по номеру телефона.
      </p>

      {current && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          {verified && <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />}
          <span className="text-xs font-medium text-gray-900">{current}</span>
          <span className="ml-auto text-xs text-gray-500">{verified ? 'Подтверждена' : 'Не подтверждена'}</span>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
      {notice && !error && <p className="mt-3 text-xs text-emerald-700">{notice}</p>}

      {step === 'idle' ? (
        <form onSubmit={handleSend} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label={current ? 'Новая почта' : 'Почта'}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@provider.com"
              autoComplete="email"
            />
          </div>
          <Button type="submit" variant="secondary" loading={loading} className="sm:w-auto">
            Подтвердить
          </Button>
        </form>
      ) : (
        <form onSubmit={handleConfirm} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Код из письма"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, codeLength))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </div>
          <Button type="submit" variant="primary" loading={loading} disabled={code.length < codeLength} className="sm:w-auto">
            Готово
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setStep('idle');
              setNotice('');
              setError('');
            }}
            className="sm:w-auto"
          >
            Отмена
          </Button>
        </form>
      )}
    </Card>
  );
}
