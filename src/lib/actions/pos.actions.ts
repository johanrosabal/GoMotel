
'use server';

import {
  collection,
  doc,
  writeBatch,
  Timestamp,
  getDocs,
  query,
  where,
  orderBy,
  getDoc,
  increment,
  runTransaction,
  limit,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '../firebase';
import type { Invoice, InvoiceItem, AppliedTax, Service } from '@/types';

interface DirectSaleInput {
    items: {
        serviceId: string;
        name: string;
        quantity: number;
        price: number;
        category?: 'Food' | 'Beverage' | 'Amenity';
        notes?: string;
    }[];
    clientName: string;
    paymentMethod: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta';
    voucherNumber?: string;
    subtotal: number;
    taxes: AppliedTax[];
    total: number;
}

export async function createDirectSale(values: DirectSaleInput) {
    if (values.items.length === 0) return { error: 'El carrito está vacío.' };

    try {
        // 1. Generate Invoice Number (Before transaction)
        const invoicesRef = collection(db, 'invoices');
        const lastInvoiceQuery = query(invoicesRef, orderBy('createdAt', 'desc'), limit(1));
        const lastInvoiceSnap = await getDocs(lastInvoiceQuery);
        
        let nextNum = 1;
        if (!lastInvoiceSnap.empty) {
            const lastInvoiceData = lastInvoiceSnap.docs[0].data() as Partial<Invoice>;
            if (lastInvoiceData.invoiceNumber) {
                const lastPart = parseInt(lastInvoiceData.invoiceNumber.split('-')[1], 10);
                if (!isNaN(lastPart)) nextNum = lastPart + 1;
            }
        }
        const invoiceNumber = `FAC-${String(nextNum).padStart(5, '0')}`;

        let invoiceIdForReturn: string | undefined;

        await runTransaction(db, async (transaction) => {
            // 2. Validate Stock and update
            for (const item of values.items) {
                const serviceRef = doc(db, 'products', item.serviceId);
                const serviceSnap = await transaction.get(serviceRef);
                if (!serviceSnap.exists()) throw new Error(`Producto "${item.name}" no encontrado.`);
                
                const serviceData = serviceSnap.data() as Service;
                if (serviceData.source !== 'Internal' && serviceData.stock < item.quantity) {
                    throw new Error(`Existencias insuficientes para ${serviceData.name}. Stock: ${serviceData.stock}`);
                }
                
                if (serviceData.source !== 'Internal') {
                    transaction.update(serviceRef, { stock: increment(-item.quantity) });
                }
            }

            // 3. Create Invoice
            const invoiceRef = doc(collection(db, 'invoices'));
            invoiceIdForReturn = invoiceRef.id;

            const invoiceData: Omit<Invoice, 'id'> = {
                invoiceNumber,
                clientName: values.clientName || 'Cliente de Contado',
                createdAt: Timestamp.now(),
                status: 'Pagada',
                items: values.items.map(i => ({
                    description: `${i.quantity}x ${i.name}${i.notes ? ` (${i.notes})` : ''}`,
                    quantity: i.quantity,
                    unitPrice: i.price,
                    total: i.price * i.quantity
                })),
                subtotal: values.subtotal,
                taxes: values.taxes,
                total: values.total,
                paymentMethod: values.paymentMethod,
                voucherNumber: values.voucherNumber || null,
            };

            transaction.set(invoiceRef, invoiceData);

            // Create Order for KDS
            const orderRef = doc(collection(db, 'orders'));
            transaction.set(orderRef, {
                locationType: 'Takeout',
                label: values.clientName || 'Venta POS',
                items: values.items.map(i => ({
                    serviceId: i.serviceId,
                    name: i.name,
                    quantity: i.quantity,
                    price: i.price,
                    category: i.category,
                    notes: i.notes || null
                })),
                total: values.total,
                createdAt: Timestamp.now(),
                status: 'Entregado',
                paymentStatus: 'Pagado',
                paymentMethod: values.paymentMethod,
                invoiceId: invoiceIdForReturn,
                source: 'POS'
            });

            // 4. Update SINPE if applies
            if (values.paymentMethod === 'Sinpe Movil') {
                const sinpeRef = collection(db, 'sinpeAccounts');
                const sinpeQ = query(sinpeRef, where('isActive', '==', true), orderBy('createdAt', 'asc'));
                const sinpeSnap = await getDocs(sinpeQ);
                
                let targetRef = null;
                for (const d of sinpeSnap.docs) {
                    const acc = d.data();
                    if ((acc.balance + values.total) <= (acc.limitAmount || Infinity)) {
                        targetRef = d.ref;
                        break;
                    }
                }
                if (targetRef) transaction.update(targetRef, { balance: increment(values.total) });
            }
        });

        revalidatePath('/inventory');
        revalidatePath('/billing/invoices');
        revalidatePath('/pos');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        
        return { success: true, invoiceId: invoiceIdForReturn };

    } catch (e: any) {
        console.error("Direct sale error:", e);
        return { error: e.message || 'Error al procesar la venta directa.' };
    }
}
