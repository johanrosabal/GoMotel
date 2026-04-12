'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
    Wallet, 
    Smartphone, 
    CreditCard, 
    CalendarDays, 
    ArrowRightLeft, 
    TrendingUp, 
    ChevronRight,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    Download,
    PieChart
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { getDashboardStats } from '@/lib/actions/report.actions';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

type PaymentMethod = 'Efectivo' | 'Sinpe Movil' | 'Tarjeta';

export default function PaymentsFinanceClient() {
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [daysRange, setDaysRange] = useState(7);
    const [searchTerm, setSearchTerm] = useState('');
    const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');

    useEffect(() => {
        async function loadStats() {
            setIsLoading(true);
            try {
                const data = await getDashboardStats(30); // Load last 30 days for flexibility
                setStats(data);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        }
        loadStats();
    }, []);

    const filteredInvoices = useMemo(() => {
        if (!stats?.detailedInvoices) return [];
        
        const startDate = startOfDay(subDays(new Date(), daysRange - 1));
        const endDate = endOfDay(new Date());

        return stats.detailedInvoices.filter((inv: any) => {
            const date = new Date(inv.createdAt);
            const isInRange = isWithinInterval(date, { start: startDate, end: endDate });
            const matchesSearch = inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesMethod = methodFilter === 'all' || inv.paymentMethod === methodFilter;
            
            return isInRange && matchesSearch && matchesMethod;
        });
    }, [stats, daysRange, searchTerm, methodFilter]);

    const balances = useMemo(() => {
        const result = {
            'Efectivo': 0,
            'Sinpe Movil': 0,
            'Tarjeta': 0,
            total: 0
        };

        filteredInvoices.forEach((inv: any) => {
            const method = inv.paymentMethod as PaymentMethod;
            if (result[method] !== undefined) {
                result[method] += inv.total;
                result.total += inv.total;
            }
        });

        return result;
    }, [filteredInvoices]);

    if (isLoading) {
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col gap-4">
                    <Skeleton className="h-10 w-64 bg-white/5" />
                    <Skeleton className="h-4 w-96 bg-white/5" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-3xl bg-white/5" />
                    ))}
                </div>
                <Skeleton className="h-96 w-full rounded-3xl bg-white/5" />
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest">
                        <TrendingUp className="h-3 w-3" />
                        Finanzas y Contabilidad
                    </div>
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">
                            Resumen de <span className="text-primary">Pagos</span>
                        </h1>
                        <p className="text-slate-400 text-sm font-medium mt-4 max-w-2xl">
                            Control centralizado de flujos de caja y conciliación de pagos por método.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
                    {[1, 7, 30].map((d) => (
                        <Button
                            key={d}
                            variant={daysRange === d ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setDaysRange(d)}
                            className={cn(
                                "h-9 px-4 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all",
                                daysRange === d ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-white"
                            )}
                        >
                            {d === 1 ? 'Hoy' : `${d} Días`}
                        </Button>
                    ))}
                </div>
            </div>

            {/* KPI Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-[2.5rem] overflow-hidden group hover:border-primary/30 transition-all duration-500 hover:-translate-y-1">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <Wallet className="h-6 w-6" />
                            </div>
                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">EFECTIVO</div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black tracking-tighter mb-1 font-mono">
                            {formatCurrency(balances['Efectivo'])}
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Recaudación física en caja</p>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-[2.5rem] overflow-hidden group hover:border-primary/30 transition-all duration-500 hover:-translate-y-1">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                <Smartphone className="h-6 w-6" />
                            </div>
                            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">SINPE MÓVIL</div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black tracking-tighter mb-1 font-mono">
                            {formatCurrency(balances['Sinpe Movil'])}
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Transferencias electrónicas</p>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-[2.5rem] overflow-hidden group hover:border-primary/30 transition-all duration-500 hover:-translate-y-1">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                <CreditCard className="h-6 w-6" />
                            </div>
                            <div className="text-[10px] font-black text-purple-500 uppercase tracking-widest">TARJETA</div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black tracking-tighter mb-1 font-mono">
                            {formatCurrency(balances['Tarjeta'])}
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Terminales de punto de venta</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[3rem] p-6 lg:p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
                
                <div className="flex flex-col gap-8">
                    {/* Toolbar */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-white/10">
                        <div className="relative w-full lg:max-w-md group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                            <Input 
                                placeholder="Buscar por cliente o factura..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                                {['all', 'Efectivo', 'Sinpe Movil', 'Tarjeta'].map((m) => (
                                    <Button
                                        key={m}
                                        variant={methodFilter === m ? 'secondary' : 'ghost'}
                                        size="sm"
                                        onClick={() => setMethodFilter(m as any)}
                                        className={cn(
                                            "h-8 px-3 font-black uppercase tracking-widest text-[9px] rounded-lg transition-all",
                                            methodFilter === m ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"
                                        )}
                                    >
                                        {m === 'all' ? 'Todos' : m}
                                    </Button>
                                ))}
                            </div>
                            <Button variant="outline" className="h-12 px-6 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest">
                                <Download className="mr-2 h-4 w-4" />
                                Exportar
                            </Button>
                        </div>
                    </div>

                    {/* History Table */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary/80 flex items-center gap-4">
                            HISTORIAL DE TRANSACCIONES
                            <span className="h-px flex-1 bg-white/5"></span>
                        </h3>

                        {filteredInvoices.length === 0 ? (
                            <div className="text-center py-20 bg-white/[0.02] rounded-[2rem] border border-dashed border-white/10">
                                <div className="p-4 rounded-full bg-white/5 w-fit mx-auto mb-4">
                                    <Filter className="h-8 w-8 text-slate-600" />
                                </div>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs italic">
                                    No se encontraron pagos para los criterios seleccionados.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {filteredInvoices.map((inv: any) => (
                                    <div 
                                        key={inv.id} 
                                        className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-3xl transition-all duration-300 group relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        
                                        <div className="flex items-center gap-6 relative z-10">
                                            <div className={cn(
                                                "p-3 rounded-2xl border shadow-sm",
                                                inv.paymentMethod === 'Efectivo' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                inv.paymentMethod === 'Sinpe Movil' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                                "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                            )}>
                                                {inv.paymentMethod === 'Efectivo' ? <Wallet className="h-5 w-5" /> :
                                                 inv.paymentMethod === 'Sinpe Movil' ? <Smartphone className="h-5 w-5" /> :
                                                 <CreditCard className="h-5 w-5" />}
                                            </div>
                                            
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-black uppercase tracking-tight text-white">{inv.clientName}</span>
                                                    <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-bold text-slate-500 px-2">
                                                        #{inv.invoiceNumber}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                    <span className="flex items-center gap-1.5">
                                                        <Calendar className="h-3 w-3" />
                                                        {format(new Date(inv.createdAt), "d 'de' MMMM, h:mm a", { locale: es })}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <ArrowRightLeft className="h-3 w-3" />
                                                        {inv.paymentMethod}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between md:justify-end gap-8 mt-4 md:mt-0 relative z-10">
                                            <div className="text-right">
                                                <div className="text-xl font-black text-white group-hover:text-primary transition-colors font-mono">
                                                    {formatCurrency(inv.total)}
                                                </div>
                                                <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Total Transado</div>
                                            </div>
                                            <Button size="icon" variant="ghost" className="rounded-xl border border-white/5 bg-white/5 opacity-0 group-hover:opacity-100 transition-all">
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
