'use server';

import {
  collection,
  getDocs,
  query,
  doc,
  getDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { RoomType } from '@/types';

const toRoomTypeObject = (doc: any): RoomType => {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name,
        code: data.code,
        capacity: data.capacity || 1,
        features: data.features || [],
        pricePlans: data.pricePlans || [],
    };
};

export async function getRoomTypes(): Promise<RoomType[]> {
  try {
    const roomTypesCollection = collection(db, 'roomTypes');
    const q = query(roomTypesCollection, orderBy('name'));
    const roomTypesSnapshot = await getDocs(q);
    const roomTypesList = roomTypesSnapshot.docs.map(toRoomTypeObject);
    return roomTypesList;
  } catch (error) {
    console.error('Error fetching room types:', error);
    return [];
  }
}

export async function getRoomTypeById(id: string): Promise<RoomType | null> {
    if (!id) return null;
    try {
        const roomTypeDoc = await getDoc(doc(db, 'roomTypes', id));
        if (roomTypeDoc.exists()) {
            return toRoomTypeObject(roomTypeDoc);
        }
        return null;
    } catch (error) {
        console.error('Error fetching room type by ID:', error);
        return null;
    }
}
