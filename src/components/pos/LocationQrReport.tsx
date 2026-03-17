
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

    // Paginate: 2 QR codes per A4 page for "Large" size
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
                    className="qr-pdf-page bg-white p-12 text-gray-900 flex flex-col items-center justify-around mb-10" 
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
                                className="w-full flex flex-col items-center justify-center p-8 border-4 border-dashed border-gray-300 rounded-[3rem] bg-white shadow-sm relative overflow-hidden"
                                style={{ height: '125mm' }}
                            >
                                {/* Header Branding */}
                                <div className="flex flex-col items-center gap-4 mb-8">
                                    {company?.logoUrl ? (
                                        <img src={company.logoUrl} alt="Logo" className="h-20 w-20 object-contain" />
                                    ) : (
                                        <AppLogo className="h-16 w-16 text-purple-700" />
                                    )}
                                    <h1 className="text-3xl font-black uppercase tracking-tighter text-gray-800">
                                        {company?.tradeName || 'Go Motel'}
                                    </h1>
                                </div>

                                {/* Main QR Section */}
                                <div className="flex flex-col items-center gap-6">
                                    <div className="p-6 bg-white border-8 border-purple-700 rounded-3xl shadow-xl">
                                        <QRCodeCanvas 
                                            value={orderUrl} 
                                            size={320}
                                            level="H"
                                            includeMargin={false}
                                            imageSettings={company?.logoUrl ? {
                                                src: company.logoUrl,
                                                x: undefined,
                                                y: undefined,
                                                height: 60,
                                                width: 60,
                                                excavate: true,
                                            } : undefined}
                                        />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <div className="bg-purple-700 text-white px-8 py-2 rounded-full inline-block">
                                            <span className="text-4xl font-black uppercase tracking-widest">{locationName}</span>
                                        </div>
                                        <p className="text-xl font-bold text-gray-500 uppercase tracking-widest mt-4">Escanee para pedir</p>
                                    </div>
                                </div>

                                {/* Footer Instructions */}
                                <div className="mt-8 flex flex-col items-center gap-2">
                                    <p className="text-sm font-bold text-gray-400 uppercase">Sistema de Auto-Servicio Digital</p>
                                    <div className="h-1 w-24 bg-purple-100 rounded-full" />
                                </div>
                                
                                {/* Corner Decoration */}
                                <div className="absolute top-[-20px] left-[-20px] w-20 h-20 bg-purple-700 rounded-full opacity-10" />
                                <div className="absolute bottom-[-20px] right-[-20px] w-20 h-20 bg-purple-700 rounded-full opacity-10" />
                            </div>
                        );
                    })}
                    
                    <div className="mt-auto pt-4 flex justify-between w-full text-[10px] font-bold text-gray-300 uppercase tracking-widest">
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
