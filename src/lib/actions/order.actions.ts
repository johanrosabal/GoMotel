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
  DocumentReference,
  limit,
  updateDoc,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '../firebase';
import type { Order, OrderItem, Service, AppliedTax, Invoice } from '@/types';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

export async function createOrder(
  stayId: string, 
  cart: CartItem[],
  paymentDetails?: {
    paymentMethod: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta';
    voucherNumber?: string;
    total: number;
    subtotal: number;
    taxes: AppliedTax[];
  }
) {
  if (!stayId || cart.length === 0) {
    return { error: 'ID de estancia no válido o carrito vacío.' };
  }

  try {
    let invoiceIdForReturn: string | undefined;
    let nextInvoiceNumber = '';

    // 1. Fetch Invoice Number if payment is upfront (Before transaction)
    if (paymentDetails) {
        const invoicesRef = collection(db, 'invoices');
        const lastInvoiceQuery = query(invoicesRef, orderBy('createdAt', 'desc'), limit(1));
        const lastInvoiceSnap = await getDocs(lastInvoiceQuery);
        let nextInvoiceNumberInt = 1;
        if (!lastInvoiceSnap.empty) {
            const lastInvoiceData = lastInvoiceSnap.docs[0].data() as Partial<Invoice>;
            if (lastInvoiceData.invoiceNumber) {
                const lastNumber = parseInt(lastInvoiceData.invoiceNumber.split('-')[1], 10);
                if (!isNaN(lastNumber)) nextInvoiceNumberInt = lastNumber + 1;
            }
        }
        nextInvoiceNumber = `FAC-${String(nextInvoiceNumberInt).padStart(5, '0')}`;
    }

    await runTransaction(db, async (transaction) => {
      const serviceDetails: { service: Service; ref: DocumentReference; quantity: number; notes?: string }[] = [];

      for (const item of cart) {
        const serviceRef = doc(db, 'services', item.service.id);
        const serviceSnap = await transaction.get(serviceRef);

        if (!serviceSnap.exists()) {
          throw new Error(`El producto "${item.service.name}" no fue encontrado.`);
        }
        
        const serviceData = { id: serviceSnap.id, ...serviceSnap.data() } as Service;

        if (serviceData.source !== 'Internal' && serviceData.stock < item.quantity) {
          throw new Error(`No hay suficientes existencias para ${serviceData.name}. Stock actual: ${serviceData.stock}.`);
        }
        
        serviceDetails.push({ service: serviceData, ref: serviceRef, quantity: item.quantity, notes: item.notes });
      }

      const orderRef = doc(collection(db, 'orders'));
      let totalOrderPrice = 0;
      const orderItems: OrderItem[] = [];

      for (const detail of serviceDetails) {
        if (detail.service.source !== 'Internal') {
          transaction.update(detail.ref, { stock: increment(-detail.quantity) });
        }

        const itemPrice = detail.service.price * detail.quantity;
        totalOrderPrice += itemPrice;

        orderItems.push({
          serviceId: detail.service.id,
          name: detail.service.name,
          quantity: detail.quantity,
          price: detail.service.price,
          category: detail.service.category,
          notes: detail.notes || null
        });
      }

      const newOrder: Omit<Order, 'id'> = {
        stayId,
        items: orderItems,
        total: totalOrderPrice,
        createdAt: Timestamp.now(),
        status: 'Pendiente',
        paymentStatus: paymentDetails ? 'Pagado' : 'Pendiente',
        paymentMethod: paymentDetails ? paymentDetails.paymentMethod : 'Por Definir',
        voucherNumber: paymentDetails?.voucherNumber || null,
      };

      if (paymentDetails) {
        const stayRef = doc(db, 'stays', stayId);
        const staySnap = await transaction.get(stayRef);
        if (!staySnap.exists()) throw new Error('La estancia asociada no existe.');
        const stayData = staySnap.data();

        const invoiceRef = doc(collection(db, 'invoices'));
        invoiceIdForReturn = invoiceRef.id;

        const newInvoice: Omit<Invoice, 'id'> = {
            invoiceNumber: nextInvoiceNumber,
            orderId: orderRef.id,
            stayId: stayId,
            clientName: stayData.guestName,
            clientId: stayData.guestId || null,
            createdAt: Timestamp.now(),
            status: 'Pagada',
            items: cart.map(item => ({
                description: `${item.quantity}x ${item.service.name}${item.notes ? ` (${item.notes})` : ''}`,
                quantity: item.quantity,
                unitPrice: item.service.price,
                total: item.service.price * item.quantity,
            })),
            subtotal: paymentDetails.subtotal,
            taxes: paymentDetails.taxes,
            total: paymentDetails.total,
            paymentMethod: paymentDetails.paymentMethod,
            voucherNumber: paymentDetails.voucherNumber || null,
        };

        transaction.set(invoiceRef, newInvoice);
        newOrder.invoiceId = invoiceRef.id;

        if (paymentDetails.paymentMethod === 'Sinpe Movil') {
            const sinpeAccountsQuery = query(collection(db, 'sinpeAccounts'), where('isActive', '==', true), orderBy('createdAt', 'asc'));
            const sinpeAccountsSnapshot = await getDocs(sinpeAccountsQuery);
            let targetAccountRef: DocumentReference | null = null;
            for (const doc of sinpeAccountsSnapshot.docs) {
                const account = doc.data();
                if ((account.balance + paymentDetails.total) <= (account.limitAmount || Infinity)) {
                    targetAccountRef = doc.ref;
                    break;
                }
            }
            if (targetAccountRef) {
                transaction.update(targetAccountRef, { balance: increment(paymentDetails.total) });
            } else {
                 throw new Error("No hay cuentas SINPE disponibles o todas han alcanzado su límite.");
            }
        }
      }

      transaction.set(orderRef, newOrder);
    });

    revalidatePath(`/rooms/${stayId}`);
    revalidatePath('/inventory');
    if (invoiceIdForReturn) revalidatePath('/billing/invoices');
    return { success: true, invoiceId: invoiceIdForReturn };
  } catch (error: any) {
    console.error('Failed to create order:', error);
    return { error: error.message || 'Ocurrió un error inesperado al realizar el pedido.' };
  }
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
    try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, { status });
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error al actualizar estado del pedido.' };
    }
}

export async function getOrdersForStay(stayId: string): Promise<Order[]> {
    if (!stayId) return [];
    try {
        const ordersCollection = collection(db, 'orders');
        const q = query(ordersCollection, where('stayId', '==', stayId));
        const ordersSnapshot = await getDocs(q);

        const orders = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Order));

        orders.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

        return orders;

    } catch (error) {
        console.error('Error fetching orders for stay:', error);
        return [];
    }
}

export async function cancelOrder(orderId: string) {
  if (!orderId) {
    return { error: 'ID de pedido no válido.' };
  }

  try {
    await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await transaction.get(orderRef);

        if (!orderSnap.exists()) {
          throw new Error('El pedido no fue encontrado.');
        }
        const orderData = orderSnap.data() as Order;

        if (orderData.status === 'Cancelado') {
          throw new Error('Este pedido ya ha sido cancelado.');
        }

        const servicesToUpdate: { ref: DocumentReference, quantity: number }[] = [];
        for (const item of orderData.items) {
            const serviceRef = doc(db, 'services', item.serviceId);
            const serviceSnap = await transaction.get(serviceRef);
            if (serviceSnap.exists()) {
                const serviceData = serviceSnap.data() as Service;
                if (serviceData.source !== 'Internal') {
                    servicesToUpdate.push({ ref: serviceRef, quantity: item.quantity });
                }
            }
        }
        
        for (const serviceUpdate of servicesToUpdate) {
            transaction.update(serviceUpdate.ref, { stock: increment(serviceUpdate.quantity) });
        }

        transaction.update(orderRef, { status: 'Cancelado' });
    });

    revalidatePath(`/rooms/*`);
    revalidatePath('/inventory');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to cancel order:', error);
    return { error: error.message || 'Ocurrió un error inesperado al cancelar el pedido.' };
  }
}
