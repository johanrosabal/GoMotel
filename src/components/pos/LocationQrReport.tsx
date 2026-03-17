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

    // Filter and sort tables
    const sortedTables = React.useMemo(() => {
        return [...tables].sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.number.localeCompare(b.number, undefined, { numeric: true });
        });
    }, [tables]);

    // Paginate: 4 QR codes per A4 page (2x2 grid)
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
                    className="qr-pdf-page bg-white p-8 text-gray-900 grid grid-cols-2 grid-rows-2 gap-4 mb-10" 
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
                                className="w-full h-full flex flex-col items-center justify-between py-6 px-4 border-[2px] border-gray-200 rounded-[2rem] bg-white shadow-sm"
                            >
                                {/* Header Branding */}
                                <div className="text-center space-y-1">
                                    <h1 className="text-2xl font-black uppercase tracking-tighter text-gray-800 line-clamp-1">
                                        {company?.tradeName || 'Go Motel'}
                                    </h1>
                                    <div className="h-0.5 w-12 bg-primary/20 mx-auto rounded-full" />
                                </div>

                                {/* QR Section */}
                                <div className="flex flex-col items-center gap-3">
                                    <div className="p-4 bg-white border-[1.5px] border-primary/10 rounded-2xl shadow-sm">
                                        <QRCodeCanvas 
                                            value={orderUrl} 
                                            size={160}
                                            level="H"
                                            includeMargin={false}
                                        />
                                    </div>
                                    <div className="text-center max-w-full px-2">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Enlace Directo:</p>
                                        <p className="text-[9px] font-mono font-medium text-primary/60 break-all border border-primary/5 rounded-md px-2 py-1 bg-primary/[0.01] leading-tight">
                                            {orderUrl}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer Location Label */}
                                <div className="text-center w-full space-y-2">
                                    <div className="bg-primary text-primary-foreground px-6 py-2 rounded-[1.5rem] inline-block shadow-md">
                                        <span className="text-3xl font-black uppercase tracking-widest">{locationName}</span>
                                    </div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Escanee para pedir</p>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Small page indicator for 4-per-page format */}
                    <div className="absolute bottom-4 left-0 right-0 px-8 flex justify-between w-full text-[8px] font-bold text-gray-300 uppercase tracking-widest">
                        <span>Configuración de Ubicaciones - Go Motel Manager</span>
                        <span>Hoja {pageIndex + 1} de {pages.length}</span>
                    </div>
                </div>
            ))}
        </div>
    );
});

LocationQrReport.displayName = "LocationQrReport";
export default LocationQrReport;
