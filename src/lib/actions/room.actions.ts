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
  limit,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '../firebase';
import type { Room, RoomStatus, Stay, Order } from '@/types';
import { z } from 'zod';

// Helper to convert Firestore doc to Room object
const toRoomObject = (doc: any): Room => {
  const data = doc.data();
  return {
    id: doc.id,
    number: data.number,
    status: data.status,
    ratePerHour: data.ratePerHour,
    currentStayId: data.currentStayId || null,
  };
};

export async function getRooms(): Promise<Room[]> {
  try {
    const roomsCollection = collection(db, 'rooms');
    const q = query(roomsCollection, orderBy('number'));
    const roomsSnapshot = await getDocs(q);
    const roomsList = roomsSnapshot.docs.map(toRoomObject);
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
  guestName: z.string().min(2, 'Guest name must be at least 2 characters.'),
});

export async function checkIn(roomId: string, formData: FormData) {
  const validatedFields = checkInSchema.safeParse({
    guestName: formData.get('guestName'),
  });

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { guestName } = validatedFields.data;

  const room = await getRoomById(roomId);
  if (!room || room.status !== 'Available') {
    return { error: 'Room is not available for check-in.' };
  }

  const batch = writeBatch(db);

  // Create new stay
  const stayRef = doc(collection(db, 'stays'));
  const newStay: Omit<Stay, 'id'> = {
    roomId: room.id,
    roomNumber: room.number,
    guestName,
    checkIn: Timestamp.now(),
    total: 0,
    isPaid: false,
  };
  batch.set(stayRef, newStay);

  // Update room status
  const roomRef = doc(db, 'rooms', roomId);
  batch.update(roomRef, { status: 'Occupied', currentStayId: stayRef.id });

  try {
    await batch.commit();
    revalidatePath('/');
    revalidatePath(`/rooms/${roomId}`);
    return { success: true, stayId: stayRef.id };
  } catch (error) {
    console.error('Check-in failed:', error);
    return { error: 'An unexpected error occurred during check-in.' };
  }
}

export async function checkOut(stayId: string, roomId: string) {
  if (!stayId || !roomId) {
    return { error: 'Invalid stay or room ID.' };
  }

  const stayDoc = await getDoc(doc(db, 'stays', stayId));
  const roomDoc = await getDoc(doc(db, 'rooms', roomId));

  if (!stayDoc.exists() || !roomDoc.exists()) {
    return { error: 'Stay or room not found.' };
  }

  const stay = { id: stayDoc.id, ...stayDoc.data() } as Stay;
  const room = { id: roomDoc.id, ...roomDoc.data() } as Room;
  const checkInTime = stay.checkIn.toDate();
  const checkOutTime = new Date();

  // Calculate stay duration in hours
  const durationMs = checkOutTime.getTime() - checkInTime.getTime();
  const durationHours = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60))); // Minimum 1 hour charge
  const roomTotal = durationHours * room.ratePerHour;

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
  batch.update(stayRef, {
    checkOut: Timestamp.fromDate(checkOutTime),
    total: finalTotal,
    isPaid: true, // Assuming payment is collected at checkout
  });

  // Update room
  const roomRef = doc(db, 'rooms', roomId);
  batch.update(roomRef, { status: 'Cleaning', currentStayId: null });

  try {
    await batch.commit();
    revalidatePath('/');
    revalidatePath(`/rooms/${roomId}`);
    return { success: true };
  } catch (error) {
    console.error('Check-out failed:', error);
    return { error: 'An unexpected error occurred during check-out.' };
  }
}

export async function updateRoomStatus(roomId: string, status: RoomStatus) {
  if (!roomId || !status) {
    return { error: 'Invalid room ID or status.' };
  }

  try {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, { status });
    revalidatePath('/');
    revalidatePath(`/rooms/${roomId}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update room status:', error);
    return { error: 'An unexpected error occurred.' };
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
