'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { getDashboardStats } from '@/lib/actions/report.actions';
import { analyzePerformance } from '@/ai/flows/performance-analysis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { 
    TrendingUp, Users, AlertTriangle, Sparkles, BrainCircuit, 
    Calendar, Download, ArrowRight, DollarSign, PieChart as PieIcon,
    Receipt, PackageSearch
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function ReportsClientPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, startAnalysis] = useTransition();
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);
    const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
    const stockReportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getDashboardStats(7).then(res => {
            setData(res);
            setIsLoading(false);
        });
    }, []);

    const handleAiAnalysis = () => {
        startAnalysis(async () => {
            const result = await analyzePerformance(data.rawForAI);
            setAiAnalysis(result);
        });
    };

    const handleExportStockPdf = () => {
        const input = stockReportRef.current;
        if (!input) return;

        html2canvas(input, { scale: 2, backgroundColor: '#ffffff' }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`reporte-stock-bajo-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        });
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-80 w-full" />
                    <Skeleton className="h-80 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* KPI Section */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Ingresos (7d)</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{formatCurrency(data.kpis.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total facturado en el periodo</p>
                        <Button variant="link" size="sm" className="p-0 h-auto mt-3 text-primary font-bold" asChild>
                            <Link href="/billing/invoices">
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
                        "transition-all duration-200 cursor-pointer hover:shadow-md",
                        data.kpis.lowStockCount > 0 ? "border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10" : "hover:bg-muted/50"
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
                            <p className="text-[10px] text-yellow-700 font-bold uppercase mt-3 flex items-center gap-1">
                                Ver cuáles son <ArrowRight className="h-2.5 w-2.5" />
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
                        <p className="text-xs text-muted-foreground mt-1">Facturas emitidas (7d)</p>
                    </CardContent>
                </Card>
            </div>

            {/* AI Analysis Button */}
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
                <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-primary/10">
                            <BrainCircuit className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Análisis de Rendimiento con IA</h3>
                            <p className="text-sm text-muted-foreground">Obtén un resumen ejecutivo y sugerencias basadas en tus datos actuales.</p>
                        </div>
                    </div>
                    <Button onClick={handleAiAnalysis} disabled={isAnalyzing} className="font-bold">
                        {isAnalyzing ? "Analizando..." : "Generar Informe IA"}
                        <Sparkles className="ml-2 h-4 w-4" />
                    </Button>
                </CardContent>
                {aiAnalysis && (
                    <CardFooter className="flex-col items-start bg-muted/30 p-6 border-t animate-in fade-in duration-500">
                        <div className="space-y-4 w-full">
                            <div>
                                <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary mb-2">Resumen Ejecutivo</h4>
                                <p className="text-sm leading-relaxed">{aiAnalysis.summary}</p>
                            </div>
                            <div>
                                <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary mb-2">Sugerencias Estratégicas</h4>
                                <ul className="space-y-2">
                                    {aiAnalysis.suggestions.map((s: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                                <span className="text-[10px] font-bold text-primary">{i+1}</span>
                                            </div>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </CardFooter>
                )}
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Revenue Chart */}
                <Card>
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
                                <YAxis fontSize={12} tickFormatter={(v) => `₡${v/1000}k`} />
                                <Tooltip 
                                    formatter={(v) => formatCurrency(v as number)}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Payment Methods Chart */}
                <Card>
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
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Breakdown Table */}
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
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/billing/invoices">
                            Ver Historial de Facturación Completo
                        </Link>
                    </Button>
                </CardFooter>
            </Card>

            {/* Low Stock Dialog */}
            <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <div ref={stockReportRef} className="bg-background p-2">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <PackageSearch className="h-5 w-5 text-yellow-600" />
                                Productos con Stock Bajo
                            </DialogTitle>
                            <DialogDescription>
                                Artículos que han alcanzado o superado su punto de reorden. Generado el {format(new Date(), "dd/MM/yyyy", { locale: es })}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="text-xs font-bold uppercase">Producto</TableHead>
                                            <TableHead className="text-center text-xs font-bold uppercase">Stock</TableHead>
                                            <TableHead className="text-center text-xs font-bold uppercase">Mínimo</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.lowStockDetails?.map((item: any) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium text-sm">{item.name}</TableCell>
                                                <TableCell className="text-center font-bold text-destructive">{item.stock}</TableCell>
                                                <TableCell className="text-center text-muted-foreground text-sm">{item.minStock}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={handleExportStockPdf} className="gap-2">
                            <Download className="h-4 w-4" />
                            Exportar PDF
                        </Button>
                        <Button variant="secondary" onClick={() => setIsStockDialogOpen(false)}>Cerrar</Button>
                        <Button asChild>
                            <Link href="/inventory">Ir a Inventario</Link>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}