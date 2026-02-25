'use server';

import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { Invoice, Stay, Order, Service } from '@/types';
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval, isSameDay } from 'date-fns';

export async function getDashboardStats(days: number = 7) {
  try {
    const now = new Date();
    const startDate = startOfDay(subDays(now, days - 1));
    const startTimestamp = Timestamp.fromDate(startDate);

    // 1. Fetch Invoices for Revenue
    const invoicesRef = collection(db, 'invoices');
    const invoicesQuery = query(
      invoicesRef,
      where('createdAt', '>=', startTimestamp),
      orderBy('createdAt', 'asc')
    );
    const invoicesSnap = await getDocs(invoicesQuery);
    const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));

    // 2. Fetch Stays for Occupancy
    const staysRef = collection(db, 'stays');
    const staysQuery = query(staysRef, where('checkIn', '>=', startTimestamp));
    const staysSnap = await getDocs(staysQuery);
    const stays = staysSnap.docs.map(d => ({ id: d.id, ...d.data() } as Stay));

    // 3. Fetch Services for Stock Alerts
    const servicesRef = collection(db, 'services');
    const servicesSnap = await getDocs(servicesRef);
    const services = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service));

    // --- Processing Data for Charts ---
    
    // Revenue by Day
    const daysInterval = eachDayOfInterval({ start: startDate, end: now });
    const revenueData = daysInterval.map(day => {
        const dayTotal = invoices
            .filter(inv => isSameDay(inv.createdAt.toDate(), day) && inv.status === 'Pagada')
            .reduce((sum, inv) => sum + inv.total, 0);
        return {
            date: format(day, 'dd/MM'),
            total: dayTotal
        };
    });

    // Payment Method Distribution
    const paymentMethods = {
        'Efectivo': 0,
        'Sinpe Movil': 0,
        'Tarjeta': 0
    };
    invoices.forEach(inv => {
        if (inv.status === 'Pagada' && inv.paymentMethod) {
            const method = inv.paymentMethod as keyof typeof paymentMethods;
            if (paymentMethods[method] !== undefined) {
                paymentMethods[method] += inv.total;
            }
        }
    });

    const paymentData = Object.entries(paymentMethods).map(([name, value]) => ({ name, value }));

    // Occupancy Stats
    const totalRoomsCount = 10; // This should ideally be dynamic
    const currentOccupied = stays.filter(s => !s.checkOut).length;
    const occupancyRate = (currentOccupied / totalRoomsCount) * 100;

    const lowStockCount = services.filter(s => s.minStock != null && s.stock <= s.minStock).length;

    return {
        revenueData,
        paymentData,
        kpis: {
            totalRevenue: invoices.filter(i => i.status === 'Pagada').reduce((sum, i) => sum + i.total, 0),
            occupancyRate,
            lowStockCount,
            totalInvoices: invoices.length
        },
        rawForAI: {
            invoicesCount: invoices.length,
            totalRevenue: invoices.reduce((sum, i) => sum + i.total, 0),
            staysCount: stays.length,
            lowStockItems: services.filter(s => s.minStock != null && s.stock <= s.minStock).map(s => s.name)
        },
        detailedInvoices: invoices
            .filter(i => i.status === 'Pagada')
            .map(inv => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                clientName: inv.clientName,
                total: inv.total,
                paymentMethod: inv.paymentMethod,
                createdAt: inv.createdAt.toDate().toISOString()
            }))
            .reverse()
    };

  } catch (error) {
    console.error('Error generating report data:', error);
    throw new Error('No se pudieron obtener los datos del reporte.');
  }
}
