
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
  DocumentReference,
  limit,
  updateDoc,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '../firebase';
import type { Order, OrderItem, Service, AppliedTax, Invoice, PrepStatus, Stay, Tax } from '@/types';

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
    voucherNumber?: string | null;
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

    let orderIdForReturn: string | undefined;

    // Fetch all taxes to have them ready for calculation in the transaction
    const taxesSnap = await getDocs(collection(db, 'taxes'));
    const allTaxes = taxesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tax));

    await runTransaction(db, async (transaction) => {
      const stayRef = doc(db, 'stays', stayId);
      const staySnap = await transaction.get(stayRef);
      if (!staySnap.exists()) throw new Error('La estancia asociada no existe.');
      const stayData = staySnap.data() as Stay;

      const serviceDetails: { service: Service; ref: DocumentReference; quantity: number; notes?: string }[] = [];

      for (const item of cart) {
        const serviceRef = doc(db, 'products', item.service.id);
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
      orderIdForReturn = orderRef.id;
      
      let orderSubtotal = 0;
      const orderItems: OrderItem[] = [];
      let hasKitchen = false;
      let hasBar = false;
      const taxMap = new Map<string, { taxId: string; name: string; percentage: number; amount: number }>();

      // 10% Service Tax for restaurant stays
      const serviceTaxInfo = allTaxes.find(t => 
        t.name.toLowerCase().includes('servicio') || 
        t.name.toLowerCase().includes('service')
      );

      for (const detail of serviceDetails) {
        if (detail.service.source !== 'Internal') {
          transaction.update(detail.ref, { stock: increment(-detail.quantity) });
        }

        const itemSubtotal = detail.service.price * detail.quantity;
        orderSubtotal += itemSubtotal;

        if (detail.service.category === 'Food') hasKitchen = true;
        if (detail.service.category === 'Beverage') hasBar = true;

        orderItems.push({
          serviceId: detail.service.id,
          name: detail.service.name,
          quantity: detail.quantity,
          price: detail.service.price,
          category: detail.service.category,
          notes: detail.notes || null
        });

        // Calculate item taxes
        const effectiveTaxIds = new Set(detail.service.taxIds || []);
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

      const newOrder: Omit<Order, 'id'> = {
        stayId,
        locationType: 'Stay',
        locationId: stayId,
        locationLabel: `Hab. ${stayData.roomNumber}`,
        label: stayData.guestName,
        items: orderItems,
        subtotal: orderSubtotal,
        taxes: appliedTaxes,
        total: orderTotal,
        createdAt: Timestamp.now(),
        status: 'Pendiente',
        kitchenStatus: hasKitchen ? 'Pendiente' : 'Entregado',
        barStatus: hasBar ? 'Pendiente' : 'Entregado',
        paymentStatus: paymentDetails ? 'Pagado' : 'Pendiente',
        paymentMethod: paymentDetails ? paymentDetails.paymentMethod : 'Por Definir',
        voucherNumber: paymentDetails?.voucherNumber || null,
      };

      if (paymentDetails) {
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
            }
        }
      }

      transaction.set(orderRef, newOrder);
    });

    revalidatePath(`/rooms/${stayId}`);
    revalidatePath('/inventory');
    if (invoiceIdForReturn) revalidatePath('/billing/invoices');
    return { success: true, orderId: orderIdForReturn, invoiceId: invoiceIdForReturn };
  } catch (error: any) {
    console.error('Failed to create order:', error);
    return { error: error.message || 'Ocurrió un error inesperado al realizar el pedido.' };
  }
}

export async function updateOrderStatus(orderId: string, status: PrepStatus, area?: 'Kitchen' | 'Bar') {
    try {
        const orderRef = doc(db, 'orders', orderId);
        const updates: Record<string, any> = {};
        
        const snap = await getDoc(orderRef);
        if (!snap.exists()) return { error: 'El pedido no existe.' };
        const data = snap.data() as Order;

        if (data.status === 'Cancelado') return { error: 'No se puede actualizar un pedido cancelado.' };

        if (area === 'Kitchen') {
            updates.kitchenStatus = status;
        } else if (area === 'Bar') {
            updates.barStatus = status;
        } else {
            updates.status = status;
        }

        const newKitchen = area === 'Kitchen' ? status : (data.kitchenStatus || 'Entregado');
        const newBar = area === 'Bar' ? status : (data.barStatus || 'Entregado');
        
        if (newKitchen === 'Entregado' && newBar === 'Entregado') {
            updates.status = 'Entregado';
        } else if (newKitchen === 'En preparación' || newBar === 'En preparación') {
            updates.status = 'En preparación';
        }

        await updateDoc(orderRef, updates);
        revalidatePath('/kitchen');
        revalidatePath('/bar');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error al actualizar estado del pedido.' };
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
            const serviceRef = doc(db, 'products', item.serviceId);
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

        transaction.update(orderRef, { 
            status: 'Cancelado',
            kitchenStatus: 'Cancelado',
            barStatus: 'Cancelado'
        });
    });

    revalidatePath('/inventory');
    revalidatePath('/pos');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to cancel order:', error);
    return { error: error.message || 'Ocurrió un error inesperado al cancelar el pedido.' };
  }
}
