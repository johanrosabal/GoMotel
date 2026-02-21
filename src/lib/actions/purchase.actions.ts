'use server';

import { z } from 'zod';
import { doc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';

const purchaseItemSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  quantity: z.number().int().positive(),
});

const purchaseSchema = z.array(purchaseItemSchema);

export async function registerPurchase(items: z.infer<typeof purchaseSchema>) {
    const validatedFields = purchaseSchema.safeParse(items);
    if (!validatedFields.success) {
        return { error: 'Datos de compra inválidos.' };
    }

    const batch = writeBatch(db);

    validatedFields.data.forEach(item => {
        const serviceRef = doc(db, 'services', item.serviceId);
        batch.update(serviceRef, { stock: increment(item.quantity) });
    });

    try {
        await batch.commit();
        revalidatePath('/inventory');
        revalidatePath('/purchases');
        return { success: true };
    } catch (e) {
        console.error('Error registering purchase:', e);
        return { error: 'No se pudo registrar la compra en el inventario.' };
    }
}
