
// 'use server'; // Removido para que se ejecute en el cliente

import { collection, getDocs, query, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db, auth as clientAuth } from '../firebase';
import { adminAuth, adminDb } from '../firebase-admin';
import type { UserProfile, UserRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { getAuth } from 'firebase/auth';

export async function getUsers(): Promise<UserProfile[]> {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersList = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      } as UserProfile
    });
    
    // Sort by creation date descending
    usersList.sort((a, b) => {
      const dateA = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
      const dateB = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
      return dateB - dateA;
    });

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

export async function updateUserRole(userId: string, newRole: UserRole) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { role: newRole });
    
    revalidatePath('/users');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating user role:', error);
    return { error: 'No se pudo actualizar el rol del usuario.' };
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

export async function deleteUser(userId: string) {
  try {
    // Mark as Deleted in Firestore
    const userRef = doc(db, 'users', userId);
    
    // We update the status to 'Deleted'. We keep the email so we can
    // prevent re-registration and show a specific error.
    await updateDoc(userRef, { 
      status: 'Deleted', 
      deletedAt: Timestamp.now()
    });
    
    // 3. Cleanup admin roles if exists
    const adminRef = doc(db, 'roles_admin', userId);
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      // For now we don't delete to keep history of who was admin
      // but we could use deleteDoc(adminRef);
    }

    revalidatePath('/users');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return { error: 'No se pudo eliminar el perfil del usuario.' };
  }
}
