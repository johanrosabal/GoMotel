'use server';

import { collection, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';
import type { Room, Service } from '@/types';

const roomsToSeed: Omit<Room, 'id' | 'currentStayId'>[] = [
  { number: '101', status: 'Available', ratePerHour: 20 },
  { number: '102', status: 'Available', ratePerHour: 20 },
  { number: '103', status: 'Occupied', ratePerHour: 20 },
  { number: '104', status: 'Cleaning', ratePerHour: 20 },
  { number: '201', status: 'Available', ratePerHour: 25 },
  { number: '202', status: 'Maintenance', ratePerHour: 25 },
  { number: '203', status: 'Available', ratePerHour: 25 },
  { number: '204', status: 'Available', ratePerHour: 25 },
  { number: '301', status: 'Available', ratePerHour: 35 },
  { number: '302', status: 'Available', ratePerHour: 35 },
];

const servicesToSeed: Omit<Service, 'id'>[] = [
  { name: 'Botella de Agua', price: 2, stock: 100, category: 'Beverage' },
  { name: 'Coca-Cola', price: 3, stock: 80, category: 'Beverage' },
  { name: 'Jugo de Naranja', price: 4, stock: 50, category: 'Beverage' },
  { name: 'Club Sándwich', price: 12, stock: 20, category: 'Food' },
  { name: 'Ensalada César', price: 10, stock: 15, category: 'Food' },
  { name: 'Hamburguesa con Queso', price: 15, stock: 25, category: 'Food' },
  { name: 'Toalla Extra', price: 1, stock: 200, category: 'Amenity' },
  { name: 'Kit Dental', price: 2.5, stock: 150, category: 'Amenity' },
];

export async function seedDatabase() {
  try {
    const batch = writeBatch(db);

    // Seed Rooms
    const roomsCollection = collection(db, 'rooms');
    roomsToSeed.forEach(room => {
      const docRef = collection(roomsCollection).doc();
      if(room.status === 'Occupied') {
        // We will create a dummy stay for this room
        const stayRef = collection(db, 'stays').doc();
        batch.set(stayRef, {
            roomId: docRef.id,
            roomNumber: room.number,
            guestName: 'Juan Pérez',
            checkIn: new Date(),
            total: 0,
            isPaid: false
        });
        batch.set(docRef, {...room, currentStayId: stayRef.id});
      } else {
        batch.set(docRef, room);
      }
    });

    // Seed Services
    const servicesCollection = collection(db, 'services');
    servicesToSeed.forEach(service => {
      const docRef = collection(servicesCollection).doc();
      batch.set(docRef, service);
    });

    await batch.commit();

    revalidatePath('/');
    revalidatePath('/inventory');
    
    return { success: '¡Base de datos cargada exitosamente!' };
  } catch (error) {
    console.error('Error seeding database:', error);
    if (error instanceof Error) {
        return { error: error.message };
    }
    return { error: 'Ocurrió un error desconocido al cargar la base de datos.' };
  }
}
