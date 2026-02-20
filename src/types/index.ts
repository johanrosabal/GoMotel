'use client';
import type { Timestamp } from 'firebase/firestore';

export type RoomStatus = 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance';

export interface PricePlan {
  name: string;
  duration: number;
  unit: 'Minutes' | 'Hours' | 'Days' | 'Weeks' | 'Months';
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
  statusUpdatedAt?: Timestamp;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
}

export interface ProductSubCategory {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
}

export interface Service {
  id:string;
  name: string;
  code?: string;
  price: number;
  costPrice?: number;
  stock: number;
  category: 'Food' | 'Beverage' | 'Amenity';
  description?: string;
  imageUrl?: string;
  categoryId?: string;
  subCategoryId?: string;
  isActive?: boolean;
}

export interface StayExtension {
  extendedAt: Timestamp;
  oldExpectedCheckOut: Timestamp;
  newExpectedCheckOut: Timestamp;
  planName: string;
  planPrice: number;
}

export interface Stay {
  id: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  checkIn: Timestamp;
  expectedCheckOut: Timestamp;
  checkOut: Timestamp | null;
  total: number;
  isPaid: boolean;
  reservationId?: string;
  guestId?: string;
  pricePlanName?: string;
  pricePlanAmount?: number;
  checkOutReason?: string;
  checkOutNotes?: string;
  renewalCount?: number;
  extensionHistory?: StayExtension[];
  paymentMethod?: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta' | 'Por Definir';
  paymentStatus?: 'Pagado' | 'Pendiente';
  paymentAmount?: number;
}

export type ReservationStatus = 'Confirmed' | 'Checked-in' | 'Cancelled' | 'No-show' | 'Completed';

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
  pricePlanName?: string;
  pricePlanAmount?: number;
  paymentMethod?: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta' | 'Por Definir';
  paymentStatus?: 'Pagado' | 'Pendiente';
  paymentAmount?: number;
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
  isVip?: boolean;
  visitCount?: number;
  createdAt: Timestamp;
}

export interface Tax {
  id: string;
  name: string;
  percentage: number;
  description?: string;
}
