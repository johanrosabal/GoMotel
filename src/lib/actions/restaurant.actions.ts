'use server';

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
  addDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '../firebase';
import type { Order, Service, AppliedTax, Invoice, RestaurantTable } from '@/types';

/**
 * Creates a new restaurant table or bar spot.
 */
export async function createRestaurantTable(data: { number: string, type: string }) {
    try {
        const tablesRef = collection(db, 'restaurantTables');
        
        // Check for duplicate number of the same type
        const q = query(tablesRef, where('number', '==', data.number), where('type', '==', data.type));
        const snap = await getDocs(q);
        if (!snap.empty) {
            return { error: `La ubicación ${data.type} ${data.number} ya existe.` };
        }

        await addDoc(tablesRef, {
            ...data,
            status: 'Available',
            currentOrderId: null
        });

        revalidatePath('/pos');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || "Error al crear ubicación." };
    }
}

/**
 * Deletes a restaurant table.
 */
export async function deleteRestaurantTable(id: string) {
    try {
        const tableRef = doc(db, 'restaurantTables', id);
        const tableSnap = await getDoc(tableRef);
        
        if (tableSnap.exists() && tableSnap.data().status === 'Occupied') {
            return { error: "No se puede eliminar una ubicación con una cuenta abierta." };
        }

        await deleteDoc(tableRef);
        revalidatePath('/pos');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || "Error al eliminar ubicación." };
    }
}

export async function openTableAccount(tableId: string, items: { service: Service; quantity: number }[], label?: string) {
    try {
        await runTransaction(db, async (transaction) => {
            const tableRef = doc(db, 'restaurantTables', tableId);
            const tableSnap = await transaction.get(tableRef);
            if (!tableSnap.exists()) throw new Error("Ubicación no encontrada.");
            
            const tableData = tableSnap.data() as RestaurantTable;

            // 1. Validate and Discount Stock
            for (const item of items) {
                if (item.service.source !== 'Internal') {
                    const sRef = doc(db, 'services', item.service.id);
                    const sSnap = await transaction.get(sRef);
                    const currentStock = sSnap.data()?.stock || 0;
                    if (currentStock < item.quantity) {
                        throw new Error(`Stock insuficiente para ${item.service.name}.`);
                    }
                    transaction.update(sRef, { stock: increment(-item.quantity) });
                }
            }

            // 2. Create Order
            const orderRef = doc(collection(db, 'orders'));
            const total = items.reduce((sum, i) => sum + i.service.price * i.quantity, 0);
            
            const newOrder: Omit<Order, 'id'> = {
                locationType: tableData.type,
                locationId: tableId,
                label: label || 'Cuenta Principal',
                items: items.map(i => ({
                    serviceId: i.service.id,
                    name: i.service.name,
                    quantity: i.quantity,
                    price: i.service.price
                })),
                total,
                createdAt: Timestamp.now(),
                status: 'Pendiente',
                paymentStatus: 'Pendiente'
            };

            transaction.set(orderRef, newOrder);
            // Update table to occupied and set the most recent order as current (for legacy compatibility)
            transaction.update(tableRef, { status: 'Occupied', currentOrderId: orderRef.id });
        });

        revalidatePath('/pos');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || "Error al abrir cuenta." };
    }
}

export async function addToTableAccount(orderId: string, items: { service: Service; quantity: number }[]) {
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw new Error("Orden no encontrada.");
            
            const orderData = orderSnap.data() as Order;
            const newTotal = items.reduce((sum, i) => sum + i.service.price * i.quantity, 0);

            // Update items
            const updatedItems = [...orderData.items];
            for (const item of items) {
                const existing = updatedItems.find(ui => ui.serviceId === item.service.id);
                if (existing) {
                    existing.quantity += item.quantity;
                } else {
                    updatedItems.push({
                        serviceId: item.service.id,
                        name: item.service.name,
                        quantity: item.quantity,
                        price: item.service.price
                    });
                }

                // Stock update
                if (item.service.source !== 'Internal') {
                    const sRef = doc(db, 'services', item.service.id);
                    transaction.update(sRef, { stock: increment(-item.quantity) });
                }
            }

            transaction.update(orderRef, {
                items: updatedItems,
                total: increment(newTotal)
            });
        });

        revalidatePath('/pos');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || "Error al actualizar cuenta." };
    }
}

export async function payRestaurantAccount(
    orderId: string, 
    tableId: string,
    details: {
        paymentMethod: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta';
        voucherNumber?: string;
        clientName: string;
        subtotal: number;
        taxes: AppliedTax[];
        total: number;
    }
) {
    try {
        let invoiceIdForReturn: string | undefined;

        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const tableRef = doc(db, 'restaurantTables', tableId);
            
            // Generate Invoice Number
            const invoicesRef = collection(db, 'invoices');
            const lastInvoiceQuery = query(invoicesRef, orderBy('createdAt', 'desc'), limit(1));
            const lastInvoiceSnap = await getDocs(lastInvoiceQuery);
            let nextNum = 1;
            if (!lastInvoiceSnap.empty) {
                const lastData = lastInvoiceSnap.docs[0].data() as Partial<Invoice>;
                if (lastData.invoiceNumber) {
                    const lastPart = parseInt(lastInvoiceData.invoiceNumber.split('-')[1], 10);
                    if (!isNaN(lastPart)) nextNum = lastPart + 1;
                }
            }
            const invoiceNumber = `FAC-${String(nextNum).padStart(5, '0')}`;

            // Create Invoice
            const invoiceRef = doc(collection(db, 'invoices'));
            invoiceIdForReturn = invoiceRef.id;

            const orderSnap = await transaction.get(orderRef);
            const orderData = orderSnap.data() as Order;

            const invoiceData: Omit<Invoice, 'id'> = {
                invoiceNumber,
                clientName: details.clientName,
                createdAt: Timestamp.now(),
                status: 'Pagada',
                items: orderData.items.map(i => ({
                    description: `${i.quantity}x ${i.name}`,
                    quantity: i.quantity,
                    unitPrice: i.price,
                    total: i.price * i.quantity
                })),
                subtotal: details.subtotal,
                taxes: details.taxes,
                total: details.total,
                paymentMethod: details.paymentMethod,
                voucherNumber: details.voucherNumber,
                orderId: orderId
            };

            transaction.set(invoiceRef, invoiceData);
            transaction.update(orderRef, { status: 'Entregado', paymentStatus: 'Pagado', invoiceId: invoiceIdForReturn });
            
            // Check if there are other pending orders for this table
            const ordersRef = collection(db, 'orders');
            const otherOrdersQuery = query(
                ordersRef, 
                where('locationId', '==', tableId), 
                where('status', '==', 'Pendiente')
            );
            const otherOrdersSnap = await getDocs(otherOrdersQuery);
            
            // Only set table to available if NO other orders are pending (counting the one we just paid)
            const remainingOrders = otherOrdersSnap.docs.filter(d => d.id !== orderId);
            if (remainingOrders.length === 0) {
                transaction.update(tableRef, { status: 'Available', currentOrderId: null });
            } else {
                // Set the next pending order as current
                transaction.update(tableRef, { currentOrderId: remainingOrders[0].id });
            }
        });

        revalidatePath('/pos');
        revalidatePath('/billing/invoices');
        return { success: true, invoiceId: invoiceIdForReturn };
    } catch (e: any) {
        return { error: e.message || "Error al procesar pago." };
    }
}

export async function updateOrderLabel(orderId: string, newLabel: string) {
    try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, { label: newLabel });
        revalidatePath('/pos');
        return { success: true };
    } catch (e: any) {
        console.error("Rename order error:", e);
        return { error: e.message || "Error al renombrar cuenta." };
    }
}

/**
 * Removes a specific item from an open order and restores stock.
 */
export async function removeItemFromAccount(orderId: string, serviceId: string) {
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw new Error("Orden no encontrada.");
            
            const orderData = orderSnap.data() as Order;
            const itemIndex = orderData.items.findIndex(i => i.serviceId === serviceId);
            
            if (itemIndex === -1) throw new Error("Producto no encontrado en la cuenta.");
            
            const item = orderData.items[itemIndex];
            const itemTotal = item.price * item.quantity;

            // 1. Restore Stock
            const serviceRef = doc(db, 'services', serviceId);
            const serviceSnap = await transaction.get(serviceRef);
            if (serviceSnap.exists()) {
                const serviceData = serviceSnap.data() as Service;
                if (serviceData.source !== 'Internal') {
                    transaction.update(serviceRef, { stock: increment(item.quantity) });
                }
            }

            // 2. Update Order Items
            const updatedItems = [...orderData.items];
            updatedItems.splice(itemIndex, 1);

            if (updatedItems.length === 0) {
                // If no items left, cancel the order
                transaction.update(orderRef, {
                    items: [],
                    total: 0,
                    status: 'Cancelado'
                });
                
                // If this order is linked to a table, we check if we should free the table
                if (orderData.locationId) {
                    const tableRef = doc(db, 'restaurantTables', orderData.locationId);
                    // Check for other orders at the same location that are still pending
                    const ordersRef = collection(db, 'orders');
                    const otherOrdersQuery = query(
                        ordersRef, 
                        where('locationId', '==', orderData.locationId), 
                        where('status', '==', 'Pendiente')
                    );
                    const otherOrdersSnap = await getDocs(otherOrdersQuery);
                    const remainingOrders = otherOrdersSnap.docs.filter(d => d.id !== orderId);
                    
                    if (remainingOrders.length === 0) {
                        transaction.update(tableRef, { status: 'Available', currentOrderId: null });
                    }
                }
            } else {
                transaction.update(orderRef, {
                    items: updatedItems,
                    total: increment(-itemTotal)
                });
            }
        });

        revalidatePath('/pos');
        return { success: true };
    } catch (e: any) {
        console.error("Remove item error:", e);
        return { error: e.message || "Error al eliminar producto." };
    }
}
