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
  showOnLandingPage?: boolean;
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

export interface RestaurantTable {
  id: string;
  number: string;
  type: string; // Dynamic: Table, Bar, Terraza, or custom
  status: 'Available' | 'Occupied';
  currentOrderId?: string | null;
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
  taxIncluded?: boolean;
  supplierId?: string;
  supplierName?: string;
  source?: 'Purchased' | 'Internal';
  isPublic?: boolean;
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
  guestId?: string | null;
  pricePlanName?: string;
  pricePlanAmount?: number;
  checkOutReason?: string;
  checkOutNotes?: string;
  renewalCount?: number;
  extensionHistory?: StayExtension[];
  paymentMethod?: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta' | 'Por Definir';
  paymentStatus?: 'Pagado' | 'Pendiente';
  paymentAmount?: number;
  voucherNumber?: string | null;
}

export type ReservationStatus = 'Confirmed' | 'Checked-in' | 'Cancelled' | 'No-show' | 'Completed';

export interface Reservation {
  id: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  guestName: string;
  guestId?: string | null;
  checkInDate: Timestamp;
  checkOutDate: Timestamp;
  status: ReservationStatus;
  createdAt: Timestamp;
  pricePlanName?: string;
  pricePlanAmount?: number;
  paymentMethod?: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta' | 'Por Definir';
  paymentStatus?: 'Pagado' | 'Pendiente';
  paymentAmount?: number;
  voucherNumber?: string | null;
}

export interface OrderItem {
  id: string;
  serviceId: string;
  name: string;
  quantity: number;
  price: number;
  category?: 'Food' | 'Beverage' | 'Amenity';
  notes?: string | null;
  status: PrepStatus;
  createdAt: Timestamp;
}

export type PrepStatus = 'Pendiente' | 'En preparación' | 'Entregado' | 'Cancelado' | 'Completado';

export interface Order {
  id: string;
  locationType: string; // Dynamic
  locationId?: string;
  locationLabel?: string; // Human readable (e.g. "Mesa 01", "Hab. 101")
  label?: string; // Account label (e.g. "Persona 1")
  items: OrderItem[];
  subtotal: number;
  taxes: AppliedTax[];
  total: number;
  createdAt: Timestamp;
  status: PrepStatus; // Global status
  kitchenStatus?: PrepStatus;
  barStatus?: PrepStatus;
  paymentStatus?: 'Pagado' | 'Pendiente';
  paymentMethod?: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta' | 'Por Definir';
  invoiceId?: string;
  voucherNumber?: string | null;
  stayId?: string; // For compatibility with older code
  source?: 'POS' | 'Public';
  billRequested?: boolean;
  billRequestedAt?: Timestamp;
}

export type UserRole = 'Administrador' | 'Recepcion' | 'Conserje' | 'Contador';

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
  birthDate: Timestamp | null;
  address?: string;
  notes?: string;
  isVip?: boolean;
  isValidated?: boolean;
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
    stayId?: string | null;
    clientId?: string | null;
    clientName: string;
    createdAt: Timestamp;
    status: 'Pagada' | 'Pendiente' | 'Anulada';
    items: InvoiceItem[];
    subtotal: number;
    taxes: AppliedTax[];
    total: number;
    paymentMethod?: 'Efectivo' | 'Sinpe Movil' | 'Tarjeta';
    voucherNumber?: string | null;
    orderId?: string;
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

export interface CompanyContact {
  label: string;
  value: string;
}
export interface CompanySocial {
  platform: 'Facebook' | 'Instagram' | 'Twitter' | 'TikTok' | 'LinkedIn';
  url: string;
}
export interface CompanyBankAccount {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  iban?: string;
}

export interface CompanyProfile {
  id: string;
  tradeName: string;
  legalId: string;
  country?: string;
  address?: string;
  googleMapsUrl?: string;
  websiteUrl?: string;
  logoUrl?: string;
  phoneNumbers?: CompanyContact[];
  emails?: CompanyContact[];
  socialMedia?: CompanySocial[];
  bankAccounts?: CompanyBankAccount[];
}

export interface SystemSettings {
  id: 'system';
  verificationApiDomain: string;
  publicMenuDarkMode?: boolean;
  supportEmail?: string;
  supportPhone?: string;
}

export interface LandingPageFeature {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export type NotificationType = 'Public' | 'Internal';
export type NotificationPriority = 'Low' | 'Medium' | 'High';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  startDate: Timestamp;
  endDate: Timestamp;
  type: NotificationType;
  priority: NotificationPriority;
  isActive: boolean;
  createdAt: Timestamp;
  createdBy?: string;
}

export interface LandingPageContent {
  id: string; // 'main'
  heroSection?: {
    title1?: string;
    title2?: string;
    desktopSubtitle?: string;
    mobileSubtitle?: string;
    mobileImageUrl: string;
    desktopImageUrl: string;
  };
  featuresSection: {
    title1: string;
    title2: string;
    description: string;
    features: LandingPageFeature[];
  };
  amenitiesSection?: {
    title1: string;
    title2: string;
    amenities: {
      id: string;
      title: string;
      description: string;
      imageUrl?: string;
    }[];
  };
  gallerySection?: {
    title1: string;
    title2: string;
    images: {
      id: string;
      url: string;
      alt?: string;
    }[];
    videos?: {
      id: string;
      url: string;
      alt?: string;
      thumbnailUrl?: string;
    }[];
  };
  aboutSection?: {
    pillText: string;
    title1: string;
    title2: string;
    description: string;
    buttonText: string;
  };
  footerSection?: {
    description: string;
    address: string;
    phone: string;
    whatsapp?: string;
    googleMapsUrl?: string;
    socialMedia: {
      platform: 'Facebook' | 'Instagram' | 'Twitter' | 'TikTok' | 'LinkedIn';
      url: string;
    }[];
  };
}

export interface AboutPageContent {
  content: string;
  heroImageUrl?: string;
}
