'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Service, Tax, SinpeAccount, AppliedTax, ProductCategory, ProductSubCategory, RestaurantTable, Order } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Card, CardTitle, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, ChevronRight, ChevronLeft,
    ImageIcon, Layers, Utensils, Clock, CheckCircle, X, Sun, 
    Trash2, MessageSquare, SmartphoneIcon, Receipt, MapPin
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // Sesión y Estado
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    const [tab, setTab] = useState<'menu' | 'cart' | 'account'>('menu');

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [zoneFilter, setZoneFilter] = useState<string>('all');

    // Dialogs
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // --- PERSISTENCIA DE SESIÓN ---
    // 1. Al seleccionar mesa, buscar sesión guardada
    useEffect(() => {
        if (selectedTable) {
            const savedOrderId = localStorage.getItem(`order_session_${selectedTable.id}`);
            if (savedOrderId) {
                setActiveOrderId(savedOrderId);
            } else {
                setActiveOrderId(null);
                setCurrentOrder(null);
            }
        }
    }, [selectedTable]);

    // 2. Escuchar la orden activa en tiempo real
    useEffect(() => {
        if (!firestore || !activeOrderId) {
            setCurrentOrder(null);
            return;
        }

        const unsubscribe = onSnapshot(doc(firestore, 'orders', activeOrderId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Order;
                // Si la orden ya fue pagada, limpiar sesión
                if (data.paymentStatus === 'Pagado') {
                    if (selectedTable) localStorage.removeItem(`order_session_${selectedTable.id}`);
                    setActiveOrderId(null);
                    setCurrentOrder(null);
                } else {
                    setCurrentOrder({ id: docSnap.id, ...data });
                }
            } else {
                // Si la orden fue eliminada
                if (selectedTable) localStorage.removeItem(`order_session_${selectedTable.id}`);
                setActiveOrderId(null);
                setCurrentOrder(null);
            }
        });

        return () => unsubscribe();
    }, [firestore, activeOrderId, selectedTable]);

    // Data Fetching
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => zoneFilter === 'all' || t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && (s.name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    // Lógica de Carrito
    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Añadido", description: `${service.name} listo en el carrito.`, duration: 1500 });
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

    const handleClearItem = (serviceId: string) => {
        setCart(prev => prev.filter(i => i.service.id !== serviceId));
    };

    const handleOpenNoteDialog = (index: number) => {
        setEditingNoteIndex(index);
        setCurrentNoteValue(cart[index].notes || '');
        setNoteDialogOpen(true);
    };

    const handleSaveNote = () => {
        if (editingNoteIndex === null) return;
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue } : item));
        setNoteDialogOpen(false);
        setEditingNoteIndex(null);
    };

    const handleConfirmOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Pedido Móvil`, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando sus productos.', variant: 'default' });
                if (result.orderId) {
                    localStorage.setItem(`order_session_${selectedTable.id}`, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                setCart([]);
                setTab('account');
            }
        });
    };

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);

    // --- VISTA: SELECCIÓN DE MESA ---
    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-6 sm:p-10">
                <div className="w-full max-w-md space-y-10 text-center">
                    <div className="space-y-4 animate-in fade-in zoom-in duration-700">
                        <div className="flex justify-center">
                            <div className="p-4 bg-primary rounded-[2.5rem] shadow-2xl shadow-primary/20 ring-8 ring-primary/5">
                                <Utensils className="h-12 w-12 text-white" />
                            </div>
                        </div>
                        <h1 className="text-5xl font-black tracking-tighter uppercase italic text-primary drop-shadow-sm">
                            Bienvenido <br />
                            <span className="text-foreground not-italic text-3xl">Go Motel Service</span>
                        </h1>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
                            Seleccione su ubicación para comenzar a ordenar
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2 text-left">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar por Zona</Label>
                            <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-background shadow-sm">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    <SelectItem value="Table">Mesas Salón</SelectItem>
                                    <SelectItem value="Bar">Barra</SelectItem>
                                    <SelectItem value="Terraza">Terraza</SelectItem>
                                    <SelectItem value="Pooles">Pooles</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="h-[40vh] w-full rounded-2xl border bg-background/50 backdrop-blur-sm p-4">
                            <div className="grid grid-cols-3 gap-3">
                                {filteredTables.map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTable(table)}
                                        className="h-20 flex flex-col items-center justify-center rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all group"
                                    >
                                        <span className="font-black text-2xl group-hover:scale-110 transition-transform">{table.number}</span>
                                        <span className="text-[8px] font-black uppercase text-muted-foreground">{table.type === 'Table' ? 'Mesa' : table.type}</span>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        );
    }

    // --- VISTA: APP DE PEDIDOS ---
    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden relative">
            {/* Header Fijo */}
            <header className="bg-primary p-4 text-primary-foreground shrink-0 shadow-lg z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedTable(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                        <div>
                            <h2 className="font-black text-lg uppercase tracking-tight leading-none">
                                {selectedTable.type === 'Table' ? 'Mesa' : selectedTable.type} {selectedTable.number}
                            </h2>
                            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-1">Sesión de Pedido Directo</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-white/10 border-white/20 text-white font-black uppercase text-[10px] px-3">
                        {tab === 'menu' ? 'Catálogo' : tab === 'cart' ? 'Mi Carrito' : 'Mi Cuenta'}
                    </Badge>
                </div>
            </header>

            {/* Contenido Principal */}
            <main className="flex-1 overflow-hidden flex flex-col">
                {tab === 'menu' && (
                    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="p-4 border-b space-y-4 bg-muted/10">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar productos..." 
                                    className="pl-9 h-12 bg-background rounded-xl border-2 border-primary/10 transition-all focus:border-primary shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn(
                                            "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shrink-0",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                        )}
                                        onClick={() => setSelectedCategoryId(null)}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn(
                                                "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shrink-0",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            )}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" className="hidden" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1 bg-muted/20">
                            <div className="grid grid-cols-2 gap-3 p-4 pb-32">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="bg-card rounded-2xl border overflow-hidden shadow-sm flex flex-col group active:scale-95 transition-all">
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
                                                <Badge className="bg-black/60 backdrop-blur-md border-0 text-[8px] font-black uppercase px-2 h-5">
                                                    {service.category === 'Food' ? 'Comida' : 'Bebida'}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge variant="secondary" className="bg-white/90 backdrop-blur-md border-0 text-[8px] font-black h-5 px-2">
                                                        STOCK: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => handleAddToCart(service)}
                                                className="absolute bottom-2 right-2 h-10 w-10 rounded-xl bg-primary text-white shadow-xl flex items-center justify-center active:bg-primary/80 transition-colors"
                                            >
                                                <Plus className="h-6 w-6" />
                                            </button>
                                        </div>
                                        <div className="p-3 space-y-1">
                                            <h3 className="font-black text-xs uppercase truncate">{service.name}</h3>
                                            <p className="text-primary font-black text-sm">{formatCurrency(service.price)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {tab === 'cart' && (
                    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500 bg-muted/10">
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-4 pb-32">
                                <div className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/10 border-dashed text-center space-y-2">
                                    <h3 className="font-black text-xl text-primary uppercase tracking-tighter">Mi Pedido</h3>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Revise los artículos antes de enviar</p>
                                </div>

                                {cart.length === 0 ? (
                                    <div className="py-20 text-center space-y-4 opacity-30">
                                        <ShoppingCart className="h-20 w-20 mx-auto" />
                                        <p className="font-black uppercase tracking-widest text-xs">Su carrito está vacío</p>
                                        <Button variant="outline" className="rounded-full font-bold" onClick={() => setTab('menu')}>Ir al Menú</Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="bg-card p-4 rounded-2xl border shadow-sm flex items-center gap-4 group">
                                                <Avatar className="h-16 w-16 rounded-xl border">
                                                    <AvatarImage src={item.service.imageUrl} className="object-cover" />
                                                    <AvatarFallback><ImageIcon className="h-6 w-6 opacity-20" /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <h4 className="font-black text-xs uppercase truncate">{item.service.name}</h4>
                                                    <p className="text-primary font-bold text-xs">{formatCurrency(item.service.price)}</p>
                                                    <button 
                                                        onClick={() => handleOpenNoteDialog(idx)}
                                                        className={cn(
                                                            "text-[9px] font-black uppercase px-2 py-1 rounded-md border flex items-center gap-1.5",
                                                            item.notes ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-transparent"
                                                        )}
                                                    >
                                                        <MessageSquare className="h-3 w-3" />
                                                        {item.notes ? "Nota guardada" : "Añadir nota"}
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col items-center bg-muted/50 rounded-xl p-1">
                                                        <button onClick={() => handleAddToCart(item.service)} className="p-1 hover:text-primary"><Plus className="h-4 w-4" /></button>
                                                        <span className="font-black text-sm my-1">{item.quantity}</span>
                                                        <button onClick={() => handleRemoveFromCart(item.service.id)} className="p-1 hover:text-destructive"><Minus className="h-4 w-4" /></button>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleClearItem(item.service.id)}>
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {cart.length > 0 && (
                            <div className="absolute bottom-20 inset-x-4 p-6 bg-card border-2 border-primary/20 rounded-[2.5rem] shadow-2xl z-30 animate-in slide-in-from-bottom-10 duration-500">
                                <div className="flex justify-between items-center mb-6 px-2">
                                    <span className="font-black uppercase tracking-widest text-xs text-muted-foreground">Total a enviar</span>
                                    <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                </div>
                                <Button 
                                    className="w-full h-16 rounded-2xl font-black text-base uppercase tracking-widest shadow-xl shadow-primary/20 gap-3"
                                    onClick={handleConfirmOrder}
                                    disabled={isPending}
                                >
                                    {isPending ? <Clock className="h-6 w-6 animate-spin" /> : <CheckCircle className="h-6 w-6" />}
                                    {isPending ? "Enviando..." : "Confirmar Pedido"}
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'account' && (
                    <div className="flex flex-col h-full animate-in fade-in slide-in-from-left-4 duration-500 bg-muted/10">
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-6 pb-32">
                                {!currentOrder ? (
                                    <div className="py-20 text-center space-y-6">
                                        <div className="inline-flex p-6 bg-muted rounded-full opacity-20">
                                            <Receipt className="h-20 w-20" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="font-black uppercase tracking-widest text-xs">No hay una cuenta activa</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold px-10">Realice su primer pedido para ver el historial aquí.</p>
                                        </div>
                                        <Button variant="primary" className="rounded-full font-black uppercase text-[10px] h-12 px-8" onClick={() => setTab('menu')}>Explorar Menú</Button>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                            <div className="bg-primary p-8 text-primary-foreground relative">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                                <div className="relative z-10 flex justify-between items-center">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Estado de Cuenta</p>
                                                        <h3 className="text-3xl font-black tracking-tighter">Mesa {selectedTable.number}</h3>
                                                    </div>
                                                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                                                        <Receipt className="h-6 w-6" />
                                                    </div>
                                                </div>
                                            </div>
                                            <CardContent className="p-8 space-y-6">
                                                <div className="space-y-4">
                                                    {currentOrder.items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-start gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-black text-xs uppercase leading-tight truncate">{item.name}</p>
                                                                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{item.quantity} x {formatCurrency(item.price)}</p>
                                                            </div>
                                                            <p className="font-black text-xs">{formatCurrency(item.price * item.quantity)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <Separator className="opacity-50" />
                                                
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consumo Total</span>
                                                        <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(currentOrder.total)}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <div className="p-6 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-900/50 rounded-3xl flex items-start gap-4 shadow-sm animate-pulse">
                                            <Smartphone className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
                                            <div className="space-y-1">
                                                <p className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-300">Solicitar Cuenta</p>
                                                <p className="text-[10px] font-bold text-amber-700/70 dark:text-amber-300/70 leading-relaxed uppercase">
                                                    Para realizar el pago, por favor comuníquese con recepción o solicítelo al personal de servicio.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </main>

            {/* Barra de Navegación Estilo App */}
            <nav className="bg-background/80 backdrop-blur-xl border-t p-3 pb-8 shrink-0 z-40">
                <div className="flex justify-around items-center max-w-md mx-auto">
                    <button 
                        onClick={() => setTab('menu')}
                        className={cn(
                            "flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all w-20",
                            tab === 'menu' ? "bg-primary/10 text-primary scale-110" : "text-muted-foreground"
                        )}
                    >
                        <Layers className={cn("h-5 w-5", tab === 'menu' && "fill-current")} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Menú</span>
                    </button>
                    
                    <button 
                        onClick={() => setTab('cart')}
                        className={cn(
                            "flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all w-20 relative",
                            tab === 'cart' ? "bg-primary/10 text-primary scale-110" : "text-muted-foreground"
                        )}
                    >
                        <ShoppingCart className={cn("h-5 w-5", tab === 'cart' && "fill-current")} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Carrito</span>
                        {cart.length > 0 && (
                            <span className="absolute top-1 right-4 h-4 w-4 bg-primary text-primary-foreground text-[8px] font-black flex items-center justify-center rounded-full animate-in zoom-in border-2 border-background">
                                {cart.length}
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={() => setTab('account')}
                        className={cn(
                            "flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all w-20",
                            tab === 'account' ? "bg-primary/10 text-primary scale-110" : "text-muted-foreground"
                        )}
                    >
                        <Receipt className={cn("h-5 w-5", tab === 'account' && "fill-current")} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Cuenta</span>
                        {currentOrder && <span className="absolute top-1.5 right-5 h-2 w-2 bg-primary rounded-full animate-pulse" />}
                    </button>
                </div>
            </nav>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                            Personalice su pedido para la cocina
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                            <div className="bg-primary/10 p-2.5 rounded-xl"><Utensils className="h-5 w-5 text-primary" /></div>
                            <span className="font-black text-xs uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Mensaje para el Chef</Label>
                            <Textarea 
                                placeholder="Ej: Término medio, sin cebolla, con extra hielo..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[140px] rounded-2xl border-2 resize-none text-sm font-bold shadow-sm"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => setNoteDialogOpen(false)}>Cancelar</Button>
                        <Button className="flex-1 h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
