'use client';

import { useState, useEffect, useTransition, useRef, useMemo } from 'react';
import { getDashboardStats } from '@/lib/actions/report.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import {
    TrendingUp, Users, AlertTriangle,
    Download, ArrowRight, DollarSign, PieChart as PieIcon,
    Receipt, PackageSearch
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import StockDistributionChart from '@/components/dashboard/charts/StockDistributionChart';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

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

export default function ReportsClientPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const stockReportRef = useRef<HTMLDivElement>(null);

    const [period, setPeriod] = useState('today');
    const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>(() => {
        const now = new Date();
        return { from: startOfDay(now), to: endOfDay(now) };
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

    const handleExportPDF = async () => {
        if (!data?.detailedInvoices) return;
        
        const doc = new jsPDF();
        
        // 1. Título y Metadatos
        doc.setFontSize(18);
        doc.text("REPORTE DE FACTURACIÓN", 14, 15);
        
        doc.setFontSize(10);
        doc.text(`Periodo: ${period === 'thisMonth' ? 'Este Mes' : period === 'last7' ? '7d' : period === 'today' ? 'Hoy' : 'Ayer'}`, 14, 22);
        doc.text(`Fecha de Emisión: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 27);
        
        // 2. Tabla de KPIs (Resumen) en la primera página
        autoTable(doc, {
            head: [["Ingresos", "Ocupación", "Stock Bajo", "Movimientos"]],
            body: [[
                formatCurrency(data.kpis.totalRevenue).replace(/[^\d.,]/g, '').trim(),
                `${data.kpis.occupancyRate}%`,
                data.kpis.lowStockCount.toString(),
                data.kpis.totalInvoices.toString()
            ]],
            startY: 32,
            theme: 'grid',
            styles: { fontSize: 10, halign: 'center' },
            headStyles: { fillColor: [51, 65, 85] },
        });

        let yOffset = (doc as any).lastAutoTable.finalY + 10;

        // 3. Agregar Gráficos en la primera página (manteniendo proporción)
        const chartTendencia = document.getElementById('chart-tendencia');
        const chartPagos = document.getElementById('chart-pagos');

        if (chartTendencia) {
            const canvas = await html2canvas(chartTendencia);
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 180;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            doc.setFontSize(12);
            doc.text("Tendencia de Ingresos", 14, yOffset);
            doc.addImage(imgData, 'PNG', 14, yOffset + 5, imgWidth, imgHeight);
            yOffset += imgHeight + 15;
        }

        if (chartPagos) {
            const canvas = await html2canvas(chartPagos);
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 180;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // Si no cabe en la página, lo pasamos a la siguiente (o si ya está muy abajo)
            if (yOffset + imgHeight > 280) {
                doc.addPage();
                yOffset = 15;
            }
            
            doc.setFontSize(12);
            doc.text("Distribución de Pagos", 14, yOffset);
            doc.addImage(imgData, 'PNG', 14, yOffset + 5, imgWidth, imgHeight);
            yOffset += imgHeight + 15;
        }

        // 4. Tabla Detallada en Nueva Página
        doc.addPage();
        doc.setFontSize(14);
        doc.text("DETALLE DE FACTURAS", 14, 15);

        const tableColumn = ["Factura", "Cliente", "Subtotal", "Total", "Método", "Fecha"];
        const tableRows = data.detailedInvoices.map((inv: any) => [
            inv.invoiceNumber,
            inv.clientName,
            formatCurrency(inv.subtotal || 0).replace(/[^\d.,]/g, '').trim(),
            formatCurrency(inv.total).replace(/[^\d.,]/g, '').trim(),
            inv.paymentMethod,
            format(new Date(inv.createdAt), "dd/MM/yyyy HH:mm")
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 22,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59] },
            styles: { fontSize: 8 },
        });

        doc.save(`Reporte_Facturacion_${format(new Date(), "yyyyMMdd")}.pdf`);
    };

    const handleExportExcel = () => {
        if (!data?.detailedInvoices) return;
        
        const worksheet = XLSX.utils.json_to_sheet(data.detailedInvoices.map((inv: any) => ({
            "Factura": inv.invoiceNumber,
            "Cliente": inv.clientName,
            "Subtotal": inv.subtotal,
            "Total": inv.total,
            "Método Pago": inv.paymentMethod,
            "Fecha": format(new Date(inv.createdAt), "dd/MM/yyyy HH:mm")
        })));
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Facturas");
        
        XLSX.writeFile(workbook, `Reporte_Facturacion_${format(new Date(), "yyyyMMdd")}.xlsx`);
    };

    useEffect(() => {
        setIsLoading(true);
        let from = dateRange.from;
        let to = dateRange.to;

        if (period === 'today') {
            from = startOfDay(new Date());
            to = endOfDay(new Date());
        } else if (period === 'yesterday') {
            from = startOfDay(subDays(new Date(), 1));
            to = endOfDay(subDays(new Date(), 1));
        } else if (period === 'last7') {
            from = startOfDay(subDays(new Date(), 6));
            to = endOfDay(new Date());
        } else if (period === 'thisMonth') {
            from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            to = new Date();
        }

        if (from && to) {
            getDashboardStats(7, { from, to }).then(res => {
                setData(res);
                setIsLoading(false);
            });
        }
    }, [period, dateRange]);

    const handleAiAnalysis = () => {
        // AI Analysis removed per user request
    };

    const taxTypes = useMemo(() => {
        if (!data?.detailedInvoices) return [];
        const types = new Set<string>();
        data.detailedInvoices.forEach((inv: any) => {
            inv.taxes?.forEach((t: any) => types.add(t.name));
        });
        return Array.from(types).sort();
    }, [data?.detailedInvoices]);

    // Lógica de Paginación para Stock Bajo: 35 filas por página
    const stockPages = useMemo(() => {
        if (!data?.lowStockDetails) return [];
        const limit = 35;
        const result = [];
        for (let i = 0; i < data.lowStockDetails.length; i += limit) {
            result.push(data.lowStockDetails.slice(i, i + limit));
        }
        return result;
    }, [data?.lowStockDetails]);

    const handleExportStockPdf = async () => {
        const input = stockReportRef.current;
        if (!input) return;

        setIsExporting(true);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pages = input.querySelectorAll('.stock-pdf-page');

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
                pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
            }
            pdf.save(`REPORTE-STOCK-${format(new Date(), 'yyyyMMdd')}.pdf`);
        } catch (error) {
            console.error("Error al exportar stock:", error);
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-80 w-full" />
                    <Skeleton className="h-80 w-full" />
                    <Skeleton className="h-80 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filtros Premium */}
            <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-2xl shadow-black/40">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Periodo de Tiempo</label>
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-[200px] h-11 bg-slate-800/50 border-white/5 rounded-xl text-white">
                                <SelectValue placeholder="Seleccionar periodo" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                                <SelectItem value="today">Hoy</SelectItem>
                                <SelectItem value="yesterday">Ayer</SelectItem>
                                <SelectItem value="last7">Últimos 7 días</SelectItem>
                                <SelectItem value="thisMonth">Este Mes</SelectItem>
                                <SelectItem value="custom">Rango Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {period === 'custom' && (
                        <div className="flex flex-wrap gap-3 items-center bg-slate-800/30 p-4 rounded-xl border border-white/5">
                            {/* Desde */}
                            <div className="flex items-center gap-1">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500 mr-1">Desde:</span>
                                <Select 
                                    value={dateRange.from ? dateRange.from.getDate().toString() : ''} 
                                    onValueChange={(val) => handleDatePartChange('from', 'day', val)}
                                >
                                    <SelectTrigger className="w-16 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all">
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
                                    <SelectTrigger className="w-24 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all">
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
                                    <SelectTrigger className="w-24 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all">
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
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500 mr-1">Hasta:</span>
                                <Select 
                                    value={dateRange.to ? dateRange.to.getDate().toString() : ''} 
                                    onValueChange={(val) => handleDatePartChange('to', 'day', val)}
                                >
                                    <SelectTrigger className="w-16 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all">
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
                                    <SelectTrigger className="w-24 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all">
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
                                    <SelectTrigger className="w-24 bg-white/5 border-white/10 text-white h-11 rounded-xl focus:border-primary/50 focus:ring-primary/50 transition-all">
                                        <SelectValue placeholder="Año" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                                        {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 mt-4 md:mt-0">
                        <Button 
                            onClick={handleExportPDF} 
                            className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl h-11 flex items-center gap-2 border border-white/5"
                        >
                            <Download className="h-4 w-4" />
                            Exportar PDF
                        </Button>
                        <Button 
                            onClick={handleExportExcel} 
                            className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl h-11 flex items-center gap-2 border border-white/5"
                        >
                            <Download className="h-4 w-4" />
                            Exportar Excel
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Ingresos ({period === 'thisMonth' ? 'Este Mes' : period === 'last7' ? '7d' : period === 'today' ? 'Hoy' : 'Ayer'})</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{formatCurrency(data.kpis.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total facturado en el periodo</p>
                        <Button variant="link" size="sm" className="p-0 h-auto mt-3 text-primary font-bold" asChild id="reportsclientpage-button-1" data-testid="reportsclientpage-action-shows-bills-button">
                            <Link href="/billing/invoices" id="reportsclientpage-link-ver-facturas" data-testid="reportsclientpage-next-link">
                                Ver facturas <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Ocupación</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{data.kpis.occupancyRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground mt-1">Capacidad actual utilizada</p>
                    </CardContent>
                </Card>
                <Card
                    className={cn(
                        "transition-all duration-200 cursor-pointer hover:shadow-md border-2",
                        data.kpis.lowStockCount > 0 ? "border-yellow-500 bg-yellow-500/5 hover:bg-yellow-500/10" : "border-transparent hover:bg-muted/50"
                    )}
                    onClick={() => data.kpis.lowStockCount > 0 && setIsStockDialogOpen(true)}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Stock Bajo</CardTitle>
                        <AlertTriangle className={cn("h-4 w-4", data.kpis.lowStockCount > 0 ? "text-yellow-600" : "text-muted-foreground")} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{data.kpis.lowStockCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Productos por debajo del mínimo</p>
                        {data.kpis.lowStockCount > 0 && (
                            <p className="text-[10px] text-yellow-700 font-black uppercase mt-3 flex items-center gap-1">
                                Revisar inventario <ArrowRight className="h-2.5 w-2.5" />
                            </p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Movimientos</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{data.kpis.totalInvoices}</div>
                        <p className="text-xs text-muted-foreground mt-1">Facturas emitidas ({period === 'thisMonth' ? 'Este Mes' : period === 'last7' ? '7d' : period === 'today' ? 'Hoy' : 'Ayer'})</p>
                    </CardContent>
                </Card>
            </div>


            <Card className="border-primary/20 bg-muted/5 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary uppercase tracking-tight text-lg">
                        <Receipt className="h-5 w-5 text-primary" />
                        Desglose de Impuestos por Factura
                    </CardTitle>
                    <CardDescription>Detalle de montos por cada impuesto aplicado en las ventas recientes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border bg-background overflow-hidden shadow-inner">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/80">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-3">Factura</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Subtotal</TableHead>
                                        {taxTypes.map(taxName => (
                                            <TableHead key={taxName} className="text-[10px] font-black uppercase tracking-widest text-right text-primary">
                                                {taxName}
                                            </TableHead>
                                        ))}
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right bg-primary/5">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.detailedInvoices && data.detailedInvoices.length > 0 ? (
                                        data.detailedInvoices.map((inv: any) => (
                                            <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors border-b last:border-0">
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-xs font-black text-primary">{inv.invoiceNumber}</span>
                                                        <span className="text-[9px] text-muted-foreground uppercase">{inv.clientName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs">
                                                    {formatCurrency(inv.subtotal || 0)}
                                                </TableCell>
                                                {taxTypes.map(taxName => {
                                                    const taxAmount = inv.taxes?.find((t: any) => t.name === taxName)?.amount || 0;
                                                    return (
                                                        <TableCell key={taxName} className="text-right font-mono text-xs text-primary/80">
                                                            {taxAmount > 0 ? formatCurrency(taxAmount) : '-'}
                                                        </TableCell>
                                                    );
                                                })}
                                                <TableCell className="text-right font-mono text-xs font-black bg-primary/5">
                                                    {formatCurrency(inv.total)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={taxTypes.length + 3} className="h-32 text-center text-muted-foreground italic">
                                                No hay datos impositivos registrados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card id="chart-tendencia">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            Tendencia de Ingresos
                        </CardTitle>
                        <CardDescription>Ventas diarias de los últimos 7 días</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.revenueData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" fontSize={12} />
                                <YAxis fontSize={12} tickFormatter={(v) => `₡${v / 1000}k`} />
                                <Tooltip
                                    formatter={(v) => formatCurrency(v as number)}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card id="chart-pagos">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieIcon className="h-5 w-5 text-primary" />
                            Distribución de Pagos
                        </CardTitle>
                        <CardDescription>Monto total por método de pago</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.paymentData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.paymentData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v) => formatCurrency(v as number)} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieIcon className="h-5 w-5 text-primary" />
                            Distribución de Stock
                        </CardTitle>
                        <CardDescription>Inventario por categoría contable</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <StockDistributionChart services={data.allServices} />
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-primary" />
                        Desglose de Ingresos Recientes
                    </CardTitle>
                    <CardDescription>Lista detallada de las facturas pagadas que componen el saldo de los últimos 7 días.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-xs uppercase font-bold">Fecha / Hora</TableHead>
                                    <TableHead className="text-xs uppercase font-bold">Factura N°</TableHead>
                                    <TableHead className="text-xs uppercase font-bold">Cliente</TableHead>
                                    <TableHead className="text-xs uppercase font-bold">Método</TableHead>
                                    <TableHead className="text-right text-xs uppercase font-bold">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.detailedInvoices && data.detailedInvoices.length > 0 ? (
                                    data.detailedInvoices.map((inv: any) => (
                                        <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="text-xs">
                                                {format(new Date(inv.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs font-bold text-primary">
                                                {inv.invoiceNumber}
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">{inv.clientName}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-tighter">
                                                    {inv.paymentMethod}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-xs">
                                                {formatCurrency(inv.total)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No hay movimientos registrados en este periodo.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="justify-center border-t py-4 bg-muted/10">
                    <Button variant="outline" size="sm" asChild id="reportsclientpage-button-3" data-testid="reportsclientpage-action-button">
                        <Link href="/billing/invoices" id="reportsclientpage-link-ver-historial-de" data-testid="reportsclientpage-billing-invoices-link">
                            Ver Historial de Facturación Completo
                        </Link>
                    </Button>
                </CardFooter>
            </Card>

            <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4">
                        <DialogTitle className="flex items-center gap-2">
                            <PackageSearch className="h-5 w-5 text-yellow-600" />
                            Gestión de Stock Crítico
                        </DialogTitle>
                        <DialogDescription>
                            Revise los artículos que requieren reposición inmediata para la operación.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 pb-6">
                        <div className="rounded-lg border">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead className="text-center">Stock Actual</TableHead>
                                        <TableHead className="text-center">Mínimo</TableHead>
                                        <TableHead className="text-right">Déficit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.lowStockDetails?.map((item: any) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-bold">{item.name}</TableCell>
                                            <TableCell className="text-center text-red-600 font-bold">{item.stock}</TableCell>
                                            <TableCell className="text-center">{item.minStock}</TableCell>
                                            <TableCell className="text-right text-red-700 font-black">
                                                Faltan {item.minStock - item.stock}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="absolute -left-[9999px] top-0 pointer-events-none">
                        <div ref={stockReportRef} style={{ letterSpacing: '0px', wordSpacing: 'normal' }}>
                            {stockPages.map((pageItems, pageIndex) => (
                                <div
                                    key={pageIndex}
                                    className="stock-pdf-page bg-white p-12 text-gray-900 flex flex-col mb-10"
                                    style={{
                                        width: '210mm',
                                        height: '297mm',
                                        fontFamily: 'Arial, sans-serif'
                                    }}
                                >
                                    <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
                                        <div className="space-y-1">
                                            <h1 className="text-xl font-bold text-gray-900 leading-tight">REPORTE DE AUDITORÍA</h1>
                                            <p className="text-sm font-semibold text-gray-600">Control de Activos e Inventarios</p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="bg-gray-50 p-2 rounded border border-gray-200">
                                                <p className="text-[8px] font-bold text-gray-400">NÚMERO DE REPORTE</p>
                                                <p className="text-xs font-mono font-bold text-gray-700">{format(new Date(), 'yyyyMMdd')}/INV-01</p>
                                            </div>
                                            <div className="pr-1">
                                                <p className="text-[8px] font-bold text-gray-400">FECHA EMISIÓN</p>
                                                <p className="text-[9px] font-bold text-gray-800">{format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {pageIndex === 0 && (
                                        <div className="mb-6 p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-r">
                                            <h2 className="text-xs font-bold text-yellow-800 mb-1">AVISO DE REABASTECIMIENTO</h2>
                                            <p className="text-[10px] text-yellow-700 leading-relaxed">
                                                Los siguientes artículos se encuentran por debajo del nivel mínimo de seguridad. Se recomienda la gestión de compra inmediata.
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex-grow">
                                        <h2 className="text-[10px] font-bold text-gray-800 uppercase mb-3 border-l-4 border-gray-800 pl-2">
                                            Listado de Stock Crítico {stockPages.length > 1 && `(Hoja ${pageIndex + 1})`}
                                        </h2>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gray-800 text-white text-left">
                                                    <th className="p-2 border border-gray-800 text-[9px] font-bold">DESCRIPCIÓN DEL PRODUCTO</th>
                                                    <th className="p-2 border border-gray-800 text-[9px] font-bold text-center">STOCK ACTUAL</th>
                                                    <th className="p-2 border border-gray-800 text-[9px] font-bold text-center">STOCK MÍN.</th>
                                                    <th className="p-2 border border-gray-800 text-[9px] font-bold text-right">PEDIDO SUGERIDO</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pageItems.map((item: any, idx: number) => (
                                                    <tr key={item.id} className={cn("text-[10px]", idx % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                                                        <td className="p-2 border border-gray-200 font-semibold text-gray-800">{item.name}</td>
                                                        <td className="p-2 border border-gray-200 text-center font-bold text-red-600">{item.stock}</td>
                                                        <td className="p-2 border border-gray-200 text-center text-gray-500">{item.minStock}</td>
                                                        <td className="p-2 border border-gray-200 text-right font-bold text-gray-900">
                                                            {item.minStock - item.stock} Unidades
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {pageIndex === stockPages.length - 1 && (
                                        <div className="mt-10 grid grid-cols-2 gap-12 pt-6 border-t border-gray-100">
                                            <div className="text-center space-y-2">
                                                <div className="h-12 border-b border-gray-300 w-48 mx-auto"></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-800">Firma Encargado Inventario</p>
                                                    <p className="text-[8px] text-gray-400">VALIDACIÓN DE EXISTENCIAS</p>
                                                </div>
                                            </div>
                                            <div className="text-center space-y-2">
                                                <div className="h-12 border-b border-gray-300 w-48 mx-auto"></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-800">Autorización Contabilidad</p>
                                                    <p className="text-[8px] text-gray-400">APROBACIÓN DE COMPRA</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 border-t flex justify-between items-center text-[8px] text-gray-400 font-bold uppercase">
                                        <span>Documento de auditoría interna</span>
                                        <span>Página {pageIndex + 1} de {stockPages.length}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t bg-muted/20">
                        <div className="flex flex-col sm:flex-row w-full gap-3">
                            <Button
                                variant="outline"
                                onClick={handleExportStockPdf}
                                disabled={isExporting}
                                className="flex-1 h-12 gap-2 font-black uppercase tracking-widest border-2 border-gray-800 hover:bg-gray-800 hover:text-white transition-colors" id="reportsclientpage-button-4" data-testid="reportsclientpage-action-button"
                            >
                                <Download className="h-5 w-5" />
                                {isExporting ? "Generando Reporte..." : "Exportar Reporte Contable"}
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setIsStockDialogOpen(false)}
                                className="sm:w-32 h-12 font-bold" id="reportsclientpage-button-cerrar" data-testid="reportsclientpage-close-button"
                            >
                                Cerrar
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <div className="bg-slate-800/50 p-4 rounded-xl mt-6">
                <h3 className="text-sm font-bold mb-2 text-white">Debug Info (Categorías):</h3>
                <pre className="text-xs text-slate-400 overflow-auto max-h-40">
                    {JSON.stringify((data as any)?.debugInfo, null, 2)}
                </pre>
            </div>
        </div>
    );
}
