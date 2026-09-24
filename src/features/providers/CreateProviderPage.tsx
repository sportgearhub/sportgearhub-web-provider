import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { FocusFrame } from '../../components/layout/FocusFrame';
import { useAuth } from '../../context/useAuth';
import { ApiError, providersApi } from '../../lib/api-client';
import { selectProvider } from '../../lib/active-provider';
import { AGREEMENT_URL } from './providerStatus';
import { SellerDetailsFields, SellerKindChoice, emptySellerDraft, isSellerInnOk, sellerDraftError, sellerDraftToInput, type SellerDraft } from './SellerDetailsFields';

type Step = 'kind' | 'seller' | 'about';

/**
 * «Добавить кабинет» — three screens: who you are, the ИНН (the registry fills the rest), a name.
 * The provider is created on the last click together with its legal party and the accepted
 * agreement; the kind and ИНН never change afterwards.
 */
export function CreateProviderPage() {
  const { user, providers, reloadSession } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('kind');
  const [draft, setDraft] = useState<SellerDraft>(() => emptySellerDraft(user?.name));
  const [noBusinessYet, setNoBusinessYet] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const kind = draft.kind;
  const innOk = isSellerInnOk(draft);

  const goToAbout = () => {
    const problem = sellerDraftError(draft);
    setError(problem ?? '');
    if (!problem) setStep('about');
  };

  const create = async () => {
    if (!kind) return;
    setSaving(true);
    setError('');
    try {
      const provider = await providersApi.create({
        seller: sellerDraftToInput(draft),
        displayName: displayName.trim() || undefined,
        description: description.trim() || undefined,
      });
      await reloadSession();
      selectProvider(provider.providerId);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать кабинет.');
      // The registry refused the ИНН or the kind: that is screen two's problem.
      if (err instanceof ApiError && err.code?.startsWith('seller.')) setStep('seller');
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = step === 'kind' ? 1 : step === 'seller' ? 2 : 3;

  return (
    <FocusFrame>
      <Card className="space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-950">
            {step === 'kind' && 'Кто вы?'}
            {step === 'seller' && 'Данные продавца'}
            {step === 'about' && 'О вашем прокате'}
          </h1>
          <span className="text-xs text-gray-500">Шаг {stepIndex} из 3</span>
        </div>

        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        {step === 'kind' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Форма ведения бизнеса. Её нельзя будет изменить: другая форма — это другой кабинет.</p>
            <SellerKindChoice
              value={kind}
              onChange={next => {
                setDraft(current => ({ ...current, kind: next, inn: '' }));
                setNoBusinessYet(false);
              }}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={noBusinessYet} onChange={event => setNoBusinessYet(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              У меня ещё нет ИП или самозанятости
            </label>
            {noBusinessYet && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-900">
                <p className="font-semibold">Без ИП или самозанятости сдавать в прокат не получится.</p>
                <p className="mt-1">Самозанятость оформляется за 10 минут в приложении «Мой налог» или на Госуслугах. Вернитесь сюда, когда получите статус.</p>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate(providers.length > 0 ? '/providers' : '/auth/sign-in')}>
                <ArrowLeft size={14} /> Назад
              </Button>
              <Button type="button" variant="primary" disabled={!kind || noBusinessYet} onClick={() => setStep('seller')}>
                Далее
              </Button>
            </div>
          </div>
        )}

        {step === 'seller' && kind && (
          <div className="space-y-3">
            <SellerDetailsFields draft={draft} onChange={setDraft} onLookupError={setError} />
            <div className="flex justify-between pt-2">
              <Button type="button" variant="secondary" onClick={() => setStep('kind')}>
                <ArrowLeft size={14} /> Назад
              </Button>
              <Button type="button" variant="primary" disabled={!innOk} onClick={goToAbout}>
                Далее
              </Button>
            </div>
          </div>
        )}

        {step === 'about' && (
          <div className="space-y-3">
            <Input label="Название кабинета" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder={kind === 'self_employed' ? 'Прокат Петрова' : 'Название, которое увидят клиенты'} />
            <Textarea label="Коротко о вас" rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Велосипеды и самокаты в Уфе, выдача у парка." />
            <label className="flex items-start gap-2 text-xs leading-5 text-gray-700">
              <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
              <span>
                Принимаю условия{' '}
                <a href={AGREEMENT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-blue-700 hover:underline">
                  Договора для провайдеров <ExternalLink size={11} />
                </a>{' '}
                и даю согласие на обработку персональных данных. Договору будет присвоен номер.
              </span>
            </label>
            <div className="flex justify-between pt-2">
              <Button type="button" variant="secondary" onClick={() => setStep('seller')}>
                <ArrowLeft size={14} /> Назад
              </Button>
              <Button type="button" variant="primary" disabled={!consent} loading={saving} onClick={() => void create()}>
                <Check size={14} /> Готово
              </Button>
            </div>
          </div>
        )}
      </Card>
    </FocusFrame>
  );
}

