
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
        <div ref={ref} className="bg-gray-100">
            {pages.map((pageTables, pageIndex) => (
                <div 
                    key={pageIndex}
                    className="qr-pdf-page bg-white p-10 text-gray-900 flex flex-col items-center justify-around gap-8 mb-10" 
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
                                className="w-[180mm] h-[130mm] flex flex-col items-center justify-between py-10 px-8 border-[3px] border-gray-200 rounded-[3rem] bg-white shadow-sm"
                            >
                                {/* Header Branding */}
                                <div className="text-center space-y-2">
                                    <h1 className="text-4xl font-black uppercase tracking-tighter text-gray-800">
                                        {company?.tradeName || 'Go Motel'}
                                    </h1>
                                    <div className="h-1 w-24 bg-primary/20 mx-auto rounded-full" />
                                </div>

                                {/* QR Section */}
                                <div className="flex flex-col items-center gap-4">
                                    <div className="p-6 bg-white border-[2px] border-primary/10 rounded-3xl shadow-sm">
                                        <QRCodeCanvas 
                                            value={orderUrl} 
                                            size={220}
                                            level="H"
                                            includeMargin={false}
                                        />
                                    </div>
                                    <div className="text-center max-w-[140mm]">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Enlace Directo:</p>
                                        <p className="text-[11px] font-mono font-medium text-primary/60 break-all border border-primary/5 rounded-lg px-4 py-1.5 bg-primary/[0.02]">
                                            {orderUrl}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer Location Label */}
                                <div className="text-center w-full space-y-4">
                                    <div className="bg-primary text-primary-foreground px-12 py-4 rounded-[2rem] inline-block shadow-lg">
                                        <span className="text-5xl font-black uppercase tracking-widest">{locationName}</span>
                                    </div>
                                    <p className="text-xl font-bold text-gray-400 uppercase tracking-[0.3em]">Escanee para pedir</p>
                                </div>
                            </div>
                        );
                    })}
                    
                    <div className="mt-auto pt-4 flex justify-between w-full text-[9px] font-bold text-gray-300 uppercase tracking-widest border-t border-gray-100">
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
