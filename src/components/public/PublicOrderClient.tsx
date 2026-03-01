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
    ShoppingCart, Plus, Minus, ChevronRight, X, Clock, CheckCircle, 
    MessageSquare, Utensils, PackageCheck, Beer, Sun, MapPin, History, LogOut, Filter
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const SESSION_KEY = 'gomotel_order_session';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());

    // Session Management
    const [activeSession, setActiveSession] = useState<{ tableId: string, orderId: string } | null>(null);
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    
    // UI State
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Dialogs
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) setActiveSession(JSON.parse(saved));
        return () => clearInterval(timer);
    }, []);

    // Data Fetching
    const [services, setServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: allTables, isLoading: isLoadingTables } = useCollection<RestaurantTable>(tablesQuery);

    const activeOrdersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'orders'), where('status', 'in', ['Pendiente', 'En preparación', 'Entregado'])) : null, 
        [firestore]
    );
    const { data: allActiveOrders } = useCollection<Order>(activeOrdersQuery);

    // Filter available tables or current session table
    const displayTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => {
            const matchesType = typeFilter === 'all' || t.type === typeFilter;
            const isAvailable = t.status === 'Available';
            const isMyTable = activeSession?.tableId === t.id;
            return matchesType && (isAvailable || isMyTable);
        });
    }, [allTables, typeFilter, activeSession]);

    const sessionTable = useMemo(() => {
        if (!activeSession || !allTables) return null;
        return allTables.find(t => t.id === activeSession.tableId);
    }, [activeSession, allTables]);

    const sessionOrders = useMemo(() => {
        if (!activeSession || !allActiveOrders) return [];
        // CRITICAL: Filter only orders that belong to this specific session token
        return allActiveOrders.filter(o => o.id === activeSession.orderId || (o.locationId === activeSession.tableId && o.status === 'Pendiente'));
    }, [activeSession, allActiveOrders]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);
    const sessionTotal = useMemo(() => sessionOrders.reduce((sum, o) => sum + o.total, 0), [sessionOrders]);

    // Handlers
    const handleSelectTable = (table: RestaurantTable) => {
        if (table.status === 'Occupied' && activeSession?.tableId !== table.id) {
            toast({ title: "Ubicación ocupada", description: "Esta mesa ya tiene una cuenta abierta.", variant: "destructive" });
            return;
        }
        setSelectedTable(table);
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

    const handleOpenNote = (index: number) => {
        setEditingNoteIndex(index);
        setCurrentNoteValue(cart[index].notes || '');
        setNoteDialogOpen(true);
    };

    const handleSaveNote = () => {
        if (editingNoteIndex === null) return;
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue || undefined } : item));
        setNoteDialogOpen(false);
    };

    const handleConfirmOrder = () => {
        const table = sessionTable || selectedTable;
        if (!table || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeSession) {
                result = await addToTableAccount(activeSession.orderId, cart);
            } else {
                result = await openTableAccount(table.id, cart, `Pedido Móvil ${new Date().toLocaleTimeString()}`);
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            } else {
                toast({ title: "¡Pedido enviado!", description: "Tu orden está siendo procesada." });
                if (result.orderId) {
                    const newSession = { tableId: table.id, orderId: result.orderId };
                    setActiveSession(newSession);
                    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
                }
                setCart([]);
                setSelectedTable(null);
            }
        });
    };

    const handleLogout = () => {
        localStorage.removeItem(SESSION_KEY);
        setActiveSession(null);
        setSelectedTable(null);
        setCart([]);
    };

    // --- RENDER SELECTION SCREEN ---
    if (!activeSession && !selectedTable) {
        return (
            <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
                <div className="text-center space-y-2">
                    <div className="bg-primary/10 h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <Utensils className="h-10 w-10 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight">Bienvenido</h1>
                    <p className="text-muted-foreground text-sm font-medium">Seleccione su ubicación para comenzar</p>
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
                                <SelectItem value="Table">Mesas Salón</SelectItem>
                                <SelectItem value="Bar">Barra</SelectItem>
                                <SelectItem value="Terraza">Terraza</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {isLoadingTables ? (
                            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
                        ) : displayTables.map(table => (
                            <button
                                key={table.id}
                                onClick={() => handleSelectTable(table)}
                                className="group bg-card border-2 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:border-primary hover:shadow-xl transition-all active:scale-95"
                            >
                                <span className="text-4xl font-black text-foreground group-hover:text-primary transition-colors">{table.number}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{table.type}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const currentTable = sessionTable || selectedTable;

    return (
        <div className="h-[100dvh] flex flex-col bg-muted/30 overflow-hidden">
            {/* Header */}
            <div className="bg-background border-b px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-primary h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="text-white font-black text-xl">{currentTable?.number}</span>
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-tighter">Go Motel Menu</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{currentTable?.type}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                </Button>
            </div>

            <Tabs defaultValue="menu" className="flex-1 flex flex-col min-h-0">
                <div className="bg-background px-6 pt-2 shrink-0">
                    <TabsList className="grid w-full grid-cols-2 h-12 rounded-xl bg-muted/50 p-1">
                        <TabsTrigger value="menu" className="rounded-lg font-black uppercase text-[10px] tracking-widest">Menú</TabsTrigger>
                        <TabsTrigger value="account" className="rounded-lg font-black uppercase text-[10px] tracking-widest gap-2">
                            Mi Cuenta {sessionTotal > 0 && <span className="bg-primary text-white px-1.5 rounded-md text-[8px]">{formatCurrency(sessionTotal)}</span>}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="menu" className="flex-1 flex flex-col min-h-0 p-0 m-0">
                    <div className="bg-background px-6 pb-4 pt-4 space-y-4 shrink-0">
                        <Input 
                            placeholder="Buscar en el menú..." 
                            className="h-12 bg-muted/50 border-0 rounded-2xl px-6 font-medium text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <ScrollArea className="w-full whitespace-nowrap">
                            <div className="flex gap-2 pb-2">
                                <button 
                                    className={cn(
                                        "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                        selectedCategoryId === null ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground"
                                    )}
                                    onClick={() => setSelectedCategoryId(null)}
                                >
                                    Todos
                                </button>
                                {categories?.map(cat => (
                                    <button 
                                        key={cat.id}
                                        className={cn(
                                            "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === cat.id ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground"
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

                    <ScrollArea className="flex-1">
                        <div className="grid grid-cols-2 gap-4 p-6 pb-32">
                            {filteredServices.map(service => (
                                <div 
                                    key={service.id} 
                                    className="group relative bg-card border rounded-[2rem] overflow-hidden shadow-sm active:scale-95 transition-transform aspect-[4/5]"
                                >
                                    <Avatar className="h-full w-full rounded-none">
                                        <AvatarImage src={service.imageUrl} className="object-cover" />
                                        <AvatarFallback className="rounded-none bg-muted">
                                            <Utensils className="h-10 w-10 text-muted-foreground/20" />
                                        </AvatarFallback>
                                    </Avatar>

                                    {/* Overlay con Información */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white mb-0.5 opacity-90">
                                                {service.category} / {service.source === 'Internal' ? 'Cocina' : `Stock: ${service.stock}`}
                                            </span>
                                            <h3 className="text-white font-black text-xs uppercase tracking-tight leading-tight line-clamp-2">{service.name}</h3>
                                            <p className="text-primary-foreground font-black text-sm mt-1">{formatCurrency(service.price)}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleAddToCart(service)}
                                            className="mt-3 w-full h-10 bg-primary text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg shadow-primary/20 active:bg-primary/80 transition-colors"
                                        >
                                            Agregar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="account" className="flex-1 flex flex-col min-h-0 p-6 m-0">
                    <ScrollArea className="flex-1">
                        <div className="space-y-6 pb-32">
                            {sessionOrders.length === 0 ? (
                                <div className="text-center py-20 space-y-4">
                                    <div className="bg-muted h-20 w-20 rounded-full flex items-center justify-center mx-auto opacity-20">
                                        <History className="h-10 w-10" />
                                    </div>
                                    <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">No hay consumos registrados</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Total Acumulado</p>
                                            <p className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(sessionTotal)}</p>
                                        </div>
                                        <History className="h-8 w-8 text-primary/20" />
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Historial de Pedidos</h3>
                                        {sessionOrders.map((order, idx) => (
                                            <div key={order.id} className="bg-background rounded-3xl border p-5 shadow-sm space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-xs font-black">{idx + 1}</div>
                                                        <span className="text-[10px] font-bold text-muted-foreground">hace {formatDistance(order.createdAt.toDate(), now, { locale: es })}</span>
                                                    </div>
                                                    <Badge variant={order.status === 'Entregado' ? 'default' : 'secondary'} className="rounded-lg font-black uppercase text-[8px] tracking-widest px-3 h-6">
                                                        {order.status}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    {order.items.map((item, i) => (
                                                        <div key={i} className="flex justify-between items-center">
                                                            <span className="text-xs font-bold uppercase tracking-tight"><span className="text-primary font-black mr-1">{item.quantity}x</span> {item.name}</span>
                                                            <span className="text-[11px] font-black text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="pt-3 border-t flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtotal Pedido</span>
                                                    <span className="text-sm font-black text-foreground">{formatCurrency(order.total)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            {/* Bottom Floating Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-background via-background to-transparent z-50">
                    <div className="max-w-md mx-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <span className="absolute -top-1 -right-1 bg-white text-primary text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-primary shadow-sm">
                                                {cart.reduce((sum, i) => sum + i.quantity, 0)}
                                            </span>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Ver Pedido</p>
                                            <p className="text-lg font-black tracking-tight leading-none">{formatCurrency(cartTotal)}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-6 w-6 opacity-50" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md rounded-t-[2.5rem] sm:rounded-3xl h-[80vh] flex flex-col p-0">
                                <DialogHeader className="p-8 pb-4 shrink-0">
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Confirmar Pedido</DialogTitle>
                                    <DialogDescription className="font-bold">Revisa los artículos antes de enviar a cocina.</DialogDescription>
                                </DialogHeader>
                                
                                <ScrollArea className="flex-1 px-8">
                                    <div className="space-y-4 pb-8">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="bg-muted/30 rounded-3xl p-4 border-2 border-transparent hover:border-primary/10 transition-all">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <h4 className="text-sm font-black uppercase tracking-tight line-clamp-1">{item.service.name}</h4>
                                                        <p className="text-xs font-bold text-primary mt-0.5">{formatCurrency(item.service.price)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-background rounded-2xl p-1 shadow-sm border">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleAddToCart(item.service)}>
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleOpenNote(idx)}
                                                    className={cn(
                                                        "mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded-xl border-2 transition-all w-full",
                                                        item.notes ? "bg-primary text-white border-primary" : "text-muted-foreground border-dashed border-muted-foreground/30 hover:bg-muted"
                                                    )}
                                                >
                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                    {item.notes ? "Ver Instrucciones" : "Añadir nota especial"}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <div className="p-8 bg-muted/20 border-t space-y-6 shrink-0">
                                    <div className="flex justify-between items-center px-2">
                                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Pedido</span>
                                        <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-16 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30"
                                        onClick={handleConfirmOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? "ENVIANDO..." : "CONFIRMAR Y ENVIAR"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Instrucciones</DialogTitle>
                        <DialogDescription className="font-bold text-xs">
                            ¿Alguna indicación especial para este producto?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Sin sal, Coca Cola con hielo, alitas bien cocidas..."
                            className="min-h-[120px] rounded-2xl border-2 bg-muted/30 focus:border-primary font-medium p-4"
                            value={currentNoteValue}
                            onChange={(e) => setCurrentNoteValue(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-xl font-bold" onClick={handleSaveNote}>
                            Guardar Instrucciones
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
