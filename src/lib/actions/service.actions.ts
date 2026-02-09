'use server';

import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  writeBatch,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '../firebase';
import type { Service } from '@/types';

// Helper to convert Firestore doc to Service object
const toServiceObject = (doc: any): Service => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    price: data.price,
    stock: data.stock,
    category: data.category,
  };
};

export async function getServices(): Promise<Service[]> {
  try {
    const servicesCollection = collection(db, 'services');
    const q = query(servicesCollection, orderBy('category'), orderBy('name'));
    const servicesSnapshot = await getDocs(q);
    return servicesSnapshot.docs.map(toServiceObject);
  } catch (error) {
    console.error('Error fetching services:', error);
    return [];
  }
}

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Service name is too short.'),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative.'),
  category: z.enum(['Food', 'Beverage', 'Amenity']),
});

export async function saveService(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const validatedFields = serviceSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { id, ...serviceData } = validatedFields.data;

  try {
    if (id) {
      // Update existing service
      const serviceRef = doc(db, 'services', id);
      await updateDoc(serviceRef, serviceData);
    } else {
      // Add new service
      await addDoc(collection(db, 'services'), serviceData);
    }
    revalidatePath('/inventory');
    return { success: true };
  } catch (error) {
    console.error('Failed to save service:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function deleteService(serviceId: string) {
    if (!serviceId) {
        return { error: 'Invalid service ID.' };
    }

    try {
        await deleteDoc(doc(db, 'services', serviceId));
        revalidatePath('/inventory');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete service:', error);
        return { error: 'An unexpected error occurred.' };
    }
}
