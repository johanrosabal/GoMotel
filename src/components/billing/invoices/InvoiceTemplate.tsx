'use client';
import React, { useEffect, useState } from 'react';
import type { Invoice, CompanyProfile } from '@/types';
import AppLogo from '@/components/AppLogo';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const InvoiceTemplate = React.forwardRef<HTMLDivElement, { invoice: Invoice }>(({ invoice }, ref) => {
    const { firestore } = useFirebase();
    const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
    const { data: company } = useDoc<CompanyProfile>(companyRef);

    return (
        <div ref={ref} className="p-10 bg-white text-gray-800" style={{ width: '8.5in', minHeight: '11in' }}>
            <header className="flex justify-between items-start pb-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    {company?.logoUrl ? (
                        <img src={company.logoUrl} alt="Logo" className="h-20 w-20 object-contain" />
                    ) : (
                        <AppLogo className="h-16 w-16 text-primary" />
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{company?.tradeName || 'Go Motel'}</h1>
                        <p className="text-sm text-gray-500 font-semibold">Céd. Jurídica: {company?.legalId || 'N/D'}</p>
                        <p className="text-xs text-gray-500 max-w-xs">{company?.address || 'Costa Rica'}</p>
                        {company?.phoneNumbers && company.phoneNumbers.length > 0 && (
                            <p className="text-xs text-gray-500">Tel: {company.phoneNumbers[0].value}</p>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-semibold uppercase tracking-widest text-primary">Factura</h2>
                    <p className="font-mono text-sm font-bold">{invoice.invoiceNumber}</p>
                </div>
            </header>

            <main className="my-10">
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">FACTURAR A</p>
                        <p className="font-bold text-lg">{invoice.clientName}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">FECHA DE EMISIÓN</p>
                        <p className="font-medium">{invoice.createdAt ? format(invoice.createdAt.toDate(), "dd 'de' MMMM, yyyy", { locale: es }) : 'N/A'}</p>
                    </div>
                </div>
                
                <div className="mt-10">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-100 text-gray-600 uppercase text-[10px] tracking-widest">
                                <th className="p-3 font-bold">Descripción</th>
                                <th className="p-3 text-center font-bold">Cant.</th>
                                <th className="p-3 text-right font-bold">Precio Unit.</th>
                                <th className="p-3 text-right font-bold">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.items.map((item, index) => (
                            <tr key={index} className="border-b border-gray-100">
                                <td className="p-3 text-sm">{item.description}</td>
                                <td className="p-3 text-center text-sm">{item.quantity}</td>
                                <td className="p-3 text-right text-sm">{formatCurrency(item.unitPrice)}</td>
                                <td className="p-3 text-right font-bold text-sm">{formatCurrency(item.total)}</td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end mt-10">
                    <div className="w-full max-w-sm space-y-2 text-sm">
                        <div className="flex justify-between">
                            <p className="text-gray-500 font-medium">Subtotal:</p>
                            <p className="font-semibold">{formatCurrency(invoice.subtotal)}</p>
                        </div>
                        {invoice.taxes.map(tax => (
                            <div key={tax.taxId} className="flex justify-between">
                                <p className="text-gray-500">{tax.name} ({tax.percentage}%):</p>
                                <p>{formatCurrency(tax.amount)}</p>
                            </div>
                        ))}
                        <div className="flex justify-between font-black text-xl border-t-2 border-gray-900 mt-2 pt-2">
                            <p>Total a Pagar:</p>
                            <p>{formatCurrency(invoice.total)}</p>
                        </div>
                    </div>
                </div>
            </main>
            
            <footer className="text-center text-[10px] text-gray-400 pt-10 mt-10 border-t border-gray-200">
                <p className="font-bold">¡Gracias por su preferencia!</p>
                <p>Si tiene alguna pregunta sobre esta factura, contáctenos a través de {company?.emails?.[0]?.value || 'nuestros canales oficiales'}.</p>
            </footer>
        </div>
    );
});
InvoiceTemplate.displayName = "InvoiceTemplate";
export default InvoiceTemplate;
