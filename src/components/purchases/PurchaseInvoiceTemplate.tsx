'use client';
import React from 'react';
import type { PurchaseInvoice } from '@/types';
import AppLogo from '@/components/AppLogo';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

const PurchaseInvoiceTemplate = React.forwardRef<HTMLDivElement, { invoice: PurchaseInvoice }>(({ invoice }, ref) => (
    <div ref={ref} className="p-10 bg-white text-gray-800" style={{ width: '8.5in', minHeight: '11in' }}>
        <header className="flex justify-between items-center pb-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
                <AppLogo className="h-16 w-16 text-primary" />
                <div>
                    <h1 className="text-4xl font-bold text-gray-900">Go Motel</h1>
                    <p className="text-gray-500">Comprobante de Compra</p>
                </div>
            </div>
            <div className="text-right">
                <h2 className="text-2xl font-semibold uppercase tracking-widest">Factura de Proveedor</h2>
                <p className="font-mono text-sm">{invoice.invoiceNumber}</p>
            </div>
        </header>

        <main className="my-10">
            <div className="grid grid-cols-2 gap-8">
                <div>
                    <p className="text-sm font-semibold text-gray-500">PROVEEDOR</p>
                    <p className="font-bold">{invoice.supplierName}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-gray-500">FECHA DE FACTURA</p>
                    <p>{invoice.invoiceDate ? format(invoice.invoiceDate.toDate(), "dd 'de' MMMM, yyyy", { locale: es }) : 'N/A'}</p>
                    <p className="text-sm font-semibold text-gray-500 mt-2">FECHA DE REGISTRO</p>
                    <p>{invoice.createdAt ? format(invoice.createdAt.toDate(), "dd 'de' MMMM, yyyy", { locale: es }) : 'N/A'}</p>
                </div>
            </div>
            
            <div className="mt-10">
                <table className="w-full text-left">
                    <thead >
                        <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
                            <th className="p-3 font-semibold">Descripción</th>
                            <th className="p-3 text-center font-semibold">Cant.</th>
                            <th className="p-3 text-right font-semibold">Costo Unit.</th>
                            <th className="p-3 text-right font-semibold">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item, index) => (
                        <tr key={index} className="border-b border-gray-100">
                            <td className="p-3">{item.serviceName}</td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className="p-3 text-right">{formatCurrency(item.costPrice)}</td>
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
                        <p>{formatCurrency(invoice.subtotal || 0)}</p>
                    </div>
                     {invoice.totalDiscount && invoice.totalDiscount > 0 && (
                        <div className="flex justify-between text-red-600">
                            <p className="text-gray-500">Descuento:</p>
                            <p>-{formatCurrency(invoice.totalDiscount)}</p>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <p className="text-gray-500">Impuestos:</p>
                        <p>{formatCurrency(invoice.totalTax || 0)}</p>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t border-gray-200 mt-2 pt-2">
                        <p>Total a Pagar:</p>
                        <p>{formatCurrency(invoice.totalAmount)}</p>
                    </div>
                </div>
            </div>
        </main>
        
        <footer className="text-center text-xs text-gray-400 pt-10 mt-10 border-t border-gray-200">
            <p>Este es un comprobante de una factura de compra registrada en el sistema.</p>
        </footer>
    </div>
));
PurchaseInvoiceTemplate.displayName = "PurchaseInvoiceTemplate";
export default PurchaseInvoiceTemplate;
