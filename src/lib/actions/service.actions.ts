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
  runTransaction,
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
    code: data.code,
    price: data.price,
    costPrice: data.costPrice,
    stock: data.stock,
    minStock: data.minStock,
    category: data.category,
    description: data.description,
    imageUrl: data.imageUrl,
    categoryId: data.categoryId,
    subCategoryId: data.subCategoryId,
    isActive: data.isActive,
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
  code: z.string().optional(),
  name: z.string().min(2, 'El nombre del servicio es demasiado corto.'),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo.'),
  costPrice: z.coerce.number().min(0, 'El precio de costo no puede ser negativo.').optional(),
  stock: z.coerce.number().int().min(0, 'Las existencias no pueden ser negativas.'),
  minStock: z.coerce.number().int().min(0, 'Las existencias mínimas no pueden ser negativas.').optional(),
  category: z.enum(['Food', 'Beverage', 'Amenity']),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  isActive: z.coerce.boolean().optional().default(true),
});

export async function saveService(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const validatedFields = serviceSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { id, ...serviceDataToSave } = validatedFields.data;
  const serviceData: Record<string, any> = serviceDataToSave;

  // If imageUrl is an empty string (from form submission), treat as null to remove from Firestore.
  if (serviceData.imageUrl === '') {
      serviceData.imageUrl = null;
  }

  try {
    if (id) {
      // Update existing service
      const serviceRef = doc(db, 'services', id);
      await updateDoc(serviceRef, serviceData);
    } else {
      // Add new service with incremental code in a transaction
      await runTransaction(db, async (transaction) => {
        const servicesCollection = collection(db, 'services');
        const servicesSnapshot = await transaction.get(query(servicesCollection));
        
        const existingCodes = servicesSnapshot.docs
          .map(d => d.data().code)
          .filter(Boolean) // Filter out services without a code
          .map(code => parseInt(String(code).replace(/\D/g, ''), 10)) // Extract numbers
          .filter(num => !isNaN(num));

        const nextCodeNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
        const newCode = `P${String(nextCodeNumber).padStart(3, '0')}`;

        const newServiceRef = doc(servicesCollection);
        transaction.set(newServiceRef, { 
            ...serviceData, 
            code: newCode 
        });
      });
    }
    revalidatePath('/inventory');
    revalidatePath('/catalog');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save service:', error);
    if (error?.code === 'invalid-argument' && error?.message?.includes('exceeds the maximum size')) {
        return { error: 'No se pudo guardar. La imagen es demasiado grande (límite de 1MB). Por favor, utilice una imagen más pequeña.' };
    }
    if (error instanceof Error) {
        return { error: `Ocurrió un error: ${error.message}` };
    }
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
