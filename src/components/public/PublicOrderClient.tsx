'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Utensils, Beer, Sun, MapPin, 
    MessageSquare, CheckCircle, Clock, 
    LogOut, ChevronRight, ImageIcon, 
    Layers, Filter, X, Info
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';

const SESSION_KEY = 'go_motel_public_session';

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
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    
    // Menu filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Note handling
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Load session
    useEffect(() => {
        const savedSession = localStorage.getItem(SESSION_KEY);
        if (savedSession) {
            const { tableId, orderId } = JSON.parse(savedSession);
            setSelectedTableId(tableId);
            setActiveOrderId(orderId);
        }
    }, []);

    // Sync session with Firestore
    useEffect(() => {
        if (!firestore || !selectedTableId) return;

        const unsubscribe = onSnapshot(doc(firestore, 'restaurantTables', selectedTableId), (docSnap) => {
            if (docSnap.exists()) {
                const tableData = docSnap.data();
                // If table becomes available or orderId changes, clear session if it doesn't match
                if (tableData.status === 'Available' || tableData.currentOrderId !== activeOrderId) {
                    if (activeOrderId && tableData.currentOrderId !== activeOrderId) {
                        handleLogout();
                    }
                }
            }
        });

        return () => unsubscribe();
    }, [firestore, selectedTableId, activeOrderId]);

    // Data Fetching
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), where('status', '==', 'Available')) : null, 
        [firestore]
    );
    const { data: availableTables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
        [firestore]
    );
    const { data: allServices } = useCollection<Service>(servicesQuery);

    const ordersQuery = useMemoFirebase(() => 
        firestore && activeOrderId ? query(collection(firestore, 'orders'), where('id', '==', activeOrderId)) : null, 
        [firestore, activeOrderId]
    );
    const { data: myOrders } = useCollection<Order>(ordersQuery);

    const locationTypes = useMemo(() => {
        if (!availableTables) return [];
        return Array.from(new Set(availableTables.map(t => t.type)));
    }, [availableTables]);

    const filteredTables = useMemo(() => {
        if (!availableTables) return [];
        return availableTables.filter(t => typeFilter === 'all' || t.type === typeFilter)
            .sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [availableTables, typeFilter]);

    const filteredServices = useMemo(() => {
        if (!allServices) return [];
        return allServices.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [allServices, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);

    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTableId(table.id);
        // Initially no orderId until first order is sent
    };

    const handleLogout = () => {
        localStorage.removeItem(SESSION_KEY);
        setSelectedTableId(null);
        setActiveOrderId(null);
        setCart([]);
        setActiveTab('menu');
    };

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
        setCart(prev => prev.map((item, i) => i === editingNoteIndex ? { ...item, notes: currentNoteValue || undefined } : item));
        setNoteDialogOpen(false);
        setEditingNoteIndex(null);
    };

    const handleSendOrder = () => {
        if (!selectedTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTableId, cart, "Pedido Móvil");
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                const orderId = activeOrderId || result.orderId;
                if (orderId) {
                    setActiveOrderId(orderId);
                    localStorage.setItem(SESSION_KEY, JSON.stringify({ tableId: selectedTableId, orderId }));
                }
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando su orden.' });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    // UI RENDERING - SELECTION SCREEN
    if (!selectedTableId) {
        return (
            <div className="min-h-screen bg-background flex flex-col p-6 animate-in fade-in duration-500">
                <div className="max-w-md mx-auto w-full space-y-8 py-10">
                    <div className="text-center space-y-2">
                        <div className="bg-primary/10 h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                            <Utensils className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter">Bienvenido</h1>
                        <p className="text-muted-foreground text-sm font-medium">Seleccione su ubicación para comenzar</p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card shadow-sm">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {locationTypes.map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {filteredTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table)}
                                    className="group flex flex-col items-center justify-center h-32 rounded-3xl border-2 bg-card hover:border-primary hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95"
                                >
                                    <span className="text-4xl font-black tracking-tighter text-foreground group-hover:text-primary">{table.number}</span>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">{table.type}</span>
                                </button>
                            ))}
                        </div>

                        {filteredTables.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground">
                                <p className="text-sm">No hay ubicaciones disponibles en esta zona.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // UI RENDERING - MAIN APP (MENU & ACCOUNT)
    return (
        <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden relative">
            {/* Mobile Header */}
            <header className="shrink-0 bg-background/80 backdrop-blur-md border-b z-20 px-6 h-20 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-primary h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <span className="text-xl font-black tracking-tighter">
                            {selectedTableId && availableTables?.find(t => t.id === selectedTableId)?.number || "00"}
                        </span>
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Ubicación Actual</span>
                        <span className="text-sm font-bold truncate">Mesa Seleccionada</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-2xl h-12 w-12 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                </Button>
            </header>

            {/* Navigation Tabs */}
            <div className="shrink-0 bg-muted/30 p-1.5 mx-6 mt-4 rounded-2xl flex gap-1 border shadow-inner">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all",
                        activeTab === 'menu' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-background/50"
                    )}
                >
                    <Utensils className="h-3.5 w-3.5" /> Menú
                </button>
                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex-1 h-11 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all relative",
                        activeTab === 'account' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-background/50"
                    )}
                >
                    <Clock className="h-3.5 w-3.5" /> Mi Cuenta
                    {activeOrderId && <span className="absolute top-2 right-4 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                </button>
            </div>

            <main className="flex-1 overflow-hidden relative">
                {activeTab === 'menu' ? (
                    <div className="flex flex-col h-full">
                        {/* Search and Categories */}
                        <div className="p-6 space-y-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="¿Qué se le antoja hoy?" 
                                    className="h-14 pl-11 rounded-2xl border-2 bg-card text-base font-medium shadow-sm transition-all focus:border-primary"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    className={cn(
                                        "px-4 h-9 rounded-full font-black text-[10px] uppercase tracking-widest transition-all border shadow-sm",
                                        selectedCategoryId === null ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground hover:border-primary/50"
                                    )}
                                    onClick={() => setSelectedCategoryId(null)}
                                >
                                    Todos
                                </button>
                                {categories?.map(cat => (
                                    <button 
                                        key={cat.id}
                                        className={cn(
                                            "px-4 h-9 rounded-full font-black text-[10px] uppercase tracking-widest transition-all border shadow-sm",
                                            selectedCategoryId === cat.id ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground hover:border-primary/50"
                                        )}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Product Grid */}
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 px-6 pb-32">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="flex flex-col bg-card border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-3 right-3">
                                                <Badge className="font-black bg-black/60 text-white backdrop-blur-md border-none">
                                                    {formatCurrency(service.price)}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="p-4 flex flex-col flex-1">
                                            <h3 className="font-black text-[11px] uppercase leading-tight line-clamp-2 mb-3">{service.name}</h3>
                                            <Button 
                                                className="mt-auto h-9 w-full rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 shadow-sm"
                                                onClick={() => handleAddToCart(service)}
                                            >
                                                <Plus className="h-3 w-3" /> Agregar
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="flex flex-col h-full p-6">
                        {!activeOrderId ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                                <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
                                <div className="space-y-1">
                                    <p className="text-sm font-black uppercase tracking-widest">Sin actividad</p>
                                    <p className="text-xs text-muted-foreground">Aún no ha realizado pedidos para esta ubicación.</p>
                                </div>
                                <Button variant="outline" onClick={() => setActiveTab('menu')} className="rounded-xl font-bold px-8">Ir al Menú</Button>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1">
                                <div className="space-y-6 pb-32">
                                    {/* Summary Card */}
                                    <div className="bg-primary text-white p-6 rounded-[2.5rem] shadow-xl shadow-primary/20 space-y-4 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                                            <Layers className="h-24 w-24" />
                                        </div>
                                        <div className="space-y-1 relative z-10">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Total Acumulado</p>
                                            <p className="text-4xl font-black tracking-tighter">{formatCurrency(myOrders?.[0]?.total || 0)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase bg-white/20 w-fit px-3 py-1.5 rounded-full relative z-10 backdrop-blur-md">
                                            <CheckCircle className="h-3 w-3" /> {myOrders?.[0]?.items.length || 0} Artículos registrados
                                        </div>
                                    </div>

                                    {/* Orders List */}
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Historial de Consumo</h4>
                                        {myOrders?.map((order) => (
                                            <div key={order.id} className="bg-card border rounded-3xl p-5 shadow-sm space-y-4 border-l-4 border-l-primary animate-in slide-in-from-bottom-2 duration-300">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={order.status === 'Entregado' ? 'secondary' : 'default'} className="font-black text-[9px] uppercase tracking-widest">
                                                                {order.status}
                                                            </Badge>
                                                            <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                                                                <Clock className="h-2.5 w-2.5" /> {formatDistanceToNow(order.createdAt.toDate(), { addSuffix: true, locale: es })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    {order.items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-sm">
                                                            <span className="font-medium text-muted-foreground"><span className="text-foreground font-black">{item.quantity}x</span> {item.name}</span>
                                                            <span className="font-bold">{formatCurrency(item.price * item.quantity)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="pt-3 border-t border-dashed flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase text-muted-foreground">Monto Pedido</span>
                                                    <span className="font-black text-primary">{formatCurrency(order.total)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="p-6 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center text-center gap-3">
                                        <div className="bg-background h-10 w-10 rounded-full flex items-center justify-center shadow-sm border"><Info className="h-5 w-5 text-primary" /></div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest">¿Necesita algo más?</p>
                                            <p className="text-xs text-muted-foreground px-4">Si requiere asistencia adicional o desea cancelar su cuenta, por favor llame al personal.</p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Cart/Action Bar */}
            {activeTab === 'menu' && cart.length > 0 && (
                <div className="absolute inset-x-0 bottom-0 p-6 z-30">
                    <div className="max-w-md mx-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                            <ShoppingCart className="h-5 w-5" />
                                            <span className="absolute -top-1.5 -right-1.5 bg-white text-primary text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-md">
                                                {cart.length}
                                            </span>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Mi Pedido</p>
                                            <p className="text-lg font-black tracking-tighter">Ver Carrito</p>
                                        </div>
                                    </div>
                                    <p className="text-xl font-black tracking-tighter">{formatCurrency(cartTotal)}</p>
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md rounded-t-[2.5rem] sm:rounded-3xl h-[80vh] flex flex-col p-0 overflow-hidden">
                                <DialogHeader className="p-8 pb-4">
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Confirmar Pedido</DialogTitle>
                                    <DialogDescription className="font-medium">Revise los productos antes de enviar a cocina.</DialogDescription>
                                </DialogHeader>
                                
                                <ScrollArea className="flex-1 px-8">
                                    <div className="space-y-4">
                                        {cart.map((item, index) => (
                                            <div key={item.service.id} className="p-4 rounded-2xl border bg-muted/20 space-y-3 relative group">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 space-y-1">
                                                        <p className="font-black text-xs uppercase tracking-tight line-clamp-1">{item.service.name}</p>
                                                        <p className="text-[10px] text-muted-foreground font-bold">{formatCurrency(item.service.price)} c/u</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-background rounded-xl p-1 shadow-sm border">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleAddToCart(item.service)}>
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center justify-between gap-4">
                                                    <button 
                                                        onClick={() => handleOpenNoteDialog(index)}
                                                        className={cn(
                                                            "text-[9px] font-black uppercase px-2 py-1.5 rounded-lg border transition-all flex items-center gap-2",
                                                            item.notes ? "bg-primary text-white border-primary" : "bg-background text-muted-foreground hover:bg-muted"
                                                        )}
                                                    >
                                                        <MessageSquare className="h-3 w-3" />
                                                        {item.notes ? "Editar Nota" : "+ Instrucciones"}
                                                    </button>
                                                    <p className="font-black text-primary text-sm">{formatCurrency(item.service.price * item.quantity)}</p>
                                                </div>
                                                
                                                {item.notes && (
                                                    <div className="bg-background/50 p-2 rounded-lg border border-dashed text-[10px] text-primary italic font-medium">
                                                        "{item.notes}"
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <DialogFooter className="p-8 pt-4 border-t bg-muted/10 space-y-4">
                                    <div className="flex justify-between items-center w-full mb-4 px-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Pedido</span>
                                        <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                    </div>
                                    <Button 
                                        className="w-full h-16 rounded-2xl font-black uppercase tracking-[0.15em] text-sm shadow-xl shadow-primary/20"
                                        onClick={handleSendOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? "PROCESANDO..." : "ENVIAR AHORA"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Note Input Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Instrucciones Especiales</DialogTitle>
                        <DialogDescription>¿Desea añadir algo más para este producto?</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-xl text-primary"><Utensils className="h-5 w-5" /></div>
                            <span className="font-black text-xs uppercase">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nota para Cocina/Barra</Label>
                            <Textarea 
                                placeholder="Ej: Con poco hielo, sin azúcar, término medio..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] rounded-2xl border-2 resize-none text-sm font-bold"
                                autoFocus
                            />
                        </div>
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
