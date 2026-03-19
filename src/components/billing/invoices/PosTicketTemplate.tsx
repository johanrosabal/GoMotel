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
            className="bg-white text-black font-mono text-[14px] leading-tight mx-auto" 
            style={{ width: '80mm', minHeight: '100mm', padding: '6mm', boxSizing: 'border-box' }}
        >
            {/* Header */}
            <div className="text-center space-y-1.5 mb-6">
                <h1 className="text-lg font-black uppercase tracking-tighter">{company?.tradeName || 'Go Motel'}</h1>
                <p className="text-[11px] font-bold">{company?.legalId || 'Cédula Jurídica N/D'}</p>
                <p className="text-[11px] uppercase line-clamp-2">{company?.address || 'Dirección de la empresa'}</p>
                {company?.phoneNumbers && company.phoneNumbers.length > 0 && (
                    <p className="text-[11px] font-bold">Tel: {company.phoneNumbers[0].value}</p>
                )}
            </div>

            <div className="border-t-2 border-dashed border-black my-3" />

            {/* Info */}
            <div className="space-y-1 mb-3 uppercase text-[12px]">
                <p className="font-bold text-sm">TICKET: {invoice.invoiceNumber}</p>
                <p>FECHA: {invoice.createdAt ? format(invoice.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: es }) : 'N/A'}</p>
                <p className="truncate">CLIENTE: {invoice.clientName || 'CLIENTE DE CONTADO'}</p>
            </div>

            <div className="border-t border-dashed border-black my-3" />

            {/* Items Table */}
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b-2 border-dashed border-black uppercase text-[11px] font-black">
                        <th className="py-2 w-8">CAN</th>
                        <th className="py-2">DESCRIPCIÓN</th>
                        <th className="py-2 text-right">TOTAL</th>
                    </tr>
                </thead>
                <tbody className="text-[13px]">
                    {invoice.items.map((item, index) => (
                        <tr key={index} className="align-top border-b border-gray-100 last:border-0">
                            <td className="py-2 font-bold">{item.quantity}</td>
                            <td className="py-2 pr-2">
                                <p className="uppercase leading-none font-medium">{item.description}</p>
                                <p className="text-[10px] opacity-80 mt-1">@{formatCurrency(item.unitPrice)}</p>
                            </td>
                            <td className="py-2 text-right font-bold">{formatCurrency(item.total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="border-t-2 border-dashed border-black my-3" />

            {/* Totals */}
            <div className="space-y-1.5 text-[13px]">
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
                <div className="flex justify-between text-lg font-black pt-2 mt-1 border-t border-black">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(invoice.total)}</span>
                </div>
            </div>

            <div className="border-t border-dashed border-black my-4" />

            {/* Payment Details */}
            <div className="text-[11px] space-y-1 uppercase font-bold">
                <p>PAGO: {invoice.paymentMethod || 'EFECTIVO'}</p>
                {invoice.voucherNumber && <p>VOUCHER: {invoice.voucherNumber}</p>}
            </div>

            <div className="border-t-2 border-dashed border-black my-6" />

            {/* Footer */}
            <div className="text-center text-[11px] space-y-2 mt-4 italic">
                <p className="font-black uppercase text-xs">¡Gracias por su visita!</p>
                <div className="space-y-0.5 opacity-80">
                    <p>Este no es un documento tributario.</p>
                    <p>Favor conservar su ticket.</p>
                </div>
            </div>
        </div>
    );
});

PosTicketTemplate.displayName = "PosTicketTemplate";
export default PosTicketTemplate;
