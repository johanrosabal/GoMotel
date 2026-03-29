
'use server';

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '../firebase';
import type { AppNotification, NotificationType } from '@/types';

const COLLECTION_NAME = 'notifications';

export async function getNotifications(type?: NotificationType): Promise<AppNotification[]> {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME);
    let q = query(notificationsRef, orderBy('createdAt', 'desc'));
    
    if (type) {
      q = query(notificationsRef, where('type', '==', type), orderBy('createdAt', 'desc'));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      const toMillis = (val: any) => {
        if (!val) return Date.now();
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (val instanceof Date) return val.getTime();
        if (typeof val === 'number') return val;
        return Date.now();
      };

      return {
        ...data,
        id: doc.id,
        startDate: toMillis(data.startDate),
        endDate: toMillis(data.endDate),
        createdAt: toMillis(data.createdAt),
        updatedAt: data.updatedAt ? toMillis(data.updatedAt) : undefined,
      } as any;
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

export async function getActiveNotifications(type: NotificationType): Promise<AppNotification[]> {
  try {
    const now = Timestamp.now();
    const notificationsRef = collection(db, COLLECTION_NAME);
    
    // Firestore doesn't support multiple inequality filters on different fields easily without composite indexes
    // So we'll fetch notifications that are active and then filter dates in memory for simplicity
    const q = query(
      notificationsRef, 
      where('type', '==', type), 
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const notifications = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      const toMillis = (val: any) => {
        if (!val) return Date.now();
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (val instanceof Date) return val.getTime();
        if (typeof val === 'number') return val;
        return Date.now();
      };

      return {
        ...data,
        id: doc.id,
        _startMillis: toMillis(data.startDate),
        _endMillis: toMillis(data.endDate),
        _createdMillis: toMillis(data.createdAt),
        _updatedMillis: data.updatedAt ? toMillis(data.updatedAt) : undefined
      };
    });

    // Filter by date range in memory
    const filtered = notifications.filter(notif => {
      const start = notif._startMillis;
      const end = notif._endMillis;
      const current = now.toMillis();
      return current >= start && current <= end;
    });

    // Return serialized objects
    return filtered.map(n => {
      const { _startMillis, _endMillis, _createdMillis, _updatedMillis, ...rest } = n;
      return {
        ...rest,
        id: n.id,
        startDate: _startMillis,
        endDate: _endMillis,
        createdAt: _createdMillis,
        updatedAt: _updatedMillis,
      } as any;
    });
  } catch (error) {
    console.error('Error fetching active notifications:', error);
    return [];
  }
}

export async function saveNotification(data: any) {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME);
    
    // Deserialize dates back to Timestamps
    const docData = {
      ...data,
      startDate: typeof data.startDate === 'number' ? Timestamp.fromMillis(data.startDate) : 
                (typeof data.startDate === 'string' ? Timestamp.fromDate(new Date(data.startDate)) : data.startDate),
      endDate: typeof data.endDate === 'number' ? Timestamp.fromMillis(data.endDate) : 
              (typeof data.endDate === 'string' ? Timestamp.fromDate(new Date(data.endDate)) : data.endDate),
    };

    if (data.id) {
      const docRef = doc(db, COLLECTION_NAME, data.id);
      await setDoc(docRef, { ...docData, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      await addDoc(notificationsRef, {
        ...docData,
        createdAt: serverTimestamp(),
        isActive: data.isActive ?? true
      });
    }

    revalidatePath('/settings/notifications');
    revalidatePath('/dashboard');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error saving notification:', error);
    return { error: 'No se pudo guardar la notificación.' };
  }
}

export async function deleteNotification(id: string) {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    revalidatePath('/settings/notifications');
    revalidatePath('/dashboard');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { error: 'No se pudo eliminar la notificación.' };
  }
}
