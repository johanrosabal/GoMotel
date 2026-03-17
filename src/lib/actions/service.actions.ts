
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
  increment,
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
    taxIds: data.taxIds || [],
    supplierId: data.supplierId,
    supplierName: data.supplierName,
    source: data.source,
  };
};

export async function getServices(): Promise<Service[]> {
  try {
    const productsCollection = collection(db, 'products');
    const q = query(productsCollection);
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
  price: z.coerce.number().min(0, 'El precio de venta no puede ser negativo.'),
  costPrice: z.coerce.number().min(0, 'El precio de costo no puede ser negativo.').optional(),
  stock: z.coerce.number().int().min(0, 'Las existencias no pueden ser negativas.'),
  minStock: z.coerce.number().int().min(0, 'Las existencias mínimas no pueden ser negativas.').optional(),
  category: z.enum(['Food', 'Beverage', 'Amenity']),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  taxIds: z.array(z.string()).optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  source: z.enum(['Purchased', 'Internal']).optional(),
});

export async function saveService(values: z.infer<typeof serviceSchema>) {
  const validatedFields = serviceSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  const { id, code, ...data } = validatedFields.data;

  const serviceData = {
    name: data.name,
    price: data.price,
    stock: data.stock,
    category: data.category,
    costPrice: data.costPrice ?? 0,
    minStock: data.minStock ?? 10,
    description: data.description ?? '',
    imageUrl: data.imageUrl ?? null,
    categoryId: data.categoryId ?? null,
    subCategoryId: data.subCategoryId ?? null,
    isActive: data.isActive ?? true,
    taxIds: data.taxIds ?? [],
    supplierId: data.supplierId ?? null,
    supplierName: data.supplierName ?? null,
    source: data.source ?? 'Purchased',
  };

  try {
    if (id) {
      // Update existing service
      const serviceRef = doc(db, 'products', id);
      await updateDoc(serviceRef, {
        ...serviceData,
        code: code, // Pass code for updates
      });
    } else {
       // Add new service with incremental code
      const productsCollection = collection(db, 'products');
      const servicesSnapshot = await getDocs(query(productsCollection));
      
      const existingCodes = servicesSnapshot.docs
        .map(d => d.data().code)
        .filter(Boolean)
        .map(code => parseInt(String(code).replace(/\D/g, ''), 10))
        .filter(num => !isNaN(num));

      const nextCodeNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
      const newCode = `P${String(nextCodeNumber).padStart(3, '0')}`;

      await addDoc(productsCollection, { 
          ...serviceData, 
          code: newCode 
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
        await deleteDoc(doc(db, 'products', serviceId));
        revalidatePath('/inventory');
        revalidatePath('/catalog');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete service:', error);
        return { error: 'Ocurrió un error inesperado.' };
    }
}

export async function toggleServiceStatus(serviceId: string, currentStatus: boolean) {
    try {
        const serviceRef = doc(db, 'products', serviceId);
        await updateDoc(serviceRef, { isActive: !currentStatus });
        revalidatePath('/inventory');
        revalidatePath('/catalog');
        return { success: true, newStatus: !currentStatus };
    } catch (e: any) {
        console.error('Error toggling service status:', e);
        return { error: 'No se pudo cambiar el estado del producto.' };
    }
}

const spoilageSchema = z.object({
  serviceId: z.string(),
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser mayor a 0.'),
  notes: z.string().optional(),
});

export async function registerServiceSpoilage(values: z.infer<typeof spoilageSchema>) {
    const validatedFields = spoilageSchema.safeParse(values);
    if (!validatedFields.success) {
        return { error: 'Datos de merma inválidos.' };
    }

    const { serviceId, quantity, notes } = validatedFields.data;

    try {
        await runTransaction(db, async (transaction) => {
            const serviceRef = doc(db, 'products', serviceId);
            const serviceSnap = await transaction.get(serviceRef);
            if (!serviceSnap.exists()) {
                throw new Error(`El producto no fue encontrado.`);
            }
            const currentStock = serviceSnap.data().stock || 0;
            if (quantity > currentStock) {
                throw new Error(`No hay suficientes existencias para registrar la merma (Actual: ${currentStock}).`);
            }
            transaction.update(serviceRef, { stock: increment(-quantity) });

            // TODO: In a real application, you would log this spoilage event for auditing.
        });

        revalidatePath('/inventory');
        return { success: true };

    } catch (e: any) {
        console.error('Error registering service spoilage:', e);
        return { error: e.message || 'No se pudo registrar la merma.' };
    }
}
