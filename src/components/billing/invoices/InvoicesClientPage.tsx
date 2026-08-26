'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Invoice, Stay } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import InvoicesTable from "./InvoicesTable";
import { useState, useMemo, useRef, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
    Calendar as CalendarIcon, 
    Download, 
    Search, 
    X,
    Loader2
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
import { cn, formatCurrency } from "@/lib/utils";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import InvoiceReportTemplate from "./InvoiceReportTemplate";
import { 
    DollarSign, 
    Receipt, 
    TrendingUp, 
    Wallet 
} from "lucide-react";

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
    const [isPending, startTransition] = useTransition();
    const [searchTerm, setSearchTerm] = useState('');
    const [period, setPeriod] = useState<Period>('today');
    const [userFilter, setUserFilter] = useState<string>('all');
    const [roomFilter, setRoomFilter] = useState<string>('all');
    const [isExporting, setIsExporting] = useState(false);
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => {
        const now = new Date();
        return {
            from: startOfDay(now),
            to: endOfDay(now)
        };
    });

    const handleDatePartChange = (target: 'from' | 'to', part: 'day' | 'month' | 'year', value: string) => {
        startTransition(() => {
            setDateRange(prev => {
                const current = prev[target] || new Date();
                const newDate = new Date(current);
                
                if (part === 'day') newDate.setDate(parseInt(value));
                if (part === 'month') newDate.setMonth(parseInt(value));
                if (part === 'year') newDate.setFullYear(parseInt(value));
                
                return { ...prev, [target]: newDate };
            });
        });
    };
    
    const reportRef = useRef<HTMLDivElement>(null);

    const invoicesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "invoices"), orderBy("createdAt", "desc"));
    }, [firestore]);

    const staysQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "stays"));
    }, [firestore]);

    const { data: invoices, isLoading } = useCollection<Invoice>(invoicesQuery);
    const { data: stays } = useCollection<Stay>(staysQuery);

    const staysMap = useMemo(() => {
        if (!stays) return new Map<string, Stay>();
        return new Map(stays.map(s => [s.id, s]));
    }, [stays]);

    const invoicesWithUser = useMemo(() => {
        if (!invoices) return [];
        return invoices.map(invoice => {
            let extraData: any = {};
            if (invoice.stayId) {
                const stay = staysMap.get(invoice.stayId);
                if (stay) {
                    if (stay.createdBy && !invoice.createdByName) extraData.createdByName = stay.createdBy;
                    if (stay.checkIn) extraData.stayCheckIn = stay.checkIn;
                    if (stay.checkOut || stay.expectedCheckOut) extraData.stayCheckOut = stay.checkOut || stay.expectedCheckOut;
                }
            }
            return { ...invoice, ...extraData };
        });
    }, [invoices, staysMap]);

    const uniqueUsers = useMemo(() => {
        if (!invoicesWithUser) return [];
        const users = new Set<string>();
        invoicesWithUser.forEach(invoice => {
            const userName = (invoice as any).createdByName || (invoice as any).createdBy;
            if (userName) users.add(userName);
        });
        return Array.from(users).sort();
    }, [invoicesWithUser]);

    const uniqueRooms = useMemo(() => {
        if (!invoicesWithUser) return [];
        const rooms = new Set<string>();
        invoicesWithUser.forEach(invoice => {
            if (invoice.roomNumber) rooms.add(invoice.roomNumber);
        });
        return Array.from(rooms).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [invoicesWithUser]);

    const handlePeriodChange = (value: Period) => {
        startTransition(() => {
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
        });
    };

    const handleUserFilterChange = (val: string) => {
        startTransition(() => {
            setUserFilter(val);
        });
    };

    const handleRoomFilterChange = (val: string) => {
        startTransition(() => {
            setRoomFilter(val);
        });
    };

    const filteredInvoices = useMemo(() => {
        if (!invoicesWithUser) return [];
        return invoicesWithUser.filter(invoice => {
            const invoiceDate = invoice.createdAt?.toDate ? invoice.createdAt.toDate() : new Date();
            
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

            const userName = (invoice as any).createdByName || (invoice as any).createdBy || 'N/D';
            const userMatch = userFilter === 'all' || userName === userFilter;
            const roomMatch = roomFilter === 'all' || invoice.roomNumber === roomFilter;

            return searchMatch && dateMatch && userMatch && roomMatch;
        });
    }, [invoicesWithUser, searchTerm, dateRange, userFilter, roomFilter]);

    const summary = useMemo(() => {
        const paidInvoices = filteredInvoices.filter(inv => inv.status === 'Pagada');
        const total = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const count = filteredInvoices.length;
        const paidCount = paidInvoices.length;
        const avgTicket = paidCount > 0 ? total / paidCount : 0;
        
        const byMethod = paidInvoices.reduce((acc, inv) => {
            const method = inv.paymentMethod || 'Otros';
            acc[method] = (acc[method] || 0) + (inv.total || 0);
            return acc;
        }, {} as Record<string, number>);

        return { total, count, paidCount, avgTicket, byMethod };
    }, [filteredInvoices]);

    const handleExportPDF = async () => {
        setIsExporting(true);

        // Give React a tick to mount the hidden template
        setTimeout(async () => {
            const input = reportRef.current;
            if (!input) {
                setIsExporting(false);
                return;
            }

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pages = input.querySelectorAll('.invoice-pdf-page');

            try {
                for (let i = 0; i < pages.length; i++) {
                    const canvas = await html2canvas(pages[i] as HTMLElement, { 
                        scale: 2, 
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        logging: false
                    });
                    
                    const imgData = canvas.toDataURL('image/png');
                    
                    if (i > 0) pdf.addPage();
                    
                    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
                }

                pdf.save(`REPORTE-VENTAS-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
            } catch (error) {
                console.error("Error al generar PDF:", error);
            } finally {
                setIsExporting(false);
            }
        }, 150);
    };

    return (
        <div className="space-y-6 p-1">
            {/* Barra de progreso / Estado de consulta */}
            {(isLoading || isPending || isExporting) && (
                <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-primary/30 p-4 rounded-2xl shadow-xl shadow-black/40 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-bold text-primary">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            {isExporting 
                                ? "Generando documento PDF de reporte consolidado..." 
                                : isLoading 
                                ? "Consultando base de datos en tiempo real..." 
                                : "Procesando y filtrando registros..."}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-primary/20 text-primary px-2.5 py-1 rounded-full border border-primary/30 animate-pulse">
                            {isExporting ? "Exportando PDF" : "Consultando"}
                        </span>
                    </div>
                    {/* Barra de progreso indeterminada animada */}
                    <div className="h-2 w-full bg-slate-950/80 rounded-full overflow-hidden relative border border-white/5">
                        <div className="h-full bg-gradient-to-r from-primary via-cyan-400 to-primary rounded-full animate-pulse w-full" />
                    </div>
                </div>
            )}

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
                        {(searchTerm || period !== 'all' || userFilter !== 'all') && (
                            <Button 
                                variant="ghost" 
                                onClick={() => {
                                    setSearchTerm('');
                                    setPeriod('today');
                                    setUserFilter('all');
                                    setRoomFilter('all');
                                    const now = new Date();
                                    setDateRange({ from: startOfDay(now), to: endOfDay(now) });
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

                    {/* Filtro Usuario */}
                    <div className="grid gap-2 w-full lg:w-auto">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Registrado Por</label>
                        <Select value={userFilter} onValueChange={handleUserFilterChange}>
                            <SelectTrigger className="w-full lg:w-52 bg-white/5 border-white/10 text-white focus:border-primary/50 focus:ring-primary/50 rounded-xl h-11 font-medium transition-all" id="invoicesclientpage-select-user-filter">
                                <SelectValue placeholder="Seleccionar usuario" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                                <SelectItem value="all">Todos los usuarios</SelectItem>
                                {uniqueUsers.map(u => (
                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                                <SelectItem value="N/D">No Definido (N/D)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Filtro Habitación */}
                    <div className="grid gap-2 w-full lg:w-auto">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Habitación</label>
                        <Select value={roomFilter} onValueChange={handleRoomFilterChange}>
                            <SelectTrigger className="w-full lg:w-52 bg-white/5 border-white/10 text-white focus:border-primary/50 focus:ring-primary/50 rounded-xl h-11 font-medium transition-all" id="invoicesclientpage-select-room-filter">
                                <SelectValue placeholder="Todas las Hab." />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                                <SelectItem value="all">Todas las Hab.</SelectItem>
                                {uniqueRooms.map(r => (
                                    <SelectItem key={r} value={r}>Habitación {r}</SelectItem>
                                ))}
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

            {/* Tarjetas de Resumen / Totales Generales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Neto Facturado */}
                <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-2xl shadow-black/40 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Facturado</span>
                        <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <DollarSign className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-white tracking-tight">
                            {formatCurrency(summary.total)}
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">
                            {summary.paidCount} factura(s) pagada(s)
                        </p>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
                </div>

                {/* Transacciones */}
                <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-2xl shadow-black/40 flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Transacciones</span>
                        <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <Receipt className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-white tracking-tight">
                            {summary.count} <span className="text-sm font-bold text-slate-400">Facturas</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">
                            Total emitidas en el periodo
                        </p>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
                </div>

                {/* Ticket Promedio */}
                <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-2xl shadow-black/40 flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/30 transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ticket Promedio</span>
                        <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-white tracking-tight">
                            {formatCurrency(summary.avgTicket)}
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">
                            Promedio por factura pagada
                        </p>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all pointer-events-none" />
                </div>

                {/* Métodos de Pago */}
                <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-2xl shadow-black/40 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Métodos de Pago</span>
                        <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                            <Wallet className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                        {Object.entries(summary.byMethod).length === 0 ? (
                            <p className="text-xs text-slate-500 font-bold">Sin ingresos registrados</p>
                        ) : (
                            Object.entries(summary.byMethod).map(([method, amount]) => (
                                <div key={method} className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-400 truncate max-w-[110px]">{method}:</span>
                                    <span className="font-black text-slate-200">{formatCurrency(amount)}</span>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
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

            {/* Template oculto para PDF (sólo se monta al exportar) */}
            {isExporting && (
                <div className="absolute -left-[9999px] top-0 pointer-events-none">
                    <InvoiceReportTemplate 
                        invoices={filteredInvoices} 
                        dateRange={dateRange}
                        ref={reportRef} 
                    />
                </div>
            )}
        </div>
    );
}