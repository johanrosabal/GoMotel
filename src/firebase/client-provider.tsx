'use client';

import React, { useMemo, type ReactNode, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { initializeAudio } from '@/lib/sound';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    const initAudio = () => {
        initializeAudio();
        // Once initialized by any user interaction, we can remove the listeners.
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
        window.removeEventListener('touchstart', initAudio);
    };

    // Add listeners for various user interactions.
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
    window.addEventListener('touchstart', initAudio);

    return () => {
        // Cleanup listeners when the component unmounts.
        window.removeEventListener('click', initAudio);
        window.removeEventListener('keydown', initAudio);
        window.removeEventListener('touchstart', initAudio);
    };
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
