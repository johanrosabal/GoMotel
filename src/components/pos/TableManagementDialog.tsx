'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createRestaurantTable, deleteRestaurantTable } from '@/lib/actions/restaurant.actions';
import type { RestaurantTable } from '@/types';
import { Trash2, Plus, Utensils, Beer } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tables: RestaurantTable[];
}

export default function TableManagementDialog({ open, onOpenChange, tables }: Props) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [newType, setNewType] = useState<'Table' | 'Bar'>('Table');

    // Calcular el siguiente número automáticamente basado en las existentes del mismo tipo
    const nextNumber = useMemo(() => {
        const typeTables = tables.filter(t => t.type === newType);
        const numbers = typeTables
            .map(t => parseInt(t.number, 10))
            .filter(n => !isNaN(n));
        
        const max = numbers.length > 0 ? Math.max(...numbers) : 0;
        return String(max + 1).padStart(2, '0');
    }, [tables, newType]);

    const handleAdd = () => {
        startTransition(async () => {
            const result = await createRestaurantTable({ number: nextNumber, type: newType });
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Éxito', description: `Ubicación ${nextNumber} agregada correctamente.` });
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Gestión de Mesas y Barra</DialogTitle>
                    <DialogDescription>
                        Añada o elimine las ubicaciones físicas de su restaurante. La numeración es automática.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/20 p-5 rounded-2xl border border-dashed border-primary/20">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tipo</Label>
                            <Select value={newType} onValueChange={(v: any) => setNewType(v)} disabled={isPending}>
                                <SelectTrigger className="h-11 font-bold rounded-xl bg-background border-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Table">Mesa Salón</SelectItem>
                                    <SelectItem value="Bar">Barra</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Próximo N°</Label>
                            <div className="relative">
                                <Input 
                                    value={nextNumber} 
                                    readOnly
                                    className="h-11 font-black text-center text-xl bg-primary/5 border-2 border-primary/20 rounded-xl font-mono text-primary pointer-events-none"
                                />
                            </div>
                        </div>

                        <Button 
                            onClick={handleAdd} 
                            disabled={isPending} 
                            className="h-11 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-primary/10"
                        >
                            <Plus className="mr-1 h-4 w-4" /> Agregar {newType === 'Table' ? 'Mesa' : 'Barra'}
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ubicaciones Actuales</h4>
                            <Badge variant="secondary" className="text-[9px] font-bold">{tables.length} Total</Badge>
                        </div>
                        <ScrollArea className="h-64 rounded-2xl border bg-background/50 backdrop-blur-sm">
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {tables.length === 0 ? (
                                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground/40">
                                        {newType === 'Table' ? <Utensils className="h-10 w-10 mb-2" /> : <Beer className="h-10 w-10 mb-2" />}
                                        <p className="text-xs font-bold uppercase tracking-widest italic">Sin ubicaciones</p>
                                    </div>
                                ) : (
                                    [...tables].sort((a,b) => {
                                        if(a.type !== b.type) return a.type === 'Table' ? -1 : 1;
                                        return a.number.localeCompare(b.number, undefined, { numeric: true });
                                    }).map(table => (
                                        <div key={table.id} className={cn(
                                            "flex items-center justify-between p-3 rounded-xl border transition-all group",
                                            table.status === 'Occupied' ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-transparent hover:border-primary/30"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "p-2 rounded-lg border shadow-sm",
                                                    table.status === 'Occupied' ? "bg-primary text-primary-foreground" : "bg-background"
                                                )}>
                                                    {table.type === 'Table' ? <Utensils className="h-4 w-4" /> : <Beer className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <p className="font-black text-sm tracking-tight">{table.type === 'Table' ? 'Mesa' : 'Barra'} {table.number}</p>
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
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="bg-muted/10 p-4 -m-6 mt-2 rounded-b-lg">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full font-bold h-11 rounded-xl">Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}