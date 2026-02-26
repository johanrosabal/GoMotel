
'use server';

import { collection, writeBatch, doc, Timestamp, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';
import type { Room, Service, RoomStatus, RoomType, RestaurantTable, Tax } from '@/types';
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

const taxesToSeed: Omit<Tax, 'id'>[] = [
    { name: 'IVA', percentage: 13, description: 'Impuesto al Valor Agregado' },
    { name: 'Impuesto de Servicio', percentage: 10, description: 'Impuesto de servicio para consumo en salón' },
];

const servicesToSeed: Omit<Service, 'id' | 'taxIds'>[] = [
  { name: 'Botella de Agua', price: 600, stock: 100, category: 'Beverage', source: 'Purchased' },
  { name: 'Coca Cola 250 ML', price: 600, stock: 80, category: 'Beverage', source: 'Purchased' },
  { name: 'Jugo de Naranja', price: 1200, stock: 50, category: 'Beverage', source: 'Purchased' },
  { name: 'Club Sándwich', price: 3500, stock: 0, category: 'Food', source: 'Internal' },
  { name: 'Ensalada César', price: 2800, stock: 0, category: 'Food', source: 'Internal' },
  { name: 'Hamburguesa con Queso', price: 4500, stock: 0, category: 'Food', source: 'Internal' },
  { name: 'Toalla Extra', price: 500, stock: 200, category: 'Amenity', source: 'Purchased' },
  { name: 'Kit Dental', price: 800, stock: 150, category: 'Amenity', source: 'Purchased' },
];

const tablesToSeed: Omit<RestaurantTable, 'id'>[] = [
    { number: '1', type: 'Table', status: 'Available' },
    { number: '2', type: 'Table', status: 'Available' },
    { number: '3', type: 'Table', status: 'Available' },
    { number: '4', type: 'Table', status: 'Available' },
    { number: '5', type: 'Table', status: 'Available' },
    { number: '6', type: 'Table', status: 'Available' },
    { number: 'B1', type: 'Bar', status: 'Available' },
    { number: 'B2', type: 'Bar', status: 'Available' },
    { number: 'B3', type: 'Bar', status: 'Available' },
    { number: 'B4', type: 'Bar', status: 'Available' },
];

export async function seedDatabase() {
  try {
    const batch = writeBatch(db);

    // 1. Seed Taxes
    const taxesCollection = collection(db, 'taxes');
    const seededTaxRefs = taxesToSeed.map(tax => {
        const docRef = doc(taxesCollection);
        batch.set(docRef, tax);
        return { ...tax, id: docRef.id };
    });

    const ivaTax = seededTaxRefs.find(t => t.name === 'IVA');

    // 2. Seed Room Types
    const roomTypesCollection = collection(db, 'roomTypes');
    const seededRoomTypeRefs = roomTypesToSeed.map(roomType => {
        const docRef = doc(roomTypesCollection);
        batch.set(docRef, roomType);
        return { ...roomType, id: docRef.id };
    });

    // 3. Seed Rooms
    const roomsCollection = collection(db, 'rooms');
    const seededRoomRefs: (Room & { id: string })[] = [];
    roomsToSeed.forEach(room => {
      const docRef = doc(roomsCollection);
      const status = initialStatuses[room.number] || 'Available';
      
      const roomType = seededRoomTypeRefs.find(rt => rt.name === room.type);
      if (!roomType) return;

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
        const expectedCheckOutTime = new Date(checkInTime.getTime() + 8 * 60 * 60 * 1000); 

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

    // 4. Seed Services (Assigned IVA by default)
    const servicesCollection = collection(db, 'services');
    servicesToSeed.forEach(service => {
      const docRef = doc(servicesCollection);
      batch.set(docRef, {
          ...service,
          taxIds: ivaTax ? [ivaTax.id] : []
      });
    });

    // 5. Seed Restaurant Tables
    const tablesCollection = collection(db, 'restaurantTables');
    tablesToSeed.forEach(table => {
        const docRef = doc(tablesCollection);
        batch.set(docRef, table);
    });

    await batch.commit();

    revalidatePath('/');
    revalidatePath('/inventory');
    revalidatePath('/pos');
    
    return { success: '¡Base de datos cargada exitosamente!' };
  } catch (error) {
    console.error('Error seeding database:', error);
    return { error: 'Ocurrió un error al cargar la base de datos.' };
  }
}
