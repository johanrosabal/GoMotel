import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, memoryLocalCache, Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase for server-side usage
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let db: Firestore;
try {
  // Check if already initialized to avoid "Firestore has already been started"
  db = getFirestore(app);
} catch (e) {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: true
  } as any);
}

const auth = getAuth(app);

export { db, auth };
