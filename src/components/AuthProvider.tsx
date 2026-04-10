"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  requestPasswordReset,
  registerWithEmailPassword,
  sendVerificationEmail,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutUser,
} from '@/lib/firebase';
import type { UserProfile, UserRole } from '@/lib/types';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  idToken: string | null;
  signInAsCandidate: () => Promise<void>;
  signInAsRecruiter: (companyId: string) => Promise<void>;
  registerCandidateWithEmail: (email: string, password: string) => Promise<void>;
  registerRecruiterWithEmail: (email: string, password: string, companyId: string) => Promise<void>;
  signInCandidateWithEmail: (email: string, password: string) => Promise<void>;
  signInRecruiterWithEmail: (email: string, password: string, companyId: string) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

type PendingAuthIntent = {
  role: UserRole;
  companyId?: string;
};

let pendingAuthIntent: PendingAuthIntent | null = null;

async function ensureVerifiedEmail(user: FirebaseUser) {
  await user.reload();

  if (user.emailVerified) {
    return;
  }

  await sendVerificationEmail();
  await signOutUser();
  throw new Error('Please verify your email before logging in. We have sent a verification email.');
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function getOrCreateUserProfile(
  user: FirebaseUser,
  role: UserRole,
  companyId?: string,
  options?: {
    forceRoleUpdate?: boolean;
  }
): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    const profile = snapshot.data() as Omit<UserProfile, 'uid'>;

    if (options?.forceRoleUpdate) {
      const updatedProfile: Omit<UserProfile, 'uid'> = {
        ...profile,
        role,
        ...(role === 'recruiter' ? { companyId } : {}),
        ...(role === 'candidate' ? { companyId: undefined } : {}),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(
        ref,
        {
          role,
          ...(role === 'recruiter' ? { companyId } : { companyId: null }),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return {
        uid: user.uid,
        ...updatedProfile,
      };
    }

    return {
      uid: user.uid,
      ...profile,
    };
  }

  const now = new Date().toISOString();
  const newProfile: Omit<UserProfile, 'uid'> = {
    email: user.email ?? '',
    displayName: user.displayName ?? 'Anonymous User',
    role,
    ...(companyId ? { companyId } : {}),
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, {
    ...newProfile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    uid: user.uid,
    ...newProfile,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setIdToken(null);
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      setIdToken(token);

      const ref = doc(db, 'users', user.uid);
      const snapshot = await getDoc(ref);

      if (snapshot.exists()) {
        const data = snapshot.data() as Omit<UserProfile, 'uid'>;
        setProfile({
          uid: user.uid,
          ...data,
        });
        pendingAuthIntent = null;
      } else {
        const intendedRole = pendingAuthIntent?.role ?? 'candidate';
        const intendedCompanyId = intendedRole === 'recruiter' ? pendingAuthIntent?.companyId : undefined;
        const created = await getOrCreateUserProfile(user, intendedRole, intendedCompanyId);
        setProfile(created);
        pendingAuthIntent = null;
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function withPendingIntent<T>(intent: PendingAuthIntent, action: () => Promise<T>): Promise<T> {
    pendingAuthIntent = intent;
    try {
      return await action();
    } catch (error) {
      pendingAuthIntent = null;
      throw error;
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      idToken,
      signInAsCandidate: async () => {
        const credential = await withPendingIntent({ role: 'candidate' }, () => signInWithGoogle());
        const createdProfile = await getOrCreateUserProfile(credential.user, 'candidate', undefined, {
          forceRoleUpdate: true,
        });
        setProfile(createdProfile);
        setIdToken(await credential.user.getIdToken());
      },
      signInAsRecruiter: async (companyId: string) => {
        const credential = await withPendingIntent(
          {
            role: 'recruiter',
            companyId,
          },
          () => signInWithGoogle()
        );
        const createdProfile = await getOrCreateUserProfile(
          credential.user,
          'recruiter',
          companyId,
          {
            forceRoleUpdate: true,
          }
        );
        setProfile(createdProfile);
        setIdToken(await credential.user.getIdToken());
      },
      registerCandidateWithEmail: async (email: string, password: string) => {
        const credential = await withPendingIntent(
          { role: 'candidate' },
          () => registerWithEmailPassword(email, password)
        );
        const createdProfile = await getOrCreateUserProfile(credential.user, 'candidate', undefined, {
          forceRoleUpdate: true,
        });
        setProfile(createdProfile);
        setIdToken(await credential.user.getIdToken());
        await signOutUser();
        setProfile(null);
        setIdToken(null);
        pendingAuthIntent = null;
      },
      registerRecruiterWithEmail: async (email: string, password: string, companyId: string) => {
        const credential = await withPendingIntent(
          {
            role: 'recruiter',
            companyId,
          },
          () => registerWithEmailPassword(email, password)
        );
        const createdProfile = await getOrCreateUserProfile(
          credential.user,
          'recruiter',
          companyId,
          {
            forceRoleUpdate: true,
          }
        );
        setProfile(createdProfile);
        setIdToken(await credential.user.getIdToken());
        await signOutUser();
        setProfile(null);
        setIdToken(null);
        pendingAuthIntent = null;
      },
      signInCandidateWithEmail: async (email: string, password: string) => {
        const credential = await withPendingIntent(
          { role: 'candidate' },
          () => signInWithEmailPassword(email, password)
        );
        await ensureVerifiedEmail(credential.user);
        const createdProfile = await getOrCreateUserProfile(credential.user, 'candidate', undefined, {
          forceRoleUpdate: true,
        });
        setProfile(createdProfile);
        setIdToken(await credential.user.getIdToken());
      },
      signInRecruiterWithEmail: async (email: string, password: string, companyId: string) => {
        const credential = await withPendingIntent(
          {
            role: 'recruiter',
            companyId,
          },
          () => signInWithEmailPassword(email, password)
        );
        await ensureVerifiedEmail(credential.user);
        const createdProfile = await getOrCreateUserProfile(
          credential.user,
          'recruiter',
          companyId,
          {
            forceRoleUpdate: true,
          }
        );
        setProfile(createdProfile);
        setIdToken(await credential.user.getIdToken());
      },
      resendEmailVerification: async () => {
        await sendVerificationEmail();
      },
      forgotPassword: async (email: string) => {
        await requestPasswordReset(email);
      },
      signOut: async () => {
        await signOutUser();
        setProfile(null);
        setIdToken(null);
        pendingAuthIntent = null;
      },
    }),
    [firebaseUser, profile, loading, idToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
