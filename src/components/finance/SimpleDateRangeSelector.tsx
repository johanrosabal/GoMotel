"use client"

import * as React from "react"
import { DateRange } from "react-day-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "lucide-react"

interface SimpleDateRangeSelectorProps {
    date: DateRange | undefined
    setDate: (date: DateRange | undefined) => void
}

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

export function SimpleDateRangeSelector({ date, setDate }: SimpleDateRangeSelectorProps) {
    const from = date?.from || new Date();
    const to = date?.to || new Date();

    const updateDate = (type: 'from' | 'to', part: 'day' | 'month' | 'year', value: string) => {
        const current = type === 'from' ? from : to;
        const newDate = new Date(current);
        
        if (part === 'day') newDate.setDate(parseInt(value));
        if (part === 'month') newDate.setMonth(parseInt(value));
        if (part === 'year') newDate.setFullYear(parseInt(value));

        if (type === 'from') {
            setDate({ from: newDate, to: date?.to || newDate });
        } else {
            setDate({ from: date?.from || new Date(), to: newDate });
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Start Date Section */}
            <div className="space-y-6 p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 relative overflow-hidden group transition-all hover:bg-white/[0.05]">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.15)]">
                        <Calendar className="h-5 w-5" />
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-[0.4em] text-white/90">Fecha de Inicio</span>
                </div>
                
                <div className="grid grid-cols-[65px_1fr_85px] gap-3">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-full text-center block mb-1">Día</label>
                        <Select value={from.getDate().toString()} onValueChange={(v) => updateDate('from', 'day', v)}>
                            <SelectTrigger className="h-14 bg-black/40 border-white/5 rounded-2xl text-base font-bold focus:ring-primary/30 justify-center hover:bg-black/60 transition-all px-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                                {DAYS.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-full text-center block mb-1">Mes</label>
                        <Select value={from.getMonth().toString()} onValueChange={(v) => updateDate('from', 'month', v)}>
                            <SelectTrigger className="h-14 bg-black/40 border-white/5 rounded-2xl text-base font-bold focus:ring-primary/30 hover:bg-black/60 transition-all px-4">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                                {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-full text-center block mb-1">Año</label>
                        <Select value={from.getFullYear().toString()} onValueChange={(v) => updateDate('from', 'year', v)}>
                            <SelectTrigger className="h-14 bg-black/40 border-white/5 rounded-2xl text-base font-bold focus:ring-primary/30 justify-center hover:bg-black/60 transition-all px-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                                {YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* End Date Section */}
            <div className="space-y-6 p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 relative overflow-hidden group transition-all hover:bg-white/[0.05]">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
                        <Calendar className="h-5 w-5" />
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-[0.4em] text-white/90">Fecha de Fin</span>
                </div>
                
                <div className="grid grid-cols-[65px_1fr_85px] gap-3">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-full text-center block mb-1">Día</label>
                        <Select value={to.getDate().toString()} onValueChange={(v) => updateDate('to', 'day', v)}>
                            <SelectTrigger className="h-14 bg-black/40 border-white/5 rounded-2xl text-base font-bold focus:ring-rose-500/30 justify-center hover:bg-black/60 transition-all px-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                                {DAYS.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-full text-center block mb-1">Mes</label>
                        <Select value={to.getMonth().toString()} onValueChange={(v) => updateDate('to', 'month', v)}>
                            <SelectTrigger className="h-14 bg-black/40 border-white/5 rounded-2xl text-base font-bold focus:ring-rose-500/30 hover:bg-black/60 transition-all px-4">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                                {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-full text-center block mb-1">Año</label>
                        <Select value={to.getFullYear().toString()} onValueChange={(v) => updateDate('to', 'year', v)}>
                            <SelectTrigger className="h-14 bg-black/40 border-white/5 rounded-2xl text-base font-bold focus:ring-rose-500/30 justify-center hover:bg-black/60 transition-all px-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                                {YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    );
}
