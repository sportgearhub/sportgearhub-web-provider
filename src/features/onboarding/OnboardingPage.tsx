import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Clock, LogOut } from 'lucide-react';
import { AddressAutocomplete } from '../../components/ui/AddressAutocomplete';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FancySelect } from '../../components/ui/FancySelect';
import { Input } from '../../components/ui/Input';
import { RuPhoneInput } from '../../components/ui/RuPhoneInput';
import { Textarea } from '../../components/ui/Textarea';
import {
  ApiError,
  paymentReferenceApi,
  providerOnboardingApi,
  type SbpMemberReference,
  type ProviderOnboarding,
  type ProviderOnboardingDraft,
  type ProviderOnboardingOptions,
} from '../../lib/api-client';
import { useAuth } from '../../context/useAuth';
import { isValidRuInn, normalizeInn } from '../../lib/utils';
import { DecisionState, LoadingState, OnboardingFrame } from './components/OnboardingFrame';
import { ChecklistLine, SectionHeader, StepChoice } from './components/OnboardingPrimitives';
import type {
  BankRequisitesForm,
  ChiefExecutiveForm,
  FieldErrors,
  FormFieldKey,
  FormState,
  FullSectionKey,
  LegalFormMismatch,
  LegalIdentitySuggestion,
  SbpPayoutForm,
} from './onboardingTypes';
import {
  bankFormFromDraft,
  buildFullOnboardingPatch,
  buildQuickOnboardingDraft,
  chiefExecutiveFormFromDraft,
  chiefExecutiveFormFromPrefill,
  chiefExecutiveFullName,
  emptyBankForm,
  emptyChiefExecutiveForm,
  emptyForm,
  emptySbpForm,
  formFromDraft,
  formatReviewDate,
  isChecklistReady,
  isSelfEmployedLegalForm,
  normalizeBic,
  normalizeRuPhoneLocal,
  payoutModeDescription,
  payoutScheduleDescription,
  sbpFormFromDraft,
} from './onboardingUtils';

const steps = [
  { key: 'inn', title: 'ИНН' },
  { key: 'legal', title: 'Статус' },
  { key: 'taxation', title: 'Налоги' },
  { key: 'profile', title: 'Профиль' },
  { key: 'address', title: 'Адрес' },
] as const;

const fullSectionKeys: Array<{ key: FullSectionKey; label: string }> = [
  { key: 'organization', label: 'Данные' },
  { key: 'requisites', label: 'Выплаты' },
  { key: 'contacts', label: 'Контакты' },
  { key: 'profile', label: 'Профиль' },
];

let onboardingLoadPromise: Promise<ProviderOnboarding> | null = null;
let onboardingOptionsPromise: Promise<ProviderOnboardingOptions> | null = null;
let sbpMembersLoadPromise: Promise<SbpMemberReference[]> | null = null;

async function loadCurrentOnboarding() {
  if (!onboardingLoadPromise) {
    onboardingLoadPromise = providerOnboardingApi.current()
      .finally(() => {
        onboardingLoadPromise = null;
      });
  }

  return onboardingLoadPromise;
}

async function loadOnboardingOptions() {
  if (!onboardingOptionsPromise) {
    onboardingOptionsPromise = providerOnboardingApi.options()
      .finally(() => {
        onboardingOptionsPromise = null;
      });
  }

  return onboardingOptionsPromise;
}

async function loadSbpMembers() {
  if (!sbpMembersLoadPromise) {
    sbpMembersLoadPromise = paymentReferenceApi.sbpMembers()
      .then(response => response.items)
      .finally(() => {
        sbpMembersLoadPromise = null;
      });
  }

  return sbpMembersLoadPromise;
}

export function OnboardingPage() {
  const { reloadUser, signOut } = useAuth();
  const [onboarding, setOnboarding] = useState<ProviderOnboarding | null>(null);
  const [options, setOptions] = useState<ProviderOnboardingOptions | null>(null);
  const [sbpMembers, setSbpMembers] = useState<SbpMemberReference[]>([]);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [bankForm, setBankForm] = useState<BankRequisitesForm>({ ...emptyBankForm });
  const [sbpForm, setSbpForm] = useState<SbpPayoutForm>({ ...emptySbpForm });
  const [chiefExecutive, setChiefExecutive] = useState<ChiefExecutiveForm>({ ...emptyChiefExecutiveForm });
  const [currentStep, setCurrentStep] = useState(0);
  const [activeFullSection, setActiveFullSection] = useState<FullSectionKey>('organization');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [legalLookupLoading, setLegalLookupLoading] = useState(false);
  const [legalLookupError, setLegalLookupError] = useState('');
  const [legalIdentitySuggestions, setLegalIdentitySuggestions] = useState<LegalIdentitySuggestion[]>([]);
  const [appliedLegalIdentityTaxNumber, setAppliedLegalIdentityTaxNumber] = useState('');
  const [bankLookupLoading, setBankLookupLoading] = useState(false);
  const [bankLookupError, setBankLookupError] = useState('');
  const [legalFormMismatch, setLegalFormMismatch] = useState<LegalFormMismatch | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isReviewing = onboarding?.status === 'submitted' || onboarding?.status === 'in_review';
  const reviewMessage = onboarding?.review?.message;
  const reviewDate = formatReviewDate(onboarding?.review?.reviewedAt);
  const selectedLegalForm = options?.legalForms.find(option => option.value === form.legalForm);
  const requiredLegalIdentityFields = selectedLegalForm?.requiredLegalIdentityFields ?? [];
  const legalFormLabels = useMemo(
    () => Object.fromEntries(options?.legalForms.map(option => [option.value, option.label]) ?? []),
    [options]
  );
  const taxationOptions = useMemo(() => {
    const all = options?.taxationSystems ?? [];
    if (!form.legalForm) return all;
    return all.filter(option => !option.supportedLegalForms?.length || option.supportedLegalForms.includes(form.legalForm));
  }, [form.legalForm, options?.taxationSystems]);
  const isSelfEmployed = isSelfEmployedLegalForm(form.legalForm, form.taxationSystem);
  const legalSectionTitle = isSelfEmployed
    ? 'Данные самозанятого'
    : form.legalForm === 'sole_proprietor'
      ? 'Данные ИП'
      : 'Данные организации';
  const legalNameLabel = isSelfEmployed
    ? 'ФИО'
    : 'Юридическое лицо';
  const fullSections = fullSectionKeys.map(section => ({
    ...section,
    label: section.key === 'organization' ? legalSectionTitle : section.label,
  }));
  const shouldShowLegalIdentityField = (field: keyof ProviderOnboardingDraft) => {
    if (isSelfEmployed) return false;
    return requiredLegalIdentityFields.includes(field) || Boolean(form[field as FormFieldKey]);
  };
  const matchingPayoutModes = useMemo(() => {
    const all = options?.payoutModes ?? [];
    if (!form.legalForm) return all;
    return all.filter(option => !option.supportedLegalForms?.length || option.supportedLegalForms.includes(form.legalForm));
  }, [form.legalForm, options?.payoutModes]);
  const bankPayoutMode = matchingPayoutModes.find(option => option.value === 't_bank_bank_account')
    ?? options?.payoutModes?.find(option => option.value === 't_bank_bank_account');
  const sbpPayoutMode = matchingPayoutModes.find(option => option.value === 't_bank_sbp_individual')
    ?? options?.payoutModes?.find(option => option.value === 't_bank_sbp_individual');
  const activePayoutMode = isSelfEmployed ? sbpPayoutMode : bankPayoutMode;
  const activePayoutModeDescription = payoutModeDescription(activePayoutMode);
  const chiefExecutiveName = chiefExecutiveFullName(chiefExecutive);

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const [next, nextOptions, nextSbpMembers] = await Promise.all([
        loadCurrentOnboarding(),
        loadOnboardingOptions(),
        loadSbpMembers().catch(() => []),
      ]);
      // Some responses carry the profile fields flat (no `draft` wrapper); fall back to that.
      const draftSource = next.draft ?? (next as unknown as ProviderOnboardingDraft | null);
      const nextForm = formFromDraft(draftSource);
      setOnboarding(next);
      setOptions(nextOptions);
      setSbpMembers(nextSbpMembers);
      setForm(nextForm);
      setBankForm(bankFormFromDraft(next.draft));
      setSbpForm(sbpFormFromDraft(next.draft));
      setChiefExecutive(chiefExecutiveFormFromDraft(next.draft));
    } catch {
      setError('Ошибка в работе сервиса.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (onboarding?.status !== 'approved' && onboarding?.status !== 'accepted') return;

    void reloadUser().then(session => {
      if (session?.memberships.length) {
        window.history.replaceState(null, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  }, [onboarding?.status, reloadUser]);

  const updateField = (field: keyof FormState, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    if (field === 'taxNumber') {
      setLegalIdentitySuggestions([]);
      setAppliedLegalIdentityTaxNumber('');
      setLegalLookupError('');
      setChiefExecutive({ ...emptyChiefExecutiveForm });
    }
    setFieldErrors(current => {
      const next = { ...current };
      delete next[field];
      if (field === 'legalForm') delete next.taxationSystem;
      return next;
    });
  };
  const updateBankField = (field: keyof BankRequisitesForm, value: string) => {
    setBankForm(current => ({ ...current, [field]: value }));
    setFieldErrors(current => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  const updateSbpField = (field: keyof SbpPayoutForm, value: string) => {
    setSbpForm(current => ({ ...current, [field]: value }));
    setFieldErrors(current => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  const selectSbpMember = (sbpMemberId: string) => {
    const selected = sbpMembers.find(member => member.sbpMemberId === sbpMemberId);
    setSbpForm(current => ({
      ...current,
      sbpMemberId,
      displayBankName: selected?.displayBankName ?? '',
      bankName: selected?.bankName ?? '',
    }));
    setFieldErrors(current => {
      const next = { ...current };
      delete next.sbpMemberId;
      return next;
    });
  };

  const lookupBankByBic = async (bic: string) => {
    const normalizedBic = normalizeBic(bic);
    if (normalizedBic.length !== 9) return;

    setBankLookupLoading(true);
    setBankLookupError('');
    try {
      const bank = await providerOnboardingApi.lookupRuBank(normalizedBic);
      setBankForm(current => ({
        ...current,
        bik: bank.bic ?? normalizedBic,
        correspondentAccount: bank.correspondentAccount ?? '',
        bankName: bank.paymentName ?? bank.shortName ?? bank.value ?? '',
      }));
    } catch {
      setBankForm(current => ({
        ...current,
        correspondentAccount: '',
        bankName: '',
      }));
      setBankLookupError('Банк по БИК не найден. Проверьте номер или заполните позже.');
    } finally {
      setBankLookupLoading(false);
    }
  };

  const selectLegalForm = (legalForm: string) => {
    const supportedTaxationSystems = options?.taxationSystems.filter(
      option => !option.supportedLegalForms?.length || option.supportedLegalForms.includes(legalForm)
    ) ?? [];
    setForm(current => ({
      ...current,
      legalCountryCode: 'RU',
      legalForm,
      legalName: current.legalForm && current.legalForm !== legalForm ? '' : current.legalName,
      registrationNumber: current.legalForm && current.legalForm !== legalForm ? '' : current.registrationNumber,
      branchNumber: current.legalForm && current.legalForm !== legalForm ? '' : current.branchNumber,
      taxationSystem: supportedTaxationSystems.some(option => option.value === current.taxationSystem) ? current.taxationSystem : '',
    }));
    setChiefExecutive(current => form.legalForm && form.legalForm !== legalForm ? { ...emptyChiefExecutiveForm } : current);
    if (isSelfEmployedLegalForm(legalForm, '')) {
      setBankForm({ ...emptyBankForm });
    } else {
      setSbpForm({ ...emptySbpForm });
    }
    setLegalFormMismatch(null);
    setFieldErrors(current => {
      const next = { ...current };
      delete next.legalForm;
      delete next.legalName;
      delete next.registrationNumber;
      delete next.branchNumber;
      delete next.settlementAccount;
      delete next.bik;
      delete next.correspondentAccount;
      delete next.bankName;
      delete next.phone;
      delete next.sbpMemberId;
      return next;
    });
    setBankLookupError('');
  };

  const applyLegalIdentitySuggestion = (suggestion: LegalIdentitySuggestion) => {
    setForm(current => ({
      ...current,
      legalCountryCode: 'RU',
      legalForm: suggestion.legalForm || current.legalForm,
      legalName: suggestion.legalName ?? chiefExecutiveFullName(suggestion.chiefExecutivePrefill) ?? current.legalName,
      taxNumber: suggestion.taxNumber ?? current.taxNumber,
      registrationNumber: suggestion.registrationNumber ?? current.registrationNumber,
      branchNumber: suggestion.branchNumber ?? current.branchNumber,
      address: suggestion.registeredAddress ?? current.address,
    }));
    setChiefExecutive(chiefExecutiveFormFromPrefill(suggestion.chiefExecutivePrefill));

    if (suggestion.legalForm && form.legalForm && suggestion.legalForm !== form.legalForm) {
      setLegalFormMismatch({
        selectedLabel: legalFormLabels[form.legalForm] ?? form.legalForm,
        returnedLabel: legalFormLabels[suggestion.legalForm] ?? suggestion.legalForm,
        returnedValue: suggestion.legalForm,
      });
    } else {
      setLegalFormMismatch(null);
    }

    setAppliedLegalIdentityTaxNumber(normalizeInn(suggestion.taxNumber ?? form.taxNumber));
    setFieldErrors(current => {
      const next = { ...current };
      delete next.taxNumber;
      delete next.legalName;
      delete next.legalForm;
      return next;
    });
  };

  const lookupLegalIdentity = async () => {
    const taxNumber = normalizeInn(form.taxNumber);
    if (!isValidRuInn(taxNumber)) {
      setFieldErrors(current => ({ ...current, taxNumber: 'Введите корректный ИНН: 10 или 12 цифр с верным контрольным числом.' }));
      return false;
    }

    if (appliedLegalIdentityTaxNumber === taxNumber) {
      return true;
    }

    setLegalLookupLoading(true);
    setLegalLookupError('');
    try {
      const result = await providerOnboardingApi.lookupRuLegalIdentity(taxNumber, form.branchNumber.trim() || undefined);
      setLegalIdentitySuggestions([result]);
      setLegalLookupError('');
      return false;
    } catch {
      setLegalIdentitySuggestions([]);
      setLegalLookupError('Не удалось найти реквизиты по ИНН. Можно продолжить вручную.');
      return true;
    } finally {
      setLegalLookupLoading(false);
    }
  };

  const validateStep = (step = currentStep) => {
    const nextErrors: FieldErrors = {};
    if (step === 0 && !isValidRuInn(form.taxNumber)) {
      nextErrors.taxNumber = 'Введите корректный ИНН: 10 или 12 цифр с верным контрольным числом.';
    }
    if (step === 1 && !form.legalForm) nextErrors.legalForm = 'Выберите статус.';
    if (step === 2 && !form.taxationSystem) nextErrors.taxationSystem = 'Выберите систему налогообложения.';
    if (step === 3) {
      if (!form.displayName.trim()) nextErrors.displayName = 'Укажите публичное название.';
    }
    if (step === 4) {
      if (!form.address.trim()) nextErrors.address = 'Укажите адрес.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveDraft = async () => {
    const payload = buildQuickOnboardingDraft(form, chiefExecutive);
    const next = onboarding?.status === 'not_started'
      ? await providerOnboardingApi.create(payload)
      : await providerOnboardingApi.updateProfile(payload);
    setOnboarding(next);
    setForm(current => ({ ...current, ...formFromDraft(next.draft) }));
    setBankForm(bankFormFromDraft(next.draft));
    setSbpForm(sbpFormFromDraft(next.draft));
    setChiefExecutive(chiefExecutiveFormFromDraft(next.draft));
    return next;
  };

  const nextStep = async () => {
    if (!validateStep()) return;
    setError('');
    if (currentStep === 0) {
      const canAdvance = await lookupLegalIdentity();
      if (!canAdvance) return;
    }
    if (currentStep === 4) {
      setSaving(true);
      try {
        await saveDraft();
      } catch {
        setError('Не удалось сохранить черновик.');
        return;
      } finally {
        setSaving(false);
      }
    }
    setCurrentStep(step => Math.min(step + 1, steps.length - 1));
  };

  const validateFullForm = () => {
    const nextErrors: FieldErrors = {};
    if (!form.legalName.trim()) nextErrors.legalName = isSelfEmployed ? 'Укажите ФИО.' : 'Укажите юридическое лицо.';
    if (!isValidRuInn(form.taxNumber)) {
      nextErrors.taxNumber = 'Введите корректный ИНН: 10 или 12 цифр с верным контрольным числом.';
    }
    if (!form.legalForm.trim()) nextErrors.legalForm = 'Выберите статус.';
    if (!form.taxationSystem.trim()) nextErrors.taxationSystem = 'Выберите систему налогообложения.';
    if (!isSelfEmployed && shouldShowLegalIdentityField('registrationNumber') && !form.registrationNumber.trim()) {
      nextErrors.registrationNumber = 'Заполните ОГРН или ОГРНИП из данных по ИНН.';
    }
    if (!isSelfEmployed && shouldShowLegalIdentityField('branchNumber') && !form.branchNumber.trim()) {
      nextErrors.branchNumber = 'Заполните КПП из данных по ИНН.';
    }
    if (!form.contactEmail.trim()) nextErrors.contactEmail = 'Укажите почту для связи.';
    if (form.contactEmail.trim() && !/^\S+@\S+\.\S+$/.test(form.contactEmail.trim())) {
      nextErrors.contactEmail = 'Укажите корректную почту.';
    }
    if (normalizeRuPhoneLocal(form.contactPhone).length !== 10) {
      nextErrors.contactPhone = 'Укажите 10 цифр номера телефона.';
    }
    if (!form.displayName.trim()) nextErrors.displayName = 'Укажите публичное название.';
    if (!form.address.trim()) nextErrors.address = 'Укажите адрес.';
    if (!form.payoutSchedule.trim()) nextErrors.payoutSchedule = 'Выберите график выплат.';
    if (isSelfEmployed) {
      if (normalizeRuPhoneLocal(sbpForm.phone || form.contactPhone).length !== 10) {
        nextErrors.phone = 'Укажите 10 цифр телефона для СБП.';
      }
      if (!sbpForm.sbpMemberId.trim()) nextErrors.sbpMemberId = 'Укажите банк для СБП выплат.';
    } else {
      if (bankForm.settlementAccount.replace(/\D/g, '').length !== 20) {
        nextErrors.settlementAccount = 'Укажите 20 цифр расчетного счета.';
      }
      if (normalizeBic(bankForm.bik).length !== 9) nextErrors.bik = 'Укажите 9 цифр БИК.';
      if (bankForm.correspondentAccount.replace(/\D/g, '').length !== 20) {
        nextErrors.correspondentAccount = 'Проверьте БИК, чтобы заполнить корреспондентский счет.';
      }
      if (!bankForm.bankName.trim()) nextErrors.bankName = 'Проверьте БИК, чтобы заполнить банк.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveFullForm = async () => {
    if (!validateFullForm()) return null;
    setError('');
    setSaving(true);
    try {
      const next = await providerOnboardingApi.updateProfile(buildFullOnboardingPatch(form, bankForm, sbpForm, chiefExecutive));
      setOnboarding(next);
      setForm(current => ({ ...current, ...formFromDraft(next.draft) }));
      setBankForm(bankFormFromDraft(next.draft));
      setSbpForm(sbpFormFromDraft(next.draft));
      setChiefExecutive(chiefExecutiveFormFromDraft(next.draft));
      return next;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка в работе сервиса.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submitFullForm = async () => {
    if (isReviewing) return;
    if (!validateFullForm()) return;
    setError('');
    setSubmitting(true);
    try {
      const saved = await providerOnboardingApi.updateProfile(buildFullOnboardingPatch(form, bankForm, sbpForm, chiefExecutive));
      setOnboarding(saved);
      setForm(current => ({ ...current, ...formFromDraft(saved.draft) }));
      setBankForm(bankFormFromDraft(saved.draft));
      setSbpForm(sbpFormFromDraft(saved.draft));
      setChiefExecutive(chiefExecutiveFormFromDraft(saved.draft));
      if (!isChecklistReady(saved.checklist)) {
        setError('Заполните все обязательные разделы перед отправкой.');
        return;
      }
      const next = await providerOnboardingApi.submit();
      setOnboarding(next);
      setForm(current => ({ ...current, ...formFromDraft(next.draft) }));
      setBankForm(bankFormFromDraft(next.draft));
      setSbpForm(sbpFormFromDraft(next.draft));
      setChiefExecutive(chiefExecutiveFormFromDraft(next.draft));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка в работе сервиса.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCurrentStep = async (event: FormEvent) => {
    event.preventDefault();
    await nextStep();
  };

  if (loading) return <LoadingState />;

  if (!onboarding || !options) {
    return (
      <DecisionState
        title="Подключение недоступно"
        text={error || 'Не удалось открыть анкету подключения.'}
        icon={<AlertCircle size={18} />}
      />
    );
  }

  if (onboarding.status === 'rejected' || onboarding.status === 'cancelled') {
    return (
      <DecisionState
        title="Заявка не активна"
        text={reviewMessage || 'Текущую заявку нельзя продолжить. Свяжитесь с поддержкой Sportgearhub, чтобы уточнить следующий шаг.'}
        icon={<AlertCircle size={18} />}
      />
    );
  }

  if (onboarding.status !== 'not_started') {
    return (
      <OnboardingFrame contentClassName="mx-auto w-full max-w-5xl space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertCircle size={14} className="shrink-0 text-red-600" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {onboarding.status === 'changes_requested' && reviewMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <p className="text-xs leading-5 text-amber-800">{reviewMessage}</p>
              {reviewDate && <p className="mt-1 text-[11px] font-medium text-amber-700">Проверено: {reviewDate}</p>}
            </div>
          </div>
        )}

        <Card padding={false} className="flex h-[min(820px,calc(100vh-32px))] flex-col overflow-hidden rounded-lg">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-700 text-sm font-semibold text-white">
                  SG
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-950">Sportgearhub</p>
                  <p className="mt-0.5 text-xs text-gray-500">Анкета подключения</p>
                </div>
              </div>
              {isReviewing ? (
                <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                  <Clock size={13} />
                  На проверке
                </span>
              ) : (
                <Button onClick={signOut} variant="ghost" size="sm" className="shrink-0">
                  <LogOut size={14} />
                  Выйти
                </Button>
              )}
            </div>
          </div>

          <form
            onSubmit={event => {
              event.preventDefault();
              void submitFullForm();
            }}
            className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-2"
          >
            <section className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <div>
                <h2 className="text-base font-semibold text-gray-950">Завершите анкету</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">Заполните недостающие разделы. После этого заявку можно отправить на проверку.</p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible" aria-label="Разделы анкеты">
                  {fullSections.map(section => (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setActiveFullSection(section.key)}
                      className={`shrink-0 rounded-md px-3 py-2 text-left text-sm font-medium transition lg:w-full ${
                        activeFullSection === section.key
                          ? 'bg-blue-50 text-blue-800'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'
                      }`}
                    >
                      {section.label}
                    </button>
                  ))}
                </nav>

                <div className="min-w-0 space-y-5">
                  {activeFullSection === 'organization' && (
                    <div className="space-y-4">
                      <SectionHeader title={legalSectionTitle} subtitle="Проверьте данные, которые заполнились после ИНН." />
                      <Input
                        label={legalNameLabel}
                        value={form.legalName}
                        onChange={event => updateField('legalName', event.target.value)}
                        error={fieldErrors.legalName}
                        disabled={isReviewing}
                      />
                      {!isSelfEmployed && chiefExecutiveName && (
                        <Input
                          label="ФИО"
                          value={chiefExecutiveName}
                          disabled
                          readOnly
                        />
                      )}
                      <FancySelect
                        label="Статус"
                        value={form.legalForm}
                        onChange={selectLegalForm}
                        options={options.legalForms.map(option => ({ value: option.value, label: option.label }))}
                        error={fieldErrors.legalForm}
                        disabled={isReviewing}
                      />
                      <Input
                        label="ИНН"
                        value={form.taxNumber}
                        onChange={event => updateField('taxNumber', normalizeInn(event.target.value))}
                        error={fieldErrors.taxNumber}
                        inputMode="numeric"
                        maxLength={12}
                        disabled={isReviewing}
                      />
                      {shouldShowLegalIdentityField('registrationNumber') && (
                        <Input
                          label="ОГРН / ОГРНИП"
                          value={form.registrationNumber}
                          error={fieldErrors.registrationNumber}
                          disabled
                          readOnly
                        />
                      )}
                      {shouldShowLegalIdentityField('branchNumber') && (
                        <Input
                          label="КПП"
                          value={form.branchNumber}
                          error={fieldErrors.branchNumber}
                          disabled
                          readOnly
                        />
                      )}
                      <FancySelect
                        label="Налоговый режим"
                        value={form.taxationSystem}
                        onChange={value => updateField('taxationSystem', value)}
                        options={taxationOptions.map(option => ({ value: option.value, label: option.label }))}
                        error={fieldErrors.taxationSystem}
                        disabled={isReviewing}
                      />
                    </div>
                  )}

                  {activeFullSection === 'requisites' && (
                    <div className="space-y-4">
                      <SectionHeader
                        title="Выплаты"
                        subtitle="Заполните банковские реквизиты для проведения выплат."
                      />
                      {activePayoutModeDescription && (
                        <div className="rounded-md bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700">
                          {activePayoutModeDescription}
                        </div>
                      )}
                      {isSelfEmployed ? (
                        <div className="space-y-3">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <RuPhoneInput
                              label="Телефон для СБП"
                              value={sbpForm.phone || form.contactPhone}
                              onChange={value => updateSbpField('phone', normalizeRuPhoneLocal(value))}
                              error={fieldErrors.phone}
                              disabled={isReviewing}
                            />
                            <FancySelect
                              label="Банк для СБП"
                              value={sbpForm.sbpMemberId}
                              onChange={selectSbpMember}
                              error={fieldErrors.sbpMemberId}
                              disabled={isReviewing}
                              options={[
                                { value: '', label: 'Выберите банк' },
                                ...sbpMembers.map(member => ({
                                  value: member.sbpMemberId,
                                  label: member.displayBankName || member.bankName || member.sbpMemberId,
                                })),
                              ]}
                            />
                          </div>

                          <div className="rounded-md bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                            Для выплат по СБП у самозанятого должен быть счет в выбранном банке, привязанный к этому номеру телефона.
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-foreground">{bankPayoutMode?.label ?? 'Банковские реквизиты'}</p>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                              label="Номер расчетного счета"
                              value={bankForm.settlementAccount}
                              onChange={event => updateBankField('settlementAccount', event.target.value.replace(/\D/g, '').slice(0, 20))}
                              error={fieldErrors.settlementAccount}
                              disabled={isReviewing}
                              inputMode="numeric"
                              maxLength={20}
                            />
                            <Input
                              label="БИК"
                              value={bankForm.bik}
                              onChange={event => {
                                const nextBic = normalizeBic(event.target.value);
                                updateBankField('bik', nextBic);
                                setBankLookupError('');
                                if (nextBic.length === 9) void lookupBankByBic(nextBic);
                              }}
                              error={bankLookupError || fieldErrors.bik}
                              disabled={isReviewing || bankLookupLoading}
                              inputMode="numeric"
                              maxLength={9}
                            />
                            <Input
                              label="Корреспондентский счет"
                              value={bankForm.correspondentAccount}
                              error={fieldErrors.correspondentAccount}
                              disabled
                              readOnly
                            />
                            <Input
                              label="Название банка-получателя"
                              value={bankForm.bankName}
                              error={fieldErrors.bankName}
                              disabled
                              readOnly
                            />
                            {bankLookupLoading && (
                              <p className="text-xs text-blue-700 sm:col-span-2">Ищем банк по БИК...</p>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Частота выплат</p>
                        <div className="grid gap-2.5">
                          {options.payoutSchedules.map(schedule => (
                            <StepChoice
                              key={schedule.value}
                              selected={form.payoutSchedule === schedule.value}
                              title={schedule.label}
                              description={payoutScheduleDescription(schedule)}
                              onClick={() => updateField('payoutSchedule', schedule.value)}
                            />
                          ))}
                        </div>
                        {fieldErrors.payoutSchedule && <p className="text-xs text-destructive">{fieldErrors.payoutSchedule}</p>}
                      </div>
                    </div>
                  )}

                  {activeFullSection === 'contacts' && (
                    <div className="space-y-4">
                      <SectionHeader title="Контакты" subtitle="Эти данные нужны платформе для связи с поставщиком." />
                      <div className="grid gap-4">
                        <Input
                          label="Почта для связи"
                          value={form.contactEmail}
                          onChange={event => updateField('contactEmail', event.target.value)}
                          error={fieldErrors.contactEmail}
                          disabled={isReviewing}
                        />
                        <RuPhoneInput
                          value={form.contactPhone}
                          onChange={value => updateField('contactPhone', normalizeRuPhoneLocal(value))}
                          error={fieldErrors.contactPhone}
                          disabled={isReviewing}
                        />
                      </div>
                    </div>
                  )}

                  {activeFullSection === 'profile' && (
                    <div className="space-y-4">
                      <SectionHeader title="Профиль" subtitle="Эти данные будут видеть клиенты." />
                      <Input
                        label="Публичное название"
                        value={form.displayName}
                        onChange={event => updateField('displayName', event.target.value)}
                        error={fieldErrors.displayName}
                        disabled={isReviewing}
                      />
                      <AddressAutocomplete
                        label="Адрес или район работы"
                        value={form.address}
                        onChange={value => updateField('address', value)}
                        error={fieldErrors.address}
                        disabled={isReviewing}
                        placeholder="Город, улица, дом"
                      />
                      <Textarea
                        label="Описание"
                        value={form.description}
                        onChange={event => updateField('description', event.target.value)}
                        error={fieldErrors.description}
                        disabled={isReviewing}
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {isReviewing ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                <Clock size={14} className="mt-0.5 shrink-0 text-blue-700" />
                <p className="text-xs leading-5 text-blue-800">Заявка на проверке. После одобрения обновим доступ к кабинету партнера.</p>
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void saveFullForm()}
                  loading={saving}
                  disabled={submitting}
                  className="justify-center"
                >
                  Сохранить
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                  disabled={saving}
                  className="justify-center"
                >
                  Отправить на проверку
                </Button>
              </div>
            )}
          </form>
        </Card>
      </OnboardingFrame>
    );
  }

  return (
    <OnboardingFrame contentClassName="mx-auto w-full max-w-xl space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle size={14} className="shrink-0 text-red-600" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <Card padding={false} className="flex h-[min(620px,calc(100vh-32px))] flex-col overflow-hidden rounded-lg">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-700 text-sm font-semibold text-white">
                SG
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-950">Sportgearhub</p>
                <p className="mt-0.5 text-xs text-gray-500">Подключение поставщика услуг</p>
              </div>
            </div>
            {isReviewing ? (
              <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                <Clock size={13} />
                На проверке
              </span>
            ) : (
              <Button onClick={signOut} variant="ghost" size="sm" className="shrink-0">
                <LogOut size={14} />
                Выйти
              </Button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-6 gap-1" aria-hidden="true">
            {steps.map((step, index) => (
              <span
                key={step.key}
                className={`h-1.5 rounded-full transition-colors ${
                  index < currentStep
                    ? 'bg-blue-700'
                    : index === currentStep
                      ? 'bg-blue-200'
                      : 'bg-gray-100'
                }`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={submitCurrentStep} className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-2">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {currentStep === 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-950">Укажите ИНН</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">Подойдет номер организации, ИП или самозанятого. Так вам не придется заполнять много полей.</p>
              </div>
                <Input
                  label="ИНН"
                  value={form.taxNumber}
                  onChange={event => updateField('taxNumber', normalizeInn(event.target.value))}
                  error={fieldErrors.taxNumber}
                  inputMode="numeric"
                  maxLength={12}
                />
              {legalLookupError && <p className="text-xs text-amber-700">{legalLookupError}</p>}
              {legalIdentitySuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">Найдены данные по ИНН</p>
                  <div className="grid gap-2">
                    {legalIdentitySuggestions.map(suggestion => {
                      const suggestionTaxNumber = normalizeInn(suggestion.taxNumber ?? form.taxNumber);
                      const isApplied = appliedLegalIdentityTaxNumber === suggestionTaxNumber;
                      const chiefExecutiveName = [
                        suggestion.chiefExecutivePrefill?.lastName,
                        suggestion.chiefExecutivePrefill?.firstName,
                        suggestion.chiefExecutivePrefill?.middleName,
                      ].filter(Boolean).join(' ');
                      return (
                        <button
                          key={`${suggestionTaxNumber}-${suggestion.branchNumber ?? 'main'}`}
                          type="button"
                          onClick={() => applyLegalIdentitySuggestion(suggestion)}
                          className={`flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition ${
                            isApplied
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                              : 'border-gray-200 bg-white text-gray-900 hover:border-blue-200 hover:bg-blue-50/40'
                          }`}
                        >
                          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            isApplied ? 'border-emerald-700 bg-emerald-100 text-emerald-700' : 'border-gray-300'
                          }`}>
                            {isApplied && <Check size={11} strokeWidth={2.4} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold">{suggestion.legalName ?? 'Данные по ИНН'}</span>
                            <span className="mt-1 block text-xs leading-4 text-gray-600">
                              {suggestionTaxNumber}
                              {suggestion.registrationNumber ? ` · ${suggestion.registrationNumber}` : ''}
                            </span>
                            {suggestion.registeredAddress && (
                              <span className="mt-1 block text-xs leading-4 text-gray-500">{suggestion.registeredAddress}</span>
                            )}
                            {chiefExecutiveName && (
                              <span className="mt-1 block text-xs leading-4 text-gray-500">
                                Руководитель: {chiefExecutiveName}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {currentStep === 1 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-950">Укажите ваш статус</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Подробнее о том, <a href="https://www.nalog.gov.ru/rn77/service/mp/" target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:text-blue-800">какие режимы бывают</a>
                </p>
              </div>
              <div className="grid gap-2">
                {options.legalForms.map(option => (
                  <StepChoice
                    key={option.value}
                    selected={form.legalForm === option.value}
                    title={option.label}
                    onClick={() => selectLegalForm(option.value)}
                  />
                ))}
              </div>
              {fieldErrors.legalForm && <p className="text-xs text-red-600">{fieldErrors.legalForm}</p>}
              {legalFormMismatch && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-700" />
                  <p className="text-xs leading-5 text-amber-800">
                    По ИНН найдена форма: {legalFormMismatch.returnedLabel}. Вы выбрали: {legalFormMismatch.selectedLabel}.
                  </p>
                </div>
              )}
            </section>
          )}

          {currentStep === 2 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-950">Уточните режим налогооблажения</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Подробнее о том, <a href="https://www.nalog.gov.ru/rn77/service/mp/" target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:text-blue-800">какие режимы бывают</a>
                </p>
              </div>
              <div className="grid gap-2">
                {taxationOptions.map(option => (
                  <StepChoice
                    key={option.value}
                    selected={form.taxationSystem === option.value}
                    title={option.label}
                    onClick={() => updateField('taxationSystem', option.value)}
                  />
                ))}
              </div>
              {fieldErrors.taxationSystem && <p className="text-xs text-red-600">{fieldErrors.taxationSystem}</p>}
            </section>
          )}

          {currentStep === 3 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-950">Укажите публичное название</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">Название будут видеть клиенты. После регистрации его можно поменять</p>
              </div>
              <Input
                placeholder="Публичное название"
                value={form.displayName}
                onChange={event => updateField('displayName', event.target.value)}
                error={fieldErrors.displayName}
              />
              <div className="text-xs text-gray-600">
                <p className="text-xs font-semibold text-gray-900">Проверьте себя:</p>
                <ul className="mt-1 space-y-1 text-xs leading-4 text-gray-600">
                  <ChecklistLine>Нет адреса сайта</ChecklistLine>
                  <ChecklistLine>Нет номера телефона</ChecklistLine>
                  <ChecklistLine>Ненормативную лексику не использовали</ChecklistLine>
                  <ChecklistLine>Отсутствуют оценочные слова или чужой торговый знак. Например &laquo;Самый быстрый, дешевый и лучший прокат&raquo;.</ChecklistLine>
                </ul>
              </div>
            </section>
          )}

          {currentStep === 4 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-950">Укажите адрес</h2>
              </div>
              <AddressAutocomplete
                label="Адрес или район работы"
                value={form.address}
                onChange={value => updateField('address', value)}
                error={fieldErrors.address}
                placeholder="Город, улица, дом"
              />
            </section>
          )}

          </div>

          <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentStep(step => Math.max(step - 1, 0))}
              disabled={currentStep === 0 || saving || submitting}
              className="justify-center"
            >
              Назад
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={currentStep === 0 ? legalLookupLoading : saving}
              disabled={isReviewing}
              className="justify-center"
            >
              Продолжить
            </Button>
          </div>
        </form>
      </Card>

      {isReviewing && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
          <Clock size={14} className="mt-0.5 shrink-0 text-blue-700" />
          <p className="text-xs leading-5 text-blue-800">Заявка на проверке. После одобрения обновим доступ к кабинету партнера.</p>
        </div>
      )}
    </OnboardingFrame>
  );
}
