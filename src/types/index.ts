'use client';
import type { Timestamp } from 'firebase/firestore';

export type RoomStatus = 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance';

export interface PricePlan {
  name: string;
  duration: number;
  unit: 'Hours' | 'Days' | 'Weeks' | 'Months';
  price: number;
}

export interface RoomType {
  id: string;
  name: string;
  code: string;
  capacity: number;
  features?: string[];
  pricePlans?: PricePlan[];
}

export interface Room {
  id: string;
  number: string;
  status: RoomStatus;
  ratePerHour: number;
  type: string;
  capacity: number;
  description: string;
  currentStayId?: string | null;
  roomTypeId: string;
  roomTypeName: string;
}

export interface Service {
  id:string;
  name: string;
  price: number;
  stock: number;
  category: 'Food' | 'Beverage' | 'Amenity';
}

export interface Stay {
  id: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  checkIn: Timestamp;
  expectedCheckOut: Timestamp;
  checkOut?: Timestamp | null;
  total: number;
  isPaid: boolean;
  reservationId?: string;
}

export type ReservationStatus = 'Confirmed' | 'Checked-in' | 'Cancelled' | 'No-show';

export interface Reservation {
  id: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  guestName: string;
  guestId?: string;
  checkInDate: Timestamp;
  checkOutDate: Timestamp;
  status: ReservationStatus;
  createdAt: Timestamp;
}

export interface OrderItem {
  serviceId: string;
  name: string;
  quantity: number;
  price: number; // Price per item at the time of order
}

export interface Order {
  id: string;
  stayId: string;
  items: OrderItem[];
  total: number;
  createdAt: Timestamp;
  status: 'Pendiente' | 'En preparación' | 'Entregado' | 'Cancelado';
}

export type UserRole = 'Administrador' | 'Recepcion';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  birthDate: Timestamp;
  idCard: string;
  phoneNumber: string;
  whatsappNumber?: string;
  createdAt: Timestamp;
  role: UserRole;
  status: 'Active' | 'Paused';
  photoURL?: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  idCard: string;
  email: string;
  phoneNumber: string;
  whatsappNumber?: string;
  birthDate: Timestamp;
  address?: string;
  notes?: string;
  createdAt: Timestamp;
}
