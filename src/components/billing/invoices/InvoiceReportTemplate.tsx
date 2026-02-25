'use client';

import React from 'react';
import type { Invoice, CompanyProfile } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

interface InvoiceReportTemplateProps {
    invoices: Invoice[];
    dateRange: { from: Date | undefined; to: Date | undefined };
}

const InvoiceReportTemplate = React.forwardRef<HTMLDivElement, InvoiceReportTemplateProps>(({ invoices, dateRange }, ref) => {
    const { firestore } = useFirebase();
    const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
    const { data: company } = useDoc<CompanyProfile>(companyRef);

    const summary = React.useMemo(() => {
        const total = invoices.filter(inv => inv.status === 'Pagada').reduce((sum, inv) => sum + inv.total, 0);
        const count = invoices.length;
        
        const byMethod = invoices.reduce((acc, inv) => {
            const method = inv.paymentMethod || 'Otros';
            acc[method] = (acc[method] || 0) + inv.total;
            return acc;
        }, {} as Record<string, number>);

        return { total, count, byMethod };
    }, [invoices]);

    // Lógica de Paginación: 18 filas en la primera (por el resumen), 30 en las siguientes
    const pages = React.useMemo(() => {
        const firstPageLimit = 18;
        const otherPageLimit = 28;
        const result = [];
        
        if (invoices.length <= firstPageLimit) {
            result.push(invoices);
        } else {
            result.push(invoices.slice(0, firstPageLimit));
            for (let i = firstPageLimit; i < invoices.length; i += otherPageLimit) {
                result.push(invoices.slice(i, i + otherPageLimit));
            }
        }
        return result;
    }, [invoices]);

    const Header = () => (
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
            <div className="space-y-1">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">REPORTE DE VENTAS Y FACTURACIÓN</h1>
                <p className="text-sm font-semibold text-gray-600">Control Administrativo de Ingresos</p>
                <div className="mt-1 text-[10px] font-medium text-gray-400">
                    <p>{company?.tradeName || 'Go Motel'} - Sistema de Gestión</p>
                </div>
            </div>
            <div className="text-right space-y-1">
                <div className="bg-gray-50 p-2 rounded border border-gray-200">
                    <p className="text-[8px] font-bold text-gray-400 uppercase">Período del Reporte</p>
                    <p className="text-[10px] font-bold text-gray-700">
                        {dateRange.from ? format(dateRange.from, 'dd/MM/yyyy') : 'Inicio'} al {dateRange.to ? format(dateRange.to, 'dd/MM/yyyy') : 'Actualidad'}
                    </p>
                </div>
                <div className="pr-1">
                    <p className="text-[8px] font-bold text-gray-400 uppercase">Emitido el</p>
                    <p className="text-[9px] font-bold text-gray-800">{format(new Date(), "dd/MM/yyyy HH:mm:ss")}</p>
                </div>
            </div>
        </div>
    );

    return (
        <div ref={ref} style={{ letterSpacing: '0px', wordSpacing: 'normal' }}>
            {pages.map((pageInvoices, pageIndex) => (
                <div 
                    key={pageIndex}
                    className="invoice-pdf-page bg-white p-12 text-gray-900 flex flex-col mb-10" 
                    style={{ 
                        width: '210mm', 
                        height: '297mm', 
                        fontFamily: 'Arial, sans-serif',
                        boxShadow: 'none'
                    }}
                >
                    <Header />

                    {/* Resumen solo en la primera página */}
                    {pageIndex === 0 && (
                        <>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="p-3 bg-gray-50 border rounded-lg">
                                    <p className="text-[8px] font-bold text-gray-500 uppercase mb-1">Total Neto Facturado</p>
                                    <p className="text-lg font-black text-gray-900">{formatCurrency(summary.total)}</p>
                                </div>
                                <div className="p-3 bg-gray-50 border rounded-lg">
                                    <p className="text-[8px] font-bold text-gray-500 uppercase mb-1">Transacciones</p>
                                    <p className="text-lg font-black text-gray-900">{summary.count} Facturas</p>
                                </div>
                                <div className="p-3 bg-gray-50 border rounded-lg">
                                    <p className="text-[8px] font-bold text-gray-500 uppercase mb-1">Ticket Promedio</p>
                                    <p className="text-lg font-black text-gray-900">{formatCurrency(summary.count > 0 ? summary.total / summary.count : 0)}</p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h2 className="text-[10px] font-bold text-gray-800 uppercase mb-2 border-l-4 border-gray-800 pl-2">Desglose por Métodos de Pago</h2>
                                <div className="grid grid-cols-4 gap-4">
                                    {Object.entries(summary.byMethod).map(([method, amount]) => (
                                        <div key={method} className="border-b pb-1">
                                            <p className="text-[8px] font-bold text-gray-400 uppercase">{method}</p>
                                            <p className="text-xs font-bold text-gray-700">{formatCurrency(amount)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Tabla de Detalle */}
                    <div className="flex-grow">
                        <h2 className="text-[10px] font-bold text-gray-800 uppercase mb-2 border-l-4 border-gray-800 pl-2">
                            Detalle de Facturas {pages.length > 1 && `(Parte ${pageIndex + 1})`}
                        </h2>
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-800 text-white text-left">
                                    <th className="p-2 border border-gray-800 text-[9px] font-bold">FECHA / HORA</th>
                                    <th className="p-2 border border-gray-800 text-[9px] font-bold">NÚMERO FACTURA</th>
                                    <th className="p-2 border border-gray-800 text-[9px] font-bold">CLIENTE</th>
                                    <th className="p-2 border border-gray-800 text-[9px] font-bold">MÉTODO</th>
                                    <th className="p-2 border border-gray-800 text-[9px] font-bold text-right">MONTO TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageInvoices.map((inv, index) => (
                                    <tr key={inv.id} className={cn("text-[9px]", index % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                                        <td className="p-2 border border-gray-200 text-gray-600">
                                            {format(inv.createdAt.toDate(), 'dd/MM/yyyy HH:mm')}
                                        </td>
                                        <td className="p-2 border border-gray-200 font-mono font-bold text-gray-800">{inv.invoiceNumber}</td>
                                        <td className="p-2 border border-gray-200 text-gray-700">{inv.clientName}</td>
                                        <td className="p-2 border border-gray-200 text-gray-600">{inv.paymentMethod}</td>
                                        <td className="p-2 border border-gray-200 text-right font-bold text-gray-900">
                                            {formatCurrency(inv.total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Firmas solo en la última página */}
                    {pageIndex === pages.length - 1 && (
                        <div className="pt-8 border-t border-gray-100 mt-6">
                            <div className="grid grid-cols-2 gap-12">
                                <div className="text-center space-y-2">
                                    <div className="h-12 border-b border-gray-300 w-48 mx-auto"></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-800">Firma Encargado de Recepción</p>
                                        <p className="text-[8px] text-gray-400 uppercase tracking-tighter">Responsable de Caja</p>
                                    </div>
                                </div>
                                <div className="text-center space-y-2">
                                    <div className="h-12 border-b border-gray-300 w-48 mx-auto"></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-800">Autorización Contabilidad</p>
                                        <p className="text-[8px] text-gray-400 uppercase tracking-tighter">Validación de Ingresos</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pie de página con numeración */}
                    <div className="mt-4 pt-4 border-t flex justify-between items-center text-[8px] text-gray-400 font-bold uppercase">
                        <span>Documento administrativo interno - Go Motel Manager</span>
                        <span>Página {pageIndex + 1} de {pages.length}</span>
                    </div>
                </div>
            ))}
        </div>
    );
});

InvoiceReportTemplate.displayName = "InvoiceReportTemplate";
export default InvoiceReportTemplate;