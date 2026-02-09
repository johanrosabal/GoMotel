'use server';

import { collection, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';
import type { Room, Service, RoomStatus, RoomType } from '@/types';

const roomsToSeed: Omit<Room, 'id' | 'currentStayId' | 'status'>[] = [
  { number: '101', ratePerHour: 20, type: 'Sencilla', capacity: 1, description: 'Habitación acogedora con cama individual, perfecta para viajeros solos.' },
  { number: '102', ratePerHour: 22, type: 'Sencilla', capacity: 2, description: 'Habitación estándar con dos camas individuales.' },
  { number: '103', ratePerHour: 25, type: 'Doble', capacity: 2, description: 'Habitación espaciosa con una cómoda cama doble.' },
  { number: '104', ratePerHour: 25, type: 'Doble', capacity: 2, description: 'Habitación espaciosa con cama doble y vista a la ciudad.' },
  { number: '201', ratePerHour: 35, type: 'Suite', capacity: 2, description: 'Suite de lujo con cama king size, jacuzzi privado y minibar.' },
  { number: '202', ratePerHour: 35, type: 'Suite', capacity: 3, description: 'Suite familiar con área de estar separada y sofá cama.' },
  { number: '203', ratePerHour: 22, type: 'Sencilla', capacity: 2, description: 'Habitación estándar con dos camas individuales y escritorio.' },
  { number: '204', ratePerHour: 25, type: 'Doble', capacity: 2, description: 'Habitación espaciosa con cama doble y balcón privado.' },
  { number: '301', ratePerHour: 40, type: 'Suite', capacity: 4, description: 'Amplia suite en el último piso con vistas panorámicas de la ciudad.' },
  { number: '302', ratePerHour: 40, type: 'Suite', capacity: 4, description: 'Nuestra Suite Presidencial, con dos dormitorios y todas las comodidades.' },
];

const initialStatuses: Record<string, RoomStatus> = {
    '103': 'Occupied',
    '104': 'Cleaning',
    '202': 'Maintenance',
}

const roomTypesToSeed: Omit<RoomType, 'id'>[] = [
    { name: 'Sencilla', features: ['Wi-Fi', 'TV', 'Baño Privado'] },
    { name: 'Doble', features: ['Wi-Fi', 'TV de Pantalla Plana', 'Escritorio'] },
    { name: 'Suite', features: ['Cama King Size', 'Jacuzzi', 'Minibar', 'Wi-Fi de Alta Velocidad'] },
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

    // Seed Room Types
    const roomTypesCollection = collection(db, 'roomTypes');
    roomTypesToSeed.forEach(roomType => {
        const docRef = doc(roomTypesCollection);
        batch.set(docRef, roomType);
    });

    // Seed Rooms
    const roomsCollection = collection(db, 'rooms');
    roomsToSeed.forEach(room => {
      const docRef = doc(roomsCollection);
      const status = initialStatuses[room.number] || 'Available';
      
      const roomData = { ...room, status };

      if(status === 'Occupied') {
        // We will create a dummy stay for this room
        const stayRef = doc(collection(db, 'stays'));
        batch.set(stayRef, {
            roomId: docRef.id,
            roomNumber: room.number,
            guestName: 'Juan Pérez',
            checkIn: Timestamp.now(),
            total: 0,
            isPaid: false
        });
        batch.set(docRef, {...roomData, currentStayId: stayRef.id});
      } else {
        batch.set(docRef, roomData);
      }
    });

    // Seed Services
    const servicesCollection = collection(db, 'services');
    servicesToSeed.forEach(service => {
      const docRef = doc(servicesCollection);
      batch.set(docRef, service);
    });

    await batch.commit();

    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/settings/room-types');
    
    return { success: '¡Base de datos cargada exitosamente!' };
  } catch (error) {
    console.error('Error seeding database:', error);
    if (error instanceof Error) {
        return { error: error.message };
    }
    return { error: 'Ocurrió un error desconocido al cargar la base de datos.' };
  }
}
