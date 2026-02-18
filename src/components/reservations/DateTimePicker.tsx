'use client';

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
}

export default function DateTimePicker({ date, setDate }: DateTimePickerProps) {
    const initialDate = date || new Date();
    
    const [day, setDay] = useState<string>(String(initialDate.getDate()));
    const [month, setMonth] = useState<string>(String(initialDate.getMonth() + 1));
    const [year, setYear] = useState<string>(String(initialDate.getFullYear()));
    const [hour, setHour] = useState<string>(String(initialDate.getHours()).padStart(2, '0'));
    const [minute, setMinute] = useState<string>(() => {
        const currentMinutes = initialDate.getMinutes();
        if (currentMinutes >= 45) return '45';
        if (currentMinutes >= 30) return '30';
        if (currentMinutes >= 15) return '15';
        return '00';
    });

    useEffect(() => {
        if (date) {
            setDay(String(date.getDate()));
            setMonth(String(date.getMonth() + 1));
            setYear(String(date.getFullYear()));
            setHour(String(date.getHours()).padStart(2, '0'));
            
            const currentMinutes = date.getMinutes();
            if (currentMinutes >= 45) setMinute('45');
            else if (currentMinutes >= 30) setMinute('30');
            else if (currentMinutes >= 15) setMinute('15');
            else setMinute('00');
        }
    }, [date]);
    
    useEffect(() => {
        if (day && month && year && hour && minute) {
            const newDate = new Date(
                parseInt(year, 10),
                parseInt(month, 10) - 1,
                parseInt(day, 10),
                parseInt(hour, 10),
                parseInt(minute, 10)
            );
            if (!isNaN(newDate.getTime())) {
                if (!date || newDate.getTime() !== date.getTime()) {
                    setDate(newDate);
                }
            }
        }
    }, [day, month, year, hour, minute, setDate, date]);
    
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => String(currentYear + i));
    const months = Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: new Date(2000, i, 1).toLocaleString('es', { month: 'long' }),
    }));
    const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
    const days = year && month ? Array.from({ length: daysInMonth(parseInt(year), parseInt(month)) }, (_, i) => String(i + 1)) : [];


    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    const formatHourForDisplay = (hour24: string) => {
        const hourVal = parseInt(hour24, 10);
        if (hourVal === 0) return '12 AM';
        if (hourVal < 12) return `${hourVal} AM`;
        if (hourVal === 12) return '12 PM';
        return `${hourVal - 12} PM`;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="grid grid-cols-3 gap-2">
                <Select value={day} onValueChange={setDay} disabled={!year || !month}>
                    <SelectTrigger><SelectValue placeholder="Día" /></SelectTrigger>
                    <SelectContent>
                        {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                    <SelectContent>
                        {months.map(m => <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <Select value={year} onValueChange={setYear}>
                    <SelectTrigger><SelectValue placeholder="Año" /></SelectTrigger>
                    <SelectContent>
                        {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2">
                <Select value={hour} onValueChange={setHour}>
                    <SelectTrigger><SelectValue placeholder="Hora" /></SelectTrigger>
                    <SelectContent>
                        {hours.map(h => <SelectItem key={h} value={h}>{formatHourForDisplay(h)}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={minute} onValueChange={setMinute}>
                    <SelectTrigger><SelectValue placeholder="Min." /></SelectTrigger>
                    <SelectContent>
                        {minutes.map(m => <SelectItem key={m} value={m}>{m} min</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
