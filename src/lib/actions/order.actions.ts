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
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '../firebase';
import type { Order, OrderItem, Service } from '@/types';

type CartItem = {
  service: Service;
  quantity: number;
};

export async function createOrder(stayId: string, cart: CartItem[]) {
  if (!stayId || cart.length === 0) {
    return { error: 'ID de estancia no válido o carrito vacío.' };
  }

  try {
    await runTransaction(db, async (transaction) => {
      const serviceDetails: { service: Service; ref: DocumentReference; quantity: number }[] = [];

      // 1. All reads first
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
        
        serviceDetails.push({ service: serviceData, ref: serviceRef, quantity: item.quantity });
      }

      // 2. All writes now
      const orderRef = doc(collection(db, 'orders'));
      let totalOrderPrice = 0;
      const orderItems: OrderItem[] = [];

      for (const detail of serviceDetails) {
        // Update stock for non-internal products
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
        });
      }
      
      const newOrder: Omit<Order, 'id'> = {
        stayId,
        items: orderItems,
        total: totalOrderPrice,
        createdAt: Timestamp.now(),
        status: 'Pendiente',
      };
      transaction.set(orderRef, newOrder);
    });

    revalidatePath(`/rooms/*`);
    revalidatePath('/inventory');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to create order:', error);
    return { error: error.message || 'Ocurrió un error inesperado al realizar el pedido.' };
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

        // Pre-fetch all service data first (READS)
        const servicesToUpdate: { ref: DocumentReference, quantity: number }[] = [];
        for (const item of orderData.items) {
            const serviceRef = doc(db, 'services', item.serviceId);
            // We need to read the service to see its source, even if we just read it in createOrder
            const serviceSnap = await transaction.get(serviceRef);
            if (serviceSnap.exists()) {
                const serviceData = serviceSnap.data() as Service;
                if (serviceData.source !== 'Internal') {
                    servicesToUpdate.push({ ref: serviceRef, quantity: item.quantity });
                }
            }
        }
        
        // Now perform all WRITES
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
