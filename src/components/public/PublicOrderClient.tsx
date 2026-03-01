'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, Trash2, 
    Smartphone, ChevronRight, ChevronLeft,
    ImageIcon, Utensils, Beer, Sun, MapPin, 
    MessageSquare, CheckCircle, Clock, X,
    AlertCircle, Info
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza',
    'Pooles': 'Pooles'
};

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // View state
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [zoneFilter, setZoneFilter] = useState<string>('all');
    
    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    
    // Order state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Session Privacy: Use a unique ID for this device's current stay
    const [sessionOrderId, setSessionOrderId] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('gomotel_public_order_id');
            if (saved) setSessionOrderId(saved);
        }
    }, []);

    // Data
    const [services, setServices] = useState<Service[]>([]);
    useEffect(() => { getServices().then(setServices); }, []);

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    // Watch current session order in real-time
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    useEffect(() => {
        if (!firestore || !sessionOrderId) {
            setCurrentOrder(null);
            return;
        }
        const unsub = onSnapshot(doc(firestore, 'orders', sessionOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                // Si la orden ya no está pendiente, limpiar sesión (el cliente ya pagó o se cerró)
                if (data.status !== 'Pendiente') {
                    localStorage.removeItem('gomotel_public_order_id');
                    setSessionOrderId(null);
                    setCurrentOrder(null);
                } else {
                    setCurrentOrder({ id: snap.id, ...data });
                }
            } else {
                localStorage.removeItem('gomotel_public_order_id');
                setSessionOrderId(null);
                setCurrentOrder(null);
            }
        });
        return () => unsub();
    }, [firestore, sessionOrderId]);

    const zones = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type)));
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => zoneFilter === 'all' || t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.isActive && (
                s.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const { subtotal, grandTotal } = useMemo(() => {
        const sub = cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);
        // En este MVP público simplificamos el total (impuestos ya mostrados en precio final o calculados en el envío)
        return { subtotal: sub, grandTotal: sub };
    }, [cart]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Agregado", description: `${service.name} listo en el carrito.`, duration: 1500 });
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

    const handleDeleteItem = (serviceId: string) => {
        setCart(prev => prev.filter(i => i.service.id !== serviceId));
        toast({ title: "Eliminado", description: "Producto quitado del carrito." });
    };

    const handleSaveNote = () => {
        if (editingNoteIndex === null) return;
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue } : item));
        setNoteDialogOpen(false);
        setEditingNoteIndex(null);
    };

    const handleOpenNoteDialog = (index: number) => {
        setEditingNoteIndex(index);
        setCurrentNoteValue(cart[index].notes || '');
        setNoteDialogOpen(true);
    };

    const handleConfirmOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (sessionOrderId && currentOrder) {
                result = await addToTableAccount(sessionOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Cliente ${selectedTable.number}`, 'Public');
            }

            if (result.success) {
                if (result.orderId) {
                    setSessionOrderId(result.orderId);
                    localStorage.setItem('gomotel_public_order_id', result.orderId);
                }
                setCart([]);
                setActiveTab('account');
                toast({ title: "¡Pedido Enviado!", description: "Lo recibiremos en breve.", variant: "default" });
            } else {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            }
        });
    };

    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 sm:p-10">
                <div className="w-full max-w-md space-y-8 text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="space-y-3">
                        <div className="h-20 w-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border-2 border-primary/20 shadow-xl">
                            <Utensils className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-4xl font-black uppercase tracking-tight">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su mesa para comenzar a ordenar.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2 text-left">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Filtrar por Zona</Label>
                            <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-background shadow-sm">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {zones.map(z => (
                                        <SelectItem key={z} value={z}>{TYPE_LABELS[z] || z}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="h-[45vh] rounded-3xl border-2 bg-muted/20 p-2">
                            <div className="grid grid-cols-2 gap-3 p-2">
                                {filteredTables.map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTable(table)}
                                        className="flex flex-col items-center justify-center h-28 bg-background border-2 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all active:scale-95 shadow-sm group"
                                    >
                                        <span className="text-3xl font-black text-foreground group-hover:text-primary transition-colors">{table.number}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">{TYPE_LABELS[table.type] || table.type}</span>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 flex flex-col">
            {/* Header Fijo */}
            <div className="bg-background border-b px-6 py-4 sticky top-0 z-30 shadow-sm flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Ubicación Actual</span>
                    <h2 className="text-lg font-black uppercase tracking-tighter text-primary">
                        {TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}
                    </h2>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full h-10 w-10 text-muted-foreground hover:text-destructive"
                    onClick={() => { setSelectedTable(null); setSessionOrderId(null); localStorage.removeItem('gomotel_public_order_id'); }}
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* Contenido Principal */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {activeTab === 'menu' && (
                    <div className="flex-1 flex flex-col animate-in slide-in-from-left-4 duration-300">
                        {/* Filtros de Menú */}
                        <div className="p-4 bg-background/80 backdrop-blur-md sticky top-0 z-20 border-b space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar platillo..." 
                                    className="pl-9 h-12 bg-muted/50 rounded-xl border-none shadow-inner"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn(
                                            "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                        )}
                                        onClick={() => setSelectedCategoryId(null)}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn(
                                                "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            )}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        {/* Cuadrícula de Productos */}
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-3 p-4 pb-24">
                                {filteredServices.map(service => (
                                    <div 
                                        key={service.id}
                                        className="group relative bg-card rounded-3xl overflow-hidden shadow-sm border border-border/50 flex flex-col animate-in fade-in duration-500"
                                    >
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            
                                            {/* Info superior */}
                                            <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
                                                <Badge className="bg-black/60 backdrop-blur-md text-white border-0 font-black text-[8px] uppercase px-2 py-0.5">
                                                    {service.category}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge variant="outline" className="bg-white/90 text-primary border-0 font-black text-[8px]">
                                                        STOCK: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Overlay Inferior */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10 z-10">
                                                <h3 className="text-white font-black text-[11px] uppercase leading-tight line-clamp-2 drop-shadow-lg mb-1">{service.name}</h3>
                                                <p className="text-primary font-black text-sm">{formatCurrency(service.price)}</p>
                                            </div>

                                            {/* Botón Añadir */}
                                            <button 
                                                onClick={() => handleAddToCart(service)}
                                                className="absolute bottom-2 right-2 z-20 h-10 w-10 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all border-2 border-white/20"
                                            >
                                                <Plus className="h-6 w-6" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {activeTab === 'cart' && (
                    <div className="flex-1 flex flex-col p-4 sm:p-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <ShoppingCart className="h-6 w-6 text-primary" />
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Tu Carrito</h2>
                        </div>

                        {cart.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-20">
                                <Utensils className="h-32 w-32 mb-4" />
                                <p className="text-xl font-black uppercase">Carrito Vacío</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0">
                                <ScrollArea className="flex-1 pr-4">
                                    <div className="space-y-4">
                                        {cart.map((item, idx) => (
                                            <Card key={item.service.id} className="rounded-2xl border-none shadow-sm overflow-hidden bg-background">
                                                <div className="p-4 flex gap-4">
                                                    <Avatar className="h-16 w-16 rounded-xl border">
                                                        <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                                        <AvatarFallback><ImageIcon /></AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="font-black text-sm uppercase truncate leading-none mb-1">{item.service.name}</h4>
                                                            <button 
                                                                onClick={() => handleDeleteItem(item.service.id)}
                                                                className="text-destructive h-8 w-8 flex items-center justify-center hover:bg-destructive/10 rounded-full"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        <p className="text-primary font-black text-xs mb-3">{formatCurrency(item.service.price)}</p>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1 bg-muted rounded-full p-1 border">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-7 w-7 rounded-full" 
                                                                    onClick={() => handleRemoveFromCart(item.service.id)}
                                                                >
                                                                    <Minus className="h-3 w-3" />
                                                                </Button>
                                                                <span className="w-8 text-center font-black text-xs text-primary">{item.quantity}</span>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-7 w-7 rounded-full" 
                                                                    onClick={() => handleAddToCart(item.service)}
                                                                    disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                            <button 
                                                                onClick={() => handleOpenNoteDialog(idx)}
                                                                className={cn(
                                                                    "text-[9px] font-black uppercase px-3 py-1.5 rounded-full border transition-all flex items-center gap-1",
                                                                    item.notes ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground"
                                                                )}
                                                            >
                                                                {item.notes ? "Ver Nota" : "+ Nota Cocina"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <div className="mt-6 pt-6 border-t space-y-4">
                                    <div className="flex justify-between items-center text-muted-foreground uppercase font-black text-[10px] tracking-widest">
                                        <span>Subtotal Neto</span>
                                        <span>{formatCurrency(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-lg font-black uppercase tracking-tight">Total Pedido</span>
                                        <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(grandTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-16 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl shadow-primary/20"
                                        disabled={isPending || cart.length === 0}
                                        onClick={handleConfirmOrder}
                                    >
                                        {isPending ? "Procesando..." : "Enviar Comanda"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="flex-1 flex flex-col p-4 sm:p-6 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <Clock className="h-6 w-6 text-primary" />
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Mi Cuenta</h2>
                        </div>

                        {!currentOrder ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background rounded-3xl border-2 border-dashed">
                                <Info className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
                                <p className="font-black uppercase text-muted-foreground opacity-40">No tienes pedidos activos en esta sesión.</p>
                                <Button variant="link" className="mt-4 font-bold text-primary" onClick={() => setActiveTab('menu')}>Ver el menú ahora</Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                    <div className="bg-primary p-8 text-primary-foreground relative">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                        <div className="relative z-10 flex justify-between items-center">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">Total Acumulado</p>
                                                <h3 className="text-5xl font-black tracking-tighter">{formatCurrency(currentOrder.total)}</h3>
                                            </div>
                                            <Badge className={cn("px-4 py-1.5 rounded-full border-0 pointer-events-none", 
                                                currentOrder.status === 'Pendiente' ? "bg-white text-primary" : "bg-emerald-500 text-white")}>
                                                {currentOrder.status}
                                            </Badge>
                                        </div>
                                    </div>
                                    <CardContent className="p-8 pt-10">
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="h-1 w-8 bg-primary rounded-full" />
                                                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detalle de Consumos</h4>
                                            </div>
                                            <div className="space-y-4">
                                                {currentOrder.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-start border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                                        <div className="space-y-1 pr-4">
                                                            <p className="font-black text-sm uppercase leading-tight">{item.name}</p>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full">x{item.quantity}</span>
                                                                {item.notes && <span className="text-[9px] font-medium text-muted-foreground italic truncate max-w-[120px]">"{item.notes}"</span>}
                                                            </div>
                                                        </div>
                                                        <span className="font-black text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="p-6 rounded-[2rem] bg-amber-500/10 border-2 border-amber-500/20 border-dashed flex items-start gap-4">
                                    <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-1">
                                        <Info className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">¿Deseas liquidar tu cuenta?</p>
                                        <p className="text-xs font-medium text-amber-700/80 dark:text-amber-300/90 leading-relaxed">
                                            Para solicitar el cobro, por favor comunícate con la recepción o un salonero. También puedes pedir más productos desde el menú.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Barra de Navegación Inferior Estilo App */}
            <div className="bg-background/95 backdrop-blur-xl border-t h-20 px-6 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.05)] sticky bottom-0 z-40">
                <button 
                    className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'menu' ? "text-primary scale-110" : "text-muted-foreground opacity-50")}
                    onClick={() => setActiveTab('menu')}
                >
                    <div className={cn("p-2 rounded-xl transition-all", activeTab === 'menu' && "bg-primary/10")}>
                        <Utensils className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Menú</span>
                </button>

                <button 
                    className={cn("flex flex-col items-center gap-1 relative transition-all", activeTab === 'cart' ? "text-primary scale-110" : "text-muted-foreground opacity-50")}
                    onClick={() => setActiveTab('cart')}
                >
                    <div className={cn("p-2 rounded-xl transition-all", activeTab === 'cart' && "bg-primary/10")}>
                        <ShoppingCart className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Carrito</span>
                    {cart.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] font-black h-5 w-5 flex items-center justify-center rounded-full ring-2 ring-background animate-in zoom-in">
                            {cart.length}
                        </span>
                    )}
                </button>

                <button 
                    className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'account' ? "text-primary scale-110" : "text-muted-foreground opacity-50")}
                    onClick={() => setActiveTab('account')}
                >
                    <div className={cn("p-2 rounded-xl transition-all", activeTab === 'account' && "bg-primary/10")}>
                        <Clock className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Cuenta</span>
                    {currentOrder && (
                        <span className="absolute -top-1 -right-1 bg-primary text-white h-2.5 w-2.5 flex items-center justify-center rounded-full ring-2 ring-background animate-pulse" />
                    )}
                </button>
            </div>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Instrucciones de Cocina</DialogTitle>
                        <DialogDescription className="text-sm font-medium">Añade indicaciones especiales para tu pedido.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Término medio, sin cebolla, salsa aparte..."
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[150px] rounded-2xl border-2 bg-muted/20 text-base font-bold shadow-inner resize-none p-4"
                            autoFocus
                        />
                    </div>
                    <DialogFooter className="gap-2 sm:gap-3">
                        <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => setNoteDialogOpen(false)}>Cancelar</Button>
                        <Button className="flex-1 h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
