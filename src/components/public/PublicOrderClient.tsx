'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, OrderItem, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, ChevronLeft,
    ImageIcon, User, Layers, Utensils, Beer, PackageCheck, Clock, CheckCircle, X, Sun, MapPin,
    Trash2, MessageSquare, Receipt, LayoutGrid
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza',
    'Pooles': 'Pooles'
};

const PREP_STATUS_STYLES: Record<string, string> = {
    'Pendiente': 'bg-red-500/10 text-red-600 border-red-500/20',
    'En preparación': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    'Entregado': 'bg-green-500/10 text-green-600 border-green-500/20',
    'Cancelado': 'bg-muted text-muted-foreground border-border'
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // --- ESTADO DE SESIÓN Y NAVEGACIÓN ---
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    const [view, setView] = useState<'menu' | 'account'>('menu');
    
    // --- ESTADOS DE CATÁLOGO ---
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    const [zoneFilter, setZoneFilter] = useState<string>('all');
    
    // --- ESTADOS DE CARRITO ---
    const [cart, setCart] = useState<CartItem[]>([]);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // --- CARGA DE DATOS ---
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const subCategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedCategoryId) return null;
        return query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategoryId), orderBy('name'));
    }, [firestore, selectedCategoryId]);
    const { data: subCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const zones = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type)));
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        if (zoneFilter === 'all') return allTables;
        return allTables.filter(t => t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            const matchesSubCategory = !selectedSubCategoryId || s.subCategoryId === selectedSubCategoryId;
            return matchesSearch && matchesCategory && matchesSubCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId, selectedSubCategoryId]);

    // --- PERSISTENCIA DE SESIÓN ---
    useEffect(() => {
        if (selectedTable) {
            const savedSession = localStorage.getItem(`active_order_${selectedTable.id}`);
            if (savedSession) {
                setActiveOrderId(savedSession);
            } else {
                setActiveOrderId(null);
                setActiveOrder(null);
            }
        }
    }, [selectedTable]);

    useEffect(() => {
        if (activeOrderId && firestore) {
            const unsubscribe = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
                if (snap.exists()) {
                    const orderData = { id: snap.id, ...snap.data() } as Order;
                    if (orderData.paymentStatus === 'Pagado' || orderData.status === 'Cancelado') {
                        localStorage.removeItem(`active_order_${selectedTable?.id}`);
                        setActiveOrderId(null);
                        setActiveOrder(null);
                    } else {
                        setActiveOrder(orderData);
                    }
                } else {
                    localStorage.removeItem(`active_order_${selectedTable?.id}`);
                    setActiveOrderId(null);
                    setActiveOrder(null);
                }
            });
            return () => unsubscribe();
        }
    }, [activeOrderId, firestore, selectedTable]);

    // --- LÓGICA DE CARRITO ---
    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id 
                    ? { ...i, quantity: i.service.source === 'Internal' ? i.quantity + 1 : Math.min(i.quantity + 1, service.stock || 0) } 
                    : i
                );
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Agregado al carrito", description: service.name, duration: 1000 });
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

    const handleRemoveItemCompletely = (serviceId: string) => {
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

    const handleSendOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Cliente Móvil - ${TYPE_LABELS[selectedTable.type]} ${selectedTable.number}`, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    localStorage.setItem(`active_order_${selectedTable.id}`, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                setCart([]);
                setView('account');
                toast({ title: '¡Pedido Enviado!', description: 'Estamos preparando sus productos.', duration: 3000 });
            }
        });
    };

    const getItemStatus = (item: any) => {
        if (!activeOrder) return 'Pendiente';
        if (item.category === 'Food') return activeOrder.kitchenStatus || 'Pendiente';
        if (item.category === 'Beverage') return activeOrder.barStatus || 'Pendiente';
        return activeOrder.status || 'Pendiente';
    };

    // --- UI SELECTOR DE UBICACIÓN ---
    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col p-6 sm:p-10">
                <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
                    <div className="text-center space-y-4 mb-12">
                        <h1 className="text-6xl sm:text-8xl font-black uppercase tracking-tighter leading-none italic">
                            BIENVENIDO A <span className="text-primary drop-shadow-[0_0_30px_rgba(var(--primary),0.3)]">GO MOTEL</span>
                        </h1>
                        <p className="text-lg sm:text-xl font-bold text-muted-foreground uppercase tracking-[0.2em] animate-pulse">
                            Seleccione su ubicación para empezar a ordenar
                        </p>
                    </div>

                    <div className="w-full max-w-xs mb-8">
                        <Select value={zoneFilter} onValueChange={setZoneFilter}>
                            <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-black uppercase tracking-widest text-xs">
                                <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-primary" />
                                    <SelectValue placeholder="Filtrar por Zona" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                                <SelectItem value="all">Todas las Zonas</SelectItem>
                                {zones.map(z => (
                                    <SelectItem key={z} value={z}>{TYPE_LABELS[z] || z}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <ScrollArea className="w-full">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-10">
                            {filteredTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => setSelectedTable(table)}
                                    className="group relative bg-white/5 border-2 border-white/5 rounded-[2.5rem] p-8 flex flex-col items-center gap-2 transition-all hover:bg-primary/10 hover:border-primary/40 hover:-translate-y-2 active:scale-95"
                                >
                                    <span className="text-5xl font-black tracking-tighter group-hover:text-primary transition-colors">{table.number}</span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 group-hover:opacity-100">{TYPE_LABELS[table.type] || table.type}</span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        );
    }

    // --- UI PRINCIPAL DE PEDIDOS ---
    return (
        <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">
            {/* Header Fijo */}
            <div className="bg-black/40 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedTable(null)} className="h-10 w-10 flex items-center justify-center bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-tighter leading-none">
                            {TYPE_LABELS[selectedTable.type]} {selectedTable.number}
                        </h2>
                        <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-1">Sesión en línea</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                    <button 
                        onClick={() => setView('menu')}
                        className={cn("h-9 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", view === 'menu' ? "bg-primary text-white shadow-lg" : "text-muted-foreground")}
                    >
                        Menú
                    </button>
                    <button 
                        onClick={() => setView('account')}
                        className={cn("h-9 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all relative", view === 'account' ? "bg-primary text-white shadow-lg" : "text-muted-foreground")}
                    >
                        Cuenta
                        {activeOrder && activeOrder.items.length > 0 && (
                            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-[8px] border-2 border-[#0a0a0a]">
                                {activeOrder.items.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {view === 'menu' ? (
                    <div className="h-full flex flex-col">
                        {/* Buscador y Categorías */}
                        <div className="p-4 space-y-4 bg-gradient-to-b from-black/20 to-transparent shrink-0">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                                <Input 
                                    placeholder="Buscar por nombre..." 
                                    className="h-12 bg-white/5 border-white/10 rounded-2xl pl-11 focus:border-primary/50 transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn("h-8 px-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all", !selectedCategoryId ? "bg-primary text-white" : "bg-white/5 text-muted-foreground")}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn("h-8 px-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all", selectedCategoryId === cat.id ? "bg-primary text-white" : "bg-white/5 text-muted-foreground")}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        {/* Grid de Productos */}
                        <ScrollArea className="flex-1 px-4 pb-32">
                            <div className="grid grid-cols-2 gap-4">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden flex flex-col">
                                        <div className="aspect-square relative overflow-hidden bg-muted/20">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="bg-transparent"><ImageIcon className="h-10 w-10 opacity-10" /></AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-2 right-2">
                                                <button 
                                                    onClick={() => handleAddToCart(service)}
                                                    className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl active:scale-90 transition-all"
                                                >
                                                    <Plus className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-1">
                                            <h3 className="font-black uppercase text-[11px] leading-tight line-clamp-2 tracking-tight">{service.name}</h3>
                                            <p className="text-primary font-black text-sm">{formatCurrency(service.price)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="h-full flex flex-col p-4">
                        <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                            <Receipt className="h-6 w-6 text-primary" /> Historial de Consumo
                        </h2>
                        
                        <ScrollArea className="flex-1 pr-4">
                            {!activeOrder || activeOrder.items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
                                    <ShoppingCart className="h-20 w-20 mb-4" />
                                    <p className="font-black uppercase tracking-widest text-sm">No hay consumos registrados</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {activeOrder.items.map((item, idx) => {
                                        const status = getItemStatus(item);
                                        return (
                                            <div key={idx} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="font-black uppercase text-xs tracking-tight">{item.name}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground">{item.quantity} x {formatCurrency(item.price)}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <p className="font-black text-sm">{formatCurrency(item.price * item.quantity)}</p>
                                                    <Badge variant="outline" className={cn("text-[8px] font-black uppercase px-2 py-0.5 pointer-events-none", PREP_STATUS_STYLES[status])}>
                                                        {status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>

                        {activeOrder && (
                            <div className="mt-6 p-6 bg-primary/10 border-2 border-primary/20 rounded-[2rem] space-y-4 shadow-2xl">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Total a Pagar</span>
                                    <span className="text-4xl font-black tracking-tighter">{formatCurrency(activeOrder.total)}</span>
                                </div>
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-start gap-3">
                                    <Sun className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] font-bold text-amber-200/80 leading-relaxed uppercase">
                                        Favor solicitar el cobro en recepción o al salonero indicando su ubicación.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Barra Flotante de Carrito (Solo en vista Menú) */}
                {view === 'menu' && cart.length > 0 && (
                    <div className="fixed bottom-6 inset-x-6 z-[60] animate-in slide-in-from-bottom-10 duration-500">
                        <button 
                            onClick={() => setNoteDialogOpen(true)}
                            className="w-full bg-primary h-16 rounded-[1.5rem] shadow-2xl shadow-primary/40 flex items-center justify-between px-6 border-2 border-white/20 active:scale-95 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center relative">
                                    <ShoppingCart className="h-5 w-5" />
                                    <span className="absolute -top-2 -right-2 h-5 w-5 bg-white text-primary rounded-full text-[10px] font-black flex items-center justify-center border-2 border-primary">
                                        {cart.reduce((s, i) => s + i.quantity, 0)}
                                    </span>
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Enviar Pedido</p>
                                    <p className="text-xl font-black tracking-tighter">{formatCurrency(cart.reduce((s, i) => s + i.service.price * i.quantity, 0))}</p>
                                </div>
                            </div>
                            <ChevronRight className="h-6 w-6" />
                        </button>
                    </div>
                )}
            </div>

            {/* Diálogo de Confirmación y Notas */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="bg-[#1a1a1a] border-white/10 text-white sm:max-w-md rounded-[2.5rem]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Confirmar Pedido</DialogTitle>
                        <DialogDescription className="text-white/40 font-bold text-xs uppercase">Revise sus artículos antes de enviar a cocina/bar.</DialogDescription>
                    </DialogHeader>
                    
                    <ScrollArea className="max-h-[40vh] pr-4 my-4">
                        <div className="space-y-3">
                            {cart.map((item, idx) => (
                                <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/5 relative">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <p className="font-black text-xs uppercase tracking-tight">{item.service.name}</p>
                                            <p className="text-[10px] font-bold text-primary mt-1">{formatCurrency(item.service.price * item.quantity)}</p>
                                            <button 
                                                onClick={() => handleOpenNoteDialog(idx)}
                                                className={cn("mt-2 text-[9px] font-black uppercase px-2 py-1 rounded-lg border transition-all flex items-center gap-1.5", item.notes ? "bg-primary text-white border-primary" : "bg-white/5 text-white/40 border-white/10")}
                                            >
                                                <MessageSquare className="h-3 w-3" /> {item.notes ? "Ver Nota" : "+ Nota Cocina"}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1 border border-white/5">
                                                <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-7 w-7 flex items-center justify-center hover:bg-white/10 rounded-lg"><Minus className="h-3 w-3" /></button>
                                                <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => handleAddToCart(item.service)} className="h-7 w-7 flex items-center justify-center hover:bg-white/10 rounded-lg"><Plus className="h-3 w-3" /></button>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveItemCompletely(item.service.id)}
                                                className="h-10 w-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    {item.notes && <p className="mt-2 text-[10px] text-primary italic font-medium border-l-2 pl-2 border-primary/20">"{item.notes}"</p>}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <Separator className="bg-white/10" />
                    <div className="flex justify-between items-center py-4">
                        <span className="text-xs font-black uppercase tracking-widest opacity-40">Total</span>
                        <span className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(cart.reduce((s, i) => s + i.service.price * i.quantity, 0))}</span>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="h-14 rounded-2xl font-bold uppercase text-[10px] tracking-widest" onClick={() => setNoteDialogOpen(false)}>Seguir Comprando</Button>
                        <Button 
                            className="h-14 rounded-2xl bg-primary text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" 
                            disabled={isPending}
                            onClick={handleSendOrder}
                        >
                            {isPending ? "Enviando..." : "Enviar Pedido Real"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo para editar Nota Individual */}
            <Dialog open={editingNoteIndex !== null} onOpenChange={(open) => !open && setEditingNoteIndex(null)}>
                <DialogContent className="bg-[#1a1a1a] border-white/10 text-white rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="text-white/40 font-bold text-[10px] uppercase">Indique al chef cómo prefiere su plato.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-primary/70 mb-2 block">Instrucciones</Label>
                        <Textarea 
                            placeholder="Ej: Sin cebolla, término medio, poca sal..."
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="bg-white/5 border-white/10 rounded-xl min-h-[120px] focus:border-primary/50"
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest" onClick={handleSaveNote}>Guardar Instrucción</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
