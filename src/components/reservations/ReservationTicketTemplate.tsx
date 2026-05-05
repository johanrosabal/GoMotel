'use client';
import React from 'react';
import type { Reservation, CompanyProfile } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const ReservationTicketTemplate = React.forwardRef<HTMLDivElement, { reservation: Reservation }>(({ reservation }, ref) => {
    const { firestore } = useFirebase();
    const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
    const { data: company } = useDoc<CompanyProfile>(companyRef);

    return (
        <div 
            ref={ref} 
            className="bg-white text-black font-mono text-[14px] leading-tight mx-auto" 
            style={{ width: '80mm', minHeight: '100mm', padding: '6mm', boxSizing: 'border-box' }}
        >
            {/* Header */}
            <div className="text-center space-y-1.5 mb-6">
                <h1 className="text-lg font-black uppercase tracking-tighter">{company?.tradeName || 'Go Motel'}</h1>
                <p className="text-[11px] font-bold">RESERVACIÓN CONFIRMADA</p>
                {company?.phoneNumbers && company.phoneNumbers.length > 0 && (
                    <p className="text-[11px] font-bold">Tel: {company.phoneNumbers[0].value}</p>
                )}
            </div>

            <div className="border-t-2 border-dashed border-black my-3" />

            {/* Info */}
            <div className="space-y-1 mb-3 uppercase text-[12px]">
                <p className="font-bold text-sm">CÓDIGO: {reservation.id.slice(-6).toUpperCase()}</p>
                <p>HUÉSPED: {reservation.guestName}</p>
                <p>HABITACIÓN: {reservation.roomNumber}</p>
                <p>TIPO: {reservation.roomType}</p>
            </div>

            <div className="border-t border-dashed border-black my-3" />

            {/* Stay Details */}
            <div className="space-y-2 uppercase text-[12px]">
                <div>
                    <p className="font-black text-[10px] text-gray-500">CHECK-IN ESTIMADO:</p>
                    <p className="font-bold">{format(reservation.checkInDate.toDate(), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                </div>
                <div>
                    <p className="font-black text-[10px] text-gray-500">CHECK-OUT ESTIMADO:</p>
                    <p className="font-bold">{format(reservation.checkOutDate.toDate(), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                </div>
            </div>

            <div className="border-t border-dashed border-black my-3" />

            {/* Totals */}
            <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                    <span>PLAN:</span>
                    <span className="font-bold">{reservation.pricePlanName}</span>
                </div>
                <div className="flex justify-between text-lg font-black pt-2 mt-1 border-t border-black">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(reservation.paymentAmount || 0)}</span>
                </div>
            </div>

            <div className="border-t border-dashed border-black my-4" />

            {/* Payment Status */}
            <div className="text-[11px] space-y-1 uppercase font-bold">
                <p>ESTADO DE PAGO: {reservation.paymentStatus === 'Pagado' ? 'PAGADO' : 'PENDIENTE DE COBRO'}</p>
                {reservation.paymentStatus === 'Pagado' && reservation.paymentMethod && (
                    <p>MÉTODO: {reservation.paymentMethod}</p>
                )}
            </div>

            <div className="border-t-2 border-dashed border-black my-6" />

            {/* Footer */}
            <div className="text-center text-[11px] space-y-2 mt-4 italic">
                <p className="font-black uppercase text-xs">¡Te esperamos!</p>
                <div className="space-y-0.5 opacity-80">
                    <p>Presenta este comprobante al llegar.</p>
                    <p>Válido únicamente para la fecha indicada.</p>
                </div>
            </div>
        </div>
    );
});

ReservationTicketTemplate.displayName = "ReservationTicketTemplate";
export default ReservationTicketTemplate;
