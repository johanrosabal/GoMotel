'use server';

import { z } from 'zod';
import { doc, writeBatch, increment, addDoc, collection, Timestamp, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';
import type { PurchaseInvoice } from '@/types';

const purchaseItemSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  quantity: z.coerce.number().int().min(1),
  costPrice: z.coerce.number().min(0),
  taxIds: z.array(z.string()).optional(),
});

const purchaseInvoiceSchema = z.object({
  id: z.string().optional(),
  supplierId: z.string({ required_error: "Debe seleccionar un proveedor." }),
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
  status: z.enum(['Activa', 'Anulada']).optional(),
  createdByName: z.string().optional(),
  createdByUid: z.string().optional(),
});

export async function savePurchaseInvoice(values: z.infer<typeof purchaseInvoiceSchema>) {
    const validatedFields = purchaseInvoiceSchema.safeParse(values);
    if (!validatedFields.success) {
        const fieldErrors = validatedFields.error.flatten().fieldErrors;
        const errorMessage = Object.values(fieldErrors)
            .map(errors => errors?.join(', '))
            .filter(Boolean)
            .join('\n');
        console.error(fieldErrors);
        return { error: errorMessage || 'Datos de factura de compra inválidos.' };
    }

    const { id, items, ...invoiceData } = validatedFields.data;
    
    try {
        if (id) {
            // EDIT LOGIC
            const purchaseInvoiceRef = doc(db, 'purchaseInvoices', id);
            const originalInvoiceSnap = await getDoc(purchaseInvoiceRef);
            if (!originalInvoiceSnap.exists()) {
                return { error: 'La factura que intenta editar no existe.' };
            }
            const originalInvoice = originalInvoiceSnap.data() as PurchaseInvoice;
            
            const batch = writeBatch(db);

            // 1. Revert original stock changes
            originalInvoice.items.forEach(item => {
                const serviceRef = doc(db, 'services', item.serviceId);
                batch.update(serviceRef, { stock: increment(-item.quantity) });
            });

            // 2. Apply new stock changes
            items.forEach(item => {
                const serviceRef = doc(db, 'services', item.serviceId);
                batch.update(serviceRef, {
                    stock: increment(item.quantity),
                    costPrice: item.costPrice
                });
            });

            // 3. Update invoice document
            batch.update(purchaseInvoiceRef, {
                ...invoiceData,
                invoiceDate: Timestamp.fromDate(invoiceData.invoiceDate),
                items: items.map(item => ({
                    ...item,
                    total: item.quantity * item.costPrice,
                })),
            });

            await batch.commit();

        } else {
            // CREATE LOGIC
            const batch = writeBatch(db);
            const purchaseInvoiceRef = doc(collection(db, 'purchaseInvoices'));
            batch.set(purchaseInvoiceRef, {
                ...invoiceData,
                invoiceDate: Timestamp.fromDate(invoiceData.invoiceDate),
                createdAt: Timestamp.now(),
                status: 'Activa',
                items: items.map(item => ({
                    ...item,
                    total: item.quantity * item.costPrice,
                })),
            });

            items.forEach(item => {
                const serviceRef = doc(db, 'services', item.serviceId);
                batch.update(serviceRef, { 
                    stock: increment(item.quantity),
                    costPrice: item.costPrice
                });
            });

            await batch.commit();
        }

        revalidatePath('/inventory');
        revalidatePath('/purchases');
        return { success: true };
    } catch (e) {
        console.error('Error saving purchase invoice:', e);
        return { error: 'No se pudo guardar la factura de compra.' };
    }
}


export async function voidPurchaseInvoice(purchaseInvoiceId: string) {
    if (!purchaseInvoiceId) {
        return { error: 'ID de factura no válido.' };
    }

    try {
        const invoiceRef = doc(db, 'purchaseInvoices', purchaseInvoiceId);
        const invoiceSnap = await getDoc(invoiceRef);

        if (!invoiceSnap.exists()) {
            return { error: 'La factura a anular no fue encontrada.' };
        }
        
        const invoice = invoiceSnap.data() as PurchaseInvoice;
        
        if (invoice.status === 'Anulada') {
            return { error: 'Esta factura ya ha sido anulada.' };
        }

        const batch = writeBatch(db);
        
        // Revert stock changes from this invoice
        invoice.items.forEach(item => {
            const serviceRef = doc(db, 'services', item.serviceId);
            batch.update(serviceRef, { stock: increment(-item.quantity) });
        });

        // Mark invoice as voided
        batch.update(invoiceRef, { status: 'Anulada' });
        
        await batch.commit();

        revalidatePath('/inventory');
        revalidatePath('/purchases');
        return { success: 'Factura anulada y stock revertido.' };
    } catch (e) {
        console.error('Error voiding purchase invoice:', e);
        return { error: 'No se pudo anular la factura.' };
    }
}

const spoilageItemSchema = z.object({
  serviceId: z.string(),
  spoilageQuantity: z.coerce.number().int().min(1, "La cantidad de merma debe ser al menos 1."),
  originalQuantity: z.number().int(),
});

const registerSpoilageSchema = z.object({
  purchaseInvoiceId: z.string(),
  notes: z.string().optional(),
  items: z.array(spoilageItemSchema).min(1, "Debe haber al menos un artículo con merma."),
});

export async function registerSpoilage(values: z.infer<typeof registerSpoilageSchema>) {
    const validatedFields = registerSpoilageSchema.safeParse(values);
    if (!validatedFields.success) {
        return { error: 'Datos de merma inválidos.' };
    }

    const { purchaseInvoiceId, items, notes } = validatedFields.data;

    try {
        await runTransaction(db, async (transaction) => {
            const invoiceRef = doc(db, 'purchaseInvoices', purchaseInvoiceId);
            const invoiceSnap = await transaction.get(invoiceRef);
            if (!invoiceSnap.exists()) {
                throw new Error("La factura de compra asociada no fue encontrada.");
            }
            
            for (const item of items) {
                const serviceRef = doc(db, 'services', item.serviceId);
                const serviceSnap = await transaction.get(serviceRef);
                if (!serviceSnap.exists()) {
                     throw new Error(`El producto no fue encontrado.`);
                }
                const currentStock = serviceSnap.data().stock || 0;
                if (item.spoilageQuantity > currentStock) {
                    throw new Error(`No hay suficientes existencias para registrar la merma (Actual: ${currentStock}).`);
                }
                transaction.update(serviceRef, { stock: increment(-item.spoilageQuantity) });
            }

            // TODO: Log the spoilage event in a `spoilageLogs` collection.
        });

        revalidatePath('/inventory');
        return { success: true };

    } catch (e: any) {
        console.error('Error registering spoilage:', e);
        return { error: e.message || 'No se pudo registrar la merma.' };
    }
}
