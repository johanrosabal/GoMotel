
'use client';

import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import type { RestaurantTable, CompanyProfile } from '@/types';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import AppLogo from '@/components/AppLogo';
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
                    className="qr-pdf-page bg-white p-8 text-gray-900 flex flex-col items-center justify-center gap-12 mb-10" 
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
                                className="w-full flex flex-col items-center justify-between py-12 px-8 border-[6px] border-dashed border-gray-300 rounded-[4rem] bg-white relative"
                                style={{ height: '125mm', width: '180mm' }}
                            >
                                {/* Header Branding */}
                                <div className="flex flex-col items-center gap-2">
                                    {company?.logoUrl ? (
                                        <img src={company.logoUrl} alt="Logo" className="h-16 w-16 object-contain" />
                                    ) : (
                                        <AppLogo className="h-12 w-12 text-primary" />
                                    )}
                                    <h1 className="text-3xl font-black uppercase tracking-tighter text-gray-800 text-center">
                                        {company?.tradeName || 'Go Motel'}
                                    </h1>
                                    <div className="h-1 w-20 bg-primary/20 rounded-full" />
                                </div>

                                {/* Main QR Section */}
                                <div className="flex flex-col items-center gap-6">
                                    <div className="p-5 bg-white border-4 border-primary rounded-3xl shadow-xl">
                                        <QRCodeCanvas 
                                            value={orderUrl} 
                                            size={280}
                                            level="H"
                                            includeMargin={false}
                                            imageSettings={company?.logoUrl ? {
                                                src: company.logoUrl,
                                                x: undefined,
                                                y: undefined,
                                                height: 50,
                                                width: 50,
                                                excavate: true,
                                            } : undefined}
                                        />
                                    </div>
                                </div>

                                {/* Footer Info */}
                                <div className="text-center space-y-4 w-full">
                                    <div className="bg-primary text-primary-foreground px-12 py-3 rounded-2xl inline-block shadow-lg">
                                        <span className="text-5xl font-black uppercase tracking-widest leading-none">{locationName}</span>
                                    </div>
                                    <p className="text-xl font-bold text-gray-400 uppercase tracking-[0.3em]">Escanee para pedir</p>
                                </div>
                                
                                {/* Corner Decorations - Small and subtle to avoid clipping */}
                                <div className="absolute top-6 left-6 w-12 h-12 border-t-4 border-l-4 border-primary/10 rounded-tl-2xl" />
                                <div className="absolute bottom-6 right-6 w-12 h-12 border-b-4 border-r-4 border-primary/10 rounded-br-2xl" />
                            </div>
                        );
                    })}
                    
                    <div className="mt-auto pt-4 flex justify-between w-full text-[9px] font-bold text-gray-300 uppercase tracking-widest border-t border-gray-100">
                        <span>Documento de Configuración Operativa - Go Motel Manager</span>
                        <span>Página {pageIndex + 1} de {pages.length}</span>
                    </div>
                </div>
            ))}
        </div>
    );
});

LocationQrReport.displayName = "LocationQrReport";
export default LocationQrReport;
