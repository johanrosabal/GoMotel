'use client';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/types';

/**
 * Fetches the complete user profile from Firestore for the currently authenticated user.
 * @returns An object with the userProfile, loading state, and any errors.
 */
export function useUserProfile() {
    const { user, firestore, isUserLoading: isAuthLoading } = useFirebase();

    const userProfileRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);

    const { data: userProfile, isLoading: isProfileLoading, error } = useDoc<UserProfile>(userProfileRef);
    
    const isLoading = isAuthLoading || (!!user && isProfileLoading);

    return { userProfile, isLoading, error };
}
