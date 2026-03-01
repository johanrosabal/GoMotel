'use client';
import React from 'react';
import type { Invoice, CompanyProfile } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const PosTicketTemplate = React.forwardRef<HTMLDivElement, { invoice: Invoice }>(({ invoice }, ref) => {
    const { firestore } = useFirebase();
    const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
    const { data: company } = useDoc<CompanyProfile>(companyRef);

    return (
        <div 
            ref={ref} 
            className="bg-white text-black p-4 font-mono text-[12px] leading-tight mx-auto" 
            style={{ width: '80mm', minHeight: '100mm' }}
        >
            {/* Header */}
            <div className="text-center space-y-1 mb-4">
                <h1 className="text-sm font-black uppercase tracking-tighter">{company?.tradeName || 'Go Motel'}</h1>
                <p className="text-[10px]">{company?.legalId || 'Cédula Jurídica N/D'}</p>
                <p className="text-[10px] uppercase line-clamp-2">{company?.address || 'Dirección de la empresa'}</p>
                {company?.phoneNumbers && company.phoneNumbers.length > 0 && (
                    <p className="text-[10px]">Tel: {company.phoneNumbers[0].value}</p>
                )}
            </div>

            <div className="border-t border-dashed border-black my-2" />

            {/* Info */}
            <div className="space-y-0.5 mb-2 uppercase">
                <p>TICKET: <span className="font-bold">{invoice.invoiceNumber}</span></p>
                <p>FECHA: {invoice.createdAt ? format(invoice.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: es }) : 'N/A'}</p>
                <p>CLIENTE: {invoice.clientName || 'CLIENTE DE CONTADO'}</p>
            </div>

            <div className="border-t border-dashed border-black my-2" />

            {/* Items Table */}
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b border-dashed border-black uppercase text-[10px]">
                        <th className="py-1">CANT</th>
                        <th className="py-1">DESCRIPCIÓN</th>
                        <th className="py-1 text-right">TOTAL</th>
                    </tr>
                </thead>
                <tbody className="text-[11px]">
                    {invoice.items.map((item, index) => (
                        <tr key={index} className="align-top">
                            <td className="py-1">{item.quantity}</td>
                            <td className="py-1 pr-2">
                                <p className="uppercase leading-none">{item.description}</p>
                                <p className="text-[9px] opacity-70">@{formatCurrency(item.unitPrice)}</p>
                            </td>
                            <td className="py-1 text-right">{formatCurrency(item.total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="border-t border-dashed border-black my-2" />

            {/* Totals */}
            <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.taxes.map(tax => (
                    <div key={tax.taxId} className="flex justify-between">
                        <span>{tax.name} ({tax.percentage}%):</span>
                        <span>{formatCurrency(tax.amount)}</span>
                    </div>
                ))}
                <div className="flex justify-between text-sm font-black pt-1">
                    <span>TOTAL A PAGAR:</span>
                    <span>{formatCurrency(invoice.total)}</span>
                </div>
            </div>

            <div className="border-t border-dashed border-black my-2" />

            {/* Payment Details */}
            <div className="text-[10px] space-y-0.5 uppercase">
                <p>MÉTODO DE PAGO: {invoice.paymentMethod || 'EFECTIVO'}</p>
                {invoice.voucherNumber && <p>VOUCHER: {invoice.voucherNumber}</p>}
            </div>

            <div className="border-t border-dashed border-black my-4" />

            {/* Footer */}
            <div className="text-center text-[10px] space-y-1 mt-4 italic">
                <p className="font-bold uppercase">¡Gracias por su visita!</p>
                <p>Este no es un documento tributario.</p>
                <p>Favor conservar su ticket.</p>
            </div>
        </div>
    );
});

PosTicketTemplate.displayName = "PosTicketTemplate";
export default PosTicketTemplate;
