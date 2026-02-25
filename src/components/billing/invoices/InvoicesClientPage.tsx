'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Invoice, CompanyProfile } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import InvoicesTable from "./InvoicesTable";
import { useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
    Calendar as CalendarIcon, 
    Download, 
    FileText, 
    Search, 
    X,
    ChevronDown
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
import { es } from "date-fns/locale";
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

export default function InvoicesClientPage() {
    const { firestore } = useFirebase();
    const [searchTerm, setSearchTerm] = useState('');
    const [period, setPeriod] = useState<Period>('all');
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });
    
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
            
            // Search filter
            const searchContent = `${invoice.clientName} ${invoice.invoiceNumber}`.toLowerCase();
            const searchMatch = searchContent.includes(searchTerm.toLowerCase());
            
            // Date filter
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

    const handleExportPDF = () => {
        const input = reportRef.current;
        if (!input) return;

        html2canvas(input, { 
            scale: 3, 
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            pdf.save(`REPORTE-VENTAS-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
        });
    };

    return (
        <div className="space-y-6">
            {/* Filters Bar */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end bg-muted/20 p-4 rounded-xl border">
                <div className="grid gap-2 w-full lg:w-auto">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Búsqueda</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cliente o N° factura..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 w-full lg:w-64 bg-background"
                        />
                    </div>
                </div>

                <div className="grid gap-2 w-full lg:w-auto">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Periodo</label>
                    <Select value={period} onValueChange={handlePeriodChange}>
                        <SelectTrigger className="w-full lg:w-48 bg-background">
                            <SelectValue placeholder="Seleccionar periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todo el historial</SelectItem>
                            <SelectItem value="today">Hoy</SelectItem>
                            <SelectItem value="yesterday">Ayer</SelectItem>
                            <SelectItem value="last7">Últimos 7 días</SelectItem>
                            <SelectItem value="thisMonth">Este Mes</SelectItem>
                            <SelectItem value="custom">Rango Personalizado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {period === 'custom' && (
                    <div className="grid gap-2 w-full lg:w-auto animate-in fade-in slide-in-from-left-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rango de Fechas</label>
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full lg:w-auto justify-start text-left font-normal bg-background", !dateRange.from && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "Desde"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.from}
                                        onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <span className="text-muted-foreground">-</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full lg:w-auto justify-start text-left font-normal bg-background", !dateRange.to && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "Hasta"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.to}
                                        onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 w-full lg:w-auto lg:ml-auto">
                    {(searchTerm || period !== 'all') && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                                setSearchTerm('');
                                setPeriod('all');
                                setDateRange({ from: undefined, to: undefined });
                            }}
                            className="h-10 w-10 text-muted-foreground hover:text-destructive"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                    <Button 
                        onClick={handleExportPDF} 
                        disabled={filteredInvoices.length === 0}
                        className="flex-1 lg:flex-none h-10 gap-2 font-bold"
                    >
                        <Download className="h-4 w-4" />
                        Exportar Reporte
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-2 rounded-md border p-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            Mostrando {filteredInvoices.length} facturas
                        </p>
                    </div>
                    <InvoicesTable invoices={filteredInvoices} />
                </div>
            )}

            {/* Hidden PDF Template */}
            <div className="absolute -left-[9999px] top-0">
                <InvoiceReportTemplate 
                    invoices={filteredInvoices} 
                    dateRange={dateRange}
                    ref={reportRef} 
                />
            </div>
        </div>
    );
}
