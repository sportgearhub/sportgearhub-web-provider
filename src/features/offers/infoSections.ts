// Offer info-section kinds (GET/PUT /offers/{id}/info-sections).
// `kind` values must match the backend OfferInclusionKind enum.
export const INFO_SECTION_KINDS: Array<{ kind: string; label: string; placeholder: string }> = [
  { kind: 'included', label: 'Что включено', placeholder: 'Например: Прокат сапборда' },
  { kind: 'excluded', label: 'Что не включено', placeholder: 'Например: Трансфер' },
  { kind: 'bring', label: 'Что взять с собой', placeholder: 'Например: Купальник' },
  { kind: 'know_before_you_go', label: 'Что нужно знать', placeholder: 'Например: Возраст 12+' },
];

export function infoSectionLabel(kind: string): string {
  return INFO_SECTION_KINDS.find(k => k.kind === kind)?.label ?? kind;
}
