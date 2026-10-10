import type { AuthChannel } from './authUtils';

/**
 * What a person typed, and which door it opens.
 *
 * Asking «phone or e-mail?» before asking for either is a question nobody needs to answer: an
 * address has an `@` and a number does not. One field, and the channel is read off the value —
 * which also means a seller who registered with one and forgot which never has to remember.
 */
export type Guess = { channel: AuthChannel; contact: string; valid: boolean };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export function readContact(input: string): Guess {
  const value = input.trim();
  const digits = value.replace(/\D/g, '');

  // A letter or an `@` can only be an address; anything else is read as a number, including an
  // empty field, so the hint under it does not flicker between the two while typing.
  const looksLikeEmail = /[a-zA-Zа-яА-Я@]/.test(value);

  if (looksLikeEmail) {
    const contact = value.toLowerCase();
    return { channel: 'email', contact, valid: EMAIL.test(contact) };
  }

  const phone = normalisePhone(digits);
  return { channel: 'phone', contact: phone ?? '', valid: phone != null };
}

/**
 * Russian numbers as people write them: `8 927 …`, `+7 927 …`, `927 …`. All three are the same
 * number, and the API wants E.164.
 */
export function normalisePhone(digits: string): string | null {
  let national = digits;
  if (national.length === 11 && (national.startsWith('8') || national.startsWith('7'))) {
    national = national.slice(1);
  }
  return national.length === 10 ? `+7${national}` : null;
}

/** `+7 927 938-35-62` — grouped as it is read aloud, while it is being typed. */
export function formatAsTyped(input: string): string {
  if (/[a-zA-Zа-яА-Я@]/.test(input)) return input;

  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('8') || digits.startsWith('7')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return input.startsWith('+') || input === '' ? input : '';

  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)];
  return `+7 ${parts[0]}${parts[1] ? ` ${parts[1]}` : ''}${parts[2] ? `-${parts[2]}` : ''}${parts[3] ? `-${parts[3]}` : ''}`;
}
