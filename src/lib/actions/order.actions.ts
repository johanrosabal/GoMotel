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
  getDoc
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

  const batch = writeBatch(db);
  const orderRef = doc(collection(db, 'orders'));
  let totalOrderPrice = 0;

  const orderItems: OrderItem[] = [];

  for (const item of cart) {
    const serviceRef = doc(db, 'services', item.service.id);
    const newStock = item.service.stock - item.quantity;
    
    if (newStock < 0) {
        return { error: `No hay suficientes existencias para ${item.service.name}.` };
    }
    
    batch.update(serviceRef, { stock: newStock });
    
    const itemPrice = item.service.price * item.quantity;
    totalOrderPrice += itemPrice;

    orderItems.push({
      serviceId: item.service.id,
      name: item.service.name,
      quantity: item.quantity,
      price: item.service.price,
    });
  }

  const newOrder: Omit<Order, 'id'> = {
    stayId,
    items: orderItems,
    total: totalOrderPrice,
    createdAt: Timestamp.now(),
    status: 'Pending',
  };

  batch.set(orderRef, newOrder);

  try {
    await batch.commit();
    revalidatePath(`/rooms/*`); // Revalidate all room pages
    revalidatePath('/inventory');
    return { success: true };
  } catch (error) {
    console.error('Failed to create order:', error);
    return { error: 'Ocurrió un error inesperado al realizar el pedido.' };
  }
}

export async function getOrdersForStay(stayId: string): Promise<Order[]> {
    if (!stayId) return [];
    try {
        const ordersCollection = collection(db, 'orders');
        const q = query(ordersCollection, where('stayId', '==', stayId), orderBy('createdAt', 'desc'));
        const ordersSnapshot = await getDocs(q);

        return ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Order));

    } catch (error) {
        console.error('Error fetching orders for stay:', error);
        return [];
    }
}
