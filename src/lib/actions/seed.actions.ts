'use server';

import { collection, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';
import type { Room, Service, RoomStatus, RoomType } from '@/types';
import { addHours } from 'date-fns';

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
  { name: 'Botella de Agua', price: 2, stock: 100, category: 'Beverage', source: 'Purchased' },
  { name: 'Coca-Cola', price: 3, stock: 80, category: 'Beverage', source: 'Purchased' },
  { name: 'Jugo de Naranja', price: 4, stock: 50, category: 'Beverage', source: 'Purchased' },
  { name: 'Club Sándwich', price: 12, stock: 0, category: 'Food', source: 'Internal' },
  { name: 'Ensalada César', price: 10, stock: 0, category: 'Food', source: 'Internal' },
  { name: 'Hamburguesa con Queso', price: 15, stock: 0, category: 'Food', source: 'Internal' },
  { name: 'Toalla Extra', price: 1, stock: 200, category: 'Amenity', source: 'Purchased' },
  { name: 'Kit Dental', price: 2.5, stock: 150, category: 'Amenity', source: 'Purchased' },
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
    const seededRoomRefs: (Room & { id: string })[] = [];
    roomsToSeed.forEach(room => {
      const docRef = doc(roomsCollection);
      const status = initialStatuses[room.number] || 'Available';
      
      const roomType = seededRoomTypeRefs.find(rt => rt.name === room.type);
      if (!roomType) {
          console.warn(`RoomType '${room.type}' not found for room ${room.number}`);
          return;
      }

      const hourlyPlan = roomType.pricePlans.find(p => p.unit === 'Hours' && p.duration === 1) || roomType.pricePlans[0];

      const roomData: Omit<Room, 'id' | 'currentStayId'> = { 
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
      
      const newRoom = { ...roomData, id: docRef.id };
      seededRoomRefs.push(newRoom as Room);

      if(status === 'Occupied') {
        const stayRef = doc(collection(db, 'stays'));
        const checkInTime = new Date();
        const expectedCheckOutTime = new Date(checkInTime.getTime() + 8 * 60 * 60 * 1000); // 8 hours from now

        batch.set(stayRef, {
            roomId: docRef.id,
            roomNumber: room.number,
            guestName: 'Juan Pérez',
            checkIn: Timestamp.fromDate(checkInTime),
            expectedCheckOut: Timestamp.fromDate(expectedCheckOutTime),
            checkOut: null,
            total: 0,
            isPaid: false,
            renewalCount: 0,
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

    // Seed a couple of reservations for testing
    const reservationsCollection = collection(db, 'reservations');
    
    // Find room '101' to create a reservation for it
    const room101 = seededRoomRefs.find(r => r.number === '101');
    const roomType101 = seededRoomTypeRefs.find(rt => rt.id === room101?.roomTypeId);
    const pricePlan101 = roomType101?.pricePlans?.find(p => p.name === 'Estadía Corta');

    if (room101 && pricePlan101) {
        const checkInTime = new Date();
        checkInTime.setDate(checkInTime.getDate() + 1); // Tomorrow
        checkInTime.setHours(14, 0, 0, 0); // At 2 PM
        
        const checkOutTime = addHours(checkInTime, pricePlan101.duration);

        const reservation1Ref = doc(reservationsCollection);
        batch.set(reservation1Ref, {
            guestName: 'Ana Rodríguez',
            roomId: room101.id,
            roomNumber: room101.number,
            roomType: room101.roomTypeName,
            checkInDate: Timestamp.fromDate(checkInTime),
            checkOutDate: Timestamp.fromDate(checkOutTime),
            status: 'Confirmed',
            createdAt: Timestamp.now(),
            pricePlanName: pricePlan101.name,
            pricePlanAmount: pricePlan101.price,
        });
    }

    // Find room '201' for another reservation
    const room201 = seededRoomRefs.find(r => r.number === '201');
    const roomType201 = seededRoomTypeRefs.find(rt => rt.id === room201?.roomTypeId);
    const pricePlan201 = roomType201?.pricePlans?.find(p => p.name === 'Noche de Lujo');

    if (room201 && pricePlan201) {
        const checkInTime = new Date();
        checkInTime.setDate(checkInTime.getDate() + 2); // Day after tomorrow
        checkInTime.setHours(18, 0, 0, 0); // At 6 PM

        const checkOutTime = addHours(checkInTime, pricePlan201.duration);

        const reservation2Ref = doc(reservationsCollection);
        batch.set(reservation2Ref, {
            guestName: 'Carlos Gómez',
            roomId: room201.id,
            roomNumber: room201.number,
            roomType: room201.roomTypeName,
            checkInDate: Timestamp.fromDate(checkInTime),
            checkOutDate: Timestamp.fromDate(checkOutTime),
            status: 'Confirmed',
            createdAt: Timestamp.now(),
            pricePlanName: pricePlan201.name,
            pricePlanAmount: pricePlan201.price,
        });
    }

    await batch.commit();

    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/settings/room-types');
    revalidatePath('/reservations');
    
    return { success: '¡Base de datos cargada exitosamente!' };
  } catch (error) {
    console.error('Error seeding database:', error);
    if (error instanceof Error) {
        return { error: error.message };
    }
    return { error: 'Ocurrió un error desconocido al cargar la base de datos.' };
  }
}
