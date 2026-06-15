'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Stay } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import StaysTable from "./StaysTable";
import { useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, CalendarDays, Search, Filter, Trophy, Clock, CheckCircle2, FileText, LineChart } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { SimpleDateRangeSelector } from "@/components/finance/SimpleDateRangeSelector";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

type StatusFilter = 'all' | 'active' | 'completed';

export default function StaysReportPage() {
    const { firestore } = useFirebase();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [daysRange, setDaysRange] = useState<number | 'month'>(1);
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
    const [isExporting, setIsExporting] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    const staysQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "stays"), orderBy("checkIn", "desc"));
    }, [firestore]);

    const { data: stays, isLoading } = useCollection<Stay>(staysQuery);

    const filteredStays = useMemo(() => {
        if (!stays) return [];
        
        let startDate: Date;
        let endDate: Date = endOfDay(new Date());

        if (customDateRange?.from) {
            startDate = startOfDay(customDateRange.from);
            endDate = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(customDateRange.from);
        } else if (daysRange === 'month') {
            const now = new Date();
            startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        } else {
            startDate = startOfDay(subDays(new Date(), (daysRange as number) - 1));
        }

        return stays.filter(stay => {
            const date = stay.checkIn ? new Date(stay.checkIn.toDate()) : new Date();
            const isInRange = isWithinInterval(date, { start: startDate, end: endDate });
            
            const searchContent = `${stay.guestName} ${stay.roomNumber}`.toLowerCase();
            const searchMatch = searchContent.includes(searchTerm.toLowerCase());

            let statusMatch = true;
            if (statusFilter === 'active') {
                statusMatch = !stay.checkOut;
            } else if (statusFilter === 'completed') {
                statusMatch = !!stay.checkOut;
            }

            return isInRange && searchMatch && statusMatch;
        });
    }, [stays, searchTerm, statusFilter, daysRange, customDateRange]);

    // Calculate room ranking
    const roomRanking = useMemo(() => {
        const ranking: { [key: string]: number } = {};
        filteredStays.forEach(stay => {
            if (stay.roomNumber) {
                ranking[stay.roomNumber] = (ranking[stay.roomNumber] || 0) + 1;
            }
        });
        return Object.entries(ranking)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5
    }, [filteredStays]);

    // Calculate income per room
    const roomIncomeData = useMemo(() => {
        const income: { [key: string]: number } = {};
        filteredStays.forEach(stay => {
            if (stay.roomNumber && stay.total && stay.isPaid) {
                income[stay.roomNumber] = (income[stay.roomNumber] || 0) + stay.total;
            }
        });
        return Object.entries(income)
            .map(([room, total]) => ({ 
                name: `Hab ${room}`, 
                total 
            }))
            .sort((a, b) => b.total - a.total);
    }, [filteredStays]);

    const stats = useMemo(() => {
        return {
            total: filteredStays.length,
            completed: filteredStays.filter(s => !!s.checkOut).length,
            active: filteredStays.filter(s => !s.checkOut).length
        };
    }, [filteredStays]);

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const doc = new jsPDF();
            
            // Title
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59); // slate-800
            doc.text('REPORTE DE ESTANCIAS', 14, 22);
            
            // Subtitle / Date
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);
            
            // Summary Cards in a table
            autoTable(doc, {
                head: [['Métrica', 'Valor']],
                body: [
                    ['Total Estancias', stats.total.toString()],
                    ['Estancias Activas', stats.active.toString()],
                    ['Estancias Completadas', stats.completed.toString()],
                ],
                startY: 35,
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42] }, // slate-900
            });
            
            // Top Rooms
            let currentY = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text('Habitaciones más Solicitadas', 14, currentY);
            
            autoTable(doc, {
                head: [['Posición', 'Habitación', 'Estancias']],
                body: roomRanking.map(([room, count], index) => [
                    `#${index + 1}`,
                    `Habitación ${room}`,
                    count.toString()
                ]),
                startY: currentY + 5,
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42] },
            });
            
            // Chart
            currentY = (doc as any).lastAutoTable.finalY + 10;
            
            if (chartRef.current) {
                const canvas = await html2canvas(chartRef.current, {
                    backgroundColor: '#0f172a', // Match the dark background!
                    scale: 2 // Higher quality!
                });
                const imgData = canvas.toDataURL('image/png');
                
                const imgWidth = 180; // Width in PDF
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                if (currentY + imgHeight > 280) {
                    doc.addPage();
                    currentY = 20;
                }
                
                doc.setFontSize(12);
                doc.setTextColor(30, 41, 59);
                doc.text('Ingresos Generados por Habitación', 14, currentY);
                
                doc.addImage(imgData, 'PNG', 14, currentY + 5, imgWidth, imgHeight);
                currentY += imgHeight + 15;
            }
            
            // Detailed Table
            if (currentY > 200) {
                doc.addPage();
                currentY = 20;
            }
            
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text('Detalle de Estancias', 14, currentY);
            
            autoTable(doc, {
                head: [['Huésped', 'Habitación', 'Check-in', 'Check-out', 'Total', 'Estado']],
                body: filteredStays.map(stay => [
                    stay.guestName,
                    stay.roomNumber,
                    format(stay.checkIn.toDate(), "dd/MM/yyyy HH:mm"),
                    stay.checkOut ? format(stay.checkOut.toDate(), "dd/MM/yyyy HH:mm") : 'En curso',
                    stay.isPaid ? formatCurrency(stay.total).replace(/[^\d.,]/g, '') : '-', // Remove symbol!
                    stay.checkOut ? 'Completada' : 'Activa'
                ]),
                startY: currentY + 5,
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42] },
            });
            
            doc.save(`Reporte_Estancias_${format(new Date(), 'yyyyMMdd')}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row justify-between gap-6 bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
                {/* Search and Status */}
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Buscar huésped o habitación..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-11 bg-black/40 border-white/5 rounded-xl text-sm focus:ring-primary/20"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                            <SelectTrigger className="pl-10 h-11 w-[180px] bg-black/40 border-white/5 rounded-xl text-sm focus:ring-primary/20">
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 rounded-xl">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="active">Activas</SelectItem>
                                <SelectItem value="completed">Completadas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Date Filters */}
                <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
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
                                    Defina un periodo específico para consultar las estancias.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-6">
                                <SimpleDateRangeSelector date={customDateRange} setDate={setCustomDateRange} />
                            </div>
                        </DialogContent>
                    </Dialog>
                    
                    <Button
                        variant="outline"
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="h-9 px-4 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all border-white/5 text-slate-500 hover:text-white hover:bg-white/10 ml-2"
                    >
                        <FileText className="h-3 w-3 mr-2" />
                        {isExporting ? "Exportando..." : "Exportar PDF"}
                    </Button>
                </div>
            </div>

            {/* Stats and Ranking Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Ranking Card */}
                <div className="lg:col-span-2 relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
                    <Card className="relative bg-black/40 backdrop-blur-2xl border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-500">
                        <CardHeader className="pb-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                                    <Trophy className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/80">Rendimiento</span>
                                    <CardTitle className="text-xl font-black uppercase italic tracking-tight text-white">Habitaciones más Solicitadas</CardTitle>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="relative z-10 pt-2">
                            <div className="space-y-4">
                                {roomRanking.length > 0 ? (
                                    roomRanking.map(([room, count], index) => (
                                        <div key={room} className="flex items-center justify-between bg-white/[0.02] p-3 rounded-xl border border-white/5 hover:bg-white/[0.05] transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black",
                                                    index === 0 ? "bg-amber-500 text-black" : 
                                                    index === 1 ? "bg-slate-400 text-black" : 
                                                    index === 2 ? "bg-amber-700 text-white" : "bg-white/10 text-white"
                                                )}>
                                                    #{index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white">Habitación {room}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suite Ocupada</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-mono font-black text-white">{count}</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estancias</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-slate-500 text-sm font-bold uppercase tracking-wider">
                                        No hay datos en este periodo
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Total Stays */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
                    <Card className="relative bg-black/40 backdrop-blur-2xl border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-500 h-full flex flex-col justify-between">
                        <CardHeader className="pb-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Volumen Total</span>
                            </div>
                        </CardHeader>
                        <CardContent className="relative z-10 pb-8 flex-1 flex flex-col justify-end">
                            <div className="text-6xl font-black tracking-tighter mb-2 font-mono bg-gradient-to-br from-white via-white to-primary/60 bg-clip-text text-transparent">
                                {stats.total}
                            </div>
                            <div className="flex items-center gap-2 text-primary/60">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">Estancias registradas</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Stays Breakdowns */}
                <div className="flex flex-col gap-4">
                    {/* Activas */}
                    <Card className="bg-black/40 backdrop-blur-2xl border-white/5 rounded-3xl overflow-hidden p-5 flex-1 flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-500">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Activas</p>
                                <div className="text-3xl font-black font-mono text-white mt-1">{stats.active}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <Clock className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-2">En curso actualmente</p>
                    </Card>

                    {/* Completadas */}
                    <Card className="bg-black/40 backdrop-blur-2xl border-white/5 rounded-3xl overflow-hidden p-5 flex-1 flex flex-col justify-between hover:border-blue-500/30 transition-all duration-500">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Completadas</p>
                                <div className="text-3xl font-black font-mono text-white mt-1">{stats.completed}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-2">Finalizadas con éxito</p>
                    </Card>
                </div>
            </div>

            {/* Income Chart Section */}
            <div ref={chartRef} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-[2.5rem] blur opacity-5 group-hover:opacity-10 transition duration-500"></div>
                <Card className="relative bg-black/40 backdrop-blur-2xl border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-500">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/20">
                                <LineChart className="h-5 w-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-500/80">Finanzas por Habitación</span>
                                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-white">Ingresos Generados</CardTitle>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {roomIncomeData.length > 0 ? (
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={roomIncomeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <XAxis 
                                            dataKey="name" 
                                            stroke="#64748b" 
                                            fontSize={11}
                                            fontWeight="bold"
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis 
                                            stroke="#64748b" 
                                            fontSize={11}
                                            fontWeight="bold"
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => formatCurrency(value)}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "#0f172a",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                borderRadius: "1rem",
                                                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)"
                                            }}
                                            labelStyle={{ color: "#94a3b8", fontWeight: "bold", fontSize: "12px" }}
                                            itemStyle={{ color: "#fff", fontWeight: "bold", fontSize: "12px" }}
                                            cursor={{ fill: "rgba(255,255,255,0.03)" }}
                                            formatter={(value) => [formatCurrency(value as number), "Ingresos"]}
                                        />
                                        <Bar 
                                            dataKey="total" 
                                            fill="#8b5cf6" 
                                            radius={[8, 8, 0, 0]}
                                            maxBarSize={50}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="text-center py-16 text-slate-500 font-bold uppercase tracking-wider">
                                No hay datos de ingresos en este periodo
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Table Area */}
            {isLoading ? (
                <div className="space-y-4 bg-slate-900/50 p-6 rounded-3xl border border-white/5">
                    <Skeleton className="h-12 w-full bg-white/5" />
                    <Skeleton className="h-12 w-full bg-white/5" />
                    <Skeleton className="h-12 w-full bg-white/5" />
                </div>
            ) : (
                <div className="bg-slate-900/50 rounded-3xl border border-white/5 overflow-hidden">
                    <StaysTable stays={filteredStays} />
                </div>
            )}
        </div>
    );
}
