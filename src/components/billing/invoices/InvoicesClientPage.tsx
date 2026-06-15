'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Invoice } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import InvoicesTable from "./InvoicesTable";
import { useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
    Calendar as CalendarIcon, 
    Download, 
    Search, 
    X
} from "lucide-react";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { 
    format, 
    startOfDay, 
    endOfDay, 
    subDays, 
    startOfMonth, 
    isWithinInterval 
} from "date-fns";
import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import InvoiceReportTemplate from "./InvoiceReportTemplate";

type Period = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom' | 'all';

const days = Array.from({ length: 31 }, (_, i) => i + 1);
const months = [
    { value: 0, label: 'Ene' },
    { value: 1, label: 'Feb' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Abr' },
    { value: 4, label: 'May' },
    { value: 5, label: 'Jun' },
    { value: 6, label: 'Jul' },
    { value: 7, label: 'Ago' },
    { value: 8, label: 'Sep' },
    { value: 9, label: 'Oct' },
    { value: 10, label: 'Nov' },
    { value: 11, label: 'Dic' },
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

export default function InvoicesClientPage() {
    const { firestore } = useFirebase();
    const [searchTerm, setSearchTerm] = useState('');
    const [period, setPeriod] = useState<Period>('all');
    const [isExporting, setIsExporting] = useState(false);
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    const handleDatePartChange = (target: 'from' | 'to', part: 'day' | 'month' | 'year', value: string) => {
        setDateRange(prev => {
            const current = prev[target] || new Date();
            const newDate = new Date(current);
            
            if (part === 'day') newDate.setDate(parseInt(value));
            if (part === 'month') newDate.setMonth(parseInt(value));
            if (part === 'year') newDate.setFullYear(parseInt(value));
            
            return { ...prev, [target]: newDate };
        });
    };
    
    const reportRef = useRef<HTMLDivElement>(null);

    const invoicesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "invoices"), orderBy("createdAt", "desc"));
    }, [firestore]);

    const { data: invoices, isLoading } = useCollection<Invoice>(invoicesQuery);

    const handlePeriodChange = (value: Period) => {
        setPeriod(value);
        const now = new Date();
        
        switch (value) {
            case 'today':
                setDateRange({ from: startOfDay(now), to: endOfDay(now) });
                break;
            case 'yesterday':
                const yesterday = subDays(now, 1);
                setDateRange({ from: startOfDay(yesterday), to: endOfDay(yesterday) });
                break;
            case 'last7':
                setDateRange({ from: startOfDay(subDays(now, 6)), to: endOfDay(now) });
                break;
            case 'thisMonth':
                setDateRange({ from: startOfMonth(now), to: endOfDay(now) });
                break;
            case 'all':
                setDateRange({ from: undefined, to: undefined });
                break;
            default:
                break;
        }
    };

    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        return invoices.filter(invoice => {
            const invoiceDate = invoice.createdAt.toDate();
            
            const searchContent = `${invoice.clientName} ${invoice.invoiceNumber}`.toLowerCase();
            const searchMatch = searchContent.includes(searchTerm.toLowerCase());
            
            let dateMatch = true;
            if (dateRange.from && dateRange.to) {
                dateMatch = isWithinInterval(invoiceDate, { 
                    start: startOfDay(dateRange.from), 
                    end: endOfDay(dateRange.to) 
                });
            } else if (dateRange.from) {
                dateMatch = invoiceDate >= startOfDay(dateRange.from);
            }

            return searchMatch && dateMatch;
        });
    }, [invoices, searchTerm, dateRange]);

    const handleExportPDF = async () => {
        const input = reportRef.current;
        if (!input) return;

        setIsExporting(true);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pages = input.querySelectorAll('.invoice-pdf-page');

        try {
            for (let i = 0; i < pages.length; i++) {
                const canvas = await html2canvas(pages[i] as HTMLElement, { 
                    scale: 2.5, 
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false
                });
                
                const imgData = canvas.toDataURL('image/png');
                
                if (i > 0) pdf.addPage();
                
                // Las dimensiones exactas de A4 en mm son 210x297
                pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
            }

            pdf.save(`REPORTE-VENTAS-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
        } catch (error) {
            console.error("Error al generar PDF:", error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6 p-1">
            {/* Filtros Premium */}
            <div className="w-full flex flex-col gap-6 bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-2xl shadow-black/40">
                {/* Fila 1: Búsqueda y Botón de Exportar */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    {/* Búsqueda */}
                    <div className="grid gap-2 w-full lg:w-auto">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Búsqueda Inteligente</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Cliente o N° factura..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full lg:w-96 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-primary/50 focus:ring-primary/50 rounded-xl h-11 font-medium transition-all" 
                                id="invoicesclientpage-input-cliente-o-n" data-testid="invoicesclientpage-1-input"
                            />
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3 w-full lg:w-auto items-center">
                        {(searchTerm || period !== 'all') && (
                            <Button 
                                variant="ghost" 
                                onClick={() => {
                                    setSearchTerm('');
                                    setPeriod('all');
                                    setDateRange({ from: undefined, to: undefined });
                                }}
                                className="h-11 px-4 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all gap-2 font-black uppercase tracking-widest text-[10px]" id="invoicesclientpage-button-3" data-testid="invoicesclientpage-close-button"
                            >
                                <X className="h-4 w-4" />
                                Limpiar Filtros
                            </Button>
                        )}
                        <Button 
                            onClick={handleExportPDF} 
                            disabled={filteredInvoices.length === 0 || isExporting}
                            className="flex-1 lg:flex-none h-11 px-6 gap-2 font-black uppercase tracking-widest text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100" id="invoicesclientpage-button-4" data-testid="invoicesclientpage-action-button"
                        >
                            <Download className="h-4 w-4" />
                            {isExporting ? "Generando..." : "Exportar Reporte"}
                        </Button>
                    </div>
                </div>

                {/* Fila 2: Filtros de Fecha */}
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end border-t border-white/5 pt-4">
                    {/* Periodo */}
                    <div className="grid gap-2 w-full lg:w-auto">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Periodo de Tiempo</label>
                        <Select value={period} onValueChange={handlePeriodChange}>
                            <SelectTrigger className="w-full lg:w-52 bg-white/5 border-white/10 text-white focus:border-primary/50 focus:ring-primary/50 rounded-xl h-11 font-medium transition-all" id="invoicesclientpage-selecttrigger-1" data-testid="invoicesclientpage-1-select">
                                <SelectValue placeholder="Seleccionar periodo" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                                <SelectItem value="all">Todo el historial</SelectItem>
                                <SelectItem value="today">Hoy</SelectItem>
                                <SelectItem value="yesterday">Ayer</SelectItem>
                                <SelectItem value="last7">Últimos 7 días</SelectItem>
                                <SelectItem value="thisMonth">Este Mes</SelectItem>
                                <SelectItem value="custom">Rango Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Custom Dates */}
                    {period === 'custom' && (
                        <div className="grid gap-2 w-full lg:w-auto animate-in fade-in slide-in-from-left-2 duration-300">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Rango de Fechas</label>
                            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
                                {/* Desde */}
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-slate-500 uppercase mr-1">Desde:</span>
                                    <Select 
                                        value={dateRange.from ? dateRange.from.getDate().toString() : ''} 
                                        onValueChange={(val) => handleDatePartChange('from', 'day', val)}
                                    >
                                        <SelectTrigger className="w-20 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all" id="invoicesclientpage-select-dia-desde">
                                            <SelectValue placeholder="Día" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                                            {days.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select 
                                        value={dateRange.from ? dateRange.from.getMonth().toString() : ''} 
                                        onValueChange={(val) => handleDatePartChange('from', 'month', val)}
                                    >
                                        <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all" id="invoicesclientpage-select-mes-desde">
                                            <SelectValue placeholder="Mes" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                                            {months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select 
                                        value={dateRange.from ? dateRange.from.getFullYear().toString() : ''} 
                                        onValueChange={(val) => handleDatePartChange('from', 'year', val)}
                                    >
                                        <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all" id="invoicesclientpage-select-ano-desde">
                                            <SelectValue placeholder="Año" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                                            {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <span className="text-slate-600 hidden lg:inline">-</span>

                                {/* Hasta */}
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-slate-500 uppercase mr-1">Hasta:</span>
                                    <Select 
                                        value={dateRange.to ? dateRange.to.getDate().toString() : ''} 
                                        onValueChange={(val) => handleDatePartChange('to', 'day', val)}
                                    >
                                        <SelectTrigger className="w-20 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all" id="invoicesclientpage-select-dia-hasta">
                                            <SelectValue placeholder="Día" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                                            {days.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select 
                                        value={dateRange.to ? dateRange.to.getMonth().toString() : ''} 
                                        onValueChange={(val) => handleDatePartChange('to', 'month', val)}
                                    >
                                        <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all" id="invoicesclientpage-select-mes-hasta">
                                            <SelectValue placeholder="Mes" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                                            {months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select 
                                        value={dateRange.to ? dateRange.to.getFullYear().toString() : ''} 
                                        onValueChange={(val) => handleDatePartChange('to', 'year', val)}
                                    >
                                        <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all" id="invoicesclientpage-select-ano-hasta">
                                            <SelectValue placeholder="Año" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                                            {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Contenido / Tabla */}
            {isLoading ? (
                <div className="space-y-3 bg-slate-900/20 p-6 rounded-2xl border border-white/5">
                    <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
                    <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
                    <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            Mostrando {filteredInvoices.length} facturas
                        </p>
                    </div>
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl shadow-black/40 overflow-hidden">
                        <InvoicesTable invoices={filteredInvoices} />
                    </div>
                </div>
            )}

            {/* Template oculto para PDF */}
            <div className="absolute -left-[9999px] top-0 pointer-events-none">
                <InvoiceReportTemplate 
                    invoices={filteredInvoices} 
                    dateRange={dateRange}
                    ref={reportRef} 
                />
            </div>
        </div>
    );
}