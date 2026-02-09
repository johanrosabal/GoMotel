'use server';

import {
  collection,
  getDocs,
  query,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '../firebase';
import type { RoomType } from '@/types';

// Helper to convert Firestore doc to RoomType object
const toRoomTypeObject = (doc: any): RoomType => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    features: data.features || [],
  };
};

export async function getRoomTypes(): Promise<RoomType[]> {
  try {
    const roomTypesCollection = collection(db, 'roomTypes');
    const q = query(roomTypesCollection);
    const roomTypesSnapshot = await getDocs(q);
    const roomTypes = roomTypesSnapshot.docs.map(toRoomTypeObject);
    roomTypes.sort((a, b) => a.name.localeCompare(b.name));
    return roomTypes;
  } catch (error) {
    console.error('Error fetching room types:', error);
    return [];
  }
}

const roomTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre es demasiado corto.'),
  features: z.string().optional(),
});

export async function saveRoomType(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const validatedFields = roomTypeSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { id, name, features } = validatedFields.data;

  const dataToSave = {
    name,
    features: features ? features.split(',').map(f => f.trim()).filter(Boolean) : [],
  };

  try {
    if (id) {
      const roomTypeRef = doc(db, 'roomTypes', id);
      await updateDoc(roomTypeRef, dataToSave);
    } else {
      await addDoc(collection(db, 'roomTypes'), dataToSave);
    }
    revalidatePath('/settings/room-types');
    return { success: true };
  } catch (error) {
    console.error('Failed to save room type:', error);
    return { error: 'Ocurrió un error inesperado.' };
  }
}

export async function deleteRoomType(roomTypeId: string) {
    if (!roomTypeId) {
        return { error: 'ID de tipo de habitación no válido.' };
    }

    try {
        await deleteDoc(doc(db, 'roomTypes', roomTypeId));
        revalidatePath('/settings/room-types');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete room type:', error);
        return { error: 'Ocurrió un error inesperado.' };
    }
}
