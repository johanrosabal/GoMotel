'use client';

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "../ui/button";

interface DateTimePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
}

export default function DateTimePicker({ date, setDate }: DateTimePickerProps) {
    const handleDateSelect = (selectedDay: Date | undefined) => {
        if (!selectedDay) {
            setDate(undefined);
            return;
        }
        const newDate = new Date(
            selectedDay.getFullYear(),
            selectedDay.getMonth(),
            selectedDay.getDate(),
            date?.getHours() ?? 0,
            date?.getMinutes() ?? 0
        );
        setDate(newDate);
    };

    const handleTimeChange = (value: string, unit: 'hours' | 'minutes') => {
        if (!date) return;
        const newDate = new Date(date);
        if (unit === 'hours') {
            newDate.setHours(parseInt(value, 10));
        } else {
            // Snap to nearest 15 minutes
            const newMinutes = parseInt(value, 10);
            newDate.setMinutes(newMinutes);
        }
        setDate(newDate);
    };

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP", { locale: es }) : <span>Seleccione una fecha</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={handleDateSelect}
                        initialFocus
                        locale={es}
                        disabled={(day) => day < new Date(new Date().setDate(new Date().getDate() - 1))}
                    />
                </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2">
                <Select
                    value={String(date?.getHours() ?? '00').padStart(2, '0')}
                    onValueChange={(val) => handleTimeChange(val, 'hours')}
                    disabled={!date}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {hours.map(h => <SelectItem key={h} value={h}>{h} H</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select
                    value={String(date?.getMinutes() ?? '00').padStart(2, '0')}
                    onValueChange={(val) => handleTimeChange(val, 'minutes')}
                    disabled={!date}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {minutes.map(m => <SelectItem key={m} value={m}>{m} min</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
