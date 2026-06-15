'use client';

import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import type { RestaurantTable, CompanyProfile } from '@/types';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface LocationQrReportProps {
    tables: RestaurantTable[];
}

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

const LocationQrReport = React.forwardRef<HTMLDivElement, LocationQrReportProps>(({ tables }, ref) => {
    const { firestore } = useFirebase();
    const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
    const { data: company } = useDoc<CompanyProfile>(companyRef);

    const sortedTables = React.useMemo(() => {
        return [...tables].sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.number.localeCompare(b.number, undefined, { numeric: true });
        });
    }, [tables]);

    const pages = React.useMemo(() => {
        const limit = 1;
        const result = [];
        for (let i = 0; i < sortedTables.length; i += limit) {
            result.push(sortedTables.slice(i, i + limit));
        }
        return result;
    }, [sortedTables]);

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    return (
        <div ref={ref} className="bg-gray-100">
            {pages.map((pageTables, pageIndex) => (
                <div 
                    key={pageIndex}
                    className="qr-pdf-page bg-white p-0 text-gray-900 flex items-center justify-center mb-10 relative" 
                    style={{ 
                        width: '210mm', 
                        height: '297mm', 
                        fontFamily: 'Arial, sans-serif'
                    }}
                >
                    {pageTables.map((table) => {
                        const orderUrl = `${baseUrl}/public/order?tableId=${table.id}`;
                        const locationName = `${TYPE_LABELS[table.type] || table.type} ${table.number}`;

                        return (
                            <div 
                                key={table.id} 
                                className="w-[140mm] h-[200mm] flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-400 relative"
                            >
                                {/* Indicador de corte */}
                                <div className="absolute top-1 left-4 text-gray-400 text-xs font-bold flex items-center gap-1">
                                    <span>✂️</span> Línea de corte
                                </div>
                                {/* Contenedor Principal Centrado */}
                                <div className="w-full h-[95%] flex flex-col items-center justify-center gap-8 py-10 bg-white rounded-[2rem] border border-gray-100 shadow-lg relative overflow-hidden">
                                    {/* Adorno superior (Gradiente Premium) */}
                                    <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />
                                    
                                    {/* Header */}
                                    <div className="text-center space-y-1">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">BIENVENIDO A</p>
                                        <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900">
                                            {company?.tradeName || 'Go Motel'}
                                        </h1>
                                        <div className="h-1 w-12 bg-purple-600 mx-auto rounded-full mt-2" />
                                    </div>

                                    {/* QR Section */}
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="p-4 bg-white border-2 border-gray-100 rounded-3xl shadow-xl">
                                            <QRCodeCanvas 
                                                value={orderUrl} 
                                                size={170}
                                                level="H"
                                                includeMargin={false}
                                            />
                                        </div>
                                        <div className="text-center max-w-[180px]">
                                            <p className="text-[8px] font-mono font-medium text-gray-400 break-all leading-tight">
                                                {orderUrl}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Footer Label */}
                                    <div className="text-center w-full space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">ORDENA DESDE TU CELULAR</p>
                                        <h2 className="text-5xl font-black uppercase tracking-tighter text-slate-900">
                                            {locationName}
                                        </h2>
                                        <p className="text-[11px] font-bold text-gray-600 mt-2">Escanea el código QR para pedir</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    <div className="absolute bottom-4 left-0 right-0 px-8 flex justify-between w-full text-[10px] font-bold text-gray-300 uppercase tracking-widest pointer-events-none">
                        <span>Go Motel Manager - Hoja {pageIndex + 1} de {pages.length}</span>
                    </div>
                </div>
            ))}
        </div>
    );
});

LocationQrReport.displayName = "LocationQrReport";
export default LocationQrReport;