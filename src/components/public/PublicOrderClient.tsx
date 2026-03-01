'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Service, RestaurantTable, Order, OrderItem, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, Check, ChevronRight, ChevronLeft,
    ImageIcon, Utensils, Beer, Clock, CheckCircle, X, Sun, MapPin, 
    MessageSquare, History, User
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
    Dialog, DialogContent, DialogDescription, 
    DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
    Select, SelectContent, SelectItem, 
    SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const SESSION_KEY = 'go_motel_active_order';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // View States
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');

    // Menu States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Note States
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // --- Persistencia de Sesión ---
    useEffect(() => {
        const savedSession = localStorage.getItem(SESSION_KEY);
        if (savedSession && firestore) {
            const { tableId, orderId } = JSON.parse(savedSession);
            // Validamos que la orden siga activa
            const unsub = onSnapshot(doc(db, 'orders', orderId), (snap) => {
                if (snap.exists()) {
                    const data = snap.data() as Order;
                    if (data.status === 'Pendiente') {
                        setActiveOrderId(orderId);
                        // Buscamos la mesa
                        onSnapshot(doc(db, 'restaurantTables', tableId), (tSnap) => {
                            if (tSnap.exists()) setSelectedTable({ id: tSnap.id, ...tSnap.data() } as RestaurantTable);
                        });
                    } else {
                        localStorage.removeItem(SESSION_KEY);
                    }
                } else {
                    localStorage.removeItem(SESSION_KEY);
                }
            });
            return () => unsub();
        }
    }, [firestore]);

    // Data Fetching
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const ordersQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrderId) return null;
        return query(collection(firestore, 'orders'), where('__name__', '==', activeOrderId));
    }, [firestore, activeOrderId]);
    const { data: orders } = useCollection<Order>(ordersQuery);
    const currentOrder = orders?.[0];

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type))).sort();
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => (typeFilter === 'all' || t.type === typeFilter) && t.status === 'Available');
    }, [allTables, typeFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            const matchesSubCategory = !selectedSubCategoryId || s.subCategoryId === selectedSubCategoryId;
            return matchesSearch && matchesCategory && matchesSubCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId, selectedSubCategoryId]);

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);

    // Handlers
    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTable(table);
        setCart([]);
    };

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
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
                result = await openTableAccount(selectedTable.id, cart, `Cliente Móvil`);
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando su solicitud.' });
                if (result.orderId) {
                    setActiveOrderId(result.orderId);
                    localStorage.setItem(SESSION_KEY, JSON.stringify({ tableId: selectedTable.id, orderId: result.orderId }));
                }
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    const handleExit = () => {
        if (cart.length > 0) {
            if (!confirm('¿Desea descartar su carrito actual?')) return;
        }
        if (!activeOrderId) {
            setSelectedTable(null);
        } else {
            if (confirm('¿Desea cerrar la sesión en este dispositivo? Su cuenta seguirá abierta en el sistema.')) {
                localStorage.removeItem(SESSION_KEY);
                setSelectedTable(null);
                setActiveOrderId(null);
            }
        }
    };

    const getTypeIcon = (type: string) => {
        if (type === 'Table') return Utensils;
        if (type === 'Bar') return Beer;
        return MapPin;
    };

    if (!selectedTable) {
        return (
            <div className="min-h-[100dvh] bg-background flex flex-col p-6 animate-in fade-in duration-500">
                <div className="space-y-2 mb-10">
                    <h1 className="text-4xl font-black tracking-tighter uppercase">Bienvenido</h1>
                    <p className="text-muted-foreground font-medium">Seleccione su ubicación para comenzar a pedir.</p>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card">
                                <SelectValue placeholder="Todas las zonas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las zonas</SelectItem>
                                {locationTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <ScrollArea className="h-[50vh]">
                        <div className="grid grid-cols-2 gap-4 pb-10">
                            {filteredTables.map(table => {
                                const Icon = getTypeIcon(table.type);
                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => handleSelectTable(table)}
                                        className="flex flex-col items-center justify-center aspect-square rounded-[2rem] border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all active:scale-95 group shadow-sm"
                                    >
                                        <div className="bg-muted p-3 rounded-2xl mb-2 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <span className="text-4xl font-black tracking-tighter">{table.number}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">{table.type}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background">
            {/* Header Fijo */}
            <div className="bg-background border-b px-6 py-4 flex items-center justify-between z-20 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={handleExit} className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted text-muted-foreground active:scale-90 transition-transform">
                        <X className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                            {selectedTable.type} {selectedTable.number}
                        </h2>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Ubicación Actual</p>
                    </div>
                </div>
                <div className="flex bg-muted p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('menu')}
                        className={cn("h-9 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all", activeTab === 'menu' ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}
                    >
                        Carta
                    </button>
                    <button 
                        onClick={() => setActiveTab('account')}
                        className={cn("h-9 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2", activeTab === 'account' ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}
                    >
                        Cuenta {currentOrder && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'menu' ? (
                    <div className="h-full flex flex-col">
                        {/* Buscador y Categorías */}
                        <div className="p-4 space-y-4 bg-muted/20 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="¿Qué desea ordenar?" 
                                    className="pl-10 h-12 bg-background border-2 rounded-2xl"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn("h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap", selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-md" : "bg-background border text-muted-foreground")}
                                        onClick={() => { setSelectedCategoryId(null); setSelectedSubCategoryId(null); }}
                                    >
                                        Todo el Menú
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn("h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap", selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-md" : "bg-background border text-muted-foreground")}
                                            onClick={() => { setSelectedCategoryId(cat.id); setSelectedSubCategoryId(null); }}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        {/* Lista de Productos */}
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-32">
                                {filteredServices.map(service => (
                                    <div 
                                        key={service.id}
                                        className="group relative aspect-[4/5] rounded-[2rem] overflow-hidden border-2 border-muted shadow-sm bg-zinc-900"
                                    >
                                        {/* Imagen */}
                                        {service.imageUrl ? (
                                            <img src={service.imageUrl} alt={service.name} className="absolute inset-0 w-full h-full object-cover opacity-90" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800"><ImageIcon className="h-10 w-10 text-zinc-700" /></div>
                                        )}

                                        {/* Overlay Inf / Sup */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />

                                        {/* Tag Superior: Categoría y Stock */}
                                        <div className="absolute top-4 left-4 right-4">
                                            <div className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full w-fit shadow-lg">
                                                <p className="text-[8px] font-black uppercase text-primary tracking-widest">
                                                    {service.category} / {service.source === 'Internal' ? 'Cocina' : `Stock: ${service.stock}`}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Contenido Inferior */}
                                        <div className="absolute inset-x-0 bottom-0 p-5 space-y-3">
                                            <div className="space-y-1">
                                                <h3 className="text-sm font-black uppercase tracking-tight text-white leading-tight line-clamp-2">
                                                    {service.name}
                                                </h3>
                                                <p className="text-xl font-black text-primary tracking-tighter">
                                                    {formatCurrency(service.price)}
                                                </p>
                                            </div>
                                            <Button 
                                                onClick={() => handleAddToCart(service)}
                                                disabled={service.source !== 'Internal' && service.stock <= 0}
                                                className="w-full h-10 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-transform"
                                            >
                                                {service.source !== 'Internal' && service.stock <= 0 ? 'Agotado' : '+ Agregar'}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    /* Pestaña: Mi Cuenta / Historial */
                    <div className="h-full bg-muted/30 p-6 flex flex-col">
                        <div className="space-y-6 flex-1 overflow-y-auto pb-20">
                            {currentOrder ? (
                                <>
                                    <div className="bg-primary text-primary-foreground p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                                        <div className="absolute -right-4 -top-4 opacity-10 rotate-12"><History className="h-32 w-32" /></div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-1">Total Acumulado</p>
                                        <p className="text-5xl font-black tracking-tighter">{formatCurrency(currentOrder.total)}</p>
                                        <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-3">
                                            <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-black text-[10px] uppercase px-3 py-1">
                                                ORDEN #{currentOrder.id.slice(-4).toUpperCase()}
                                            </Badge>
                                            <span className="text-[10px] font-bold opacity-70">ABIERTA HACE {formatDistanceToNow(currentOrder.createdAt.toDate(), { locale: es, addSuffix: false }).toUpperCase()}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Historial de Consumo</h3>
                                        {currentOrder.items.map((item, idx) => (
                                            <div key={idx} className="bg-background rounded-3xl border p-5 shadow-sm space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center font-black text-primary border">
                                                            {item.quantity}x
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-sm uppercase tracking-tight">{item.name}</p>
                                                            <p className="text-xs text-muted-foreground font-bold">{formatCurrency(item.price)} c/u</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="h-6 font-black uppercase text-[8px] tracking-widest border-primary/20 text-primary">
                                                        Entregado
                                                    </Badge>
                                                </div>
                                                {item.notes && (
                                                    <div className="bg-muted/50 p-3 rounded-xl border border-dashed text-[10px] text-primary italic font-medium">
                                                        Nota: "{item.notes}"
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-40">
                                    <History className="h-20 w-20 mb-4" />
                                    <p className="font-black uppercase text-xs tracking-widest">Sin actividad reciente</p>
                                    <Button variant="link" onClick={() => setActiveTab('menu')} className="mt-4 font-bold text-primary">Volver al Menú</Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Carrito Flotante (Paso 1) */}
            {cart.length > 0 && activeTab === 'menu' && (
                <div className="absolute bottom-6 inset-x-6 z-30 pointer-events-none">
                    <div className="max-w-md mx-auto pointer-events-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-primary-foreground rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/30 animate-in slide-in-from-bottom-4 active:scale-95 transition-transform">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <span className="absolute -top-2 -right-2 bg-white text-primary text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-md">
                                                {cart.length}
                                            </span>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none">Ver Carrito</p>
                                            <p className="text-lg font-black tracking-tight leading-none mt-1">{formatCurrency(cartTotal)}</p>
                                        </div>
                                    </div>
                                    <div className="h-10 px-4 bg-white/20 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
                                        Confirmar <ChevronRight className="h-4 w-4" />
                                    </div>
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                                <DialogHeader className="p-8 pb-4 bg-muted/20">
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Su Selección</DialogTitle>
                                    <DialogDescription className="font-bold">Revise los artículos antes de enviar a cocina.</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[50vh] p-8 pt-0">
                                    <div className="space-y-4">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="bg-muted/10 p-4 rounded-2xl border-2 border-transparent hover:border-primary/10 transition-all space-y-3">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <p className="font-black text-sm uppercase tracking-tight leading-none">{item.service.name}</p>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <p className="text-[10px] font-bold text-muted-foreground">{formatCurrency(item.service.price)} c/u</p>
                                                            {item.service.source === 'Internal' && (
                                                                <button onClick={() => handleOpenNoteDialog(idx)} className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shadow-sm transition-all", item.notes ? "bg-primary text-primary-foreground border-primary" : "bg-background text-primary border-primary/20 hover:bg-primary/5")}>
                                                                    {item.notes ? "Editar Nota" : "+ Instrucciones"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-background p-1 rounded-xl border-2">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleRemoveFromCart(item.service.id)}><Minus className="h-3 w-3" /></Button>
                                                        <span className="text-sm font-black text-primary w-6 text-center">{item.quantity}</span>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleAddToCart(item.service)} disabled={item.service.source !== 'Internal' && item.quantity >= item.service.stock}><Plus className="h-3 w-3" /></Button>
                                                    </div>
                                                </div>
                                                {item.notes && <p className="text-[10px] text-primary italic font-medium pl-2 border-l-2 border-primary/20">"{item.notes}"</p>}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <div className="p-8 bg-muted/20 border-t space-y-6">
                                    <div className="flex justify-between items-center px-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total de este pedido</span>
                                        <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button onClick={handleSendOrder} disabled={isPending || cart.length === 0} className="w-full h-16 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-transform">
                                        {isPending ? "PROCESANDO..." : "ENVIAR A COCINA"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="font-bold">Indique cómo desea que preparemos su {editingNoteIndex !== null ? cart[editingNoteIndex]?.service.name : 'producto'}.</DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <Textarea 
                            placeholder="Ej: Término medio, con poca sal, sin cebolla, etc..." 
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[150px] rounded-2xl border-2 resize-none font-bold text-sm p-4"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg" onClick={handleSaveNote}>
                            Guardar Instrucciones
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}