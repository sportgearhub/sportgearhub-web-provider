import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { StepChoice } from '../../components/ui/StepChoice';
import { FieldRow, FloatingInput, FloatingSelect } from '../../components/form';
import { ApiError, providersApi } from '../../lib/api-client';
import type { LegalIdentityLookup, SellerKind, SellerProfileInput } from '../../types';
import { isValidInn, taxationSystemOptions, vatRateOptions } from './providerStatus';

export const SELLER_KINDS: { value: SellerKind; title: string; description: string }[] = [
  { value: 'self_employed', title: 'Самозанятый', description: 'Плательщик НПД. Выплаты по СБП на ваш номер телефона.' },
  { value: 'sole_proprietor', title: 'ИП', description: 'Индивидуальный предприниматель. Выплаты на расчётный счёт.' },
  { value: 'company', title: 'Организация', description: 'ООО, АО и другие юрлица. Выплаты на расчётный счёт.' },
];

/** What the seller types before the legal party exists: the kind, the ИНН, and what the registry cannot tell. */
export type SellerDraft = {
  kind: SellerKind | '';
  inn: string;
  person: { lastName: string; firstName: string; middleName: string };
  taxationSystem: string;
  vatRate: string;
};

export function emptySellerDraft(userName?: string | null): SellerDraft {
  const [firstName = '', lastName = ''] = (userName ?? '').split(' ');
  return { kind: '', inn: '', person: { lastName, firstName, middleName: '' }, taxationSystem: 'usn', vatRate: 'none' };
}

export function isBusinessKind(kind: SellerKind | '') {
  return kind === 'sole_proprietor' || kind === 'company';
}

export function sellerDraftInn(draft: SellerDraft) {
  return draft.inn.replace(/\D/g, '');
}

export function isSellerInnOk(draft: SellerDraft) {
  const digits = sellerDraftInn(draft);
  return digits.length === (draft.kind === 'company' ? 10 : 12) && isValidInn(digits);
}

/** The first thing wrong with the draft, in the seller's words; null when it can be sent. */
export function sellerDraftError(draft: SellerDraft): string | null {
  if (!draft.kind) return 'Выберите форму собственности.';
  if (!isSellerInnOk(draft)) return draft.kind === 'company' ? 'ИНН организации — 10 цифр с верной контрольной суммой.' : 'ИНН — 12 цифр с верной контрольной суммой.';
  if (draft.kind === 'self_employed' && (!draft.person.lastName.trim() || !draft.person.firstName.trim())) return 'Укажите фамилию и имя как в налоговом учёте.';
  return null;
}

export function sellerDraftToInput(draft: SellerDraft): SellerProfileInput {
  return {
    kind: draft.kind,
    inn: sellerDraftInn(draft),
    ...(isBusinessKind(draft.kind) ? { taxationSystem: draft.taxationSystem, vatRate: draft.vatRate } : {}),
    ...(draft.kind === 'self_employed'
      ? { person: { lastName: draft.person.lastName.trim(), firstName: draft.person.firstName.trim(), middleName: draft.person.middleName.trim() || null } }
      : {}),
  };
}

export function SellerKindChoice({ value, onChange }: { value: SellerKind | ''; onChange: (kind: SellerKind) => void }) {
  return (
    <div className="space-y-2">
      {SELLER_KINDS.map(item => (
        <StepChoice key={item.value} selected={value === item.value} title={item.title} description={item.description} onClick={() => onChange(item.value)} />
      ))}
    </div>
  );
}

/**
 * The ИНН and what follows from the kind: a самозанятый's name as the tax office knows it, or —
 * for ИП and organisations — the registry's card (looked up as soon as the ИНН is complete, no
 * button) plus the taxation system and VAT rate the registry does not know.
 */
export function SellerDetailsFields({ draft, onChange, onLookupError }: { draft: SellerDraft; onChange: (next: SellerDraft) => void; onLookupError?: (message: string) => void }) {
  const [lookup, setLookup] = useState<LegalIdentityLookup | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'missing'>('idle');
  const innDigits = sellerDraftInn(draft);
  const innOk = isSellerInnOk(draft);
  const business = isBusinessKind(draft.kind);

  useEffect(() => {
    if (!business || !innOk) {
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
        if (err instanceof ApiError && err.status !== 404) onLookupError?.(err.message);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [innDigits, innOk, business, onLookupError]);

  if (!draft.kind) return null;

  return (
    <div className="space-y-3">
      <FloatingInput
        label={draft.kind === 'company' ? 'ИНН организации' : 'ИНН'}
        required
        inputMode="numeric"
        autoComplete="off"
        value={draft.inn}
        onChange={event => onChange({ ...draft, inn: event.target.value.replace(/[^\d\s]/g, '') })}
        hint={draft.kind === 'company' ? '10 цифр' : '12 цифр'}
        error={draft.inn && !innOk && innDigits.length >= (draft.kind === 'company' ? 10 : 12) ? 'Проверьте ИНН: контрольная сумма не сходится.' : undefined}
      />
      {draft.kind === 'self_employed' ? (
        <>
          <FieldRow className="sm:grid-cols-3">
            <FloatingInput label="Фамилия" required value={draft.person.lastName} onChange={event => onChange({ ...draft, person: { ...draft.person, lastName: event.target.value } })} />
            <FloatingInput label="Имя" required value={draft.person.firstName} onChange={event => onChange({ ...draft, person: { ...draft.person, firstName: event.target.value } })} />
            <FloatingInput label="Отчество" value={draft.person.middleName} onChange={event => onChange({ ...draft, person: { ...draft.person, middleName: event.target.value } })} />
          </FieldRow>
          <p className="px-1 text-xs text-gray-500">Как в налоговом учёте. Система налогообложения: НПД. Выплаты — по СБП на номер телефона.</p>
        </>
      ) : (
        <>
          {lookupState === 'loading' && <p className="px-1 text-xs text-gray-500">Ищем в реестре…</p>}
          {lookupState === 'missing' && <p className="px-1 text-xs text-amber-700">В реестре не нашли — проверьте ИНН.</p>}
          {lookup && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-950">
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
          <FieldRow>
            <FloatingSelect label="Система налогообложения" required value={draft.taxationSystem} options={taxationSystemOptions} onChange={taxationSystem => onChange({ ...draft, taxationSystem })} />
            <FloatingSelect label="Ставка НДС в чеке" required value={draft.vatRate} options={vatRateOptions} onChange={vatRate => onChange({ ...draft, vatRate })} />
          </FieldRow>
          <p className="px-1 text-xs text-gray-500">Название, ОГРН, адрес и руководителя мы берём из реестра. Систему налогообложения реестр не сообщает — укажите её сами.</p>
        </>
      )}
    </div>
  );
}
