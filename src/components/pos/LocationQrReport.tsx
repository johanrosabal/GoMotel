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
        const limit = 4;
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
                    className="qr-pdf-page bg-white p-0 text-gray-900 grid grid-cols-2 grid-rows-2 mb-10" 
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
                                className="w-full h-full flex flex-col items-center justify-center border-[0.5px] border-gray-100 p-8"
                            >
                                {/* Contenedor Principal Centrado */}
                                <div className="w-full flex flex-col items-center gap-8 py-10 bg-white rounded-[3rem] border-2 border-gray-100 shadow-sm">
                                    {/* Header */}
                                    <div className="text-center space-y-2">
                                        <h1 className="text-2xl font-black uppercase tracking-tight text-gray-800">
                                            {company?.tradeName || 'Go Motel'}
                                        </h1>
                                        <div className="h-1 w-12 bg-primary/20 mx-auto rounded-full" />
                                    </div>

                                    {/* QR Section */}
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="p-5 bg-white border-4 border-primary/5 rounded-[2.5rem] shadow-sm">
                                            <QRCodeCanvas 
                                                value={orderUrl} 
                                                size={180}
                                                level="H"
                                                includeMargin={false}
                                            />
                                        </div>
                                        <div className="text-center max-w-[180px]">
                                            <p className="text-[10px] font-mono font-bold text-primary/40 break-all leading-tight">
                                                {orderUrl}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Footer Label - ESTILO ACTUALIZADO A TÍTULO NORMAL */}
                                    <div className="text-center w-full space-y-1">
                                        <h2 className="text-4xl font-black uppercase tracking-widest text-primary">
                                            {locationName}
                                        </h2>
                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Escanee para pedir</p>
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