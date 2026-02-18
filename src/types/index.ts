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
  checkOut?: Timestamp | null;
  total: number;
  isPaid: boolean;
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
  status: 'Pending' | 'Delivered';
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
