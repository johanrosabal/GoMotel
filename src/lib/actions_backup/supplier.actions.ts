'use server';

import { z } from 'zod';
import { collection, doc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';

const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  contactName: z.string().optional(),
  email: z.string().email('Correo electrónico inválido.').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  googleMapsUrl: z.string().url('URL de Google Maps inválida.').optional().or(z.literal('')),
  notes: z.string().optional(),
});

export async function saveSupplier(values: z.infer<typeof supplierSchema>) {
    const validatedFields = supplierSchema.safeParse(values);
    if (!validatedFields.success) {
        return { error: 'Datos inválidos.' };
    }
    const { id, ...data } = validatedFields.data;

    try {
        if (id) {
            await updateDoc(doc(db, 'suppliers', id), data);
        } else {
            await addDoc(collection(db, 'suppliers'), {
                ...data,
                createdAt: Timestamp.now(),
            });
        }
        revalidatePath('/suppliers');
        return { success: true };
    } catch (e) {
        return { error: 'No se pudo guardar el proveedor.' };
    }
}

export async function deleteSupplier(id: string) {
    try {
        await deleteDoc(doc(db, 'suppliers', id));
        revalidatePath('/suppliers');
        return { success: true };
    } catch (e) {
        return { error: 'No se pudo eliminar el proveedor.' };
    }
}

    