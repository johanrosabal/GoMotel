import {
  collection,
  doc,
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
import { db } from '../firebase';
import type { Order, Service, AppliedTax, RestaurantTable, Tax, OrderItem, Invoice, PrepStatus } from '@/types';

export async function payRestaurantAccountClient(
    orderId: string, 
    tableId: string,
    details: {
        paymentMethod: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta';
        voucherNumber?: string | null;
        clientName: string;
        subtotal: number;
        taxes: AppliedTax[];
        total: number;
    }
) {
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
            const orderRef = doc(db, 'orders', orderId);
            
            // Create Invoice
            const invoiceRef = doc(collection(db, 'invoices'));
            invoiceIdForReturn = invoiceRef.id;

            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw new Error("Pedido no encontrado.");
            const orderData = orderSnap.data() as Order;

            const invoiceData: Omit<Invoice, 'id'> = {
                invoiceNumber,
                clientName: details.clientName,
                createdAt: Timestamp.now(),
                status: 'Pagada',
                items: orderData.items.map(i => ({
                    description: `${i.quantity}x ${i.name}${i.notes ? ` (${i.notes})` : ''}`,
                    quantity: i.quantity,
                    unitPrice: i.price,
                    total: i.price * i.quantity
                })),
                subtotal: details.subtotal,
                taxes: details.taxes,
                total: details.total,
                paymentMethod: details.paymentMethod,
                voucherNumber: details.voucherNumber || null,
                orderId: orderId,
                stayId: orderData.stayId || null,
            };

            transaction.set(invoiceRef, invoiceData);
            transaction.update(orderRef, { 
                status: 'Entregado', 
                kitchenStatus: 'Entregado',
                barStatus: 'Entregado',
                articlesStatus: 'Entregado',
                paymentStatus: 'Pagado', 
                invoiceId: invoiceIdForReturn,
                billRequested: false,
                items: (orderData.items || []).map(i => i.status === 'Cancelado' ? i : { ...i, status: 'Entregado' })
            });
            
            if (orderData.locationType !== 'Stay') {
                const tableRef = doc(db, 'restaurantTables', tableId);
                // Check if there are other pending orders for this table
                const ordersCollection = collection(db, 'orders');
                const otherOrdersQuery = query(
                    ordersCollection, 
                    where('locationId', '==', tableId), 
                    where('paymentStatus', '==', 'Pendiente')
                );
                const otherOrdersSnap = await getDocs(otherOrdersQuery);
                
                const remainingOrders = otherOrdersSnap.docs.filter(d => d.id !== orderId);
                if (remainingOrders.length === 0) {
                    transaction.update(tableRef, { status: 'Available', currentOrderId: null });
                } else {
                    transaction.update(tableRef, { currentOrderId: remainingOrders[0].id });
                }
            }

            // Update SINPE balance if applies
            if (details.paymentMethod === 'Sinpe Movil') {
                const sinpeRef = collection(db, 'sinpeAccounts');
                const sinpeQ = query(sinpeRef, where('isActive', '==', true), orderBy('createdAt', 'asc'));
                const sinpeSnap = await getDocs(sinpeQ);
                
                let targetRef = null;
                for (const d of sinpeSnap.docs) {
                    const acc = d.data();
                    if ((acc.balance + details.total) <= (acc.limitAmount || Infinity)) {
                        targetRef = d.ref;
                        break;
                    }
                }
                if (targetRef) transaction.update(targetRef, { balance: increment(details.total) });
            }
        });

        return { success: true, invoiceId: invoiceIdForReturn };
    } catch (e: any) {
        console.error("Pay restaurant account error:", e);
        return { error: e.message || "Error al procesar pago." };
    }
}
