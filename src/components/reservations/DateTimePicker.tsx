'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DateTimePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
}

export default function DateTimePicker({ date, setDate }: DateTimePickerProps) {
    const selectedDate = date || new Date();

    const day = String(selectedDate.getDate());
    const month = String(selectedDate.getMonth() + 1);
    const year = String(selectedDate.getFullYear());
    const hour = String(selectedDate.getHours()).padStart(2, '0');
    const minute = String(selectedDate.getMinutes()).padStart(2, '0');

    const handleValueChange = (part: 'day' | 'month' | 'year' | 'hour' | 'minute', value: string) => {
        const newDate = new Date(selectedDate);
        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) return;

        switch(part) {
            case 'day':
                newDate.setDate(numValue);
                break;
            case 'month':
                const originalDay = newDate.getDate();
                newDate.setMonth(numValue - 1);
                if (newDate.getDate() !== originalDay) {
                    newDate.setDate(0);
                }
                break;
            case 'year':
                newDate.setFullYear(numValue);
                break;
            case 'hour':
                newDate.setHours(numValue);
                break;
            case 'minute':
                newDate.setMinutes(numValue);
                break;
        }

        setDate(newDate);
    };

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => String(currentYear + i));
    const months = Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: new Date(2000, i, 1).toLocaleString('es', { month: 'long' }),
    }));
    
    const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
    const days = year && month ? Array.from({ length: daysInMonth(parseInt(year, 10), parseInt(month, 10)) }, (_, i) => String(i + 1)) : [];

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    const formatHourForDisplay = (hour24: string) => {
        const hourVal = parseInt(hour24, 10);
        if (hourVal === 0) return '12 AM';
        if (hourVal < 12) return `${hourVal} AM`;
        if (hourVal === 12) return '12 PM';
        return `${hourVal - 12} PM`;
    };

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
                <Select value={day} onValueChange={(value) => handleValueChange('day', value)}>
                    <SelectTrigger id="datetimepicker-selecttrigger-1"><SelectValue placeholder="Día" /></SelectTrigger>
                    <SelectContent>
                        {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={month} onValueChange={(value) => handleValueChange('month', value)}>
                    <SelectTrigger id="datetimepicker-selecttrigger-2"><SelectValue placeholder="Mes" /></SelectTrigger>
                    <SelectContent>
                        {months.map(m => <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <Select value={year} onValueChange={(value) => handleValueChange('year', value)}>
                    <SelectTrigger id="datetimepicker-selecttrigger-3"><SelectValue placeholder="Año" /></SelectTrigger>
                    <SelectContent>
                        {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <Select value={hour} onValueChange={(value) => handleValueChange('hour', value)}>
                    <SelectTrigger id="datetimepicker-selecttrigger-4"><SelectValue placeholder="Hora" /></SelectTrigger>
                    <SelectContent>
                        {hours.map(h => <SelectItem key={h} value={h}>{formatHourForDisplay(h)}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={minute} onValueChange={(value) => handleValueChange('minute', value)}>
                    <SelectTrigger id="datetimepicker-selecttrigger-5"><SelectValue placeholder="Min." /></SelectTrigger>
                    <SelectContent>
                        {minutes.map(m => <SelectItem key={m} value={m}>{m} min</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
