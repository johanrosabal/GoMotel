'use client';
import React from 'react';
import type { Invoice } from '@/types';
import AppLogo from '@/components/AppLogo';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

const InvoiceTemplate = React.forwardRef<HTMLDivElement, { invoice: Invoice }>(({ invoice }, ref) => (
    <div ref={ref} className="p-10 bg-white text-gray-800" style={{ width: '8.5in', minHeight: '11in' }}>
        <header className="flex justify-between items-center pb-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
                <AppLogo className="h-16 w-16 text-primary" />
                <div>
                    <h1 className="text-4xl font-bold text-gray-900">Go Motel</h1>
                    <p className="text-gray-500">San José, Costa Rica</p>
                </div>
            </div>
            <div className="text-right">
                <h2 className="text-2xl font-semibold uppercase tracking-widest">Factura</h2>
                <p className="font-mono text-sm">{invoice.invoiceNumber}</p>
            </div>
        </header>

        <main className="my-10">
            <div className="grid grid-cols-2 gap-8">
                <div>
                    <p className="text-sm font-semibold text-gray-500">FACTURAR A</p>
                    <p className="font-bold">{invoice.clientName}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-gray-500">FECHA DE FACTURA</p>
                    <p>{invoice.createdAt ? format(invoice.createdAt.toDate(), "dd 'de' MMMM, yyyy", { locale: es }) : 'N/A'}</p>
                </div>
            </div>
            
            <div className="mt-10">
                <table className="w-full text-left">
                    <thead >
                        <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
                            <th className="p-3 font-semibold">Descripción</th>
                            <th className="p-3 text-center font-semibold">Cant.</th>
                            <th className="p-3 text-right font-semibold">Precio Unit.</th>
                            <th className="p-3 text-right font-semibold">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item, index) => (
                        <tr key={index} className="border-b border-gray-100">
                            <td className="p-3">{item.description}</td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="p-3 text-right font-semibold">{formatCurrency(item.total)}</td>
                        </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end mt-10">
                <div className="w-full max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between">
                        <p className="text-gray-500">Subtotal:</p>
                        <p>{formatCurrency(invoice.subtotal)}</p>
                    </div>
                    {invoice.taxes.map(tax => (
                        <div key={tax.taxId} className="flex justify-between">
                            <p className="text-gray-500">{tax.name} ({tax.percentage}%):</p>
                            <p>{formatCurrency(tax.amount)}</p>
                        </div>
                    ))}
                    <div className="flex justify-between font-bold text-lg border-t border-gray-200 mt-2 pt-2">
                        <p>Total a Pagar:</p>
                        <p>{formatCurrency(invoice.total)}</p>
                    </div>
                </div>
            </div>
        </main>
        
        <footer className="text-center text-xs text-gray-400 pt-10 mt-10 border-t border-gray-200">
            <p>¡Gracias por su preferencia!</p>
            <p>Si tiene alguna pregunta sobre esta factura, contáctenos.</p>
        </footer>
    </div>
));
InvoiceTemplate.displayName = "InvoiceTemplate";
export default InvoiceTemplate;
