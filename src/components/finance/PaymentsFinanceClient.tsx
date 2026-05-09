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
    PieChart,
    FileText
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { getDashboardStats } from '@/lib/actions/report.actions';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { SimpleDateRangeSelector } from './SimpleDateRangeSelector';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CompanyProfile } from '@/types';

type PaymentMethod = 'Efectivo' | 'Sinpe Movil' | 'Tarjeta';

export default function PaymentsFinanceClient() {
    const { firestore } = useFirebase();
    const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
    const { data: company } = useDoc<CompanyProfile>(companyRef);

    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [daysRange, setDaysRange] = useState<number | 'month'>(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);

    useEffect(() => {
        async function loadStats() {
            setIsLoading(true);
            try {
                const data = await getDashboardStats(365); // Load more data for month/year flexibility
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
        
        let startDate: Date;
        let endDate: Date = endOfDay(new Date());

        if (customDateRange?.from) {
            startDate = startOfDay(customDateRange.from);
            endDate = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(customDateRange.from);
        } else if (daysRange === 'month') {
            const now = new Date();
            startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        } else {
            startDate = startOfDay(subDays(new Date(), daysRange - 1));
        }

        return stats.detailedInvoices.filter((inv: any) => {
            const date = new Date(inv.createdAt);
            const isInRange = isWithinInterval(date, { start: startDate, end: endDate });
            const matchesSearch = inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesMethod = methodFilter === 'all' || inv.paymentMethod === methodFilter;
            
            return isInRange && matchesSearch && matchesMethod;
        });
    }, [stats, daysRange, searchTerm, methodFilter, customDateRange]);

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

    const handleExportPDF = async () => {
        const doc = new jsPDF();
        
        // Helper to format currency for PDF
        const formatPDFCurrency = (amount: number) => {
            return amount.toLocaleString('en-US', {
                style: 'decimal',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };

        // Helper to load image
        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = src;
                img.onload = () => resolve(img);
                img.onerror = (e) => reject(e);
            });
        };

        // Professional Colors
        const primaryColor = [26, 37, 48]; // Dark Corporate Navy/Charcoal
        const secondaryColor = [71, 85, 105]; // Slate
        const accentColor = [139, 92, 246]; // Violet (used sparingly)
        const lightBg = [248, 250, 252]; // Very light gray/blue

        // Calculate active range text
        let rangeText = '';
        if (customDateRange?.from) {
            const start = format(customDateRange.from, "dd/MM/yyyy");
            const end = customDateRange.to ? format(customDateRange.to, "dd/MM/yyyy") : start;
            rangeText = `${start} - ${end}`;
        } else if (daysRange === 'month') {
            rangeText = format(new Date(), "MMMM yyyy", { locale: es }).toUpperCase();
        } else {
            const start = format(subDays(new Date(), (daysRange as number) - 1), "dd/MM/yyyy");
            const end = format(new Date(), "dd/MM/yyyy");
            rangeText = daysRange === 1 ? `HOY (${end})` : `${start} - ${end}`;
        }

        // Header Background
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 50, 'F');
        
        // Load and Add Real Logo
        try {
            const logoToLoad = company?.logoUrl || '/logo_manolo.png';
            const logoImg = await loadImage(logoToLoad);
            doc.addImage(logoImg, 'PNG', 14, 10, 25, 25);
        } catch (error) {
            console.error("Error loading logo:", error);
            // Fallback: Draw Stylized Logo if image fails
            doc.setFillColor(255, 255, 255, 0.1);
            doc.circle(25, 25, 12, 'F');
            doc.setFillColor(255, 255, 255);
            doc.circle(25, 25, 10, 'F');
            doc.setFontSize(14);
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.setFont("helvetica", "bold");
            doc.text(company?.tradeName?.charAt(0) || "M", 25, 29.5, { align: 'center' });
        }

        // Business Name
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(company?.tradeName || "HOTEL DU MANOLO", 45, 24);
        
        doc.setFontSize(11);
        doc.setTextColor(200, 200, 200);
        doc.setFont("helvetica", "normal");
        doc.text(company?.legalId ? `CÉD. JURÍDICA: ${company.legalId}` : "SISTEMA DE GESTIÓN HOTELERA", 45, 31);
        
        // Document Info (Right Aligned in Header)
        doc.setFontSize(10);
        doc.setTextColor(220, 220, 220);
        doc.text("REPORTE DE INGRESOS", 196, 18, { align: 'right' });
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(rangeText, 196, 25, { align: 'right' });
        doc.setFontSize(7);
        doc.setTextColor(180, 180, 180);
        doc.setFont("helvetica", "normal");
        doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy - hh:mm a")}`, 196, 31, { align: 'right' });
        
        // Horizontal separator line in header
        doc.setDrawColor(255, 255, 255, 0.2);
        doc.setLineWidth(0.5);
        doc.line(14, 40, 196, 40);
        
        // Summary Title
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text("RESUMEN DE RECAUDACIÓN", 14, 65);

        // Summary Grid
        const summaryData = [
            ["EFECTIVO", formatPDFCurrency(balances['Efectivo']), "TARJETA", formatPDFCurrency(balances['Tarjeta'])],
            ["SINPE MÓVIL", formatPDFCurrency(balances['Sinpe Movil']), "TOTAL GENERAL", formatPDFCurrency(balances.total)]
        ];

        autoTable(doc, {
            startY: 70,
            body: summaryData,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 3, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 35, textColor: [100, 100, 100] },
                1: { cellWidth: 50, textColor: [5, 5, 5] },
                2: { cellWidth: 35, textColor: [100, 100, 100] },
                3: { cellWidth: 50, textColor: primaryColor }
            }
        });
        
        // Table Title
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text("DETALLE DE TRANSACCIONES", 14, (doc as any).lastAutoTable.finalY + 15);

        // Add Table
        const tableData = filteredInvoices.map((inv: any) => [
            format(new Date(inv.createdAt), 'dd/MM/yyyy HH:mm'),
            inv.clientName,
            inv.invoiceNumber,
            inv.paymentMethod,
            formatPDFCurrency(inv.total)
        ]);

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['FECHA', 'CLIENTE', 'FACTURA', 'MÉTODO', 'MONTO (CRC)']],
            body: tableData,
            theme: 'striped',
            headStyles: { 
                fillColor: primaryColor, 
                textColor: [255, 255, 255],
                fontSize: 9,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 35 },
                2: { halign: 'center', cellWidth: 30 },
                3: { halign: 'center', cellWidth: 30 },
                4: { halign: 'right', cellWidth: 30 }
            },
            alternateRowStyles: { fillColor: lightBg },
            styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' }
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            // Bottom line
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.5);
            doc.line(14, 280, 196, 280);
            
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, 105, 287, { align: 'center' });
            doc.text("Documento generado automáticamente por GoMotel", 14, 287);
        }

        doc.save(`Reporte_Finanzas_HotelDuManolo_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    };

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
                            variant={daysRange === d && !customDateRange ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => {
                                setDaysRange(d);
                                setCustomDateRange(undefined);
                            }}
                            className={cn(
                                "h-9 px-4 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all",
                                daysRange === d && !customDateRange ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-white"
                            )}
                        >
                            {d === 1 ? 'Hoy' : `${d} Días`}
                        </Button>
                    ))}

                    <Button
                        variant={daysRange === 'month' && !customDateRange ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => {
                            setDaysRange('month');
                            setCustomDateRange(undefined);
                        }}
                        className={cn(
                            "h-9 px-4 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all",
                            daysRange === 'month' && !customDateRange ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-white"
                        )}
                    >
                        Mes Actual
                    </Button>
                    
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                variant={customDateRange ? 'secondary' : 'ghost'}
                                size="sm"
                                className={cn(
                                    "h-9 px-4 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all",
                                    customDateRange ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-white"
                                )}
                            >
                                <Calendar className="h-3 w-3 mr-2" />
                                Rango
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-950 border-white/10 text-white rounded-[2rem] sm:max-w-4xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                                        <CalendarDays className="h-5 w-5" />
                                    </div>
                                    Seleccionar Rango Personalizado
                                </DialogTitle>
                                <DialogDescription className="text-slate-400 font-medium">
                                    Defina un periodo específico para consultar los ingresos de la suite.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-6">
                                <SimpleDateRangeSelector date={customDateRange} setDate={setCustomDateRange} />
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* KPI Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Efectivo Card */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                    <Card className="relative bg-black/40 backdrop-blur-2xl border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:-translate-y-2">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                            <Wallet className="h-20 w-20 text-emerald-500" />
                        </div>
                        <CardHeader className="pb-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                    <Wallet className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/80">Efectivo</span>
                            </div>
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="flex flex-col">
                                <div className="text-4xl font-black tracking-tighter mb-2 font-mono bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                                    {formatCurrency(balances['Efectivo'])}
                                </div>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="text-[9px] font-bold uppercase tracking-widest">Físico en caja</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* SINPE Card */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                    <Card className="relative bg-black/40 backdrop-blur-2xl border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:-translate-y-2">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                            <Smartphone className="h-20 w-20 text-blue-500" />
                        </div>
                        <CardHeader className="pb-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                                    <Smartphone className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/80">Sinpe Móvil</span>
                            </div>
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="flex flex-col">
                                <div className="text-4xl font-black tracking-tighter mb-2 font-mono bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                                    {formatCurrency(balances['Sinpe Movil'])}
                                </div>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <div className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
                                    <p className="text-[9px] font-bold uppercase tracking-widest">Transferencias</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tarjeta Card */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                    <Card className="relative bg-black/40 backdrop-blur-2xl border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:-translate-y-2">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                            <CreditCard className="h-20 w-20 text-purple-500" />
                        </div>
                        <CardHeader className="pb-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
                                    <CreditCard className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-500/80">Tarjeta</span>
                            </div>
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="flex flex-col">
                                <div className="text-4xl font-black tracking-tighter mb-2 font-mono bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                                    {formatCurrency(balances['Tarjeta'])}
                                </div>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <div className="h-1 w-1 rounded-full bg-purple-500 animate-pulse" />
                                    <p className="text-[9px] font-bold uppercase tracking-widest">Terminales POS</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Total General Card */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-[2.5rem] blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                    <Card className="relative bg-black/40 backdrop-blur-2xl border-primary/20 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:-translate-y-2">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <TrendingUp className="h-20 w-20 text-primary" />
                        </div>
                        <CardHeader className="pb-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.2)]">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Total General</span>
                            </div>
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="flex flex-col">
                                <div className="text-4xl font-black tracking-tighter mb-2 font-mono bg-gradient-to-br from-white via-white to-primary/60 bg-clip-text text-transparent">
                                    {formatCurrency(balances.total)}
                                </div>
                                <div className="flex items-center gap-2 text-primary/60">
                                    <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
                                    <p className="text-[9px] font-bold uppercase tracking-widest">Suma de todos los flujos</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
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
                            <Button 
                                variant="outline" 
                                onClick={handleExportPDF}
                                className="h-12 px-6 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
                            >
                                <FileText className="mr-2 h-4 w-4 text-primary" />
                                Exportar PDF
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
