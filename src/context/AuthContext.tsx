import { createContext, useCallback, useState, useEffect, ReactNode } from 'react';
import type { AuthUser, ProviderMembership } from '../types';
import { ApiError, authApi } from '../lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  memberships: ProviderMembership[];
  activeMembership: ProviderMembership | null;
  loading: boolean;
  // Step 1 of sign-in: mail a one-time code. Step 2 is verifyCode / passcodeSignIn below.
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<SessionSnapshot | { registrationToken: string }>;
  passcodeSignIn: (passcode: string) => Promise<SessionSnapshot>;
  completeRegistration: (data: {
    token: string;
    name: string;
    surname: string;
    phone: string;
  }) => Promise<SessionSnapshot>;
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

  const requestCode = (email: string) => authApi.requestCode(email);

  const verifyCode = async (email: string, code: string) => {
    const result = await authApi.verifyCode(email, code);
    return result.status === 'registration_required'
      ? { registrationToken: result.registrationToken }
      : adoptSession(result.user);
  };

  const passcodeSignIn = async (passcode: string) => adoptSession(await authApi.passcodeSignIn(passcode));

  const completeRegistration = async (data: {
    token: string;
    name: string;
    surname: string;
    phone: string;
  }) => adoptSession(await authApi.completeRegistration(data));

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
      requestCode,
      verifyCode,
      passcodeSignIn,
      completeRegistration,
      signOut,
      reloadUser,
      sessionExpired,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
