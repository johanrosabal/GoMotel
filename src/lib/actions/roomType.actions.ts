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
    name: data.name || 'Sin Nombre',
    code: data.code || 'N/A',
    features: data.features || [],
    pricePlans: data.pricePlans || [],
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

const pricePlanSchema = z.object({
  name: z.string().min(1, 'El nombre del plan es requerido.'),
  duration: z.coerce.number().positive('La duración debe ser un número positivo.'),
  unit: z.enum(['Hours', 'Days', 'Weeks', 'Months']),
  price: z.coerce.number().positive('El precio debe ser un número positivo.'),
});

const roomTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre es demasiado corto.'),
  features: z.array(z.string()).optional(),
  pricePlans: z.array(pricePlanSchema).optional(),
});

export async function saveRoomType(formData: FormData) {
  const id = formData.get('id')?.toString();
  const rawData = {
    id: id,
    name: formData.get('name')?.toString() || '',
    features: formData.getAll('features').map(f => f.toString()),
    pricePlans: formData.get('pricePlans') ? JSON.parse(formData.get('pricePlans') as string) : [],
  };
  
  const validatedFields = roomTypeSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { name, features, pricePlans } = validatedFields.data;

  const dataToSave = {
    name,
    features: features || [],
    pricePlans: pricePlans || [],
  };

  try {
    if (id) {
      const roomTypeRef = doc(db, 'roomTypes', id);
      await updateDoc(roomTypeRef, dataToSave);
    } else {
      // Generate new code for new room types
      const roomTypesCollection = collection(db, 'roomTypes');
      const roomTypesSnapshot = await getDocs(roomTypesCollection);
      const existingCodes = roomTypesSnapshot.docs
        .map(doc => parseInt(doc.data().code, 10))
        .filter(c => !isNaN(c));
      
      const nextCodeNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
      const newCode = String(nextCodeNumber).padStart(2, '0');

      await addDoc(collection(db, 'roomTypes'), { ...dataToSave, code: newCode });
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
