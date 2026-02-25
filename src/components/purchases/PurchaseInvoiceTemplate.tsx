'use client';
import React from 'react';
import type { PurchaseInvoice, CompanyProfile } from '@/types';
import AppLogo from '@/components/AppLogo';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const PurchaseInvoiceTemplate = React.forwardRef<HTMLDivElement, { invoice: PurchaseInvoice }>(({ invoice }, ref) => {
    const { firestore } = useFirebase();
    const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
    const { data: company } = useDoc<CompanyProfile>(companyRef);

    return (
        <div ref={ref} className="p-10 bg-white text-gray-800" style={{ width: '8.5in', minHeight: '11in' }}>
            <header className="flex justify-between items-center pb-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    {company?.logoUrl ? (
                        <img src={company.logoUrl} alt="Logo" className="h-16 w-16 object-contain" />
                    ) : (
                        <AppLogo className="h-16 w-16 text-primary" />
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{company?.tradeName || 'Go Motel'}</h1>
                        <p className="text-gray-500 text-sm">Comprobante de Compra Interno</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-semibold uppercase tracking-widest text-muted-foreground">Factura Proveedor</h2>
                    <p className="font-mono text-sm font-bold">{invoice.invoiceNumber}</p>
                </div>
            </header>

            <main className="my-10">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">PROVEEDOR</p>
                        <p className="font-bold text-lg">{invoice.supplierName}</p>
                    </div>
                    <div className="text-right flex gap-10">
                        <div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">FECHA FACTURA</p>
                            <p className="font-medium text-sm">{invoice.invoiceDate ? format(invoice.invoiceDate.toDate(), "dd 'de' MMMM, yyyy", { locale: es }) : 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">FECHA REGISTRO</p>
                            <p className="font-medium text-sm">{invoice.createdAt ? format(invoice.createdAt.toDate(), "dd MMM yyyy, h:mm a", { locale: es }) : 'N/A'}</p>
                        </div>
                    </div>
                </div>
                
                <div className="mt-10">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-100 text-gray-600 uppercase text-[10px] tracking-widest">
                                <th className="p-3 font-bold">Descripción / Producto</th>
                                <th className="p-3 text-center font-bold">Cant.</th>
                                <th className="p-3 text-right font-bold">Costo Unit.</th>
                                <th className="p-3 text-right font-bold">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.items.map((item, index) => (
                            <tr key={index} className="border-b border-gray-100">
                                <td className="p-3 text-sm">{item.serviceName}</td>
                                <td className="p-3 text-center text-sm">{item.quantity}</td>
                                <td className="p-3 text-right text-sm">{formatCurrency(item.costPrice)}</td>
                                <td className="p-3 text-right font-bold text-sm">{formatCurrency(item.total)}</td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end mt-10">
                    <div className="w-full max-w-sm space-y-2 text-sm">
                        <div className="flex justify-between">
                            <p className="text-gray-500">Subtotal:</p>
                            <p className="font-semibold">{formatCurrency(invoice.subtotal || 0)}</p>
                        </div>
                         {invoice.totalDiscount && invoice.totalDiscount > 0 && (
                            <div className="flex justify-between text-sm">
                                <p className="text-gray-500">Descuento aplicado:</p>
                                <p className="text-red-600">-{formatCurrency(invoice.totalDiscount)}</p>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <p className="text-gray-500">Impuestos:</p>
                            <p>{formatCurrency(invoice.totalTax || 0)}</p>
                        </div>
                        <div className="flex justify-between font-black text-xl border-t-2 border-gray-900 mt-2 pt-2">
                            <p>Total Compra:</p>
                            <p>{formatCurrency(invoice.totalAmount)}</p>
                        </div>
                    </div>
                </div>
            </main>
            
            <footer className="text-center text-[10px] text-gray-400 pt-10 mt-10 border-t border-gray-200">
                <p>Este documento es un registro administrativo de entrada de mercancía para <strong>{company?.tradeName || 'la empresa'}</strong>.</p>
                {invoice.createdByName && <p className="mt-2 uppercase font-semibold">Registrado por: {invoice.createdByName}</p>}
            </footer>
        </div>
    );
});
PurchaseInvoiceTemplate.displayName = "PurchaseInvoiceTemplate";
export default PurchaseInvoiceTemplate;
