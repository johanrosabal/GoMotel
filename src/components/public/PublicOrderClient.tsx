'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, getDoc } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, SinpeAccount, AppliedTax } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, ChevronRight, X, Utensils, 
    CheckCircle, MessageSquare, MapPin, 
    History, Clock, User
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const SESSION_TOKEN_KEY = 'public_order_session_v1';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // UI State
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [view, setView] = useState<'menu' | 'cart' | 'history'>('menu');

    // Notes state
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Fetch Tables
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    // Fetch Services
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    // Session Management
    useEffect(() => {
        const savedSession = localStorage.getItem(SESSION_TOKEN_KEY);
        if (savedSession) {
            const { tableId, orderId } = JSON.parse(savedSession);
            if (tableId && allTables) {
                const table = allTables.find(t => t.id === tableId);
                if (table) setSelectedTable(table);
            }
            if (orderId) setActiveOrderId(orderId);
        }
    }, [allTables]);

    // Monitor Active Order
    useEffect(() => {
        if (!firestore || !activeOrderId) return;
        const unsub = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Cancelado' || data.paymentStatus === 'Pagado') {
                    // Session ended
                    setActiveOrderId(null);
                    setSelectedTable(null);
                    localStorage.removeItem(SESSION_TOKEN_KEY);
                    toast({ title: 'Cuenta cerrada', description: 'Su cuenta ha sido pagada o cerrada.' });
                }
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId]);

    const activeOrderQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrderId) return null;
        return doc(firestore, 'orders', activeOrderId);
    }, [firestore, activeOrderId]);
    const { data: currentOrder } = useDoc<Order>(activeOrderQuery);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => typeFilter === 'all' || t.type === typeFilter);
    }, [allTables, typeFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => 
            s.isActive && (s.name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [availableServices, searchTerm]);

    const cartTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
    }, [cart]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id 
                    ? { ...i, quantity: i.quantity + 1 } 
                    : i
                );
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: 'Agregado', description: `${service.name} al carrito.` });
    };

    const handleRemoveFromCart = (serviceId: string) => {
        setCart(prev => {
            const item = prev.find(i => i.service.id === serviceId);
            if (item && item.quantity > 1) {
                return prev.map(i => i.service.id === serviceId ? { ...i, quantity: i.quantity - 1 } : i);
            }
            return prev.filter(i => i.service.id !== serviceId);
        });
    };

    const handleSaveNote = () => {
        if (editingNoteIndex === null) return;
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue } : item));
        setNoteDialogOpen(false);
        setEditingNoteIndex(null);
    };

    const handleSendOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Cliente ${selectedTable.number}`);
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                const orderId = result.orderId || activeOrderId;
                setActiveOrderId(orderId);
                localStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify({ tableId: selectedTable.id, orderId }));
                setCart([]);
                setView('history');
                toast({ title: '¡Pedido enviado!', description: 'Su solicitud está siendo procesada.' });
            }
        });
    };

    // --- VIEW: Selection ---
    if (!selectedTable) {
        return (
            <div className="min-h-[100dvh] bg-background p-6 flex flex-col items-center justify-center space-y-8">
                <div className="text-center space-y-2">
                    <div className="h-20 w-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <MapPin className="h-10 w-10 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight">Bienvenido</h1>
                    <p className="text-muted-foreground font-medium">Por favor, seleccione su ubicación para comenzar.</p>
                </div>

                <div className="w-full max-w-sm space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card">
                                <SelectValue placeholder="Todas las zonas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las zonas</SelectItem>
                                <SelectItem value="Table">Mesas</SelectItem>
                                <SelectItem value="Bar">Barra</SelectItem>
                                <SelectItem value="Terraza">Terraza</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {filteredTables.map(table => (
                            <button
                                key={table.id}
                                onClick={() => setSelectedTable(table)}
                                className="h-24 bg-card border-2 rounded-2xl flex flex-col items-center justify-center transition-all hover:border-primary hover:shadow-lg active:scale-95"
                            >
                                <span className="text-3xl font-black">{table.number}</span>
                                <span className="text-[10px] font-bold uppercase opacity-50">{table.type}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-muted/30 overflow-hidden">
            {/* Header */}
            <div className="bg-background border-b px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                        <Utensils className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="font-black uppercase tracking-tight text-sm leading-none">Mesa {selectedTable.number}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{selectedTable.type}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setView('history')}
                        className={cn(
                            "h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all",
                            view === 'history' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                    >
                        <History className="h-4 w-4" /> Mi Cuenta
                    </button>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6 pb-32">
                    {view === 'menu' && (
                        <>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar comida o bebida..." 
                                    className="pl-10 h-12 rounded-2xl border-2 bg-background focus:border-primary transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="bg-card rounded-3xl border-2 overflow-hidden shadow-sm group">
                                        <div className="aspect-[4/5] relative overflow-hidden">
                                            <img src={service.imageUrl || `https://picsum.photos/seed/${service.id}/400/500`} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                            
                                            {/* Top Labels */}
                                            <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap gap-1.5">
                                                <Badge className="bg-white/90 backdrop-blur-md text-black border-none font-black text-[8px] uppercase px-2 py-0.5 rounded-lg shadow-sm">
                                                    {service.category === 'Food' ? 'Comida' : 'Bebida'}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge className="bg-primary/90 backdrop-blur-md text-primary-foreground border-none font-black text-[8px] uppercase px-2 py-0.5 rounded-lg shadow-sm">
                                                        Stock: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Bottom Info Overlay */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-10 z-10">
                                                <h3 className="font-black text-xs uppercase tracking-tight text-white leading-tight mb-2 drop-shadow-md">{service.name}</h3>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-base font-black text-primary drop-shadow-md">{formatCurrency(service.price)}</span>
                                                    <button 
                                                        onClick={() => handleAddToCart(service)}
                                                        className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg active:scale-90 transition-transform"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {view === 'history' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-xl font-black uppercase tracking-tight">Consumo Actual</h3>
                                <button onClick={() => setView('menu')} className="text-primary font-bold text-xs uppercase flex items-center gap-1">
                                    <Plus className="h-3 w-3" /> Añadir más
                                </button>
                            </div>

                            {currentOrder ? (
                                <div className="space-y-4">
                                    <div className="bg-card rounded-3xl border-2 p-6 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between border-b pb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                                                    <CheckCircle className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground leading-none">Estado</p>
                                                    <p className="font-bold text-emerald-600 uppercase mt-1">{currentOrder.status}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground leading-none">Iniciado</p>
                                                <p className="font-bold uppercase mt-1">{formatDistanceToNow(currentOrder.createdAt.toDate(), { locale: es, addSuffix: true })}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {currentOrder.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start py-1">
                                                    <div className="flex gap-3">
                                                        <span className="font-black text-primary">{item.quantity}x</span>
                                                        <div>
                                                            <p className="font-bold uppercase text-[11px] leading-none">{item.name}</p>
                                                            {item.notes && <p className="text-[9px] text-muted-foreground italic mt-1">"{item.notes}"</p>}
                                                        </div>
                                                    </div>
                                                    <span className="font-black text-xs">{formatCurrency(item.price * item.quantity)}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-4 border-t space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground">Total a Pagar</span>
                                                <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(currentOrder.total)}</span>
                                            </div>
                                            <p className="text-[9px] text-center font-bold text-muted-foreground uppercase pt-2">Solicite su factura al personal</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-20 text-center space-y-4">
                                    <ShoppingCart className="h-16 w-16 mx-auto opacity-10" />
                                    <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Aún no tiene pedidos confirmados</p>
                                    <Button onClick={() => setView('menu')} className="rounded-2xl h-12 px-8 font-black uppercase text-xs tracking-widest">Ver Catálogo</Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Footer Cart Bar */}
            {cart.length > 0 && (
                <div className="absolute bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom-10 duration-500">
                    <div className="bg-black text-white p-4 rounded-[2.5rem] shadow-2xl flex items-center justify-between border-2 border-white/10 ring-8 ring-black/5">
                        <div className="flex items-center gap-4 pl-2">
                            <div className="relative">
                                <ShoppingCart className="h-6 w-6 text-primary" />
                                <Badge className="absolute -top-3 -right-3 h-5 w-5 flex items-center justify-center p-0 rounded-full font-black text-[10px]">{cart.length}</Badge>
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Subtotal</span>
                                <span className="text-xl font-black tracking-tighter">{formatCurrency(cartTotal)}</span>
                            </div>
                        </div>
                        <button 
                            onClick={handleSendOrder}
                            disabled={isPending}
                            className="h-14 px-8 bg-primary text-primary-foreground rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        >
                            {isPending ? 'Enviando...' : (
                                <>Confirmar <ChevronRight className="h-4 w-4" /></>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>Instrucciones de Cocina</DialogTitle>
                        <DialogDescription>Añada indicaciones especiales para su preparación.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Notas</Label>
                            <Textarea 
                                placeholder="Ej: Sin hielo, término medio, etc..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] rounded-2xl border-2 resize-none text-sm font-bold"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" className="rounded-2xl h-12 font-bold" onClick={() => setNoteDialogOpen(false)}>Cancelar</Button>
                        <Button className="rounded-2xl h-12 font-black uppercase text-[10px] tracking-widest" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Internal component for real-time order monitoring
function useDoc<T>(memoizedDocRef: any) {
    const [data, setData] = useState<T | null>(null);
    useEffect(() => {
        if (!memoizedDocRef) return;
        return onSnapshot(memoizedDocRef, (snap: any) => {
            if (snap.exists()) setData({ id: snap.id, ...snap.data() } as T);
            else setData(null);
        });
    }, [memoizedDocRef]);
    return { data };
}
