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

    return (
        <div 
            ref={ref} 
            className="bg-white p-12 text-gray-900 flex flex-col" 
            style={{ 
                width: '210mm', 
                minHeight: '297mm', 
                fontFamily: 'Arial, sans-serif',
                letterSpacing: '0px',
                wordSpacing: 'normal'
            }}
        >
            {/* Membrete Contable */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                <div className="space-y-1">
                    <h1 className="text-xl font-bold text-gray-900 leading-tight">REPORTE DE VENTAS Y FACTURACIÓN</h1>
                    <p className="text-sm font-semibold text-gray-600">Control Administrativo de Ingresos</p>
                    <div className="mt-2 text-[10px] font-medium text-gray-400">
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
                        <p className="text-[8px] font-bold text-gray-400 uppercase">Generado el</p>
                        <p className="text-[10px] font-bold text-gray-800">{format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}</p>
                        <p className="text-[9px] text-gray-500">{format(new Date(), 'HH:mm:ss')} hrs</p>
                    </div>
                </div>
            </div>

            {/* Resumen Ejecutivo de Cierre */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-gray-50 border rounded-lg">
                    <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Total Neto Facturado</p>
                    <p className="text-xl font-black text-gray-900">{formatCurrency(summary.total)}</p>
                </div>
                <div className="p-4 bg-gray-50 border rounded-lg">
                    <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Cant. Transacciones</p>
                    <p className="text-xl font-black text-gray-900">{summary.count} Facturas</p>
                </div>
                <div className="p-4 bg-gray-50 border rounded-lg">
                    <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Ticket Promedio</p>
                    <p className="text-xl font-black text-gray-900">{formatCurrency(summary.count > 0 ? summary.total / summary.count : 0)}</p>
                </div>
            </div>

            {/* Desglose por Método de Pago */}
            <div className="mb-8">
                <h2 className="text-xs font-bold text-gray-800 uppercase mb-3 border-l-4 border-gray-800 pl-2">Desglose por Métodos de Pago</h2>
                <div className="grid grid-cols-4 gap-4">
                    {Object.entries(summary.byMethod).map(([method, amount]) => (
                        <div key={method} className="border-b pb-2">
                            <p className="text-[8px] font-bold text-gray-400 uppercase">{method}</p>
                            <p className="text-sm font-bold text-gray-700">{formatCurrency(amount)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabla de Detalle */}
            <div className="mb-10 flex-grow">
                <h2 className="text-xs font-bold text-gray-800 uppercase mb-3 border-l-4 border-gray-800 pl-2">Detalle Cronológico de Facturas</h2>
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
                        {invoices.map((inv, index) => (
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

            {/* Notas y Firmas */}
            <div className="mt-auto pt-12">
                <div className="grid grid-cols-2 gap-12 border-t border-gray-100 pt-8">
                    <div className="text-center space-y-4">
                        <div className="h-16 border-b border-gray-300 w-48 mx-auto"></div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-800">Firma Encargado de Recepción</p>
                            <p className="text-[8px] text-gray-400 uppercase tracking-tighter">Responsable de Caja</p>
                        </div>
                    </div>
                    <div className="text-center space-y-4">
                        <div className="h-16 border-b border-gray-300 w-48 mx-auto"></div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-800">Autorización Contabilidad</p>
                            <p className="text-[8px] text-gray-400 uppercase tracking-tighter">Validación de Ingresos</p>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center border-t pt-4">
                    <p className="text-[7px] text-gray-300 font-medium uppercase">
                        Documento administrativo interno. No válido como comprobante tributario electrónico.
                    </p>
                </div>
            </div>
        </div>
    );
});

InvoiceReportTemplate.displayName = "InvoiceReportTemplate";
export default InvoiceReportTemplate;