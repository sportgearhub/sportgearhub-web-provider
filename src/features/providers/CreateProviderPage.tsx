import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Check, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StepChoice } from '../../components/ui/StepChoice';
import { Textarea } from '../../components/ui/Textarea';
import { FocusFrame } from '../../components/layout/FocusFrame';
import { useAuth } from '../../context/useAuth';
import { ApiError, providersApi } from '../../lib/api-client';
import { selectProvider } from '../../lib/active-provider';
import type { LegalIdentityLookup, SellerKind } from '../../types';
import { AGREEMENT_URL, isValidInn, taxationSystemOptions, vatRateOptions } from './providerStatus';

type Step = 'kind' | 'seller' | 'about';

const kinds: { value: SellerKind; title: string; description: string }[] = [
  { value: 'self_employed', title: 'Самозанятый', description: 'Плательщик НПД. Выплаты по СБП на ваш номер телефона.' },
  { value: 'sole_proprietor', title: 'ИП', description: 'Индивидуальный предприниматель. Выплаты на расчётный счёт.' },
  { value: 'company', title: 'Организация', description: 'ООО, АО и другие юрлица. Выплаты на расчётный счёт.' },
];

/**
 * «Добавить кабинет» — three screens: who you are, the ИНН (the registry fills the rest), a name.
 * The provider is created on the last click together with its legal party and the accepted
 * agreement; the kind and ИНН never change afterwards.
 */
export function CreateProviderPage() {
  const { user, providers, reloadSession } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('kind');
  const [kind, setKind] = useState<SellerKind | ''>('');
  const [noBusinessYet, setNoBusinessYet] = useState(false);
  const [inn, setInn] = useState('');
  const [person, setPerson] = useState(() => {
    const [firstName = '', lastName = ''] = (user?.name ?? '').split(' ');
    return { lastName, firstName, middleName: '' };
  });
  const [taxationSystem, setTaxationSystem] = useState('usn');
  const [vatRate, setVatRate] = useState('none');
  const [lookup, setLookup] = useState<LegalIdentityLookup | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'missing'>('idle');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const innDigits = inn.replace(/\D/g, '');
  const isBusiness = kind === 'sole_proprietor' || kind === 'company';
  const expectedInnLength = kind === 'company' ? 10 : 12;
  const innOk = innDigits.length === expectedInnLength && isValidInn(innDigits);

  // The registry is asked as soon as the ИНН is complete and passes its checksum — no button.
  useEffect(() => {
    if (!isBusiness || !innOk) {
      setLookup(null);
      setLookupState('idle');
      return;
    }
    let cancelled = false;
    setLookupState('loading');
    const timer = window.setTimeout(async () => {
      try {
        const found = await providersApi.lookupSeller(innDigits);
        if (cancelled) return;
        setLookup(found);
        setLookupState('idle');
      } catch (err) {
        if (cancelled) return;
        setLookup(null);
        setLookupState('missing');
        if (err instanceof ApiError && err.status !== 404) setError(err.message);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [innDigits, innOk, isBusiness]);

  const goToAbout = () => {
    setError('');
    if (!innOk) {
      setError(kind === 'company' ? 'ИНН организации — 10 цифр с верной контрольной суммой.' : 'ИНН — 12 цифр с верной контрольной суммой.');
      return;
    }
    if (kind === 'self_employed' && (!person.lastName.trim() || !person.firstName.trim())) {
      setError('Укажите фамилию и имя как в налоговом учёте.');
      return;
    }
    setStep('about');
  };

  const create = async () => {
    if (!kind) return;
    setSaving(true);
    setError('');
    try {
      const provider = await providersApi.create({
        seller: {
          kind,
          inn: innDigits,
          ...(isBusiness ? { taxationSystem, vatRate } : {}),
          ...(kind === 'self_employed'
            ? { person: { lastName: person.lastName.trim(), firstName: person.firstName.trim(), middleName: person.middleName.trim() || null } }
            : {}),
        },
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
            {kinds.map(item => (
              <StepChoice
                key={item.value}
                selected={kind === item.value}
                title={item.title}
                description={item.description}
                onClick={() => {
                  setKind(item.value);
                  setNoBusinessYet(false);
                  setLookup(null);
                }}
              />
            ))}
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
            <Input
              label={kind === 'company' ? 'ИНН организации (10 цифр)' : 'ИНН (12 цифр)'}
              inputMode="numeric"
              value={inn}
              onChange={event => {
                setInn(event.target.value.replace(/[^\d\s]/g, ''));
                setLookup(null);
                setLookupState('idle');
              }}
              placeholder={kind === 'company' ? '7707083893' : '500100732259'}
            />
            {kind === 'self_employed' ? (
              <>
                <p className="text-xs text-gray-500">Как в налоговом учёте. Подставили из вашего профиля — поправьте, если нужно.</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input label="Фамилия" value={person.lastName} onChange={event => setPerson(current => ({ ...current, lastName: event.target.value }))} />
                  <Input label="Имя" value={person.firstName} onChange={event => setPerson(current => ({ ...current, firstName: event.target.value }))} />
                  <Input label="Отчество" value={person.middleName} onChange={event => setPerson(current => ({ ...current, middleName: event.target.value }))} />
                </div>
                <p className="text-xs text-gray-500">Система налогообложения: НПД. Выплаты — по СБП на номер телефона.</p>
              </>
            ) : (
              <>
                {lookupState === 'loading' && <p className="text-xs text-gray-500">Ищем в реестре…</p>}
                {lookupState === 'missing' && <p className="text-xs text-amber-700">В реестре не нашли — проверьте ИНН.</p>}
                {lookup && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-950">
                    <p className="flex items-center gap-1.5 text-sm font-semibold"><Building2 size={14} /> {lookup.legalName}</p>
                    <p>ОГРН {lookup.registrationNumber ?? '—'}{lookup.branchNumber ? ` · КПП ${lookup.branchNumber}` : ''}</p>
                    {lookup.address && <p>{lookup.address}</p>}
                    {lookup.chiefExecutivePrefill && (
                      <p>
                        {lookup.chiefExecutivePrefill.position ?? 'Руководитель'}: {[lookup.chiefExecutivePrefill.lastName, lookup.chiefExecutivePrefill.firstName, lookup.chiefExecutivePrefill.middleName].filter(Boolean).join(' ')}
                      </p>
                    )}
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <Select label="Система налогообложения" value={taxationSystem} options={taxationSystemOptions} onChange={event => setTaxationSystem(event.target.value)} />
                  <Select label="Ставка НДС в чеке" value={vatRate} options={vatRateOptions} onChange={event => setVatRate(event.target.value)} />
                </div>
                <p className="text-xs text-gray-500">Название, ОГРН, адрес и руководителя мы берём из реестра. Систему налогообложения реестр не сообщает — укажите её сами.</p>
              </>
            )}
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

