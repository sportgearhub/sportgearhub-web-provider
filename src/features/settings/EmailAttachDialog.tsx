import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/useAuth';
import { ApiError, authApi } from '../../lib/api-client';

/**
 * Attaching an email to an account that signs in by phone. Short and self-contained, so it asks in
 * a dialog: the account page keeps showing what is on file, and this is the one task at hand.
 *
 * Typing an address proves nothing, so it is never stored on its own: the address is only written
 * once a code sent to it comes back. Until then the field is just a draft, and the account keeps
 * whatever verified address it already had.
 */
export function EmailAttachDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, reloadSession } = useAuth();
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeLength, setCodeLength] = useState(6);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const current = user?.email ?? null;

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
      await reloadSession();
      setStep('idle');
      setEmail('');
      setCode('');
      onClose();
    } catch (err) {
      setCode('');
      setError(err instanceof ApiError ? err.message || 'Неверный код.' : 'Ошибка в работе сервиса.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={current ? 'Редактирование почты' : 'Добавление почты'} size="sm">
      <p className="text-sm leading-5 text-gray-500">
        Сюда приходят уведомления кабинета: счета, акты и письма о заказах и выплатах.
      </p>

      {/* Just the address. It is here because a code confirmed it, so saying «подтверждена»
          beside it states the condition of being shown at all. */}
      {current && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <span className="text-sm font-medium text-gray-900">{current}</span>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && !error && <p className="mt-3 text-sm text-emerald-700">{notice}</p>}

      {step === 'idle' ? (
        <form onSubmit={handleSend} className="mt-4 space-y-4">
          <Input
            label={current ? 'Новая почта' : 'Почта'}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@provider.com"
            autoComplete="email"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Отмена</Button>
            <Button type="submit" variant="primary" loading={loading}>Отправить код</Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleConfirm} className="mt-4 space-y-4">
          <Input
            label="Код из письма"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, codeLength))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => {
                setStep('idle');
                setNotice('');
                setError('');
              }}
            >
              Назад
            </Button>
            <Button type="submit" variant="primary" loading={loading} disabled={code.length < codeLength}>
              Подтвердить почту
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
