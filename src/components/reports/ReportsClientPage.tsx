'use client';

import { useState, useEffect, useTransition, useRef, useMemo } from 'react';
import { getDashboardStats } from '@/lib/actions/report.actions';
import { analyzePerformance } from '@/ai/flows/performance-analysis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { 
    TrendingUp, Users, AlertTriangle, Sparkles, BrainCircuit, 
    Download, ArrowRight, DollarSign, PieChart as PieIcon,
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
  DialogFooter,
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
    const [isExporting, setIsExporting] = useState(false);
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
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-80 w-full" />
                    <Skeleton className="h-80 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
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
                        <p className="text-xs text-muted-foreground mt-1">Facturas emitidas (7d)</p>
                    </CardContent>
                </Card>
            </div>

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
                                className="flex-1 h-12 gap-2 font-black uppercase tracking-widest border-2 border-gray-800 hover:bg-gray-800 hover:text-white transition-colors"
                            >
                                <Download className="h-5 w-5" />
                                {isExporting ? "Generando Reporte..." : "Exportar Reporte Contable"}
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => setIsStockDialogOpen(false)} 
                                className="sm:w-32 h-12 font-bold"
                            >
                                Cerrar
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}