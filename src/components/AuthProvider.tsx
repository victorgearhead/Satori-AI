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
import { auth, db, signInWithGoogle, signOutUser } from '@/lib/firebase';
import type { UserProfile, UserRole } from '@/lib/types';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  idToken: string | null;
  signInAsCandidate: () => Promise<void>;
  signInAsRecruiter: (companyId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function getOrCreateUserProfile(
  user: FirebaseUser,
  role: UserRole,
  companyId?: string
): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    const profile = snapshot.data() as Omit<UserProfile, 'uid'>;
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
    companyId,
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
      } else {
        const created = await getOrCreateUserProfile(user, 'candidate');
        setProfile(created);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      idToken,
      signInAsCandidate: async () => {
        const credential = await signInWithGoogle();
        const createdProfile = await getOrCreateUserProfile(credential.user, 'candidate');
        setProfile(createdProfile);
        setIdToken(await credential.user.getIdToken());
      },
      signInAsRecruiter: async (companyId: string) => {
        const credential = await signInWithGoogle();
        const createdProfile = await getOrCreateUserProfile(
          credential.user,
          'recruiter',
          companyId
        );
        setProfile(createdProfile);
        setIdToken(await credential.user.getIdToken());
      },
      signOut: async () => {
        await signOutUser();
        setProfile(null);
        setIdToken(null);
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
