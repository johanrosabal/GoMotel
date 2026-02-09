'use client';

import { useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { auth, user, isUserLoading } = useFirebase();

  useEffect(() => {
    // Only attempt to sign in if auth is available, loading is finished, and there's no user.
    if (auth && !isUserLoading && !user) {
      signInAnonymously(auth).catch(error => {
        console.error("Anonymous sign-in failed:", error);
      });
    }
  }, [auth, user, isUserLoading]);

  return <>{children}</>;
}
