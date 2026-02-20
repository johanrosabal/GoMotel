'use server';

import { z } from 'zod';
import { collection, doc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';

const sinpeAccountSchema = z.object({
  id: z.string().optional(),
  phoneNumber: z.string().min(8, 'El número de teléfono es requerido.'),
  bankName: z.string().min(2, 'El nombre del banco es requerido.'),
  balance: z.coerce.number().optional(),
});

export async function saveSinpeAccount(values: z.infer<typeof sinpeAccountSchema>) {
    const validatedFields = sinpeAccountSchema.safeParse(values);
    if (!validatedFields.success) {
        return { error: 'Datos inválidos.' };
    }
    const { id, ...data } = validatedFields.data;

    const dataToSave = {
        ...data,
        balance: data.balance || 0,
    };

    try {
        if (id) {
            await updateDoc(doc(db, 'sinpeAccounts', id), dataToSave);
        } else {
            await addDoc(collection(db, 'sinpeAccounts'), {
                ...dataToSave,
                createdAt: Timestamp.now(),
            });
        }
        revalidatePath('/settings/sinpe-accounts');
        return { success: true };
    } catch (e) {
        console.error('Error saving SINPE account:', e);
        return { error: 'No se pudo guardar la cuenta SINPE.' };
    }
}

export async function deleteSinpeAccount(id: string) {
    if (!id) {
        return { error: 'ID de cuenta no válido.' };
    }
    try {
        await deleteDoc(doc(db, 'sinpeAccounts', id));
        revalidatePath('/settings/sinpe-accounts');
        return { success: true };
    } catch (e) {
        console.error('Error deleting SINPE account:', e);
        return { error: 'No se pudo eliminar la cuenta SINPE.' };
    }
}
