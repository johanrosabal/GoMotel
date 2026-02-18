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
  updateDoc
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '../firebase';
import type { Reservation, Stay, RoomType } from '@/types';
import { checkOut } from './room.actions';

const reservationActionSchema = z.object({
  guestName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  roomId: z.string({ required_error: 'Debe seleccionar una habitación.' }),
  pricePlanName: z.string({ required_error: 'Debe seleccionar un plan de estancia.' }),
  checkOutDate: z.coerce.date(),
  guestId: z.string().optional(),
  checkInNow: z.boolean(),
  checkInDate: z.coerce.date().optional(),
}).refine(data => data.checkInNow || data.checkInDate, {
  message: 'La fecha de check-in es requerida para futuras reservaciones.',
  path: ['checkInDate'],
});


export async function createReservation(values: z.infer<typeof reservationActionSchema>) {
  const validatedFields = reservationActionSchema.safeParse(values);

  if (!validatedFields.success) {
    console.error(validatedFields.error.flatten().fieldErrors);
    return { error: 'Datos inválidos. Por favor, revise todos los campos.' };
  }

  const { roomId, checkInDate, checkOutDate, guestId, guestName, checkInNow, pricePlanName } = validatedFields.data;
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
    };
    batch.set(reservationRef, reservationPayload);

    if (checkInNow) {
        const stayRef = doc(collection(db, 'stays'));
        const newStay: Omit<Stay, 'id'> = {
          roomId: roomId,
          roomNumber: roomData.number,
          guestName: guestName,
          checkIn: Timestamp.fromDate(finalCheckInDate),
          expectedCheckOut: Timestamp.fromDate(checkOutDate),
          total: 0,
          isPaid: false,
          reservationId: reservationRef.id,
          guestId: guestId,
          pricePlanName: pricePlanName,
          pricePlanAmount: pricePlanAmount,
        };
        batch.set(stayRef, newStay);
        
        batch.update(roomRef, { status: 'Occupied', currentStayId: stayRef.id });
    }
    
    await batch.commit();

    revalidatePath('/reservations');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/rooms');
    revalidatePath(`/rooms/${roomId}`);

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
      total: 0,
      isPaid: false,
      reservationId: reservation.id,
      guestId: reservation.guestId,
      pricePlanName: reservation.pricePlanName,
      pricePlanAmount: reservation.pricePlanAmount,
    };
    batch.set(stayRef, newStay);
    
    // Update room
    batch.update(roomRef, { status: 'Occupied', currentStayId: stayRef.id });

    // Update reservation
    batch.update(reservationRef, { status: 'Checked-in' });

    try {
        await batch.commit();
        revalidatePath('/reservations');
        revalidatePath(`/rooms/${reservation.roomId}`);
        revalidatePath('/dashboard/rooms');
        return { success: true };
    } catch (error) {
        console.error("Check-in from reservation failed: ", error);
        return { error: 'Ocurrió un error inesperado.' };
    }
}

export async function checkOutEarlyFromReservation(reservationId: string) {
    if (!reservationId) {
        return { error: 'ID de reservación no válido.' };
    }

    try {
        // Find the active stay associated with this reservation
        const staysRef = collection(db, 'stays');
        const q = query(staysRef, where('reservationId', '==', reservationId), where('checkOut', '==', null));
        const staySnapshot = await getDocs(q);

        if (staySnapshot.empty) {
            return { error: 'No se encontró una estancia activa para esta reservación.' };
        }

        const stayDoc = staySnapshot.docs[0];
        const stayId = stayDoc.id;
        const roomId = stayDoc.data().roomId;

        // Use the existing checkOut logic
        const result = await checkOut(stayId, roomId);

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
