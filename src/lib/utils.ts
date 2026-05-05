import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '₡0.00';
  }
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `₡${formatted}`;
}

export function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Si estamos en localhost, intentamos usar el dominio de firebase para que WhatsApp lo reconozca
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
      if (authDomain) {
        return `https://${authDomain}`;
      }
      return 'https://hotel-du-manolo-cr.web.app'; 
    }
    return window.location.origin;
  }
  return '';
}
