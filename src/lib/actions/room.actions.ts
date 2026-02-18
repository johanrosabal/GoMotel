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
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '../firebase';
import type { Room, RoomStatus, Stay, Order, RoomType } from '@/types';
import { z } from 'zod';
import { formatDistance } from 'date-fns';
import { es, addMinutes, addHours, addDays, addWeeks, addMonths } from 'date-fns';

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

  // Create new stay
  const stayRef = doc(collection(db, 'stays'));
  const newStay: Omit<Stay, 'id'> = {
    roomId: room.id,
    roomNumber: room.number,
    guestName,
    checkIn: checkInTime,
    expectedCheckOut: Timestamp.fromDate(expectedCheckOut),
    total: 0,
    isPaid: false,
    guestId: guestId,
    pricePlanName: pricePlanName,
    pricePlanAmount: pricePlanAmount,
  };
  batch.set(stayRef, newStay);

  // Update room status
  const roomRef = doc(db, 'rooms', roomId);
  batch.update(roomRef, { status: 'Occupied', currentStayId: stayRef.id, statusUpdatedAt: Timestamp.now() });

  try {
    await batch.commit();
    revalidatePath('/');
    revalidatePath(`/rooms/${roomId}`);
    return { success: true, stayId: stayRef.id };
  } catch (error) {
    console.error('Check-in failed:', error);
    return { error: 'Ocurrió un error inesperado durante el check-in.' };
  }
}

export async function checkOut(stayId: string, roomId: string, options?: { reason?: string; notes?: string }) {
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
    // Fallback for old data: calculate based on duration
    const checkInTime = stay.checkIn.toDate();
    const checkOutTime = new Date();
    const durationMs = checkOutTime.getTime() - checkInTime.getTime();
    const durationHours = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60))); // Minimum 1 hour charge
    roomTotal = durationHours * room.ratePerHour;
  }


  // Calculate total from services
  const ordersCollection = collection(db, 'orders');
  const q = query(ordersCollection, where('stayId', '==', stayId));
  const ordersSnapshot = await getDocs(q);
  const servicesTotal = ordersSnapshot.docs.reduce((acc, doc) => {
    const order = doc.data() as Order;
    return acc + order.total;
  }, 0);

  const finalTotal = roomTotal + servicesTotal;

  const batch = writeBatch(db);

  // Update stay
  const stayRef = doc(db, 'stays', stayId);
  
  const stayUpdateData: Record<string, any> = {
    checkOut: Timestamp.now(),
    total: finalTotal,
    isPaid: true, // Assuming payment is collected at checkout
  };

  if (options?.reason) {
    stayUpdateData.checkOutReason = options.reason;
  }
  if (options?.notes) {
    stayUpdateData.checkOutNotes = options.notes;
  }
  
  batch.update(stayRef, stayUpdateData);

  // Update room
  const roomRef = doc(db, 'rooms', roomId);
  batch.update(roomRef, { status: 'Cleaning', currentStayId: null, statusUpdatedAt: Timestamp.now() });

  try {
    await batch.commit();
    revalidatePath('/');
    revalidatePath(`/rooms/${roomId}`);
    return { success: true };
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
});

export async function extendStay(stayId: string, newPlanName: string) {
  const validatedFields = extendStaySchema.safeParse({ stayId, newPlanName });
  if (!validatedFields.success) {
    return { error: 'Datos de extensión inválidos.' };
  }

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
  let newExpectedCheckOut = new Date(now);
  switch (newPlan.unit) {
    case 'Minutes': newExpectedCheckOut = addMinutes(now, newPlan.duration); break;
    case 'Hours': newExpectedCheckOut = addHours(now, newPlan.duration); break;
    case 'Days': newExpectedCheckOut = addDays(now, newPlan.duration); break;
    case 'Weeks': newExpectedCheckOut = addWeeks(now, newPlan.duration); break;
    case 'Months': newExpectedCheckOut = addMonths(now, newPlan.duration); break;
  }

  // Add the price of the new plan to the existing amount.
  const newPricePlanAmount = (stayData.pricePlanAmount || 0) + newPlan.price;
  const newPricePlanName = `${stayData.pricePlanName}, ${newPlan.name}`; // Append plan names

  try {
    await updateDoc(stayRef, {
      expectedCheckOut: Timestamp.fromDate(newExpectedCheckOut),
      pricePlanAmount: newPricePlanAmount,
      pricePlanName: newPricePlanName,
    });
    revalidatePath(`/rooms/${stayData.roomId}`);
    revalidatePath('/dashboard/rooms');
    return { success: true };
  } catch (error) {
    console.error('Error extending stay:', error);
    return { error: 'No se pudo extender la estancia.' };
  }
}
