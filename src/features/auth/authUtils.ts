export type Navigate = (path: string, replace?: boolean) => void;

export function authPath(path: string) {
  return path.startsWith('/auth') ? path : `/auth${path}`;
}

/**
 * Which credential a sign-in is using. Both are credentials — a seller who registered with one can
 * add the other and then use either — so this is a value the flow carries, not a mode with a
 * fallback.
 */
export type AuthChannel = 'phone' | 'email';
