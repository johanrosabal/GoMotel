'use server';

import { z } from 'zod';
import { doc, writeBatch, increment, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';

const purchaseItemSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  quantity: z.coerce.number().int().min(1),
  costPrice: z.coerce.number().min(0),
  taxIds: z.array(z.string()).optional(),
});

const purchaseInvoiceSchema = z.object({
  supplierId: z.string(),
  supplierName: z.string(),
  invoiceNumber: z.string().min(1, "El número de factura es requerido.").max(25, "El número de factura no debe exceder los 25 caracteres."),
  invoiceDate: z.date(),
  items: z.array(purchaseItemSchema).min(1),
  totalAmount: z.number(),
  subtotal: z.number().optional(),
  totalTax: z.number().optional(),
  taxesIncluded: z.boolean().optional(),
  discountType: z.enum(['percentage', 'fixed', 'none']).optional(),
  discountValue: z.number().optional(),
  totalDiscount: z.number().optional(),
  imageUrls: z.array(z.string()).optional(),
});

export async function savePurchaseInvoice(values: z.infer<typeof purchaseInvoiceSchema>) {
    const validatedFields = purchaseInvoiceSchema.safeParse(values);
    if (!validatedFields.success) {
        const fieldErrors = validatedFields.error.flatten().fieldErrors;
        // Combine all error messages into a single string.
        const errorMessage = Object.values(fieldErrors)
            .map(errors => errors?.join(', '))
            .filter(Boolean) // Filter out any undefined/null values
            .join('\n');
        console.error(fieldErrors);
        return { error: errorMessage || 'Datos de factura de compra inválidos.' };
    }

    const { items, ...invoiceData } = validatedFields.data;
    const batch = writeBatch(db);

    const purchaseInvoiceRef = doc(collection(db, 'purchaseInvoices'));
    batch.set(purchaseInvoiceRef, {
        ...invoiceData,
        invoiceDate: Timestamp.fromDate(invoiceData.invoiceDate),
        createdAt: Timestamp.now(),
        items: items.map(item => ({
            ...item,
            total: item.quantity * item.costPrice,
        })),
    });

    items.forEach(item => {
        const serviceRef = doc(db, 'services', item.serviceId);
        batch.update(serviceRef, { 
            stock: increment(item.quantity),
            costPrice: item.costPrice // Update cost price
        });
    });

    try {
        await batch.commit();
        revalidatePath('/inventory');
        revalidatePath('/purchases');
        return { success: true };
    } catch (e) {
        console.error('Error saving purchase invoice:', e);
        return { error: 'No se pudo guardar la factura de compra.' };
    }
}
