
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
import type { Order, Service, AppliedTax, RestaurantTable, Tax, OrderItem, Invoice, PrepStatus } from '@/types';

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

const TYPE_LABELS: Record<string, string> = {
    'Table': 'MESA',
    'Bar': 'BARRA',
    'Terraza': 'TERRAZA'
};

export async function openTableAccount(tableId: string, items: { service: Service; quantity: number; notes?: string }[], label?: string, source: 'POS' | 'Public' = 'POS') {
    try {
        let orderIdForReturn: string | undefined;

        // Fetch taxes first
        const taxesSnap = await getDocs(collection(db, 'taxes'));
        const allTaxes = taxesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tax));

        await runTransaction(db, async (transaction) => {
            const tableRef = doc(db, 'restaurantTables', tableId);
            const tableSnap = await transaction.get(tableRef);
            if (!tableSnap.exists()) throw new Error("Ubicación no encontrada.");
            
            const tableData = tableSnap.data() as RestaurantTable;
            const locationLabel = `${TYPE_LABELS[tableData.type] || tableData.type} ${tableData.number}`;

            let orderSubtotal = 0;
            const orderItems: OrderItem[] = [];
            let hasKitchen = false;
            let hasBar = false;
            const taxMap = new Map<string, { taxId: string; name: string; percentage: number; amount: number }>();

            const serviceTaxInfo = allTaxes.find(t => 
                t.name.toLowerCase().includes('servicio') || 
                t.name.toLowerCase().includes('service')
            );

            for (const item of items) {
                const itemSubtotal = item.service.price * item.quantity;
                orderSubtotal += itemSubtotal;

                if (item.service.category === 'Food') hasKitchen = true;
                if (item.service.category === 'Beverage') hasBar = true;

                if (item.service.source !== 'Internal') {
                    const sRef = doc(db, 'products', item.service.id);
                    const sSnap = await transaction.get(sRef);
                    const currentStock = sSnap.data()?.stock || 0;
                    if (currentStock < item.quantity) {
                        throw new Error(`Stock insuficiente para ${item.service.name}.`);
                    }
                    transaction.update(sRef, { stock: increment(-item.quantity) });
                }

                const itemCreatedAt = Timestamp.now();
                orderItems.push({
                    id: Math.random().toString(36).substring(2, 9),
                    serviceId: item.service.id,
                    name: item.service.name,
                    quantity: item.quantity,
                    price: item.service.price,
                    category: item.service.category,
                    notes: item.notes || null,
                    status: 'Pendiente',
                    createdAt: itemCreatedAt
                });

                // Calculate item taxes
                const effectiveTaxIds = new Set(item.service.taxIds || []);
                if (serviceTaxInfo) effectiveTaxIds.add(serviceTaxInfo.id);

                effectiveTaxIds.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        const taxAmount = itemSubtotal * (taxInfo.percentage / 100);
                        const existing = taxMap.get(taxId);
                        if (existing) {
                            existing.amount += taxAmount;
                        } else {
                            taxMap.set(taxId, { taxId, name: taxInfo.name, percentage: taxInfo.percentage, amount: taxAmount });
                        }
                    }
                });
            }

            const appliedTaxes = Array.from(taxMap.values());
            const totalTax = appliedTaxes.reduce((sum, t) => sum + t.amount, 0);
            const orderTotal = orderSubtotal + totalTax;

            const orderRef = doc(collection(db, 'orders'));
            orderIdForReturn = orderRef.id;
            
            const newOrder: Omit<Order, 'id'> = {
                locationType: tableData.type,
                locationId: tableId,
                locationLabel: locationLabel,
                label: label || locationLabel,
                items: orderItems,
                subtotal: orderSubtotal,
                taxes: appliedTaxes,
                total: orderTotal,
                createdAt: Timestamp.now(),
                status: 'Pendiente',
                kitchenStatus: hasKitchen ? 'Pendiente' : 'Entregado',
                barStatus: hasBar ? 'Pendiente' : 'Entregado',
                paymentStatus: 'Pendiente',
                source: source
            };

            transaction.set(orderRef, newOrder);
            transaction.update(tableRef, { status: 'Occupied', currentOrderId: orderRef.id });
        });

        revalidatePath('/pos');
        revalidatePath('/public/order');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        return { success: true, orderId: orderIdForReturn };
    } catch (e: any) {
        console.error("Open table account error:", e);
        return { error: e.message || "Error al abrir cuenta." };
    }
}

export async function addToTableAccount(orderId: string, items: { service: Service; quantity: number; notes?: string }[]) {
    try {
        const taxesSnap = await getDocs(collection(db, 'taxes'));
        const allTaxes = taxesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tax));

        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw new Error("Orden no encontrada.");
            
            const orderData = orderSnap.data() as Order;
            const updatedItems = [...orderData.items];
            let hasNewKitchen = false;
            let hasNewBar = false;
            
            const taxMap = new Map<string, { taxId: string; name: string; percentage: number; amount: number }>();
            // Initialize taxMap with existing order taxes if they exist
            if (orderData.taxes) {
                orderData.taxes.forEach(t => taxMap.set(t.taxId, { ...t }));
            }

            const serviceTaxInfo = allTaxes.find(t => 
                t.name.toLowerCase().includes('servicio') || 
                t.name.toLowerCase().includes('service')
            );

            let newSubtotalAddition = 0;

            const itemCreatedAt = Timestamp.now();
            for (const item of items) {
                const itemSubtotal = item.service.price * item.quantity;
                newSubtotalAddition += itemSubtotal;

                if (item.service.category === 'Food') hasNewKitchen = true;
                if (item.service.category === 'Beverage') hasNewBar = true;

                // IMPORTANT: Stop merging items to track status per order batch
                updatedItems.push({
                    id: Math.random().toString(36).substring(2, 9),
                    serviceId: item.service.id,
                    name: item.service.name,
                    quantity: item.quantity,
                    price: item.service.price,
                    category: item.service.category,
                    notes: item.notes || null,
                    status: 'Pendiente',
                    createdAt: itemCreatedAt
                });

                if (item.service.source !== 'Internal') {
                    const sRef = doc(db, 'products', item.service.id);
                    transaction.update(sRef, { stock: increment(-item.quantity) });
                }

                // Add new taxes
                const effectiveTaxIds = new Set(item.service.taxIds || []);
                if (serviceTaxInfo) effectiveTaxIds.add(serviceTaxInfo.id);

                effectiveTaxIds.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        const taxAmount = itemSubtotal * (taxInfo.percentage / 100);
                        const existing = taxMap.get(taxId);
                        if (existing) {
                            existing.amount += taxAmount;
                        } else {
                            taxMap.set(taxId, { taxId, name: taxInfo.name, percentage: taxInfo.percentage, amount: taxAmount });
                        }
                    }
                });
            }

            const appliedTaxes = Array.from(taxMap.values());
            const currentSubtotal = orderData.subtotal || orderData.total;
            const finalSubtotal = currentSubtotal + newSubtotalAddition;
            const finalTotalTax = appliedTaxes.reduce((sum, t) => sum + t.amount, 0);
            const finalTotal = finalSubtotal + finalTotalTax;

            const updates: Record<string, any> = {
                items: updatedItems,
                subtotal: finalSubtotal,
                taxes: appliedTaxes,
                total: finalTotal
            };

            if (hasNewKitchen) {
                updates.kitchenStatus = 'Pendiente';
                updates.status = 'Pendiente';
            }
            if (hasNewBar) {
                updates.barStatus = 'Pendiente';
                updates.status = 'Pendiente';
            }

            transaction.update(orderRef, updates);
        });

        revalidatePath('/pos');
        revalidatePath('/public/order');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        return { success: true, orderId };
    } catch (e: any) {
        console.error("Add to table account error:", e);
        return { error: e.message || "Error al actualizar cuenta." };
    }
}

export async function payRestaurantAccount(
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
            const tableRef = doc(db, 'restaurantTables', tableId);
            
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
                paymentStatus: 'Pagado', 
                invoiceId: invoiceIdForReturn 
            });
            
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

        revalidatePath('/pos');
        revalidatePath('/billing/invoices');
        return { success: true, invoiceId: invoiceIdForReturn };
    } catch (e: any) {
        console.error("Pay restaurant account error:", e);
        return { error: e.message || "Error al procesar pago." };
    }
}

/**
 * Updates the status of an individual item in an order.
 */
export async function updateOrderItemStatus(orderId: string, itemId: string, status: PrepStatus, area: 'Kitchen' | 'Bar') {
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw new Error("Orden no encontrada.");
            
            const orderData = orderSnap.data() as Order;
            const itemIndex = orderData.items.findIndex(i => i.id === itemId);
            if (itemIndex === -1) throw new Error("Producto no encontrado.");

            const updatedItems = [...orderData.items];
            updatedItems[itemIndex] = { ...updatedItems[itemIndex], status };

            const updates: Record<string, any> = { items: updatedItems };

            // Recalculate area statuses
            const kItems = updatedItems.filter(i => i.category === 'Food');
            const bItems = updatedItems.filter(i => i.category === 'Beverage');

            const getAreaStatus = (items: OrderItem[], current: PrepStatus | undefined) => {
                if (items.length === 0) return 'Entregado'; // If no items for this area, it's "done"
                const allDelivered = items.every(i => i.status === 'Entregado');
                const anyPrepping = items.some(i => i.status === 'En preparación');
                return allDelivered ? 'Entregado' : (anyPrepping ? 'En preparación' : 'Pendiente');
            };

            const kStatus = getAreaStatus(kItems, orderData.kitchenStatus);
            const bStatus = getAreaStatus(bItems, orderData.barStatus);

            updates.kitchenStatus = kStatus;
            updates.barStatus = bStatus;

            if (kStatus === 'Entregado' && bStatus === 'Entregado') {
                updates.status = 'Entregado';
            } else if (kStatus === 'En preparación' || bStatus === 'En preparación') {
                updates.status = 'En preparación';
            } else {
                updates.status = 'Pendiente';
            }

            transaction.update(orderRef, updates);
        });

        revalidatePath('/kitchen');
        revalidatePath('/bar');
        revalidatePath('/public/order');
        revalidatePath('/pos');
        return { success: true };
    } catch (e: any) {
        console.error("Update item status error:", e);
        return { error: e.message || "Error al actualizar estado del producto." };
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
export async function removeItemFromAccount(orderId: string, serviceId: string, reason: string, notes?: string) {
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw new Error("Orden no encontrada.");
            
            const orderData = orderSnap.data() as Order;
            const itemIndex = orderData.items.findIndex(i => i.serviceId === serviceId);
            
            if (itemIndex === -1) throw new Error("Producto no encontrado en la cuenta.");
            
            const item = orderData.items[itemIndex];
            const itemPrice = item.price * item.quantity;

            // 1. Restore Stock
            const serviceRef = doc(db, 'products', serviceId);
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
                    subtotal: 0,
                    total: 0,
                    taxes: [],
                    status: 'Cancelado',
                    kitchenStatus: 'Cancelado',
                    barStatus: 'Cancelado'
                });
                
                if (orderData.locationId) {
                    const tableRef = doc(db, 'restaurantTables', orderData.locationId);
                    const ordersCollection = collection(db, 'orders');
                    const otherOrdersQuery = query(
                        ordersCollection, 
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
                // Approximate new tax based on new subtotal
                const currentSubtotal = orderData.subtotal || orderData.total;
                const newSubtotal = Math.max(0, currentSubtotal - itemPrice);
                const taxRatio = orderData.total > 0 ? (orderData.total - currentSubtotal) / currentSubtotal : 0;
                const newTotal = newSubtotal * (1 + taxRatio);

                transaction.update(orderRef, {
                    items: updatedItems,
                    subtotal: newSubtotal,
                    total: newTotal
                });
            }
        });

        revalidatePath('/pos');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        return { success: true };
    } catch (e: any) {
        console.error("Remove item error:", e);
        return { error: e.message || "Error al eliminar producto." };
    }
}

/**
 * Deletes/Cancels an entire restaurant account and restores all stock.
 */
export async function cancelRestaurantOrder(orderId: string) {
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw new Error("Orden no encontrada.");
            
            const orderData = orderSnap.data() as Order;
            
            // 1. Restore Stock for all items
            for (const item of orderData.items) {
                const serviceRef = doc(db, 'products', item.serviceId);
                const serviceSnap = await transaction.get(serviceRef);
                if (serviceSnap.exists()) {
                    const serviceData = serviceSnap.data() as Service;
                    if (serviceData.source !== 'Internal') {
                        transaction.update(serviceRef, { stock: increment(item.quantity) });
                    }
                }
            }

            // 2. Delete the order
            transaction.delete(orderRef);

            // 3. Update table status if it was the last pending order
            if (orderData.locationId) {
                const tableRef = doc(db, 'restaurantTables', orderData.locationId);
                
                // Get other pending orders for this location
                const ordersCollection = collection(db, 'orders');
                const otherOrdersQuery = query(
                    ordersCollection, 
                    where('locationId', '==', orderData.locationId), 
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
        });

        revalidatePath('/pos');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        return { success: true };
    } catch (e: any) {
        console.error("Cancel entire order error:", e);
        return { error: e.message || "Error al cancelar la cuenta." };
    }
}

/**
 * Marks an order as bill requested.
 */
export async function requestBill(orderId: string) {
    try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, { 
            billRequested: true,
            billRequestedAt: Timestamp.now()
        });
        revalidatePath('/pos');
        revalidatePath('/public/order');
        return { success: true };
    } catch (e: any) {
        console.error("Request bill error:", e);
        return { error: e.message || "Error al solicitar la cuenta." };
    }
}

/**
 * Cancels a specific item from an order, only if it's still 'Pendiente'.
 */
export async function cancelOrderItem(orderId: string, itemId: string) {
    try {
        const taxesSnap = await getDocs(collection(db, 'taxes'));
        const allTaxes = taxesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tax));
        
        const serviceTaxInfo = allTaxes.find(t => 
            t.name.toLowerCase().includes('servicio') || 
            t.name.toLowerCase().includes('service')
        );

        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw new Error("Orden no encontrada.");
            
            const orderData = orderSnap.data() as Order;
            const items = orderData.items || [];
            const itemIndex = items.findIndex(i => i.id === itemId);
            
            if (itemIndex === -1) throw new Error("Producto no encontrado en la orden.");
            const itemToCancel = items[itemIndex];
            
            if (itemToCancel.status !== 'Pendiente') {
                throw new Error("No se puede cancelar un producto que ya está en preparación o entregado.");
            }

            // Restore stock if applicable
            if (itemToCancel.serviceId) {
                const sRef = doc(db, 'products', itemToCancel.serviceId);
                const sSnap = await transaction.get(sRef);
                if (sSnap.exists() && sSnap.data().source !== 'Internal') {
                    transaction.update(sRef, { stock: increment(itemToCancel.quantity) });
                }
            }

            // Remove item
            const newItems = items.filter(i => i.id !== itemId);
            
            // Recalculate totals
            let newSubtotal = 0;
            const taxMap = new Map<string, { taxId: string; name: string; percentage: number; amount: number }>();
            let hasKitchen = false;
            let hasBar = false;

            for (const item of newItems) {
                const itemSubtotal = item.price * item.quantity;
                newSubtotal += itemSubtotal;
                
                if (item.category === 'Food') hasKitchen = true;
                if (item.category === 'Beverage') hasBar = true;

                // We need the service to know its taxes. 
                // Since fetching all services in a loop is bad, let's fetch only those needed or assume standard taxes if not found.
                // However, we can fetch all services first.
                const sRef = doc(db, 'products', item.serviceId);
                const sSnap = await transaction.get(sRef);
                const serviceData = sSnap.data() as Service;

                const effectiveTaxIds = new Set(serviceData?.taxIds || []);
                if (serviceTaxInfo) effectiveTaxIds.add(serviceTaxInfo.id);

                effectiveTaxIds.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        const taxAmount = itemSubtotal * (taxInfo.percentage / 100);
                        const existing = taxMap.get(taxId);
                        if (existing) existing.amount += taxAmount;
                        else taxMap.set(taxId, { taxId, name: taxInfo.name, percentage: taxInfo.percentage, amount: taxAmount });
                    }
                });
            }

            const appliedTaxes = Array.from(taxMap.values());
            const totalTax = appliedTaxes.reduce((sum, t) => sum + t.amount, 0);
            const newTotal = newSubtotal + totalTax;

            transaction.update(orderRef, {
                items: newItems,
                subtotal: newSubtotal,
                taxes: appliedTaxes,
                total: newTotal,
                kitchenStatus: hasKitchen ? orderData.kitchenStatus : 'Entregado',
                barStatus: hasBar ? orderData.barStatus : 'Entregado'
            });
        });

        revalidatePath('/pos');
        revalidatePath('/public/order');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        return { success: true };
    } catch (e: any) {
        console.error("Cancel order item error:", e);
        return { error: e.message || "Error al cancelar producto." };
    }
}

/**
 * Marks a paid takeout order as handed over to the client.
 */
export async function completeTakeoutOrder(orderId: string) {
    try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, { 
            status: 'Completado',
            completedAt: Timestamp.now()
        });
        revalidatePath('/pos');
        return { success: true };
    } catch (e: any) {
        console.error("Complete takeout order error:", e);
        return { error: e.message || "Error al completar pedido." };
    }
}
