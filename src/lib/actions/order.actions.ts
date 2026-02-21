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
      const orderRef = doc(collection(db, 'orders'));
      let totalOrderPrice = 0;
      const orderItems: OrderItem[] = [];

      for (const item of cart) {
        const serviceRef = doc(db, 'services', item.service.id);
        const serviceSnap = await transaction.get(serviceRef);

        if (!serviceSnap.exists()) {
          throw new Error(`El producto "${item.service.name}" no fue encontrado.`);
        }
        const serviceData = serviceSnap.data() as Service;
        
        if (serviceData.source === 'Internal') {
          if (!serviceData.ingredients || serviceData.ingredients.length === 0) {
            throw new Error(`El producto de producción interna '${serviceData.name}' no tiene ingredientes definidos.`);
          }
          // Handle ingredient stock deduction
          for (const ingredient of serviceData.ingredients) {
            const ingredientServiceRef = doc(db, 'services', ingredient.serviceId);
            const ingredientSnap = await transaction.get(ingredientServiceRef);
            if (!ingredientSnap.exists()) {
              throw new Error(`El ingrediente "${ingredient.name}" no fue encontrado.`);
            }
            const ingredientData = ingredientSnap.data() as Service;
            const requiredQuantity = ingredient.quantity * item.quantity;
            if (ingredientData.stock < requiredQuantity) {
              throw new Error(`Stock insuficiente para el ingrediente "${ingredient.name}". Se necesitan: ${requiredQuantity}, disponibles: ${ingredientData.stock}`);
            }
            transaction.update(ingredientServiceRef, { stock: increment(-requiredQuantity) });
          }
        } else {
          // Handle regular purchased item stock deduction
          if (serviceData.stock < item.quantity) {
            throw new Error(`No hay suficientes existencias para ${serviceData.name}.`);
          }
          transaction.update(serviceRef, { stock: increment(-item.quantity) });
        }


        const itemPrice = serviceData.price * item.quantity;
        totalOrderPrice += itemPrice;

        orderItems.push({
          serviceId: serviceData.id,
          name: serviceData.name,
          quantity: item.quantity,
          price: serviceData.price,
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
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return { error: 'El pedido no fue encontrado.' };
    }
    const orderData = orderSnap.data() as Order;

    if (orderData.status === 'Cancelado') {
      return { error: 'Este pedido ya ha sido cancelado.' };
    }
    
    const batch = writeBatch(db);

    // Revert stock for each item in the order
    for (const item of orderData.items) {
      const serviceRef = doc(db, 'services', item.serviceId);
      const serviceSnap = await getDoc(serviceRef);
      if (!serviceSnap.exists()) continue;
      
      const serviceData = serviceSnap.data() as Service;

      if (serviceData.source === 'Internal') {
        if (!serviceData.ingredients) continue;
        for (const ingredient of serviceData.ingredients) {
            const ingredientRef = doc(db, 'services', ingredient.serviceId);
            const requiredQty = ingredient.quantity * item.quantity;
            batch.update(ingredientRef, { stock: increment(requiredQty) });
        }
      } else {
        batch.update(serviceRef, { stock: increment(item.quantity) });
      }
    }

    // Mark order as cancelled
    batch.update(orderRef, { status: 'Cancelado' });

    await batch.commit();

    revalidatePath(`/rooms/*`);
    revalidatePath('/inventory');
    return { success: true };
  } catch (error) {
    console.error('Failed to cancel order:', error);
    return { error: 'Ocurrió un error inesperado al cancelar el pedido.' };
  }
}

