
'use server';

import { collection, getDocs, query, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db, auth as clientAuth } from '../firebase';
import type { UserProfile, UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { getAuth } from 'firebase/auth';

export async function getUsers(): Promise<UserProfile[]> {
  try {
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection);
    const usersSnapshot = await getDocs(q);
    const usersList = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      } as UserProfile
    });
    
    // Sort by creation date descending
    usersList.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

    return usersList;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Helper specifically for Server Components to get the current user's profile.
 */
export async function getServerUserProfile(): Promise<UserProfile | null> {
    try {
        const user = clientAuth.currentUser;
        if (!user) return null;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            return { id: userDoc.id, ...userDoc.data() } as UserProfile;
        }
        return null;
    } catch (e) {
        console.error("Error fetching server user profile:", e);
        return null;
    }
}

export async function updateUserProfile(values: any) {
  try {
    const { id, birthDate, ...data } = values;
    if (!id) return { error: 'ID de usuario no proporcionado.' };

    const userRef = doc(db, 'users', id);
    await updateDoc(userRef, {
      ...data,
      birthDate: birthDate ? Timestamp.fromDate(new Date(birthDate)) : null,
    });

    revalidatePath('/users');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return { error: error.message || 'Ocurrió un error al actualizar el perfil.' };
  }
}

export async function toggleUserStatus(userId: string, currentStatus: string) {
  try {
    const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { status: newStatus });
    
    revalidatePath('/users');
    return { success: true, newStatus };
  } catch (error: any) {
    console.error('Error toggling user status:', error);
    return { error: 'No se pudo cambiar el estado del usuario.' };
  }
}
