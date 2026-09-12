import { createContext, useCallback, useState, useEffect, ReactNode } from 'react';
import type { AuthUser, ProviderMembership } from '../types';
import { ApiError, authApi } from '../lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  memberships: ProviderMembership[];
  activeMembership: ProviderMembership | null;
  loading: boolean;
  // Sign-in is phone-first: send a code to the number, then exchange it. An unknown number comes
  // back as a registration token rather than an error.
  requestPhoneCode: (phone: string) => Promise<void>;
  verifyPhoneCode: (phone: string, code: string) => Promise<SessionSnapshot | { registrationToken: string }>;
  completePhoneRegistration: (data: {
    token: string;
    name: string;
    surname: string;
  }) => Promise<SessionSnapshot>;
  passcodeSignIn: (passcode: string) => Promise<SessionSnapshot>;

  signOut: () => Promise<void>;
  reloadUser: () => Promise<{ user: AuthUser; memberships: ProviderMembership[] } | null>;
  sessionExpired: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

type SessionSnapshot = { user: AuthUser; memberships: ProviderMembership[] };

let sessionLoadPromise: Promise<SessionSnapshot | null> | null = null;

function isPublicAuthEntry() {
  return window.location.pathname.startsWith('/auth');
}

async function loadSessionSnapshot() {
  if (!sessionLoadPromise) {
    sessionLoadPromise = authApi.me()
      .then(async currentUser => {
        const currentMemberships = await authApi.providerMemberships();
        return { user: currentUser, memberships: currentMemberships };
      })
      .finally(() => {
        sessionLoadPromise = null;
      });
  }

  return sessionLoadPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<ProviderMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const reloadUser = useCallback(async () => {
    setLoading(true);
    try {
      const session = await loadSessionSnapshot();
      if (!session) return null;
      setUser(session.user);
      setMemberships(session.memberships);
      setSessionExpired(false);
      return session;
    } catch (error) {
      setUser(null);
      setMemberships([]);
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

    void reloadUser();
  }, [reloadUser]);

  const adoptSession = async (nextUser: AuthUser) => {
    const currentMemberships = nextUser.emailVerified === false ? [] : await authApi.providerMemberships();
    setUser(nextUser);
    setMemberships(currentMemberships);
    setSessionExpired(false);
    return { user: nextUser, memberships: currentMemberships };
  };

  const requestPhoneCode = async (phone: string) => {
    await authApi.requestPhoneCode(phone);
  };

  const verifyPhoneCode = async (phone: string, code: string) => {
    const result = await authApi.verifyPhoneCode(phone, code);
    return result.status === 'registration_required'
      ? { registrationToken: result.registrationToken }
      : adoptSession(result.user);
  };

  const completePhoneRegistration = async (data: { token: string; name: string; surname: string }) =>
    adoptSession(await authApi.completePhoneRegistration(data));

  const passcodeSignIn = async (passcode: string) => adoptSession(await authApi.passcodeSignIn(passcode));



  const signOut = async () => {
    await authApi.signout().catch(() => undefined);
    setUser(null);
    setMemberships([]);
    setSessionExpired(false);
  };

  const activeMembership = memberships[0] ?? null;

  return (
    <AuthContext.Provider value={{
      user,
      memberships,
      activeMembership,
      loading,
      requestPhoneCode,
      verifyPhoneCode,
      completePhoneRegistration,
      passcodeSignIn,
      signOut,
      reloadUser,
      sessionExpired,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
