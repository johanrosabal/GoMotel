
'use client';

import { useState, useTransition } from 'react';
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

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tables: RestaurantTable[];
}

export default function TableManagementDialog({ open, onOpenChange, tables }: Props) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [newNumber, setNewNumber] = useState('');
    const [newType, setNewType] = useState<'Table' | 'Bar'>('Table');

    const handleAdd = () => {
        if (!newNumber) return;
        startTransition(async () => {
            const result = await createRestaurantTable({ number: newNumber, type: newType });
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Éxito', description: 'Ubicación agregada correctamente.' });
                setNewNumber('');
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
                        Añada o elimine las ubicaciones físicas de su restaurante.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-3 gap-3 items-end bg-muted/30 p-4 rounded-xl border border-dashed">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase">Número/ID</Label>
                            <Input 
                                placeholder="Ej: 15" 
                                value={newNumber} 
                                onChange={(e) => setNewNumber(e.target.value)}
                                className="h-10 font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase">Tipo</Label>
                            <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                                <SelectTrigger className="h-10 font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Table">Mesa Salón</SelectItem>
                                    <SelectItem value="Bar">Barra</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleAdd} disabled={isPending || !newNumber} className="h-10 font-black uppercase text-[10px]">
                            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Ubicaciones Actuales</h4>
                        <ScrollArea className="h-64 rounded-xl border bg-background">
                            <div className="p-3 space-y-2">
                                {tables.length === 0 ? (
                                    <p className="text-center py-10 text-xs text-muted-foreground italic">No hay ubicaciones configuradas.</p>
                                ) : (
                                    tables.map(table => (
                                        <div key={table.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10 group">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-full bg-background border">
                                                    {table.type === 'Table' ? <Utensils className="h-4 w-4" /> : <Beer className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <p className="font-black text-sm">{table.type === 'Table' ? 'Mesa' : 'Barra'} {table.number}</p>
                                                    <Badge variant="outline" className="text-[8px] font-bold uppercase">{table.status === 'Available' ? 'Libre' : 'Ocupada'}</Badge>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                disabled={isPending || table.status === 'Occupied'}
                                                onClick={() => handleDelete(table.id)}
                                                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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

                <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)} className="font-bold">Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
