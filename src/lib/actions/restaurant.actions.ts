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
  writeBatch,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '../firebase';
import type { Order, Service, AppliedTax, RestaurantTable, Tax, OrderItem, Invoice, PrepStatus } from '@/types';
import { logCancellationAudit } from './audit.actions';

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
            
            // A. PRE-READ ALL PRODUCTS (Unique IDs only to save bandwidth)
            const uniqueProductIds = Array.from(new Set(items.map(i => i.service.id)));
            const productSnapshots: { ref: any, data: any, sId: string, name: string }[] = [];
            
            for (const sId of uniqueProductIds) {
                const itemRef = items.find(i => i.service.id === sId);
                const sRef = doc(db, 'products', sId);
                const sSnap = await transaction.get(sRef);
                productSnapshots.push({ 
                    ref: sRef, 
                    data: sSnap.exists() ? sSnap.data() : null, 
                    sId,
                    name: itemRef?.service.name || 'Producto'
                });
            }

            // B. LOGIC & CALCULATIONS
            const tableData = tableSnap.data() as RestaurantTable;
            const locationLabel = `${TYPE_LABELS[tableData.type] || tableData.type} ${tableData.number}`;

            let orderSubtotal = 0;
            const orderItems: OrderItem[] = [];
            let hasKitchen = false;
            let hasBar = false;
            let hasArticles = false;
            const taxMap = new Map<string, { taxId: string; name: string; percentage: number; amount: number }>();

            const serviceTaxInfo = allTaxes.find(t => 
                t.name.toLowerCase().includes('servicio') || 
                t.name.toLowerCase().includes('service')
            );

            for (const item of items) {
                const ps = productSnapshots.find(p => p.sId === item.service.id);
                if (ps?.data && ps.data.source !== 'Internal' && ps.data.stock < item.quantity) {
                    throw new Error(`Stock insuficiente para ${item.service.name}.`);
                }

                if (item.service.category === 'Food') hasKitchen = true;
                if (item.service.category === 'Beverage') hasBar = true;
                if (item.service.category === 'Article') hasArticles = true;

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

                const effectiveTaxIds = new Set(item.service.taxIds || []);
                if (serviceTaxInfo) effectiveTaxIds.add(serviceTaxInfo.id);

                let cumulativePercentage = 0;
                effectiveTaxIds.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) cumulativePercentage += taxInfo.percentage;
                });

                let itemSubtotal = 0;
                const itemQuantityPrice = item.service.price * item.quantity;
                if (item.service.taxIncluded) {
                    itemSubtotal = itemQuantityPrice / (1 + cumulativePercentage / 100);
                } else {
                    itemSubtotal = itemQuantityPrice;
                }
                orderSubtotal += itemSubtotal;

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
                status: (hasKitchen || hasBar || hasArticles) ? 'Pendiente' : 'Listo',
                kitchenStatus: hasKitchen ? 'Pendiente' : 'Entregado',
                barStatus: hasBar ? 'Pendiente' : 'Entregado',
                articlesStatus: hasArticles ? 'Pendiente' : 'Entregado',
                paymentStatus: 'Pendiente',
                source: source
            };

            // C. BATCHED WRITES AT THE END
            for (const ps of productSnapshots) {
                if (ps.data && ps.data.source !== 'Internal') {
                    const totalQty = items.filter(i => i.service.id === ps.sId).reduce((sum, i) => sum + i.quantity, 0);
                    transaction.update(ps.ref, { stock: increment(-totalQty) });
                }
            }
            transaction.set(orderRef, newOrder);
            transaction.update(tableRef, { status: 'Occupied', currentOrderId: orderRef.id });
        });


        revalidatePath('/pos');
        revalidatePath('/public/order');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        revalidatePath('/articles');
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
            
            // A. PRE-READ ALL PRODUCTS (Unique IDs only)
            const uniqueProductIds = Array.from(new Set(items.map(i => i.service.id)));
            const productSnapshots: { ref: any, data: any, sId: string, name: string }[] = [];
            
            for (const sId of uniqueProductIds) {
                const itemRef = items.find(i => i.service.id === sId);
                const sRef = doc(db, 'products', sId);
                const sSnap = await transaction.get(sRef);
                productSnapshots.push({ 
                    ref: sRef, 
                    data: sSnap.exists() ? sSnap.data() : null, 
                    sId,
                    name: itemRef?.service.name || 'Producto'
                });
            }

            // B. LOGIC & CALCULATIONS
            const orderData = orderSnap.data() as Order;
            const updatedItems = [...orderData.items];
            let hasNewKitchen = false;
            let hasNewBar = false;
            let hasNewArticles = false;
            
            const taxMap = new Map<string, { taxId: string; name: string; percentage: number; amount: number }>();
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
                const ps = productSnapshots.find(p => p.sId === item.service.id);
                if (ps?.data && ps.data.source !== 'Internal' && ps.data.stock < item.quantity) {
                    throw new Error(`Stock insuficiente para ${item.service.name}.`);
                }

                if (item.service.category === 'Food') hasNewKitchen = true;
                if (item.service.category === 'Beverage') hasNewBar = true;
                if (item.service.category === 'Article') hasNewArticles = true;

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

                const effectiveTaxIds = new Set(item.service.taxIds || []);
                if (serviceTaxInfo) effectiveTaxIds.add(serviceTaxInfo.id);

                let cumulativePercentage = 0;
                effectiveTaxIds.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) cumulativePercentage += taxInfo.percentage;
                });

                let itemSubtotal = 0;
                const itemQuantityPrice = item.service.price * item.quantity;
                if (item.service.taxIncluded) {
                    itemSubtotal = itemQuantityPrice / (1 + cumulativePercentage / 100);
                } else {
                    itemSubtotal = itemQuantityPrice;
                }
                newSubtotalAddition += itemSubtotal;

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

            const currentSubtotal = orderData.subtotal || orderData.total;
            const finalSubtotal = currentSubtotal + newSubtotalAddition;
            const appliedTaxes = Array.from(taxMap.values());
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
            if (hasNewArticles) {
                updates.articlesStatus = 'Pendiente';
                updates.status = 'Pendiente';
            }

            // C. BATCHED WRITES AT THE END
            for (const ps of productSnapshots) {
                if (ps.data && ps.data.source !== 'Internal') {
                    const totalQty = items.filter(i => i.service.id === ps.sId).reduce((sum, i) => sum + i.quantity, 0);
                    transaction.update(ps.ref, { stock: increment(-totalQty) });
                }
            }
            transaction.update(orderRef, updates);
        });


        revalidatePath('/pos');
        revalidatePath('/public/order');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        revalidatePath('/articles');
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
export async function updateOrderItemStatus(orderId: string, itemId: string, status: PrepStatus, area: 'Kitchen' | 'Bar' | 'Articles') {
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

            // Recalculate area statuses - ignoring cancelled items
            const kItems = updatedItems.filter(i => i.category === 'Food' && i.status !== 'Cancelado');
            const bItems = updatedItems.filter(i => i.category === 'Beverage' && i.status !== 'Cancelado');
            const aItems = updatedItems.filter(i => i.category === 'Article' && i.status !== 'Cancelado');

            const getAreaStatus = (items: OrderItem[], current: PrepStatus | undefined) => {
                if (items.length === 0) return 'Listo'; // If no items for this area, it's "done"
                const allListo = items.every(i => i.status === 'Listo' || i.status === 'Entregado');
                const allDelivered = items.every(i => i.status === 'Entregado');
                const anyPrepping = items.some(i => i.status === 'En preparación');
                
                if (allDelivered) return 'Entregado';
                if (allListo) return 'Listo';
                return anyPrepping ? 'En preparación' : 'Pendiente';
            };

            const kStatus = getAreaStatus(kItems, orderData.kitchenStatus);
            const bStatus = getAreaStatus(bItems, orderData.barStatus);
            const aStatus = getAreaStatus(aItems, orderData.articlesStatus);

            updates.kitchenStatus = kStatus;
            updates.barStatus = bStatus;
            updates.articlesStatus = aStatus;

            if (kStatus === 'Entregado' && bStatus === 'Entregado' && aStatus === 'Entregado') {
                updates.status = 'Entregado';
            } else if ((kStatus === 'Listo' || kStatus === 'Entregado') && 
                       (bStatus === 'Listo' || bStatus === 'Entregado') && 
                       (aStatus === 'Listo' || aStatus === 'Entregado')) {
                updates.status = 'Listo';
            } else if (kStatus === 'En preparación' || bStatus === 'En preparación' || aStatus === 'En preparación') {
                updates.status = 'En preparación';
            } else {
                updates.status = 'Pendiente';
            }

            transaction.update(orderRef, updates);
        });

        revalidatePath('/kitchen');
        revalidatePath('/bar');
        revalidatePath('/articles');
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

            // 0. Audit check: if it was already in prep or ready, log it as a loss
            if (item.status === 'En preparación' || item.status === 'Listo') {
                await logCancellationAudit({
                    orderId,
                    serviceId: item.serviceId,
                    serviceName: item.name,
                    quantity: item.quantity,
                    previousStatus: item.status,
                    reason,
                    notes: notes || '',
                    locationLabel: orderData.locationLabel || 'Unknown',
                    area: item.category === 'Food' ? 'Kitchen' : item.category === 'Beverage' ? 'Bar' : 'Other'
                });
            }

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
                    barStatus: 'Cancelado',
                    articlesStatus: 'Cancelado'
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
        revalidatePath('/articles');
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
        // 1. Pre-fetch basic data needed for the transaction logic
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) throw new Error("Orden no encontrada.");
        const orderData = orderSnap.data() as Order;

        // 2. Check for other pending orders for this location to handle table status
        let nextOrderId: string | null = null;
        let hasOtherOrders = false;

        if (orderData.locationId) {
            const ordersCollection = collection(db, 'orders');
            const otherOrdersQuery = query(
                ordersCollection, 
                where('locationId', '==', orderData.locationId), 
                where('paymentStatus', '==', 'Pendiente')
            );
            const otherOrdersSnap = await getDocs(otherOrdersQuery);
            const remainingOrders = otherOrdersSnap.docs.filter(d => d.id !== orderId);
            
            hasOtherOrders = remainingOrders.length > 0;
            if (hasOtherOrders) {
                nextOrderId = remainingOrders[0].id;
            }
        }

        // 3. Start Transaction
        await runTransaction(db, async (transaction) => {
            // A. ALL READS FIRST
            const serviceSnapshots = [];
            for (const item of orderData.items) {
                const serviceRef = doc(db, 'products', item.serviceId);
                const serviceSnap = await transaction.get(serviceRef);
                serviceSnapshots.push({ ref: serviceRef, snap: serviceSnap, quantity: item.quantity });
            }

            let tableRef = null;
            if (orderData.locationId) {
                tableRef = doc(db, 'restaurantTables', orderData.locationId);
                await transaction.get(tableRef); // Read table
            }

            // B. ALL WRITES AFTER
            for (const { ref, snap, quantity } of serviceSnapshots) {
                if (snap.exists()) {
                    const serviceData = snap.data() as Service;
                    if (serviceData.source !== 'Internal') {
                        transaction.update(ref, { stock: increment(quantity) });
                    }
                }
            }

            transaction.delete(orderRef);

            if (tableRef) {
                if (!hasOtherOrders) {
                    transaction.update(tableRef, { status: 'Available', currentOrderId: null });
                } else {
                    transaction.update(tableRef, { currentOrderId: nextOrderId });
                }
            }
        });

        revalidatePath('/pos');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        revalidatePath('/articles');
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
 * Marks all orders and the stay itself as bill requested.
 */
export async function requestStayBill(stayId: string) {
    try {
        const batch = writeBatch(db);
        
        // 1. Find all active orders for this stay
        const q = query(collection(db, 'orders'), where('stayId', '==', stayId), where('status', '!=', 'Cancelado'));
        const snap = await getDocs(q);
        
        snap.docs.forEach(d => {
            batch.update(d.ref, { 
                billRequested: true,
                billRequestedAt: Timestamp.now()
            });
        });
        
        // 2. Update the stay itself
        const stayRef = doc(db, 'stays', stayId);
        batch.update(stayRef, {
            billRequested: true,
            billRequestedAt: Timestamp.now()
        });

        await batch.commit();
        
        revalidatePath('/pos');
        revalidatePath('/public/order');
        revalidatePath(`/rooms/${stayId}`);
        
        return { success: true };
    } catch (e: any) {
        console.error("Request stay bill error:", e);
        return { error: e.message || "Error al solicitar la cuenta de la habitación." };
    }
}

/**
 * Cancels a specific item from an order, only if it's still 'Pendiente'.
 */
export async function cancelOrderItem(orderId: string, itemId: string, reason: string = 'Sin razón especificada', notes?: string) {
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

            // 1. Audit check: if it was already in prep or ready, log it as a loss
            if (itemToCancel.status === 'En preparación' || itemToCancel.status === 'Listo') {
                await logCancellationAudit({
                    orderId,
                    serviceId: itemToCancel.serviceId,
                    serviceName: itemToCancel.name,
                    quantity: itemToCancel.quantity,
                    previousStatus: itemToCancel.status,
                    reason,
                    notes: notes || '',
                    locationLabel: orderData.locationLabel || 'Unknown',
                    area: itemToCancel.category === 'Food' ? 'Kitchen' : itemToCancel.category === 'Beverage' ? 'Bar' : 'Other'
                });
            }
            
            // We now allow cancelling even if delivered to allow corrections

            // A. PRE-READ ALL PRODUCTS FOR TAX RECALCULATION & STOCK RESTORE
            const canceledServiceRef = doc(db, 'products', itemToCancel.serviceId);
            const canceledServiceSnap = await transaction.get(canceledServiceRef);

            // Mark the specific item as Cancelado
            const newItems = items.map(i => i.id === itemId ? { ...i, status: 'Cancelado' as PrepStatus } : i);
            const activeItems = newItems.filter(i => i.status !== 'Cancelado');

            // Fetch product data for all active items to recalculate taxes
            const productSnapshots: { id: string, data: any }[] = [];
            const uniqueActiveIds = Array.from(new Set(activeItems.map(i => i.serviceId)));
            for (const sId of uniqueActiveIds) {
                const sRef = doc(db, 'products', sId);
                const sSnap = await transaction.get(sRef);
                productSnapshots.push({ id: sId, data: sSnap.exists() ? sSnap.data() : null });
            }

            // B. LOGIC & CALCULATIONS
            let newSubtotal = 0;
            const taxMap = new Map<string, { taxId: string; name: string; percentage: number; amount: number }>();

            for (const item of activeItems) {
                const serviceData = productSnapshots.find(s => s.id === item.serviceId)?.data;
                const effectiveTaxIds = new Set(serviceData?.taxIds || []);
                if (serviceTaxInfo) effectiveTaxIds.add(serviceTaxInfo.id);

                let cumulativePercentage = 0;
                effectiveTaxIds.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) cumulativePercentage += taxInfo.percentage;
                });

                let itemSubtotal = 0;
                const itemQuantityPrice = item.price * item.quantity;
                if (serviceData?.taxIncluded) {
                    itemSubtotal = itemQuantityPrice / (1 + cumulativePercentage / 100);
                } else {
                    itemSubtotal = itemQuantityPrice;
                }
                newSubtotal += itemSubtotal;

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

            // Recalculate area statuses
            const getAreaStatus = (areaItems: OrderItem[]) => {
                if (areaItems.length === 0) return 'Listo';
                const allListo = areaItems.every(i => i.status === 'Listo' || i.status === 'Entregado');
                const allDelivered = areaItems.every(i => i.status === 'Entregado');
                const anyPrepping = areaItems.some(i => i.status === 'En preparación');
                if (allDelivered) return 'Entregado';
                if (allListo) return 'Listo';
                return anyPrepping ? 'En preparación' : 'Pendiente';
            };

            const kStatus = getAreaStatus(activeItems.filter(i => i.category === 'Food'));
            const bStatus = getAreaStatus(activeItems.filter(i => i.category === 'Beverage'));
            const aStatus = getAreaStatus(activeItems.filter(i => i.category === 'Article'));

            const updates: Record<string, any> = {
                items: newItems,
                subtotal: newSubtotal,
                taxes: appliedTaxes,
                total: newTotal,
                kitchenStatus: kStatus,
                barStatus: bStatus,
                articlesStatus: aStatus
            };

            if (activeItems.length === 0) {
                updates.status = 'Cancelado';
                updates.subtotal = 0;
                updates.total = 0;
                updates.taxes = [];

                // Liberar la mesa si ya no hay productos activos
                if (orderData.locationId && orderData.locationType === 'RestaurantTable') {
                    const tableRef = doc(db, 'restaurantTables', orderData.locationId);
                    transaction.update(tableRef, { status: 'Available', currentOrderId: null });
                }
            } else if (kStatus === 'Entregado' && bStatus === 'Entregado' && aStatus === 'Entregado') {
                updates.status = 'Entregado';
            } else if ((kStatus === 'Listo' || kStatus === 'Entregado') && 
                       (bStatus === 'Listo' || bStatus === 'Entregado') && 
                       (aStatus === 'Listo' || aStatus === 'Entregado')) {
                updates.status = 'Listo';
            } else if (kStatus === 'En preparación' || bStatus === 'En preparación' || aStatus === 'En preparación') {
                updates.status = 'En preparación';
            } else {
                updates.status = 'Pendiente';
            }

            // C. ALL WRITES AT THE END
            if (canceledServiceSnap.exists() && canceledServiceSnap.data().source !== 'Internal') {
                transaction.update(canceledServiceRef, { stock: increment(itemToCancel.quantity) });
            }
            transaction.update(orderRef, updates);
        });


        revalidatePath('/pos');
        revalidatePath('/public/order');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        revalidatePath('/articles');
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

export async function completeTableOrderDelivery(orderId: string) {
    try {
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) throw new Error("Orden no encontrada.");
        
        await updateDoc(orderRef, {
            status: 'Entregado',
            kitchenStatus: 'Entregado',
            barStatus: 'Entregado',
            articlesStatus: 'Entregado',
            items: orderSnap.data().items.map((i: any) => ({ ...i, status: 'Entregado' }))
        });
        revalidatePath('/pos');
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        revalidatePath('/articles');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || "Error al completar la entrega." };
    }
}
