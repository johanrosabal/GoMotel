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
    costPrice: data.costPrice,
    stock: data.stock,
    category: data.category,
    description: data.description,
    imageUrl: data.imageUrl,
    categoryId: data.categoryId,
    subCategoryId: data.subCategoryId,
  };
};

export async function getServices(): Promise<Service[]> {
  try {
    const servicesCollection = collection(db, 'services');
    const q = query(servicesCollection);
    const servicesSnapshot = await getDocs(q);
    const services = servicesSnapshot.docs.map(toServiceObject);
    services.sort((a, b) => {
        if (a.category.localeCompare(b.category) !== 0) {
            return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
    });
    return services;
  } catch (error) {
    console.error('Error fetching services:', error);
    return [];
  }
}

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre del servicio es demasiado corto.'),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo.'),
  costPrice: z.coerce.number().min(0, 'El precio de costo no puede ser negativo.').optional(),
  stock: z.coerce.number().int().min(0, 'Las existencias no pueden ser negativas.'),
  category: z.enum(['Food', 'Beverage', 'Amenity']),
  description: z.string().optional(),
  imageUrl: z.string().url('URL de imagen no válida.').optional().or(z.literal('')),
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
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
    revalidatePath('/catalog');
    return { success: true };
  } catch (error) {
    console.error('Failed to save service:', error);
    return { error: 'Ocurrió un error inesperado.' };
  }
}

export async function deleteService(serviceId: string) {
    if (!serviceId) {
        return { error: 'ID de servicio no válido.' };
    }

    try {
        await deleteDoc(doc(db, 'services', serviceId));
        revalidatePath('/inventory');
        revalidatePath('/catalog');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete service:', error);
        return { error: 'Ocurrió un error inesperado.' };
    }
}
