'use server';

import { z } from 'zod';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';

const taxSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre es requerido.'),
  percentage: z.coerce.number().min(0, 'El porcentaje no puede ser negativo.').max(100, 'El porcentaje no puede ser mayor a 100.'),
  description: z.string().optional(),
});

export async function saveTax(values: z.infer<typeof taxSchema>) {
    const validatedFields = taxSchema.safeParse(values);
    if (!validatedFields.success) {
        return { error: 'Datos inválidos.' };
    }
    const { id, ...data } = validatedFields.data;

    try {
        if (id) {
            await updateDoc(doc(db, 'taxes', id), data);
        } else {
            await addDoc(collection(db, 'taxes'), data);
        }
        revalidatePath('/settings/taxes');
        return { success: true };
    } catch (e) {
        return { error: 'No se pudo guardar el impuesto.' };
    }
}

export async function deleteTax(id: string) {
    try {
        await deleteDoc(doc(db, 'taxes', id));
        revalidatePath('/settings/taxes');
        return { success: true };
    } catch (e) {
        return { error: 'No se pudo eliminar el impuesto.' };
    }
}
