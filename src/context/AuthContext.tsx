import { createContext, useCallback, useState, useEffect, ReactNode } from 'react';
import type { AuthUser, PendingInvitation, ProviderSummary, Session } from '../types';
import { ApiError, authApi } from '../lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  /** Providers the user belongs to, with kind, status and role — the picker's input. */
  providers: ProviderSummary[];
  /** Invitations addressed to the user's verified phone. */
  pendingInvitations: PendingInvitation[];
  loading: boolean;
  // Sign-in is phone-first: send a code to the number, then exchange it. An unknown number comes
  // back as a registration token rather than an error.
  requestPhoneCode: (phone: string) => Promise<void>;
  verifyPhoneCode: (phone: string, code: string) => Promise<Session | { registrationToken: string }>;
  completePhoneRegistration: (data: { token: string; name: string; surname: string }) => Promise<Session>;
  passcodeSignIn: (passcode: string) => Promise<Session>;
  acceptInvitation: (invitationId: string) => Promise<Session>;
  signOut: () => Promise<void>;
  reloadSession: () => Promise<Session | null>;
  sessionExpired: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

let sessionLoadPromise: Promise<Session | null> | null = null;

function isPublicAuthEntry() {
  return window.location.pathname.startsWith('/auth');
}

// One bootstrap call: the token carries only the subject, and /auth/me answers who is signed in,
// which providers they are in and what is waiting for their phone.
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
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const adopt = (session: Session) => {
    setUser(session.user);
    setProviders(session.providers);
    setPendingInvitations(session.pendingInvitations);
    setSessionExpired(false);
    return session;
  };

  const reloadSession = useCallback(async () => {
    setLoading(true);
    try {
      const session = await loadSession();
      return session ? adopt(session) : null;
    } catch (error) {
      setUser(null);
      setProviders([]);
      setPendingInvitations([]);
      if (error instanceof ApiError && error.status === 401) {
        setSessionExpired(true);
      }
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

  const requestPhoneCode = async (phone: string) => {
    await authApi.requestPhoneCode(phone);
  };

  const verifyPhoneCode = async (phone: string, code: string) => {
    const result = await authApi.verifyPhoneCode(phone, code);
    return result.status === 'registration_required'
      ? { registrationToken: result.registrationToken }
      : adopt(result.session);
  };

  const completePhoneRegistration = async (data: { token: string; name: string; surname: string }) =>
    adopt(await authApi.completePhoneRegistration(data));

  const passcodeSignIn = async (passcode: string) => adopt(await authApi.passcodeSignIn(passcode));

  const acceptInvitation = async (invitationId: string) => {
    await authApi.acceptProviderInvitation(invitationId);
    return adopt(await authApi.me());
  };

  const signOut = async () => {
    await authApi.signout().catch(() => undefined);
    setUser(null);
    setProviders([]);
    setPendingInvitations([]);
    setSessionExpired(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        providers,
        pendingInvitations,
        loading,
        requestPhoneCode,
        verifyPhoneCode,
        completePhoneRegistration,
        passcodeSignIn,
        acceptInvitation,
        signOut,
        reloadSession,
        sessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
