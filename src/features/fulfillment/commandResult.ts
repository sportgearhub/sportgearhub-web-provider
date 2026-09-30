import type { FulfillmentCommandResult } from '../../types';

/**
 * Fulfillment commands do not fail with an HTTP error when they are refused — they answer 200 with
 * `result.status = "rejected"` and a reason. Treating that as success is how an operator ends up
 * being told the handover was recorded when the booking never moved, so every caller runs the
 * response through here.
 */
const reasonMessages: Record<string, string> = {
  handover_not_allowed: 'Выдачу сейчас записать нельзя — обновите очередь и проверьте статус брони.',
  return_not_allowed: 'Возврат сейчас записать нельзя — возможно, оборудование ещё не выдано.',
  completion_not_allowed: 'Бронь пока нельзя завершить — сначала запишите возврат.',
  reason_code_required: 'Укажите причину обращения.',
};

/** Returns an error message when the command was refused, or null when it went through. */
export function rejectionMessage(response: FulfillmentCommandResult, fallback: string): string | null {
  if (response.result?.status !== 'rejected') return null;
  const code = response.result.reasonCode;
  return (code && reasonMessages[code]) || fallback;
}
