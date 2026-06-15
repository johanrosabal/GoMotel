'use client';

import React, { useState } from 'react';
import { useFirebase, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Order } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, ArrowLeft, Search, Download, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function FinesReportPage() {
    const { firestore } = useFirebase();
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const finesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'orders'),
            where('type', '==', 'Multa'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore]);

    const { data: fines, isLoading } = useCollection<Order>(finesQuery);

    const filteredFines = fines?.filter(fine => {
        // Search check
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = (
                fine.label?.toLowerCase().includes(searchLower) ||
                fine.locationLabel?.toLowerCase().includes(searchLower) ||
                fine.items[0]?.name.toLowerCase().includes(searchLower)
            );
            if (!matchesSearch) return false;
        }

        // Date check
        if (startDate || endDate) {
            if (!(fine.createdAt instanceof Timestamp)) return true;
            const fineDate = fine.createdAt.toDate();
            // Reset hours for accurate date comparison
            fineDate.setHours(0, 0, 0, 0);

            if (startDate) {
                const sDate = new Date(startDate + 'T00:00:00');
                if (fineDate < sDate) return false;
            }
            if (endDate) {
                const eDate = new Date(endDate + 'T00:00:00');
                if (fineDate > eDate) return false;
            }
        }

        return true;
    });

    const totalFinesValue = filteredFines?.reduce((sum, fine) => sum + fine.total, 0) || 0;

    const exportToPDF = () => {
        if (!filteredFines || filteredFines.length === 0) return;

        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text('Reporte de Multas', 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        let subtitle = `Total de Multas: ${filteredFines.length} | Monto Total: ${formatCurrency(totalFinesValue)}`;
        if (startDate && endDate) {
            subtitle += ` | Desde: ${startDate} Hasta: ${endDate}`;
        } else if (startDate) {
            subtitle += ` | Desde: ${startDate}`;
        } else if (endDate) {
            subtitle += ` | Hasta: ${endDate}`;
        }
        doc.text(subtitle, 14, 30);

        const tableColumn = ["Fecha", "Habitación", "Cliente", "Descripción", "Pago", "Monto"];
        const tableRows: any[] = [];

        filteredFines.forEach(fine => {
            const fineData = [
                fine.createdAt instanceof Timestamp ? fine.createdAt.toDate().toLocaleDateString('es-CR') : 'N/A',
                fine.locationLabel || 'N/A',
                fine.label || 'Desconocido',
                fine.items[0]?.name.replace('Multa: ', '') || 'Sin descripción',
                fine.paymentMethod || 'Pagado',
                formatCurrency(fine.total)
            ];
            tableRows.push(fineData);
        });

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'striped',
            headStyles: { fillColor: [225, 29, 72] } // rose-600 color to match app branding
        });

        doc.save(`reporte-multas-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10">
                                <ArrowLeft className="h-4 w-4 text-slate-400" />
                            </Button>
                        </Link>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                            <AlertTriangle className="h-8 w-8 text-rose-500" />
                            Reporte de Multas
                        </h2>
                    </div>
                    <p className="text-slate-500 font-medium tracking-wide ml-11">
                        Historial de todas las multas registradas en el sistema.
                    </p>
                </div>

                <Button 
                    onClick={exportToPDF}
                    disabled={!filteredFines || filteredFines.length === 0}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-widest text-xs h-10 px-6 rounded-xl shadow-lg shadow-rose-600/20"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar a PDF
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
                <Card className="bg-slate-950/50 border-white/5 backdrop-blur-xl">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Total Multas
                        </CardTitle>
                        <FileText className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tighter text-white">
                            {filteredFines?.length || 0}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-950/50 border-white/5 backdrop-blur-xl">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Valor Total
                        </CardTitle>
                        <span className="text-sm text-emerald-500 font-black">₡</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tighter text-emerald-400">
                            {formatCurrency(totalFinesValue)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-950/50 border-white/5 backdrop-blur-xl overflow-hidden">
                <div className="p-4 border-b border-white/5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Buscar por cliente, habitación..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 bg-white/5 border-white/10 rounded-xl w-full"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 h-10 w-full md:w-auto">
                            <span className="text-xs font-bold text-slate-400 mr-2 uppercase">Desde:</span>
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent border-none text-sm text-white focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                            />
                        </div>
                        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 h-10 w-full md:w-auto">
                            <span className="text-xs font-bold text-slate-400 mr-2 uppercase">Hasta:</span>
                            <input 
                                type="date" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent border-none text-sm text-white focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fecha</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Habitación</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cliente</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descripción</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pago</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Monto</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-white/5">
                                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Cargando...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredFines?.length === 0 ? (
                                <TableRow className="border-white/5">
                                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                                        <span className="text-xs font-bold uppercase tracking-widest">No hay multas registradas en este rango.</span>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredFines?.map((fine) => (
                                    <TableRow key={fine.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-300">
                                                    {fine.createdAt instanceof Timestamp ? fine.createdAt.toDate().toLocaleDateString('es-CR') : 'N/A'}
                                                </span>
                                                <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {fine.createdAt instanceof Timestamp ? fine.createdAt.toDate().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-white/5 border-white/10 text-white font-mono uppercase tracking-widest text-[10px]">
                                                {fine.locationLabel || 'N/A'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm font-bold text-white">{fine.label || 'Desconocido'}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-slate-400">
                                                {fine.items[0]?.name.replace('Multa: ', '') || 'Sin descripción'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
                                                {fine.paymentMethod || 'Pagado'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="text-lg font-black text-rose-400 tracking-tighter">
                                                {formatCurrency(fine.total)}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
