'use server';

import {
  collection,
  doc,
  writeBatch,
  Timestamp,
  getDocs,
  query,
  where,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
  orderBy,
  DocumentReference,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '../firebase';
import type { Reservation, Stay, RoomType, Invoice, SinpeAccount } from '@/types';
import { checkOut } from './room.actions';

const reservationActionSchema = z.object({
  guestName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  roomId: z.string({ required_error: 'Debe seleccionar una habitación.' }),
  pricePlanName: z.string({ required_error: 'Debe seleccionar un plan de estancia.' }),
  checkOutDate: z.coerce.date(),
  guestId: z.string().optional(),
  checkInNow: z.boolean(),
  checkInDate: z.coerce.date().optional(),
  isOpenAccount: z.boolean(),
  paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']).optional(),
  paymentConfirmed: z.boolean().optional(),
}).refine(data => data.checkInNow || data.checkInDate, {
  message: 'La fecha de check-in es requerida para futuras reservaciones.',
  path: ['checkInDate'],
}).refine(data => data.isOpenAccount || !!data.paymentMethod, {
    message: "Se requiere un método de pago si no es cuenta abierta.",
    path: ["paymentMethod"],
}).refine(data => {
    if (!data.isOpenAccount && data.paymentMethod === 'Sinpe Movil') {
        return data.paymentConfirmed === true;
    }
    return true;
}, {
    message: "El pago SINPE debe ser confirmado.",
    path: ["paymentConfirmed"],
});


export async function createReservation(values: z.infer<typeof reservationActionSchema>) {
  const validatedFields = reservationActionSchema.safeParse(values);

  if (!validatedFields.success) {
    console.error(validatedFields.error.flatten().fieldErrors);
    return { error: 'Datos inválidos. Por favor, revise todos los campos.' };
  }

  const { roomId, checkInDate, checkOutDate, guestId, guestName, checkInNow, pricePlanName, isOpenAccount, paymentMethod: upfrontPaymentMethod } = validatedFields.data;
  const finalCheckInDate = checkInNow ? new Date() : checkInDate!;

  const roomRef = doc(db, 'rooms', roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    return { error: 'La habitación seleccionada no existe.' };
  }
  const roomData = roomSnap.data();
  
  const roomTypeRef = doc(db, 'roomTypes', roomData.roomTypeId);
  const roomTypeSnap = await getDoc(roomTypeRef);
  if (!roomTypeSnap.exists()) {
    return { error: "Tipo de habitación no encontrado." };
  }
  const roomTypeData = roomTypeSnap.data() as RoomType;

  const plan = roomTypeData.pricePlans?.find(p => p.name === pricePlanName);
  if (!plan) {
      return { error: 'Plan de precios no encontrado para este tipo de habitación.' };
  }
  const pricePlanAmount = plan.price;

  // --- Conflict & Availability Check ---
  const reservationsRef = collection(db, 'reservations');
  const conflictQuery = query(
    reservationsRef, 
    where('roomId', '==', roomId),
    where('status', 'in', ['Confirmed', 'Checked-in'])
  );
  
  const querySnapshot = await getDocs(conflictQuery);
  const existingReservations = querySnapshot.docs.map(doc => doc.data() as Reservation);

  const hasConflict = existingReservations.some(res => {
    const oldStart = res.checkInDate.toDate();
    const oldEnd = res.checkOutDate.toDate();
    return finalCheckInDate < oldEnd && checkOutDate > oldStart;
  });

  if (hasConflict) {
    return { error: 'La habitación ya está reservada para las fechas seleccionadas.' };
  }
  
  if (checkInNow && roomData.status !== 'Available') {
      return { error: `La habitación no está disponible para check-in inmediato. Estado actual: ${roomData.status}.` };
  }

  // --- Database Operations ---
  try {
    const batch = writeBatch(db);

    const isUpfrontPayment = !isOpenAccount;
    const paymentStatus = isUpfrontPayment ? 'Pagado' : 'Pendiente';
    const paymentMethod = isUpfrontPayment ? upfrontPaymentMethod! : 'Por Definir';
    const paymentAmount = isUpfrontPayment ? pricePlanAmount : 0;

    const reservationRef = doc(collection(db, 'reservations'));
    const reservationPayload: Omit<Reservation, 'id'> = {
      guestName,
      guestId: guestId ?? undefined,
      roomId,
      roomNumber: roomData.number,
      roomType: roomData.roomTypeName,
      checkInDate: Timestamp.fromDate(finalCheckInDate),
      checkOutDate: Timestamp.fromDate(checkOutDate),
      createdAt: Timestamp.now(),
      status: checkInNow ? 'Checked-in' : 'Confirmed',
      pricePlanName,
      pricePlanAmount,
      paymentStatus,
      paymentMethod,
      paymentAmount,
    };
    batch.set(reservationRef, reservationPayload);

    if (isUpfrontPayment) {
        if (paymentMethod === 'Sinpe Movil') {
            const sinpeAccountsQuery = query(collection(db, 'sinpeAccounts'), where('isActive', '==', true), orderBy('createdAt', 'asc'));
            const sinpeAccountsSnapshot = await getDocs(sinpeAccountsQuery);

            let targetAccountRef: DocumentReference | null = null;
            let targetAccountData: SinpeAccount | null = null;

            for (const doc of sinpeAccountsSnapshot.docs) {
                const account = { id: doc.id, ...doc.data() } as SinpeAccount;
                const limit = account.limitAmount || Infinity;
                if ((account.balance + paymentAmount) <= limit) {
                    targetAccountRef = doc.ref;
                    targetAccountData = account;
                    break; // Use the first available account
                }
            }
            
            if (!targetAccountRef || !targetAccountData) {
                return { error: "No hay cuentas SINPE Móvil disponibles o todas han alcanzado su límite de saldo." };
            }

            // Increment the balance
            batch.update(targetAccountRef, { balance: increment(paymentAmount) });
            
            // Deactivate if the new balance meets or exceeds the limit
            const newBalance = targetAccountData.balance + paymentAmount;
            if (targetAccountData.limitAmount && newBalance >= targetAccountData.limitAmount) {
                batch.update(targetAccountRef, { isActive: false });
            }
        }
        
        const invoiceRef = doc(collection(db, 'invoices'));
        const invoiceItems = [{
            description: `Reservación: ${plan.name} para Hab. ${roomData.number}`,
            quantity: 1,
            unitPrice: pricePlanAmount,
            total: pricePlanAmount
        }];

        const newInvoice: Omit<Invoice, 'id'> = {
            reservationId: reservationRef.id,
            clientId: guestId,
            clientName: guestName,
            createdAt: Timestamp.now(),
            status: 'Pagada',
            items: invoiceItems,
            subtotal: pricePlanAmount,
            taxes: [], // Taxes logic can be added later
            total: pricePlanAmount,
            paymentMethod: paymentMethod,
        };
        batch.set(invoiceRef, newInvoice);
    }

    if (checkInNow) {
        const stayRef = doc(collection(db, 'stays'));
        const newStay: Omit<Stay, 'id'> = {
          roomId: roomId,
          roomNumber: roomData.number,
          guestName: guestName,
          checkIn: Timestamp.fromDate(finalCheckInDate),
          expectedCheckOut: Timestamp.fromDate(checkOutDate),
          checkOut: null,
          total: 0,
          isPaid: paymentStatus === 'Pagado',
          reservationId: reservationRef.id,
          guestId: guestId,
          pricePlanName: pricePlanName,
          pricePlanAmount: pricePlanAmount,
          renewalCount: 0,
          paymentStatus,
          paymentMethod,
          paymentAmount,
        };
        batch.set(stayRef, newStay);
        
        batch.update(roomRef, { status: 'Occupied', currentStayId: stayRef.id });

        if (guestId) {
            const clientRef = doc(db, 'clients', guestId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                const currentCount = clientSnap.data().visitCount || 0;
                batch.update(clientRef, { visitCount: increment(1) });
            }
        }
    }
    
    await batch.commit();

    revalidatePath('/reservations');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/rooms');
    revalidatePath(`/rooms/${roomId}`);
    if (guestId) revalidatePath('/clients');
    if (paymentMethod === 'Sinpe Movil') revalidatePath('/settings/sinpe-accounts');


    return { success: true };
  } catch (error) {
    console.error("Error creating reservation/check-in: ", error);
    return { error: 'No se pudo procesar la solicitud.' };
  }
}

export async function cancelReservation(reservationId: string) {
    if (!reservationId) return { error: 'ID de reservación no válido.' };

    try {
        const reservationRef = doc(db, 'reservations', reservationId);
        await updateDoc(reservationRef, { status: 'Cancelled' });
        revalidatePath('/reservations');
        return { success: true };
    } catch (error) {
        console.error("Error cancelling reservation: ", error);
        return { error: 'No se pudo cancelar la reservación.' };
    }
}

export async function checkInFromReservation(reservationId: string) {
    if (!reservationId) return { error: 'ID de reservación no válido.' };
    
    const reservationRef = doc(db, 'reservations', reservationId);
    const reservationSnap = await getDoc(reservationRef);

    if (!reservationSnap.exists()) {
        return { error: 'Reservación no encontrada.' };
    }

    const reservation = reservationSnap.data() as Reservation;
    const guestId = reservation.guestId;


    if (reservation.status !== 'Confirmed') {
        return { error: `La reservación tiene estado '${reservation.status}' y no puede ser utilizada para check-in.` };
    }
    
    const roomRef = doc(db, 'rooms', reservation.roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists() || roomSnap.data().status !== 'Available') {
        return { error: 'La habitación no está disponible para check-in.' };
    }

    const batch = writeBatch(db);

    // Create new stay from reservation
    const stayRef = doc(collection(db, 'stays'));
    const newStay: Omit<Stay, 'id'> = {
      roomId: reservation.roomId,
      roomNumber: reservation.roomNumber,
      guestName: reservation.guestName,
      checkIn: Timestamp.now(), // Actual check-in time
      expectedCheckOut: reservation.checkOutDate,
      checkOut: null,
      total: 0,
      isPaid: reservation.paymentStatus === 'Pagado',
      reservationId: reservationId,
      guestId: reservation.guestId,
      pricePlanName: reservation.pricePlanName,
      pricePlanAmount: reservation.pricePlanAmount,
      renewalCount: 0,
      paymentStatus: reservation.paymentStatus,
      paymentMethod: reservation.paymentMethod,
      paymentAmount: reservation.paymentAmount,
    };
    batch.set(stayRef, newStay);
    
    // Update room
    batch.update(roomRef, { status: 'Occupied', currentStayId: stayRef.id });

    // Update reservation
    batch.update(reservationRef, { status: 'Checked-in' });

    if (guestId) {
        const clientRef = doc(db, 'clients', guestId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
            const currentCount = clientSnap.data().visitCount || 0;
            batch.update(clientRef, { visitCount: increment(1) });
        }
    }

    try {
        await batch.commit();
        revalidatePath('/reservations');
        revalidatePath(`/rooms/${reservation.roomId}`);
        revalidatePath('/dashboard/rooms');
        if (guestId) revalidatePath('/clients');
        return { success: true };
    } catch (error) {
        console.error("Check-in from reservation failed: ", error);
        return { error: 'Ocurrió un error inesperado.' };
    }
}

export async function checkOutEarlyFromReservation(reservationId: string, reason: string, notes?: string) {
    if (!reservationId) {
        return { error: 'ID de reservación no válido.' };
    }
    if (!reason) {
        return { error: 'Se requiere un motivo para el check-out anticipado.' };
    }

    try {
        const reservationRef = doc(db, 'reservations', reservationId);
        const reservationSnap = await getDoc(reservationRef);
        if (!reservationSnap.exists()) {
            return { error: 'Reservación no encontrada.' };
        }
        const reservation = reservationSnap.data() as Reservation;

        const roomRef = doc(db, 'rooms', reservation.roomId);
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists() || !roomSnap.data().currentStayId) {
            return { error: 'La habitación asociada no tiene una estancia activa.' };
        }

        const stayId = roomSnap.data().currentStayId;
        const roomId = reservation.roomId;

        // Use the existing checkOut logic
        const result = await checkOut(stayId, roomId, { reason, notes });

        if (result.error) {
            return { error: result.error };
        }
        
        revalidatePath('/reservations');
        return { success: true };

    } catch (error) {
        console.error("Early check-out from reservation failed: ", error);
        return { error: 'Ocurrió un error inesperado durante el check-out anticipado.' };
    }
}

export async function markAsNoShow(reservationId: string) {
    if (!reservationId) return { error: 'ID de reservación no válido.' };

    try {
        const reservationRef = doc(db, 'reservations', reservationId);
        const reservationSnap = await getDoc(reservationRef);

        if (!reservationSnap.exists()) {
            return { error: 'Reservación no encontrada.' };
        }

        const reservation = reservationSnap.data() as Reservation;

        if (reservation.status !== 'Confirmed') {
            return { error: `Solo se puede anular una reservación con estado 'Confirmada'.` };
        }

        await updateDoc(reservationRef, { status: 'No-show' });
        revalidatePath('/reservations');
        return { success: true };
    } catch (error) {
        console.error("Error marking reservation as no-show: ", error);
        return { error: 'No se pudo anular la reservación.' };
    }
}

export async function deleteReservation(reservationId: string) {
    if (!reservationId) {
        return { error: 'ID de reservación no válido.' };
    }

    try {
        const reservationRef = doc(db, 'reservations', reservationId);
        const reservationSnap = await getDoc(reservationRef);

        if (!reservationSnap.exists()) {
            return { error: 'Reservación no encontrada.' };
        }
        
        const reservation = reservationSnap.data() as Reservation;

        if (reservation.status === 'Checked-in') {
            return { error: 'No se puede eliminar una reservación con check-in realizado. Realice el check-out primero.' };
        }

        await deleteDoc(reservationRef);

        revalidatePath('/reservations');
        return { success: true };
    } catch (error) {
        console.error("Error deleting reservation: ", error);
        return { error: 'No se pudo eliminar la reservación.' };
    }
}

    