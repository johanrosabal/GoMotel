'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { RestaurantTable, Order, Service, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { formatCurrency, cn } from '@/lib/utils';
import { 
    Utensils, Beer, Sun, MapPin, ShoppingCart, Package, 
    History, User, CheckCircle, ChevronLeft, Plus, Minus,
    LogOut, MessageSquare, Search, ImageIcon, Clock, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const SESSION_KEY = 'go_motel_order_session';

type CartItem = {
    service: Service;
    quantity: number;
    notes?: string;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());

    // Session State
    const [sessionId, setSessionId] = useState<{ tableId: string; orderId: string } | null>(null);
    const [activeTab, setActiveTab] = useState('menu');
    const [typeFilter, setTypeFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    
    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        const savedSession = localStorage.getItem(SESSION_KEY);
        if (savedSession) {
            setSessionId(JSON.parse(savedSession));
        }
        return () => clearInterval(timer);
    }, []);

    // Firestore Queries
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

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
        [firestore]
    );
    const { data: services } = useCollection<Service>(servicesQuery);

    const myOrdersQuery = useMemoFirebase(() => {
        if (!firestore || !sessionId?.orderId) return null;
        return query(collection(firestore, 'orders'), where('__name__', '==', sessionId.orderId));
    }, [firestore, sessionId?.orderId]);
    const { data: myOrderDoc } = useCollection<Order>(myOrdersQuery);

    // Filter Logic
    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => {
            const matchesType = typeFilter === 'all' || t.type === typeFilter;
            const isAvailable = t.status === 'Available';
            // Only show if available OR if it's my current session table
            return matchesType && (isAvailable || t.id === sessionId?.tableId);
        });
    }, [allTables, typeFilter, sessionId]);

    const filteredServices = useMemo(() => {
        if (!services) return [];
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const currentOrder = myOrderDoc?.[0] || null;

    // Actions
    const handleSelectTable = (table: RestaurantTable) => {
        if (table.status === 'Occupied' && table.id !== sessionId?.tableId) {
            toast({ title: "Ubicación ocupada", description: "Esta mesa ya tiene una cuenta activa.", variant: "destructive" });
            return;
        }
        // If it's my table, just set it. If it's available, it will be set on first order.
        if (table.id === sessionId?.tableId) {
            // Already my session, just UI update
        } else {
            // Initial selection of available table
            setSessionId({ tableId: table.id, orderId: '' });
        }
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

    const handleSendOrder = () => {
        if (!sessionId?.tableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (sessionId.orderId && currentOrder && currentOrder.paymentStatus !== 'Pagado') {
                // Add to existing order
                result = await addToTableAccount(sessionId.orderId, cart.map(i => ({
                    service: i.service,
                    quantity: i.quantity,
                    notes: i.notes || null
                })));
            } else {
                // Create new order
                result = await openTableAccount(sessionId.tableId, cart.map(i => ({
                    service: i.service,
                    quantity: i.quantity,
                    notes: i.notes || null
                })), `Pedido Móvil - ${new Date().toLocaleTimeString()}`);
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            } else {
                const newSession = { tableId: sessionId.tableId, orderId: result.orderId || sessionId.orderId };
                setSessionId(newSession);
                localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
                setCart([]);
                setActiveTab('account');
                toast({ title: "¡Pedido enviado!", description: "Estamos preparando su orden." });
            }
        });
    };

    const handleExitSession = () => {
        localStorage.removeItem(SESSION_KEY);
        setSessionId(null);
        setCart([]);
        setActiveTab('menu');
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);

    const getTypeIcon = (type: string) => {
        if (type === 'Table') return Utensils;
        if (type === 'Bar') return Beer;
        if (type === 'Terraza') return Sun;
        return MapPin;
    };

    // --- RENDER SELECTION ---
    if (!sessionId) {
        return (
            <div className="min-h-screen bg-muted/30 p-6">
                <div className="max-w-md mx-auto space-y-8 pt-10">
                    <div className="text-center space-y-2">
                        <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su ubicación para comenzar a ordenar.</p>
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
                                    <SelectItem value="Table">Mesas Salón</SelectItem>
                                    <SelectItem value="Bar">Barra</SelectItem>
                                    <SelectItem value="Terraza">Terraza</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {filteredTables.map(table => {
                                const Icon = getTypeIcon(table.type);
                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => handleSelectTable(table)}
                                        className="group relative bg-card border-2 rounded-3xl p-6 flex flex-col items-center gap-4 transition-all hover:border-primary hover:shadow-xl active:scale-95"
                                    >
                                        <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <span className="text-4xl font-black tracking-tighter">{table.number}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            {table.type === 'Table' ? 'Mesa' : table.type}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const myTable = allTables?.find(t => t.id === sessionId.tableId);

    return (
        <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto border-x shadow-2xl relative">
            {/* Sticky Header */}
            <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-primary h-10 w-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <Utensils className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="font-black text-sm uppercase tracking-tighter">
                            {myTable ? `${myTable.type === 'Table' ? 'Mesa' : myTable.type} ${myTable.number}` : 'Cargando...'}
                        </h2>
                        <button onClick={handleExitSession} className="text-[9px] font-black text-destructive uppercase tracking-widest flex items-center gap-1">
                            <LogOut className="h-3 w-3" /> Cambiar ubicación
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-right mr-2">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Total Cuenta</p>
                        <p className="text-sm font-black text-primary">{formatCurrency(currentOrder?.total || 0)}</p>
                    </div>
                </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="px-6 py-2 bg-muted/20">
                    <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-background border-2 p-1">
                        <TabsTrigger value="menu" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">
                            <Utensils className="mr-2 h-3.5 w-3.5" /> Menú
                        </TabsTrigger>
                        <TabsTrigger value="account" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white relative">
                            <History className="mr-2 h-3.5 w-3.5" /> Mi Cuenta
                            {currentOrder && currentOrder.status === 'Pendiente' && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="menu" className="flex-1 flex flex-col min-h-0 m-0 animate-in fade-in duration-300">
                    <div className="p-6 space-y-4 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar algo delicioso..." 
                                className="pl-10 h-12 rounded-2xl border-2 bg-muted/30 border-transparent focus:border-primary transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button 
                                onClick={() => setSelectedCategoryId(null)}
                                className={cn(
                                    "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                    !selectedCategoryId ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                )}
                            >
                                Todos
                            </button>
                            {categories?.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                        selectedCategoryId === cat.id ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="px-6 pb-32 grid grid-cols-2 gap-4">
                            {filteredServices.map(service => (
                                <button
                                    key={service.id}
                                    onClick={() => handleAddToCart(service)}
                                    className="group flex flex-col bg-card border rounded-3xl overflow-hidden hover:shadow-xl transition-all active:scale-95 text-left"
                                >
                                    <div className="aspect-square relative overflow-hidden bg-muted">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} className="object-cover transition-transform group-hover:scale-110" />
                                            <AvatarFallback className="rounded-none bg-transparent">
                                                <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute top-2 right-2">
                                            <Badge className="font-black bg-background/90 text-primary border-primary/20 backdrop-blur-sm">
                                                {formatCurrency(service.price)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="p-3 space-y-1">
                                        <h3 className="font-bold text-[11px] uppercase tracking-tight line-clamp-2 leading-tight">
                                            {service.name}
                                        </h3>
                                        <div className={cn(
                                            "inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                                            service.source === 'Internal' ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                                        )}>
                                            {service.source === 'Internal' ? 'Cocina' : 'Comprado'}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="account" className="flex-1 flex flex-col min-h-0 m-0 animate-in slide-in-from-right-4 duration-300">
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-6 pb-24">
                            {/* Account Summary Card */}
                            <div className="bg-primary text-white rounded-[2.5rem] p-8 shadow-2xl shadow-primary/20 relative overflow-hidden">
                                <div className="absolute -top-10 -right-10 h-40 w-40 bg-white/10 rounded-full blur-3xl" />
                                <div className="relative z-10 space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Total Acumulado</p>
                                    <h3 className="text-5xl font-black tracking-tighter">{formatCurrency(currentOrder?.total || 0)}</h3>
                                    <div className="flex items-center gap-2 pt-4">
                                        <Badge variant="outline" className="border-white/30 text-white font-black text-[9px] uppercase tracking-widest bg-white/10">
                                            {currentOrder?.items.reduce((sum, i) => sum + i.quantity, 0) || 0} Artículos
                                        </Badge>
                                        <Badge variant="outline" className="border-white/30 text-white font-black text-[9px] uppercase tracking-widest bg-white/10">
                                            Sesión Activa
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Order History */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Historial de Consumo</h4>
                                    {currentOrder && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase">
                                            <Clock className="h-3 w-3" /> Estado: {currentOrder.status}
                                        </div>
                                    )}
                                </div>

                                {!currentOrder || currentOrder.items.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground/40 space-y-4">
                                        <Package className="h-12 w-12" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Aún no has realizado pedidos</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {currentOrder.items.map((item, idx) => (
                                            <div key={idx} className="bg-card border-2 rounded-3xl p-4 flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center text-lg font-black text-primary">
                                                        {item.quantity}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm uppercase tracking-tight leading-none mb-1">{item.name}</p>
                                                        <p className="text-[10px] text-muted-foreground font-bold">{formatCurrency(item.price)} c/u</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-sm">{formatCurrency(item.price * item.quantity)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center text-center space-y-2">
                                <CheckCircle className="h-6 w-6 text-muted-foreground/40" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">¿Necesitas pagar?</p>
                                <p className="text-xs font-medium text-muted-foreground">Por favor, solicita la cuenta al personal de servicio cuando estés listo para salir.</p>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            {/* Floating Cart Button */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[calc(100%-3rem)] sm:max-w-xs z-50">
                    <Dialog>
                        <DialogTrigger asChild>
                            <button className="w-full h-16 bg-primary text-white rounded-3xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-4">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 h-10 w-10 rounded-2xl flex items-center justify-center relative">
                                        <ShoppingCart className="h-5 w-5" />
                                        <span className="absolute -top-1 -right-1 bg-white text-primary text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-primary">
                                            {cart.reduce((sum, i) => sum + i.quantity, 0)}
                                        </span>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none">Ver Carrito</p>
                                        <p className="text-lg font-black leading-none">{formatCurrency(cartTotal)}</p>
                                    </div>
                                </div>
                                <ChevronLeft className="h-6 w-6 rotate-180 opacity-50" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md rounded-t-[2.5rem] bottom-0 top-auto translate-y-0">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black tracking-tighter uppercase">Confirmar Pedido</DialogTitle>
                                <DialogDescription>Revise su orden antes de enviarla a preparación.</DialogDescription>
                            </DialogHeader>
                            
                            <ScrollArea className="max-h-[50vh] pr-4">
                                <div className="space-y-4 py-4">
                                    {cart.map((item, idx) => (
                                        <div key={item.service.id} className="flex items-center justify-between bg-muted/20 p-4 rounded-3xl border">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm uppercase truncate">{item.service.name}</p>
                                                <p className="text-xs text-muted-foreground font-bold">{formatCurrency(item.service.price)} c/u</p>
                                                {item.service.source === 'Internal' && (
                                                    <button 
                                                        onClick={() => {
                                                            setEditingNoteIndex(idx);
                                                            setCurrentNoteValue(item.notes || '');
                                                            setNoteDialogOpen(true);
                                                        }}
                                                        className="mt-2 text-[9px] font-black uppercase flex items-center gap-1 text-primary"
                                                    >
                                                        <MessageSquare className="h-3 w-3" />
                                                        {item.notes ? "Editar nota" : "+ Instrucciones"}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 bg-background p-1.5 rounded-2xl border-2 shadow-sm">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <span className="font-black text-lg w-6 text-center">{item.quantity}</span>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleAddToCart(item.service)}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>

                            <Separator />
                            <div className="py-4 flex justify-between items-center">
                                <span className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">Total del Pedido</span>
                                <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                            </div>

                            <DialogFooter className="flex-col sm:flex-col gap-3">
                                <Button 
                                    className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20"
                                    onClick={handleSendOrder}
                                    disabled={isPending}
                                >
                                    {isPending ? 'Enviando...' : 'Confirmar y Pedir'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>Instrucciones</DialogTitle>
                        <DialogDescription>Añada detalles especiales para su pedido.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Sin cebolla, término medio, etc..."
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-2xl border-2 text-base"
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
