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
import type { Reservation, Stay } from '@/types';

const reservationSchema = z.object({
  guestName: z.string().min(3),
  roomId: z.string(),
  roomNumber: z.string(),
  roomType: z.string(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
});

export async function createReservation(formData: FormData) {
  const rawData = Object.fromEntries(formData.entries());
  const validatedFields = reservationSchema.safeParse(rawData);

  if (!validatedFields.success) {
    console.error(validatedFields.error.flatten().fieldErrors);
    return { error: 'Datos inválidos. Por favor, revise todos los campos.' };
  }

  const { roomId, checkInDate, checkOutDate, ...rest } = validatedFields.data;

  // Check for booking conflicts
  const reservationsRef = collection(db, 'reservations');
  const q = query(
    reservationsRef, 
    where('roomId', '==', roomId),
    where('status', 'in', ['Confirmed', 'Checked-in'])
  );
  
  const querySnapshot = await getDocs(q);
  const existingReservations = querySnapshot.docs.map(doc => doc.data() as Reservation);

  const hasConflict = existingReservations.some(res => {
    const oldStart = res.checkInDate.toDate();
    const oldEnd = res.checkOutDate.toDate();
    // new_start < old_end AND new_end > old_start
    return checkInDate < oldEnd && checkOutDate > oldStart;
  });

  if (hasConflict) {
    return { error: 'La habitación ya está reservada para las fechas seleccionadas.' };
  }

  try {
    await addDoc(reservationsRef, {
      ...rest,
      roomId,
      checkInDate: Timestamp.fromDate(checkInDate),
      checkOutDate: Timestamp.fromDate(checkOutDate),
      status: 'Confirmed',
      createdAt: Timestamp.now(),
    });
    revalidatePath('/reservations');
    return { success: true };
  } catch (error) {
    console.error("Error creating reservation: ", error);
    return { error: 'No se pudo crear la reservación.' };
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
