import { clearSelectedProvider } from '../lib/active-provider';
import { createContext, useCallback, useState, useEffect, ReactNode } from 'react';
import type { AuthUser, ProviderSummary, Session } from '../types';
import type { AuthChannel } from '../features/auth/authUtils';
import { authApi, onUnauthorized } from '../lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  /** Providers the user belongs to, with kind, status and role — the picker's input. */
  providers: ProviderSummary[];
  loading: boolean;
  // Sign-in is phone-first: send a code to the number, then exchange it. An unknown number comes
  // back as a registration token rather than an error.
  /**
   * The two credentials, as one shape.
   *
   * A phone number and an address are both ways in, with no primary and no secondary, so every
   * screen in the flow takes the channel as a value rather than existing twice.
   */
  requestCode: (channel: AuthChannel, contact: string) => Promise<void>;
  verifyCode: (
    channel: AuthChannel,
    contact: string,
    code: string
  ) => Promise<Session | { registrationToken: string }>;
  completeRegistration: (
    channel: AuthChannel,
    data: { token: string; name: string; surname: string; birthday: string }
  ) => Promise<Session>;
  passcodeSignIn: (passcode: string) => Promise<Session>;
  acceptInvitation: (invitationId: string) => Promise<Session>;
  signOut: () => Promise<void>;
  reloadSession: () => Promise<Session | null>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

let sessionLoadPromise: Promise<Session | null> | null = null;

function isPublicAuthEntry() {
  return window.location.pathname.startsWith('/auth');
}

// One bootstrap call: the token carries only the subject, and /auth/me answers who is signed in
// and which cabinets they belong to. Invitations are addressed to a phone rather than a cabinet,
// so the picker fetches those from /seller-invitations/pending where that decision is made.
async function loadSession() {
  if (!sessionLoadPromise) {
    sessionLoadPromise = authApi.me().finally(() => {
      sessionLoadPromise = null;
    });
  }
  return sessionLoadPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const adopt = (session: Session) => {
    setUser(session.user);
    setProviders(session.providers);
    return session;
  };

  /**
   * A session that ended while the console was open.
   *
   * The token is already gone by the time this runs — the client dropped it after the refresh
   * failed — so the only question is where the person lands. A device they have trusted asks for
   * its passcode; anything else starts from the phone. This replaces the location rather than
   * routing, because every page's state was built on a session that no longer exists and a reload
   * is the honest way to be rid of it.
   */
  useEffect(() => onUnauthorized(() => {
    if (isPublicAuthEntry()) return;
    clearSelectedProvider();
    const next = authApi.hasTrustedDevice() ? '/auth/passcode' : '/auth/sign-in';
    window.location.replace(next);
  }), []);

  const reloadSession = useCallback(async () => {
    setLoading(true);
    try {
      const session = await loadSession();
      return session ? adopt(session) : null;
    } catch {
      // A 401 here has already been announced by the client, which is what sends the person back
      // to the passcode; there is nothing left for this to flag.
      setUser(null);
      setProviders([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPublicAuthEntry()) {
      setLoading(false);
      return;
    }
    void reloadSession();
  }, [reloadSession]);

  const requestCode = async (channel: AuthChannel, contact: string) => {
    await (channel === 'email' ? authApi.requestEmailCode(contact) : authApi.requestPhoneCode(contact));
  };

  const verifyCode = async (channel: AuthChannel, contact: string, code: string) => {
    const result = await (channel === 'email'
      ? authApi.verifyEmailCode(contact, code)
      : authApi.verifyPhoneCode(contact, code));
    return result.status === 'registration_required'
      ? { registrationToken: result.registrationToken }
      : adopt(result.session);
  };

  const completeRegistration = async (
    channel: AuthChannel,
    data: { token: string; name: string; surname: string; birthday: string }
  ) => adopt(await (channel === 'email'
    ? authApi.completeEmailRegistration(data)
    : authApi.completePhoneRegistration(data)));

  const passcodeSignIn = async (passcode: string) => adopt(await authApi.passcodeSignIn(passcode));

  const acceptInvitation = async (invitationId: string) => {
    await authApi.acceptProviderInvitation(invitationId);
    return adopt(await authApi.me());
  };

  const signOut = async () => {
    clearSelectedProvider();
    await authApi.signout().catch(() => undefined);
    setUser(null);
    setProviders([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        providers,
        loading,
        requestCode,
        verifyCode,
        completeRegistration,
        passcodeSignIn,
        acceptInvitation,
        signOut,
        reloadSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
