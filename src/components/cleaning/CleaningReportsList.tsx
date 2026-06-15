'use client';

import { useState, useMemo } from 'react';
import { useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Skeleton } from "../ui/skeleton";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AlertTriangle, Check, ShieldAlert, Smartphone, Calendar, User, FileText, Search, Filter, X, Download } from "lucide-react";
import { format, isToday, isThisMonth, subMonths } from "date-fns";
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Timestamp } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CleaningReport {
    id: string;
    roomId: string;
    roomNumber: string;
    lastStayId: string | null;
    remoteControlRecovered: boolean;
    roomCondition: 'Perfecto' | 'Daños' | 'Problemas';
    notes?: string;
    images?: string[];
    reportedBy: string;
    createdAt: Timestamp;
}

export default function CleaningReportsList() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCondition, setFilterCondition] = useState<string>('Todas');
    const [filterControl, setFilterControl] = useState<string>('Todos');
    const [filterDate, setFilterDate] = useState<string>('Hoy');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const monthsOptions = useMemo(() => Array.from({ length: 6 }).map((_, i) => {
        const d = subMonths(new Date(), i);
        return {
            value: format(d, 'yyyy-MM'),
            label: format(d, 'MMMM yyyy', { locale: es })
        };
    }), []);

    const cleaningReportsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, "cleaningReports"),
            orderBy('createdAt', 'desc')
        );
    }, [firestore]);

    const { data: reports, isLoading, error } = useCollection<CleaningReport>(cleaningReportsQuery);

    if (error) {
        return (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl">
                Error al cargar los reportes: {error.message}
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-48 rounded-[2rem] bg-white/5 animate-pulse border border-white/10" />
                ))}
            </div>
        )
    }

    if (!reports || reports.length === 0) {
        return (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 bg-black/20 backdrop-blur-sm rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-6"
            >
                <div className="relative">
                    <div className="absolute inset-0 blur-3xl bg-slate-500/20 animate-pulse" />
                    <FileText className="h-16 w-16 text-slate-400 relative z-10" />
                </div>
                <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-200">Sin Reportes</h3>
                    <p className="text-slate-500 mt-2 font-medium">
                        No hay reportes de limpieza registrados.
                    </p>
                </div>
            </motion.div>
        )
    }

    const filteredReports = reports?.filter(report => {
        const matchesSearch = report.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (report.notes && report.notes.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCondition = filterCondition === 'Todas' || report.roomCondition === filterCondition;
        const matchesControl = filterControl === 'Todos' || 
                               (filterControl === 'Sí' && report.remoteControlRecovered) || 
                               (filterControl === 'No' && !report.remoteControlRecovered);
        
        let matchesDate = true;
        if (report.createdAt) {
            const reportDate = report.createdAt.toDate();
            if (filterDate === 'Hoy') {
                matchesDate = isToday(reportDate);
            } else if (filterDate === 'Este Mes') {
                matchesDate = isThisMonth(reportDate);
            } else if (filterDate !== 'Todos') {
                matchesDate = format(reportDate, 'yyyy-MM') === filterDate;
            }
        }
        
        return matchesSearch && matchesCondition && matchesControl && matchesDate;
    }) || [];

    const exportToPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.text('Historial de Reportes de Limpieza', 14, 22);
        doc.setFontSize(11);
        doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);
        
        const tableColumn = ["Habitación", "Fecha", "Estado", "Control", "Notas", "Reportado por"];
        const tableRows: any[] = [];

        filteredReports.forEach(report => {
            const reportData = [
                `Hab. ${report.roomNumber}`,
                report.createdAt ? format(report.createdAt.toDate(), "dd/MM/yyyy HH:mm") : '-',
                report.roomCondition,
                report.remoteControlRecovered ? "Recuperado" : "No Recuperado",
                report.notes || 'N/A',
                report.reportedBy
            ];
            tableRows.push(reportData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255 }
        });

        doc.save(`reportes_limpieza_${format(new Date(), "yyyy_MM_dd")}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-4 bg-slate-900/50 p-5 rounded-3xl border border-white/5 shadow-inner">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input 
                        placeholder="Buscar por número de habitación o palabra clave en las notas..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-14 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-2xl focus-visible:ring-amber-500/20 text-base font-medium"
                    />
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Select value={filterDate} onValueChange={setFilterDate}>
                        <SelectTrigger className="w-full sm:w-[180px] h-14 bg-white/5 border-white/10 text-white rounded-2xl focus:ring-amber-500/20 font-bold">
                            <Calendar className="w-4 h-4 mr-2 opacity-50" />
                            <SelectValue placeholder="Fecha" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 rounded-2xl text-white max-h-80">
                            <SelectItem value="Hoy" className="py-3 font-bold">Hoy</SelectItem>
                            <SelectItem value="Este Mes" className="py-3 font-bold text-slate-300">Este Mes</SelectItem>
                            {monthsOptions.slice(1).map(month => (
                                <SelectItem key={month.value} value={month.value} className="py-3 font-bold capitalize text-slate-400">
                                    {month.label}
                                </SelectItem>
                            ))}
                            <SelectItem value="Todos" className="py-3 font-bold text-amber-400">Todo el Histórico</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterCondition} onValueChange={setFilterCondition}>
                        <SelectTrigger className="w-full sm:w-[200px] h-14 bg-white/5 border-white/10 text-white rounded-2xl focus:ring-amber-500/20 font-bold">
                            <Filter className="w-4 h-4 mr-2 opacity-50" />
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 rounded-2xl text-white">
                            <SelectItem value="Todas" className="py-3 font-bold">Todos los estados</SelectItem>
                            <SelectItem value="Perfecto" className="py-3 font-bold text-emerald-400">Todo Perfecto</SelectItem>
                            <SelectItem value="Daños" className="py-3 font-bold text-amber-400">Daños Menores</SelectItem>
                            <SelectItem value="Problemas" className="py-3 font-bold text-rose-500">Problemas Graves</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    <Select value={filterControl} onValueChange={setFilterControl}>
                        <SelectTrigger className="w-full sm:w-[200px] h-14 bg-white/5 border-white/10 text-white rounded-2xl focus:ring-amber-500/20 font-bold">
                            <Smartphone className="w-4 h-4 mr-2 opacity-50" />
                            <SelectValue placeholder="Control" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 rounded-2xl text-white">
                            <SelectItem value="Todos" className="py-3 font-bold">Cualquier Control</SelectItem>
                            <SelectItem value="Sí" className="py-3 font-bold text-slate-300">Recuperado</SelectItem>
                            <SelectItem value="No" className="py-3 font-bold text-rose-400">No Recuperado</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    <Button onClick={exportToPDF} className="h-14 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-2xl px-6 transition-all active:scale-95 shadow-xl">
                        <Download className="mr-2 h-5 w-5" />
                        Exportar PDF
                    </Button>
                </div>
            </div>

            {filteredReports.length === 0 ? (
                <div className="text-center py-16 bg-white/5 rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-4">
                    <Filter className="h-12 w-12 text-slate-600 mb-2" />
                    <p className="text-xl font-bold text-slate-300">No se encontraron resultados.</p>
                    <p className="text-slate-500 font-medium">Intenta ajustar los filtros de búsqueda.</p>
                </div>
            ) : (
                <>
                {/* Mobile View: Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:hidden">
                    <AnimatePresence mode="popLayout">
                        {filteredReports.map((report) => {
                    const isPerfect = report.roomCondition === 'Perfecto';
                    const isDamage = report.roomCondition === 'Daños';
                    const isProblem = report.roomCondition === 'Problemas';
                    
                    return (
                        <motion.div 
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            key={report.id}
                            className="group/card"
                        >
                            <Card className={cn(
                                "relative transition-all duration-300 flex flex-col h-full",
                                "bg-slate-950/40 backdrop-blur-2xl border",
                                "rounded-[2rem] shadow-xl overflow-hidden",
                                isPerfect ? "border-emerald-500/20" : 
                                isDamage ? "border-amber-500/30" : 
                                "border-rose-500/30"
                            )}>
                                <div className={cn(
                                    "absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent to-transparent opacity-30",
                                    isPerfect ? "via-emerald-400" : 
                                    isDamage ? "via-amber-400" : 
                                    "via-rose-500"
                                )} />
                                
                                <CardHeader className="pb-3 p-6 shrink-0 border-b border-white/5">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <CardTitle className="text-3xl font-black uppercase italic tracking-tighter text-white">
                                                Hab. {report.roomNumber}
                                            </CardTitle>
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <Calendar className="h-3 w-3" />
                                                <span className="text-xs font-medium">
                                                    {report.createdAt ? format(report.createdAt.toDate(), "dd MMM yyyy, hh:mm a", { locale: es }) : 'Desconocido'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className={cn(
                                            "p-2.5 rounded-xl border",
                                            isPerfect ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : 
                                            isDamage ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : 
                                            "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                        )}>
                                            {isPerfect ? <Check className="h-5 w-5" /> : 
                                             isDamage ? <AlertTriangle className="h-5 w-5" /> : 
                                             <ShieldAlert className="h-5 w-5" />}
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4 p-6 grow flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                            isPerfect ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : 
                                            isDamage ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : 
                                            "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                        )}>
                                            {report.roomCondition}
                                        </div>
                                        
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                            report.remoteControlRecovered ? "bg-slate-800 border-white/10 text-slate-300" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                        )}>
                                            {report.remoteControlRecovered ? (
                                                <><Smartphone className="h-3 w-3" /> Control Recuperado</>
                                            ) : (
                                                <><AlertTriangle className="h-3 w-3" /> Control No Recuperado</>
                                            )}
                                        </div>
                                    </div>

                                    {report.notes && (
                                        <div className="bg-white/5 border border-white/5 rounded-xl p-3 grow">
                                            <p className="text-sm text-slate-300 font-medium whitespace-pre-wrap">
                                                {report.notes}
                                            </p>
                                        </div>
                                    )}

                                    {report.images && report.images.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {report.images.map((url, idx) => (
                                                <button type="button" onClick={() => setSelectedImage(url)} key={idx} className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-amber-500/50 hover:scale-105 transition-all block focus:outline-none focus:ring-2 focus:ring-amber-500/50">
                                                    <img src={url} alt={`Respaldo ${idx + 1}`} className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1.5 text-slate-500 mt-auto pt-2">
                                        <User className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">Reportado por: <span className="text-slate-300">{report.reportedBy}</span></span>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
            </div>

                {/* Desktop View: Table */}
                <div className="hidden lg:block rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-2xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-900/50">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400">Habitación</TableHead>
                                <TableHead className="text-slate-400">Fecha</TableHead>
                                <TableHead className="text-slate-400">Estado</TableHead>
                                <TableHead className="text-slate-400">Control</TableHead>
                                <TableHead className="text-slate-400">Notas / Evidencia</TableHead>
                                <TableHead className="text-slate-400 text-right">Reportado por</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredReports.map((report) => {
                                const isPerfect = report.roomCondition === 'Perfecto';
                                const isDamage = report.roomCondition === 'Daños';
                                const isProblem = report.roomCondition === 'Problemas';
                                return (
                                    <TableRow key={report.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                        <TableCell className="font-bold text-white text-base">Hab. {report.roomNumber}</TableCell>
                                        <TableCell className="text-slate-300 whitespace-nowrap">
                                            {report.createdAt ? format(report.createdAt.toDate(), "dd MMM yyyy, hh:mm a", { locale: es }) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn("border py-1 px-2.5 rounded-full text-xs font-black uppercase tracking-widest", isPerfect ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : isDamage ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400")}>
                                                {report.roomCondition}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn("border py-1 px-2.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5 w-fit", report.remoteControlRecovered ? "bg-slate-800 border-white/10 text-slate-300" : "bg-rose-500/10 border-rose-500/20 text-rose-400")}>
                                                {report.remoteControlRecovered ? (
                                                    <><Smartphone className="h-3 w-3" /> Recuperado</>
                                                ) : (
                                                    <><AlertTriangle className="h-3 w-3" /> No Recuperado</>
                                                )}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[250px]">
                                            {report.notes && <p className="text-sm text-slate-300 truncate mb-1.5" title={report.notes}>{report.notes}</p>}
                                            {report.images && report.images.length > 0 && (
                                                <div className="flex gap-1.5">
                                                    {report.images.map((url, idx) => (
                                                        <button type="button" onClick={() => setSelectedImage(url)} key={idx} className="w-8 h-8 rounded-md overflow-hidden border border-white/10 hover:border-amber-500/50 hover:scale-105 transition-all">
                                                            <img src={url} alt={`img-${idx}`} className="w-full h-full object-cover" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-slate-300 text-sm font-semibold">{report.reportedBy}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
                </>
            )}

            <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
                <DialogContent className="max-w-4xl bg-transparent border-none p-0 overflow-hidden flex flex-col items-center justify-center shadow-none [&>button]:hidden">
                    <button type="button" onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 z-50 p-3 bg-black/60 hover:bg-black/90 rounded-full text-white transition-colors border border-white/10 backdrop-blur-md">
                        <X className="h-6 w-6" />
                    </button>
                    {selectedImage && (
                        <motion.img 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            src={selectedImage} 
                            alt="Evidencia en grande" 
                            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10" 
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
