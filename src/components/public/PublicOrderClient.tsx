'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Utensils, Beer, Sun, MapPin, 
    ChevronRight, ChevronLeft, X,
    CheckCircle, MessageSquare, Clock, ArrowLeft, LogOut
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

const LOCAL_STORAGE_KEY = 'go_motel_public_table_id';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // View States
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [hasAttemptedResume, setHasAttemptedResume] = useState(false);

    // Product Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    
    // Cart States
    const [cart, setCart] = useState<CartItem[]>([]);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Fetch Tables
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables, isLoading: isLoadingTables } = useCollection<RestaurantTable>(tablesQuery);

    // Fetch Active Orders (to show history)
    const activeOrdersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'orders'), where('status', 'in', ['Pendiente', 'En preparación', 'Entregado'])) : null, 
        [firestore]
    );
    const { data: allActiveOrders } = useCollection<Order>(activeOrdersQuery);

    // Fetch Products
    const [services, setServices] = useState<Service[]>([]);
    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    useEffect(() => {
        getServices().then(setServices);
    }, []);

    // Session Persistence Logic
    useEffect(() => {
        if (!allTables || hasAttemptedResume) return;

        const savedTableId = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedTableId) {
            const table = allTables.find(t => t.id === savedTableId);
            // Si la mesa sigue ocupada, es probable que sea el mismo cliente regresando
            if (table && table.status === 'Occupied') {
                setSelectedTable(table);
                // Si ya tiene pedidos, mostrarle su cuenta primero
                const tableOrders = allActiveOrders?.filter(o => o.locationId === table.id) || [];
                if (tableOrders.length > 0) {
                    setActiveTab('account');
                }
            }
        }
        setHasAttemptedResume(true);
    }, [allTables, allActiveOrders, hasAttemptedResume]);

    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTable(table);
        localStorage.setItem(LOCAL_STORAGE_KEY, table.id);
        setActiveTab('menu');
    };

    const handleExitLocation = () => {
        setSelectedTable(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setCart([]);
    };

    const currentTableOrders = useMemo(() => {
        if (!selectedTable || !allActiveOrders) return [];
        return allActiveOrders.filter(o => o.locationId === selectedTable.id);
    }, [selectedTable, allActiveOrders]);

    const totalSpent = useMemo(() => {
        return currentTableOrders.reduce((sum, o) => sum + o.total, 0);
    }, [currentTableOrders]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    // Cart Logic
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
    };

    const handleSendOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            const existingOrder = currentTableOrders[0]; // Simplificación: añadimos al primer pedido abierto de la mesa

            if (existingOrder) {
                result = await addToTableAccount(existingOrder.id, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Pedido Móvil`);
            }

            if (result.error) {
                toast({ title: 'Error al pedir', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido Recibido!', description: 'Estamos preparando su orden.' });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (isLoadingTables) {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <p className="text-sm font-black uppercase tracking-widest animate-pulse">Cargando menú...</p>
            </div>
        );
    }

    // Step 1: Selection of Location
    if (!selectedTable) {
        const availableTables = allTables?.filter(t => t.status === 'Available') || [];
        
        return (
            <div className="min-h-screen bg-background p-6 flex flex-col items-center animate-in fade-in duration-500">
                <div className="text-center space-y-2 mb-10">
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-primary">Go Motel Menu</h1>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Selecciona tu ubicación para pedir</p>
                </div>

                <div className="w-full max-w-lg space-y-8">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {availableTables.map(table => {
                            const Icon = table.type === 'Bar' ? Beer : table.type === 'Terraza' ? Sun : Utensils;
                            return (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table)}
                                    className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border-2 bg-card hover:border-primary hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95"
                                >
                                    <div className="bg-primary/10 p-3 rounded-2xl">
                                        <Icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="text-center">
                                        <span className="block text-3xl font-black tracking-tighter">{table.number}</span>
                                        <span className="text-[10px] font-bold uppercase text-muted-foreground">{TYPE_LABELS[table.type] || table.type}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {availableTables.length === 0 && (
                        <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
                            <MapPin className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                            <p className="font-bold text-muted-foreground uppercase text-xs">No hay ubicaciones disponibles en este momento.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Step 2: Menu & Account
    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background animate-in slide-in-from-bottom-4 duration-500">
            {/* Public Header */}
            <header className="shrink-0 bg-primary p-4 text-primary-foreground shadow-lg z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Utensils className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tighter leading-none uppercase">
                                {TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}
                            </h2>
                            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">Cuenta en curso</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-white/10" onClick={handleExitLocation}>
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
                <div className="bg-card border-b px-4 shrink-0">
                    <TabsList className="grid w-full grid-cols-2 h-14 bg-transparent gap-4">
                        <TabsTrigger 
                            value="menu" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-black uppercase text-[11px] tracking-widest"
                        >
                            <ShoppingCart className="h-4 w-4 mr-2" /> La Carta
                        </TabsTrigger>
                        <TabsTrigger 
                            value="account" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-black uppercase text-[11px] tracking-widest"
                        >
                            <CheckCircle className="h-4 w-4 mr-2" /> Mi Cuenta
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="menu" className="flex-1 flex flex-col min-h-0 p-0 m-0 border-none outline-none">
                    <div className="p-4 bg-muted/10 space-y-4 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="¿Qué se le antoja hoy?..." 
                                className="pl-10 h-12 bg-background border-2 rounded-2xl"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button 
                                className={cn(
                                    "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                                    selectedCategoryId === null ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-background text-muted-foreground border-border"
                                )}
                                onClick={() => setSelectedCategoryId(null)}
                            >
                                Todos
                            </button>
                            {categories?.map(cat => (
                                <button 
                                    key={cat.id}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                                        selectedCategoryId === cat.id ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-background text-muted-foreground border-border"
                                    )}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="grid grid-cols-2 gap-4 p-4 pb-32">
                            {filteredServices.map(service => (
                                <button
                                    key={service.id}
                                    onClick={() => handleAddToCart(service)}
                                    className="group flex flex-col bg-card border rounded-3xl overflow-hidden shadow-sm active:scale-95 transition-all text-left"
                                >
                                    <div className="aspect-square relative overflow-hidden bg-muted">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                            <AvatarFallback className="rounded-none bg-transparent">
                                                <Utensils className="h-8 w-8 text-muted-foreground/20" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute top-2 right-2">
                                            <Badge className="font-black bg-background/90 text-primary border-primary/20 backdrop-blur-sm">
                                                {formatCurrency(service.price)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="p-3 space-y-1">
                                        <h3 className="font-black text-[11px] uppercase tracking-tight line-clamp-2 leading-tight h-8">
                                            {service.name}
                                        </h3>
                                        <span className={cn(
                                            "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block",
                                            service.source === 'Internal' ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                                        )}>
                                            {service.source === 'Internal' ? 'Cocina' : 'Comprado'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="account" className="flex-1 flex flex-col min-h-0 p-0 m-0 border-none outline-none bg-muted/10">
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-6 pb-20">
                            <div className="bg-primary/5 border-2 border-primary/10 rounded-3xl p-6 text-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 mb-1">Total Acumulado</p>
                                <p className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(totalSpent)}</p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Historial de Pedidos</h3>
                                {currentTableOrders.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed rounded-3xl opacity-40">
                                        <Clock className="h-10 w-10 mx-auto mb-2" />
                                        <p className="text-[10px] font-bold uppercase">No hay consumos registrados aún</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {currentTableOrders.sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()).map((order, idx) => (
                                            <div key={order.id} className="bg-card border rounded-2xl p-4 shadow-sm">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase text-muted-foreground">Pedido #{currentTableOrders.length - idx}</p>
                                                        <p className="text-[9px] font-bold text-muted-foreground/60">{order.createdAt.toDate().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                    <Badge variant="outline" className="font-black text-[9px] uppercase border-primary/20 bg-primary/5 text-primary">
                                                        {order.status}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-2 border-t pt-3">
                                                    {order.items.map((item, i) => (
                                                        <div key={i} className="flex justify-between text-xs font-bold uppercase tracking-tight">
                                                            <span>{item.quantity}x {item.name}</span>
                                                            <span className="text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            {/* Float Cart/Submit Bar */}
            {cart.length > 0 && activeTab === 'menu' && (
                <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-30">
                    <div className="max-w-md mx-auto bg-primary rounded-3xl p-4 shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-10 duration-500">
                        <div className="flex items-center gap-4 ml-2">
                            <div className="relative">
                                <ShoppingCart className="h-6 w-6 text-white" />
                                <Badge className="absolute -top-3 -right-3 h-5 w-5 flex items-center justify-center p-0 bg-white text-primary font-black rounded-full border-2 border-primary">
                                    {cart.reduce((s, i) => s + i.quantity, 0)}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">Monto Pedido</p>
                                <p className="text-xl font-black text-white tracking-tighter leading-none">{formatCurrency(subtotal)}</p>
                            </div>
                        </div>
                        <Button 
                            className="bg-white text-primary hover:bg-white/90 rounded-2xl h-12 px-6 font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all"
                            onClick={() => setStep(2)}
                        >
                            REVISAR <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Review and Pay Modal (Simulated as Step 2) */}
            <Dialog open={cart.length > 0 && step === 2} onOpenChange={(o) => !o && setStep(1)}>
                <DialogContent className="sm:max-w-md rounded-t-3xl sm:rounded-3xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 bg-primary text-white">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter">Resumen de Pedido</DialogTitle>
                        <DialogDescription className="text-white/70 font-bold uppercase text-[10px] tracking-widest">
                            Mesa {selectedTable.number} • Confirma tus productos
                        </DialogDescription>
                    </DialogHeader>
                    
                    <ScrollArea className="max-h-[50vh] p-6">
                        <div className="space-y-4">
                            {cart.map((item, idx) => (
                                <div key={item.service.id} className="flex flex-col gap-2 p-3 rounded-2xl bg-muted/30 border border-border/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-black text-xs uppercase tracking-tight truncate">{item.service.name}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground">{formatCurrency(item.service.price)}</p>
                                        </div>
                                        <div className="flex items-center gap-3 bg-background rounded-full p-1 border shadow-sm">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleRemoveFromCart(item.service.id)}><Minus className="h-3 w-3" /></Button>
                                            <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleAddToCart(item.service)}><Plus className="h-3 w-3" /></Button>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleOpenNoteDialog(idx)}
                                        className={cn(
                                            "w-full text-left p-2 rounded-xl text-[10px] font-bold uppercase flex items-center gap-2 border border-dashed transition-all",
                                            item.notes ? "bg-primary/5 text-primary border-primary/30" : "bg-muted text-muted-foreground border-muted-foreground/30"
                                        )}
                                    >
                                        <MessageSquare className="h-3 w-3" />
                                        {item.notes ? `Nota: "${item.notes}"` : "Añadir instrucciones especiales..."}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <div className="p-6 bg-muted/10 border-t space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total a Enviar</span>
                            <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(subtotal)}</span>
                        </div>
                        <Button 
                            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                            disabled={isPending}
                            onClick={handleSendOrder}
                        >
                            {isPending ? "ENVIANDO..." : "CONFIRMAR Y PEDIR"}
                        </Button>
                        <Button variant="ghost" className="w-full font-bold text-muted-foreground uppercase text-[10px] tracking-widest" onClick={() => setStep(1)}>
                            Seguir Comprando
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase tracking-tight">Instrucciones</DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground uppercase">
                            Para: {editingNoteIndex !== null ? cart[editingNoteIndex].service.name : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Con poca sal, sin hielo, término medio..."
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-2xl border-2 font-bold text-sm"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest" onClick={handleSaveNote}>
                            Guardar Instrucción
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Temporary step state for the logic above
function useInternalState() {
    const [step, setStep] = useState(1);
    const [subtotal, setSubtotal] = useState(0);
    return { step, setStep, subtotal };
}
