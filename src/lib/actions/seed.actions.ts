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
  { name: 'Water Bottle', price: 2, stock: 100, category: 'Beverage' },
  { name: 'Coca-Cola', price: 3, stock: 80, category: 'Beverage' },
  { name: 'Orange Juice', price: 4, stock: 50, category: 'Beverage' },
  { name: 'Club Sandwich', price: 12, stock: 20, category: 'Food' },
  { name: 'Caesar Salad', price: 10, stock: 15, category: 'Food' },
  { name: 'Cheeseburger', price: 15, stock: 25, category: 'Food' },
  { name: 'Extra Towel', price: 1, stock: 200, category: 'Amenity' },
  { name: 'Dental Kit', price: 2.5, stock: 150, category: 'Amenity' },
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
            guestName: 'John Doe',
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
    
    return { success: 'Database seeded successfully!' };
  } catch (error) {
    console.error('Error seeding database:', error);
    if (error instanceof Error) {
        return { error: error.message };
    }
    return { error: 'An unknown error occurred while seeding the database.' };
  }
}
