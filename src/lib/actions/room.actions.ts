'use server';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  writeBatch,
  query,
  orderBy,
  updateDoc,
  where,
  addDoc,
  limit,
  increment,
  DocumentReference,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '../firebase';
import type { Room, RoomStatus, Stay, Order, RoomType, StayExtension, Invoice, InvoiceItem, SinpeAccount } from '@/types';
import { z } from 'zod';
import { formatDistance, addMinutes, addHours, addDays, addWeeks, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

// Helper to convert Firestore doc to Room object
const toRoomObject = (doc: any): Room => {
  const data = doc.data();
  return {
    id: doc.id,
    number: data.number,
    status: data.status,
    ratePerHour: data.ratePerHour,
    type: data.type || 'Sencilla',
    capacity: data.capacity || 1,
    description: data.description || '',
    currentStayId: data.currentStayId || null,
    roomTypeId: data.roomTypeId || '',
    roomTypeName: data.roomTypeName || '',
    statusUpdatedAt: data.statusUpdatedAt || null,
  };
};

export async function getRooms(): Promise<Room[]> {
  try {
    const roomsCollection = collection(db, 'rooms');
    const q = query(roomsCollection);
    const roomsSnapshot = await getDocs(q);
    const roomsList = roomsSnapshot.docs.map(toRoomObject);
    roomsList.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    return roomsList;
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return [];
  }
}

export async function getRoomById(roomId: string): Promise<Room | null> {
  try {
    const roomDoc = await getDoc(doc(db, 'rooms', roomId));
    if (roomDoc.exists()) {
      return toRoomObject(roomDoc);
    }
    return null;
  } catch (error) {
    console.error('Error fetching room by ID:', error);
    return null;
  }
}

const checkInSchema = z.object({
  guestName: z.string().min(2, 'El nombre del huésped debe tener al menos 2 caracteres.'),
  guestId: z.string().optional(),
  pricePlanName: z.string(),
  pricePlanAmount: z.coerce.number(),
  expectedCheckOut: z.coerce.date(),
});

export async function checkIn(roomId: string, formData: FormData) {
  const rawData = Object.fromEntries(formData);
  const validatedFields = checkInSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { guestName, guestId, pricePlanName, pricePlanAmount, expectedCheckOut } = validatedFields.data;

  const room = await getRoomById(roomId);
  if (!room || room.status !== 'Available') {
    return { error: 'La habitación no está disponible para check-in.' };
  }

  const batch = writeBatch(db);

  const checkInTime = Timestamp.now();
  
  if (guestId) {
    const clientRef = doc(db, 'clients', guestId);
    const clientSnap = await getDoc(clientRef);
    if (clientSnap.exists()) {
      const currentCount = clientSnap.data().visitCount || 0;
      batch.update(clientRef, { visitCount: currentCount + 1 });
    }
  }


  // Create new stay
  const stayRef = doc(collection(db, 'stays'));
  const newStay: Omit<Stay, 'id'> = {
    roomId: room.id,
    roomNumber: room.number,
    guestName,
    checkIn: checkInTime,
    expectedCheckOut: Timestamp.fromDate(expectedCheckOut),
    checkOut: null,
    total: 0,
    isPaid: false,
    guestId: guestId || null,
    pricePlanName: pricePlanName,
    pricePlanAmount: pricePlanAmount,
    renewalCount: 0,
    extensionHistory: [],
  };
  batch.set(stayRef, newStay);

  // Update room status
  const roomRef = doc(db, 'rooms', roomId);
  batch.update(roomRef, { status: 'Occupied', currentStayId: stayRef.id, statusUpdatedAt: Timestamp.now() });

  try {
    await batch.commit();
    revalidatePath('/');
    revalidatePath(`/rooms/${roomId}`);
    revalidatePath('/clients');
    return { success: true, stayId: stayRef.id };
  } catch (error) {
    console.error('Check-in failed:', error);
    return { error: 'Ocurrió un error inesperado durante el check-in.' };
  }
}

export async function checkOut(
    stayId: string, 
    roomId: string, 
    paymentDetails?: {
        paymentMethod: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta';
        voucherNumber?: string;
        amountPaid: number;
    }
) {
  if (!stayId || !roomId) {
    return { error: 'ID de estancia o habitación no válido.' };
  }

  const stayDoc = await getDoc(doc(db, 'stays', stayId));
  const roomDoc = await getDoc(doc(db, 'rooms', roomId));

  if (!stayDoc.exists() || !roomDoc.exists()) {
    return { error: 'Estancia o habitación no encontrada.' };
  }

  const stay = { id: stayDoc.id, ...stayDoc.data() } as Stay;
  const room = { id: roomDoc.id, ...roomDoc.data() } as Room;
  
  let roomTotal: number;
  if (stay.pricePlanAmount != null) {
    roomTotal = stay.pricePlanAmount;
  } else {
    const checkInTime = stay.checkIn.toDate();
    const checkOutTime = new Date();
    const durationMs = checkOutTime.getTime() - checkInTime.getTime();
    const durationHours = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60)));
    roomTotal = durationHours * room.ratePerHour;
  }

  const ordersCollection = collection(db, 'orders');
  const q = query(ordersCollection, where('stayId', '==', stayId));
  const ordersSnapshot = await getDocs(q);
  const activeOrders = ordersSnapshot.docs.filter(d => d.data().status !== 'Cancelado');
  const servicesTotal = activeOrders.reduce((acc, doc) => {
      const data = doc.data() as Order;
      // Only sum orders that haven't been paid upfront
      return acc + (data.paymentStatus === 'Pagado' ? 0 : data.total);
  }, 0);

  const finalTotal = roomTotal + servicesTotal;
  const upfrontPaid = stay.paymentAmount || 0;
  const totalDueAtCheckout = finalTotal - upfrontPaid;

  const batch = writeBatch(db);
  let invoiceIdForReturn: string | undefined;
  
  // --- Invoice Logic ---
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
  const newInvoiceNumber = `FAC-${String(nextInvoiceNumberInt).padStart(5, '0')}`;
  
  const invoiceRef = doc(collection(db, 'invoices'));
  invoiceIdForReturn = invoiceRef.id;

  const invoiceItems: InvoiceItem[] = [];
  invoiceItems.push({
      description: `Estancia Hab. ${room.number} (${stay.pricePlanName || 'Tarifa base'})`,
      quantity: 1,
      unitPrice: roomTotal,
      total: roomTotal
  });

  if (servicesTotal > 0) {
      invoiceItems.push({
          description: `Servicios y Consumos Pendientes`,
          quantity: 1,
          unitPrice: servicesTotal,
          total: servicesTotal
      });
  }

  if (upfrontPaid > 0) {
      invoiceItems.push({
          description: `Pagos Adelantados Recibidos`,
          quantity: 1,
          unitPrice: -upfrontPaid,
          total: -upfrontPaid,
      });
  }

  const finalInvoice: Omit<Invoice, 'id'> = {
      invoiceNumber: newInvoiceNumber,
      stayId: stayId,
      clientId: stay.guestId || null,
      clientName: stay.guestName,
      createdAt: Timestamp.now(),
      status: 'Pagada',
      items: invoiceItems,
      subtotal: finalTotal,
      taxes: [], 
      total: Math.max(0, totalDueAtCheckout),
      paymentMethod: paymentDetails?.paymentMethod || 'Efectivo',
      voucherNumber: paymentDetails?.voucherNumber,
  };
  batch.set(invoiceRef, finalInvoice);

  // --- SINPE Balance Update ---
  if (paymentDetails?.paymentMethod === 'Sinpe Movil') {
      const sinpeAccountsQuery = query(collection(db, 'sinpeAccounts'), where('isActive', '==', true), orderBy('createdAt', 'asc'));
      const sinpeAccountsSnapshot = await getDocs(sinpeAccountsQuery);
      let targetAccountRef: DocumentReference | null = null;
      for (const doc of sinpeAccountsSnapshot.docs) {
          const account = doc.data() as SinpeAccount;
          if ((account.balance + totalDueAtCheckout) <= (account.limitAmount || Infinity)) {
              targetAccountRef = doc.ref;
              break;
          }
      }
      if (targetAccountRef) {
          batch.update(targetAccountRef, { balance: increment(totalDueAtCheckout) });
      }
  }

  // Update reservation status if exists
  if (stay.reservationId) {
    const reservationRef = doc(db, 'reservations', stay.reservationId);
    batch.update(reservationRef, { status: 'Completed' });
  }

  // Update stay
  const stayRef = doc(db, 'stays', stayId);
  batch.update(stayRef, {
    checkOut: Timestamp.now(),
    total: finalTotal,
    isPaid: true,
    paymentStatus: 'Pagado',
    paymentMethod: paymentDetails?.paymentMethod || stay.paymentMethod || 'Efectivo',
    paymentAmount: increment(totalDueAtCheckout > 0 ? totalDueAtCheckout : 0),
  });

  // Update room status
  const roomRef = doc(db, 'rooms', roomId);
  batch.update(roomRef, { status: 'Cleaning', currentStayId: null, statusUpdatedAt: Timestamp.now() });

  try {
    await batch.commit();
    revalidatePath('/');
    revalidatePath(`/rooms/${roomId}`);
    revalidatePath('/reservations');
    revalidatePath('/billing/invoices');
    revalidatePath('/dashboard/rooms');
    return { success: true, invoiceId: invoiceIdForReturn };
  } catch (error) {
    console.error('Check-out failed:', error);
    return { error: 'Ocurrió un error inesperado durante el check-out.' };
  }
}

export async function updateRoomStatus(roomId: string, status: RoomStatus) {
  if (!roomId || !status) {
    return { error: 'ID de habitación o estado no válido.' };
  }

  try {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, { status, statusUpdatedAt: Timestamp.now() });
    revalidatePath('/');
    revalidatePath(`/rooms/${roomId}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update room status:', error);
    return { error: 'Ocurrió un error inesperado.' };
  }
}


export async function getStayById(stayId: string): Promise<Stay | null> {
    if (!stayId) return null;
    try {
        const stayDoc = await getDoc(doc(db, 'stays', stayId));
        if (stayDoc.exists()) {
            return { id: stayDoc.id, ...stayDoc.data() } as Stay;
        }
        return null;
    } catch (error) {
        console.error('Error fetching stay by ID:', error);
        return null;
    }
}

const roomSchema = z.object({
  id: z.string().optional(),
  number: z.string().min(1, 'El número de habitación es requerido.'),
  ratePerHour: z.coerce.number().min(0, 'La tarifa no puede ser negativa.'),
  type: z.string({ required_error: 'El tipo de habitación es requerido.' }).min(1, 'El tipo de habitación es requerido.'),
  capacity: z.coerce.number().int().min(1, 'La capacidad debe ser al menos 1.'),
  description: z.string().max(200, 'La descripción no puede exceder los 200 caracteres.').optional(),
  roomTypeId: z.string({ required_error: 'El ID de tipo de habitación es requerido.' }),
  roomTypeName: z.string({ required_error: 'El nombre del tipo de habitación es requerido.' }),
});

export async function saveRoom(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const validatedFields = roomSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { id, ...roomData } = validatedFields.data;

  try {
    if (id) {
      // Update existing room
      const roomRef = doc(db, 'rooms', id);
      await updateDoc(roomRef, roomData);
    } else {
      // Add new room
      const q = query(collection(db, 'rooms'), where('number', '==', roomData.number));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
          return { error: 'El número de habitación ya existe.' };
      }
      await addDoc(collection(db, 'rooms'), { ...roomData, status: 'Available', statusUpdatedAt: Timestamp.now() });
    }
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to save room:', error);
    if (error instanceof Error) {
        return { error: error.message };
    }
    return { error: 'Ocurrió un error inesperado.' };
  }
}

const extendStaySchema = z.object({
  stayId: z.string(),
  newPlanName: z.string(),
  payNow: z.boolean(),
  paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']).optional(),
  paymentConfirmed: z.boolean().optional(),
  voucherNumber: z.string().optional(),
}).refine(data => {
    if (data.payNow) return !!data.paymentMethod;
    return true;
}, {
    message: "Debe seleccionar un método de pago.",
    path: ["paymentMethod"],
}).refine(data => {
    if (data.payNow && data.paymentMethod === 'Sinpe Movil') {
        return data.paymentConfirmed === true;
    }
    return true;
}, {
    message: 'Debe confirmar el pago SINPE.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (data.payNow && data.paymentMethod === 'Tarjeta' && data.voucherNumber) {
        return data.voucherNumber.trim() !== '';
    }
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});

export async function extendStay(values: z.infer<typeof extendStaySchema>) {
    const validatedFields = extendStaySchema.safeParse(values);
    if (!validatedFields.success) {
      console.error(validatedFields.error.flatten().fieldErrors);
      return { error: 'Datos de extensión inválidos.' };
    }
  
    const { stayId, newPlanName, payNow, paymentMethod, voucherNumber } = validatedFields.data;
  
    try {
      const batch = writeBatch(db);
      let invoiceIdForReturn: string | undefined;

      const stayRef = doc(db, 'stays', stayId);
      const staySnap = await getDoc(stayRef);
      if (!staySnap.exists()) {
        return { error: 'La estancia a extender no fue encontrada.' };
      }
      const stayData = staySnap.data() as Stay;
  
      const roomSnap = await getDoc(doc(db, 'rooms', stayData.roomId));
      if (!roomSnap.exists()) {
        return { error: 'La habitación de la estancia no fue encontrada.' };
      }
      const roomData = roomSnap.data() as Room;
  
      const roomTypeSnap = await getDoc(doc(db, 'roomTypes', roomData.roomTypeId));
      if (!roomTypeSnap.exists()) {
        return { error: 'El tipo de habitación no fue encontrado.' };
      }
      const roomTypeData = roomTypeSnap.data() as RoomType;
  
      const newPlan = roomTypeData.pricePlans?.find(p => p.name === newPlanName);
      if (!newPlan) {
        return { error: 'El nuevo plan de precios no es válido para este tipo de habitación.' };
      }
  
      const now = new Date();
      const currentCheckOut = stayData.expectedCheckOut.toDate();
      const baseDate = isOverdue && now > currentCheckOut ? now : currentCheckOut;
  
      let newExpectedCheckOut = new Date(baseDate);
      switch (newPlan.unit) {
        case 'Minutes': newExpectedCheckOut = addMinutes(baseDate, newPlan.duration); break;
        case 'Hours': newExpectedCheckOut = addHours(baseDate, newPlan.duration); break;
        case 'Days': newExpectedCheckOut = addDays(baseDate, newPlan.duration); break;
        case 'Weeks': newExpectedCheckOut = addWeeks(baseDate, newPlan.duration); break;
        case 'Months': newExpectedCheckOut = addMonths(baseDate, newPlan.duration); break;
      }
  
      const newExtension: StayExtension = {
          extendedAt: Timestamp.now(),
          oldExpectedCheckOut: stayData.expectedCheckOut,
          newExpectedCheckOut: Timestamp.fromDate(newExpectedCheckOut),
          planName: newPlan.name,
          planPrice: newPlan.price,
      };
  
      const updatedStayData: Record<string, any> = {
          expectedCheckOut: Timestamp.fromDate(newExpectedCheckOut),
          renewalCount: increment(1),
          extensionHistory: [...(stayData.extensionHistory || []), newExtension],
      };
  
      if (payNow) {
          const invoicesRef = collection(db, 'invoices');
          const lastInvoiceQuery = query(invoicesRef, orderBy('createdAt', 'desc'), limit(1));
          const lastInvoiceSnap = await getDocs(lastInvoiceQuery);
          let nextInvoiceNumberInt = 1;
          if (!lastInvoiceSnap.empty) {
              const lastInvoiceData = lastInvoiceSnap.docs[0].data() as Partial<Invoice>;
              if (lastInvoiceData.invoiceNumber) {
                  const lastNumber = parseInt(lastInvoiceData.invoiceNumber.split('-')[1], 10);
                  if (!isNaN(lastNumber)) {
                      nextInvoiceNumberInt = lastNumber + 1;
                  }
              }
          }
          const newInvoiceNumber = `FAC-${String(nextInvoiceNumberInt).padStart(5, '0')}`;
          
          const invoiceRef = doc(collection(db, 'invoices'));
          invoiceIdForReturn = invoiceRef.id;

          const invoiceItems = [{
              description: `Extensión de Estancia: ${newPlan.name} para Hab. ${roomData.number}`,
              quantity: 1,
              unitPrice: newPlan.price,
              total: newPlan.price
          }];
  
          const newInvoice: Omit<Invoice, 'id'> = {
              invoiceNumber: newInvoiceNumber,
              stayId: stayId,
              clientId: stayData.guestId || null,
              clientName: stayData.guestName,
              createdAt: Timestamp.now(),
              status: 'Pagada',
              items: invoiceItems,
              subtotal: newPlan.price,
              taxes: [],
              total: newPlan.price,
              paymentMethod: paymentMethod!,
              voucherNumber: voucherNumber ?? undefined,
          };
          batch.set(invoiceRef, newInvoice);
  
          if (paymentMethod === 'Sinpe Movil') {
              const sinpeAccountsQuery = query(collection(db, 'sinpeAccounts'), where('isActive', '==', true), orderBy('createdAt', 'asc'));
              const sinpeAccountsSnapshot = await getDocs(sinpeAccountsQuery);
              let targetAccountRef: DocumentReference | null = null;
              let targetAccountData: SinpeAccount | null = null;
              for (const doc of sinpeAccountsSnapshot.docs) {
                  const account = { id: doc.id, ...doc.data() } as SinpeAccount;
                  const limit = account.limitAmount || Infinity;
                  if ((account.balance + newPlan.price) <= limit) {
                      targetAccountRef = doc.ref;
                      targetAccountData = account;
                      break;
                  }
              }
              if (!targetAccountRef || !targetAccountData) {
                  throw new Error("No hay cuentas SINPE Móvil disponibles o todas han alcanzado su límite de saldo.");
              }
              batch.update(targetAccountRef, { balance: increment(newPlan.price) });
              const newBalance = targetAccountData.balance + newPlan.price;
              if (targetAccountData.limitAmount && newBalance >= targetAccountData.limitAmount) {
                  batch.update(targetAccountRef, { isActive: false });
              }
          }
          
          updatedStayData.paymentAmount = increment(newPlan.price);
          // If the stay was pending, and now it's paid, it's fully paid
          if (stayData.paymentStatus === 'Pendiente') {
            updatedStayData.paymentStatus = 'Pagado';
          }
      } else {
        // If not paying now, ensure status is 'Pendiente'
        updatedStayData.paymentStatus = 'Pendiente';
      }
      
      batch.update(stayRef, updatedStayData);
      
      if (stayData.reservationId) {
          const reservationRef = doc(db, 'reservations', stayData.reservationId);
          batch.update(reservationRef, {
              checkOutDate: Timestamp.fromDate(newExpectedCheckOut)
          });
      }
  
      await batch.commit();
  
      revalidatePath(`/rooms/${stayData.roomId}`);
      revalidatePath('/dashboard/rooms');
      revalidatePath('/reservations');
      revalidatePath('/settings/sinpe-accounts');
      revalidatePath('/billing/invoices');
  
      return { success: true, invoiceId: invoiceIdForReturn };
    } catch (error: any) {
      console.error('Error extending stay:', error);
      return { error: error.message || 'No se pudo extender la estancia.' };
    }
}
