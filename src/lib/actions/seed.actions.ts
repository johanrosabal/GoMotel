'use server';

import { collection, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';
import type { Room, Service, RoomStatus, RoomType } from '@/types';

const roomsToSeed: Omit<Room, 'id' | 'currentStayId' | 'status' | 'ratePerHour' | 'description' | 'roomTypeId' | 'roomTypeName' | 'capacity'>[] = [
  { number: '101', type: 'Sencilla' },
  { number: '102', type: 'Sencilla' },
  { number: '103', type: 'Doble' },
  { number: '104', type: 'Doble' },
  { number: '201', type: 'Suite' },
  { number: '202', type: 'Suite' },
  { number: '203', type: 'Sencilla' },
  { number: '204', type: 'Doble' },
  { number: '301', type: 'Suite' },
  { number: '302', type: 'Suite' },
];

const initialStatuses: Record<string, RoomStatus> = {
    '103': 'Occupied',
    '104': 'Cleaning',
    '202': 'Maintenance',
}

const roomTypesToSeed: Omit<RoomType, 'id'>[] = [
    { 
        name: 'Sencilla', 
        code: '01', 
        capacity: 2,
        features: ['Wi-Fi', 'TV', 'Baño Privado'], 
        pricePlans: [
            {name: 'Tarifa por Hora', duration: 1, unit: 'Hours', price: 20}, 
            {name: 'Estadía Corta', duration: 3, unit: 'Hours', price: 55}, 
            { name: 'Día Completo', duration: 1, unit: 'Days', price: 100 }
        ] 
    },
    { 
        name: 'Doble', 
        code: '02',
        capacity: 2,
        features: ['Wi-Fi', 'TV de Pantalla Plana', 'Escritorio'], 
        pricePlans: [
            {name: 'Tarifa por Hora', duration: 1, unit: 'Hours', price: 25}, 
            {name: 'Día Completo', duration: 1, unit: 'Days', price: 150},
            {name: 'Semana', duration: 1, unit: 'Weeks', price: 800},
        ] 
    },
    { 
        name: 'Suite', 
        code: '03', 
        capacity: 4,
        features: ['Cama King Size', 'Jacuzzi', 'Minibar', 'Wi-Fi de Alta Velocidad'], 
        pricePlans: [
            {name: 'Tarifa por Hora', duration: 1, unit: 'Hours', price: 40}, 
            {name: 'Noche de Lujo', duration: 10, unit: 'Hours', price: 350},
            {name: 'Fin de Semana (2 Días)', duration: 2, unit: 'Days', price: 600}
        ] 
    },
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
    const seededRoomTypeRefs = roomTypesToSeed.map(roomType => {
        const docRef = doc(roomTypesCollection);
        batch.set(docRef, roomType);
        return { ...roomType, id: docRef.id };
    });

    // Seed Rooms
    const roomsCollection = collection(db, 'rooms');
    roomsToSeed.forEach(room => {
      const docRef = doc(roomsCollection);
      const status = initialStatuses[room.number] || 'Available';
      
      const roomType = seededRoomTypeRefs.find(rt => rt.name === room.type);
      if (!roomType) {
          console.warn(`RoomType '${room.type}' not found for room ${room.number}`);
          return;
      }

      const hourlyPlan = roomType.pricePlans.find(p => p.unit === 'Hours' && p.duration === 1) || roomType.pricePlans[0];

      const roomData = { 
          number: room.number,
          capacity: roomType.capacity,
          type: room.type,
          status,
          roomTypeId: roomType.id,
          roomTypeName: roomType.name,
          ratePerHour: hourlyPlan?.price || 0,
          description: roomType.features?.join(', ') || '',
          statusUpdatedAt: Timestamp.now(),
      };

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
