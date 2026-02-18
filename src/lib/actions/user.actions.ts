'use server';

import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserProfile } from '@/types';

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
