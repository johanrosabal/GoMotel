
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

    // Paginate: 2 QR codes per A4 page
    const pages = React.useMemo(() => {
        const limit = 2;
        const result = [];
        for (let i = 0; i < sortedTables.length; i += limit) {
            result.push(sortedTables.slice(i, i + limit));
        }
        return result;
    }, [sortedTables]);

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    return (
        <div ref={ref} className="bg-gray-50">
            {pages.map((pageTables, pageIndex) => (
                <div 
                    key={pageIndex}
                    className="qr-pdf-page bg-white p-12 text-gray-900 flex flex-col items-center justify-center gap-16 mb-10" 
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
                                className="w-full flex flex-col items-center justify-between py-16 px-10 border-[4px] border-dashed border-gray-200 rounded-[5rem] bg-white relative"
                                style={{ height: '120mm', width: '185mm' }}
                            >
                                {/* Header Branding */}
                                <div className="flex flex-col items-center gap-4">
                                    <h1 className="text-4xl font-black uppercase tracking-tighter text-gray-800 text-center">
                                        {company?.tradeName || 'Go Motel'}
                                    </h1>
                                    <div className="h-1.5 w-32 bg-primary/30 rounded-full" />
                                </div>

                                {/* Main QR Section - No logos for maximum scan area */}
                                <div className="flex flex-col items-center justify-center py-6">
                                    <div className="p-8 bg-white border-[4px] border-primary rounded-[3rem] shadow-2xl">
                                        <QRCodeCanvas 
                                            value={orderUrl} 
                                            size={300}
                                            level="H"
                                            includeMargin={false}
                                        />
                                    </div>
                                </div>

                                {/* Footer Info - Generous spacing to avoid overlap */}
                                <div className="text-center space-y-6 w-full">
                                    <div className="bg-primary text-primary-foreground px-16 py-5 rounded-[2.5rem] inline-block shadow-2xl">
                                        <span className="text-6xl font-black uppercase tracking-widest leading-none">{locationName}</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-400 uppercase tracking-[0.4em] pt-4">Escanee para pedir</p>
                                </div>
                                
                                {/* Decoration corners */}
                                <div className="absolute top-10 left-10 w-16 h-16 border-t-8 border-l-8 border-primary/5 rounded-tl-[3rem]" />
                                <div className="absolute bottom-10 right-10 w-16 h-16 border-b-8 border-r-8 border-primary/5 rounded-br-[3rem]" />
                            </div>
                        );
                    })}
                    
                    <div className="mt-auto pt-6 flex justify-between w-full text-[10px] font-bold text-gray-300 uppercase tracking-widest border-t border-gray-100">
                        <span>Configuración de Ubicaciones - Go Motel Manager</span>
                        <span>Página {pageIndex + 1} de {pages.length}</span>
                    </div>
                </div>
            ))}
        </div>
    );
});

LocationQrReport.displayName = "LocationQrReport";
export default LocationQrReport;
