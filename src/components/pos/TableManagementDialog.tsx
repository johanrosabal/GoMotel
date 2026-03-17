'use client';

import { useState, useTransition, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createRestaurantTable, deleteRestaurantTable } from '@/lib/actions/restaurant.actions';
import type { RestaurantTable } from '@/types';
import { Trash2, Plus, Utensils, Beer, Sun, MapPin, ChevronLeft, QrCode, Download } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import LocationQrReport from './LocationQrReport';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tables: RestaurantTable[];
}

const DEFAULT_TYPES = [
    { value: 'Table', label: 'Mesa Salón', icon: Utensils },
    { value: 'Bar', label: 'Barra', icon: Beer },
    { value: 'Terraza', label: 'Terraza', icon: Sun },
];

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

export default function TableManagementDialog({ open, onOpenChange, tables }: Props) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [newType, setNewType] = useState<string>('Table');
    const [customType, setCustomType] = useState('');
    const [isAddingCustomType, setIsAddingCustomType] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const qrReportRef = useRef<HTMLDivElement>(null);

    const activeType = useMemo(() => isAddingCustomType ? customType : newType, [isAddingCustomType, customType, newType]);

    const filteredTablesForList = useMemo(() => {
        if (!activeType && isAddingCustomType) return [];
        return tables.filter(t => t.type === activeType).sort((a,b) => 
            a.number.localeCompare(b.number, undefined, { numeric: true })
        );
    }, [tables, activeType, isAddingCustomType]);

    const nextNumber = useMemo(() => {
        const numbers = filteredTablesForList
            .map(t => parseInt(t.number, 10))
            .filter(n => !isNaN(n));
        const max = numbers.length > 0 ? Math.max(...numbers) : 0;
        return String(max + 1).padStart(2, '0');
    }, [filteredTablesForList]);

    const handleAdd = () => {
        const finalType = isAddingCustomType ? customType.trim() : newType;
        if (!finalType) {
            toast({ title: 'Error', description: 'Debe ingresar un tipo válido.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            const result = await createRestaurantTable({ number: nextNumber, type: finalType });
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                const label = TYPE_LABELS[finalType] || finalType;
                toast({ title: 'Éxito', description: `${label} ${nextNumber} agregada correctamente.` });
                if (isAddingCustomType) {
                    setIsAddingCustomType(false);
                    setNewType(customType);
                    setCustomType('');
                }
            }
        });
    };

    const handleDelete = (id: string) => {
        startTransition(async () => {
            const result = await deleteRestaurantTable(id);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Eliminado', description: 'Ubicación eliminada.' });
            }
        });
    };

    const handleExportQrPdf = async () => {
        const input = qrReportRef.current;
        if (!input || tables.length === 0) return;

        setIsExporting(true);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pages = input.querySelectorAll('.qr-pdf-page');
        const baseUrl = window.location.origin;

        // Sort tables for logical link assignment
        const sortedTables = [...tables].sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.number.localeCompare(b.number, undefined, { numeric: true });
        });

        try {
            for (let i = 0; i < pages.length; i++) {
                const canvas = await html2canvas(pages[i] as HTMLElement, { 
                    scale: 2, 
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false
                });
                
                const imgData = canvas.toDataURL('image/png');
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

                // ASIGNACIÓN DE VÍNCULOS CLICKABLES (Lógica 2x2 en A4)
                const tablesInThisPage = sortedTables.slice(i * 4, (i + 1) * 4);
                tablesInThisPage.forEach((table, idx) => {
                    const orderUrl = `${baseUrl}/public/order?tableId=${table.id}`;
                    
                    // Calcular cuadrante (x, y en mm)
                    const col = idx % 2; // 0 o 1
                    const row = Math.floor(idx / 2); // 0 o 1
                    
                    const x = col * 105;
                    const y = row * 148.5;

                    // Añadir link sobre toda el área del cuadrante (más robusto)
                    // pdf.link(x + 10, y + 10, 85, 128, { url: orderUrl });
                    
                    // Añadir link específico sobre el área del código QR y URL text
                    // Aproximadamente el centro del cuadrante
                    pdf.link(x + 25, y + 40, 55, 70, { url: orderUrl });
                });
            }
            pdf.save(`QR-UBICACIONES-${new Date().getTime()}.pdf`);
            toast({ title: '¡Éxito!', description: 'El PDF con vínculos funcionales ha sido generado.' });
        } catch (error) {
            console.error("Error al exportar QRs:", error);
            toast({ title: 'Error', description: 'No se pudo generar el PDF.', variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    };

    const getTypeIcon = (type: string) => {
        if (type === 'Table') return Utensils;
        if (type === 'Bar') return Beer;
        if (type === 'Terraza') return Sun;
        return MapPin;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[95vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Gestión de Ubicaciones</DialogTitle>
                    <DialogDescription>
                        Añada o elimine las zonas de servicio de su restaurante.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/20 p-5 rounded-2xl border border-dashed border-primary/20">
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tipo de Zona</Label>
                            {isAddingCustomType ? (
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" onClick={() => setIsAddingCustomType(false)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Input 
                                        placeholder="Ej: VIP, Piscina..." 
                                        value={customType} 
                                        onChange={(e) => setCustomType(e.target.value)}
                                        className="h-11 font-bold rounded-xl border-2"
                                        autoFocus
                                    />
                                </div>
                            ) : (
                                <Select value={newType} onValueChange={(v) => v === 'ADD_NEW' ? setIsAddingCustomType(true) : setNewType(v)} disabled={isPending}>
                                    <SelectTrigger className="h-11 font-bold rounded-xl bg-background border-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DEFAULT_TYPES.map(t => (
                                            <SelectItem key={t.value} value={t.value}>
                                                <div className="flex items-center gap-2">
                                                    <t.icon className="h-4 w-4" /> {t.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                        {Array.from(new Set(tables.map(t => t.type)))
                                            .filter(t => !DEFAULT_TYPES.some(dt => dt.value === t))
                                            .map(t => (
                                                <SelectItem key={t} value={t}>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-4 w-4" /> {t}
                                                    </div>
                                                </SelectItem>
                                            ))
                                        }
                                        <SelectItem value="ADD_NEW" className="text-primary font-bold">
                                            <div className="flex items-center gap-2">
                                                <Plus className="h-4 w-4" /> Añadir nuevo tipo...
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Próximo N°</Label>
                            <Input 
                                value={nextNumber} 
                                readOnly
                                className="h-11 font-black text-center text-xl bg-primary/5 border-2 border-primary/20 rounded-xl font-mono text-primary pointer-events-none"
                            />
                        </div>

                        <Button 
                            onClick={handleAdd} 
                            disabled={isPending || (isAddingCustomType && !customType)} 
                            className="md:col-span-3 h-11 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-primary/10"
                        >
                            <Plus className="mr-1 h-4 w-4" /> Agregar Ubicación
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                {isAddingCustomType ? 'Ubicaciones Existentes' : `Mapa de ${TYPE_LABELS[newType] || newType}`}
                            </h4>
                            <Badge variant="secondary" className="text-[9px] font-bold">{filteredTablesForList.length} Mostradas</Badge>
                        </div>
                        <div className="rounded-2xl border bg-background/50 backdrop-blur-sm p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {filteredTablesForList.length === 0 ? (
                                <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground/40">
                                    <MapPin className="h-10 w-10 mb-2" />
                                    <p className="text-xs font-bold uppercase tracking-widest italic">
                                        {isAddingCustomType && !customType ? 'Ingrese un tipo para filtrar' : 'Sin ubicaciones en este tipo'}
                                    </p>
                                </div>
                            ) : (
                                filteredTablesForList.map(table => {
                                    const Icon = getTypeIcon(table.type);
                                    const label = TYPE_LABELS[table.type] || table.type;
                                    return (
                                        <div key={table.id} className={cn(
                                            "flex items-center justify-between p-3 rounded-xl border transition-all group",
                                            table.status === 'Occupied' ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-transparent hover:border-primary/30"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "p-2 rounded-lg border shadow-sm",
                                                    table.status === 'Occupied' ? "bg-primary text-primary-foreground" : "bg-background"
                                                )}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-sm tracking-tight">{label} {table.number}</p>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn(
                                                            "w-1.5 h-1.5 rounded-full",
                                                            table.status === 'Occupied' ? "bg-blue-500 animate-pulse" : "bg-green-500"
                                                        )} />
                                                        <span className="text-[8px] font-black uppercase text-muted-foreground/70">
                                                            {table.status === 'Available' ? 'Libre' : 'En uso'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                disabled={isPending || table.status === 'Occupied'}
                                                onClick={() => handleDelete(table.id)}
                                                className="text-muted-foreground hover:text-destructive h-8 w-8 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 border-t bg-muted/5 flex flex-col sm:flex-row gap-3">
                    <Button 
                        variant="outline" 
                        className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2 border-2" 
                        onClick={handleExportQrPdf}
                        disabled={isExporting || tables.length === 0}
                    >
                        <QrCode className="h-4 w-4" />
                        {isExporting ? 'Generando...' : 'Exportar QRs con Hipervínculos'}
                    </Button>
                    <Button variant="secondary" onClick={() => onOpenChange(false)} className="sm:w-32 h-12 font-bold">Cerrar</Button>
                </DialogFooter>

                <div className="absolute -left-[9999px] top-0 pointer-events-none">
                    <LocationQrReport tables={tables} ref={qrReportRef} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
