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
  minStock?: number;
  category: 'Food' | 'Beverage' | 'Amenity';
  description?: string;
  imageUrl?: string;
  categoryId?: string;
  subCategoryId?: string;
  isActive?: boolean;
  taxIds?: string[];
  supplierId?: string;
  supplierName?: string;
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
  voucherNumber?: string;
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
  voucherNumber?: string;
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

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface AppliedTax {
    taxId: string;
    name: string;
    percentage: number;
    amount: number;
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    reservationId?: string;
    stayId?: string;
    clientId?: string;
    clientName: string;
    createdAt: Timestamp;
    status: 'Pagada' | 'Pendiente' | 'Anulada';
    items: InvoiceItem[];
    subtotal: number;
    taxes: AppliedTax[];
    total: number;
    paymentMethod?: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta';
    voucherNumber?: string;
}

export interface SinpeAccount {
  id: string;
  accountHolder: string;
  phoneNumber: string;
  bankName: string;
  balance: number;
  limitAmount?: number;
  isActive?: boolean;
  createdAt: Timestamp;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  googleMapsUrl?: string;
  notes?: string;
  createdAt: Timestamp;
}

export interface PurchaseInvoiceItem {
  serviceId: string;
  serviceName: string;
  quantity: number;
  costPrice: number;
  total: number;
  taxIds?: string[];
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  invoiceDate: Timestamp;
  createdAt: Timestamp;
  items: PurchaseInvoiceItem[];
  totalAmount: number;
  subtotal?: number;
  totalTax?: number;
  taxesIncluded?: boolean;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  totalDiscount?: number;
  imageUrls?: string[];
  status?: 'Activa' | 'Anulada';
  createdByName?: string;
  createdByUid?: string;
}
