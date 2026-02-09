import type { Timestamp } from 'firebase/firestore';

export type RoomStatus = 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance';
export type RoomType = 'Sencilla' | 'Doble' | 'Suite';

export interface Room {
  id: string;
  number: string;
  status: RoomStatus;
  ratePerHour: number;
  type: RoomType;
  capacity: number;
  description: string;
  currentStayId?: string | null;
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
