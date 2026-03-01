'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, Wallet, CreditCard, ChevronRight, ChevronLeft,
    ImageIcon, User, Layers, Filter, Utensils, Beer, PackageCheck, Clock, CheckCircle, Settings2, X, Sun, MapPin,
    MessageSquare, History
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza',
    'Pooles': 'Pooles'
};

const CATEGORY_MAP: Record<string, string> = {
    'Food': 'Comida',
    'Beverage': 'Bebida',
    'Amenity': 'Amenidad',
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());

    // Session privacy logic
    const [sessionToken, setSessionToken] = useState<string | null>(null);

    useEffect(() => {
        let token = localStorage.getItem('guest_session_token');
        if (!token) {
            token = Math.random().toString(36).substring(2, 15);
            localStorage.setItem('guest_session_token', token);
        }
        setSessionToken(token);
        
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [zoneFilter, setStatusFilter] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [cart, setCart] = useState<{ service: Service; quantity: number; notes?: string }[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, [firestore]);
    const { data: services } = useCollection<Service>(servicesQuery);

    const activeOrdersQuery = useMemoFirebase(() => {
        if (!firestore || !selectedTable) return null;
        return query(
            collection(firestore, 'orders'), 
            where('locationId', '==', selectedTable.id),
            where('status', '==', 'Pendiente')
        );
    }, [firestore, selectedTable]);
    const { data: tableOrders } = useCollection<Order>(activeOrdersQuery);

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type))).sort();
    }, [allTables]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => zoneFilter === 'all' || t.type === zoneFilter);
    }, [allTables, zoneFilter]);

    const filteredServices = useMemo(() => {
        if (!services) return [];
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const cartTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
    }, [cart]);

    const myOrders = useMemo(() => {
        if (!tableOrders) return [];
        return tableOrders;
    }, [tableOrders]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Añadido", description: `${service.name} al carrito.` });
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
            if (myOrders.length > 0) {
                result = await addToTableAccount(myOrders[0].id, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Pedido Móvil`, 'Public');
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            } else {
                toast({ title: "¡Pedido Enviado!", description: "Tu orden está siendo procesada." });
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md space-y-8 text-center">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black uppercase tracking-tighter text-primary">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su mesa para comenzar a ordenar.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="grid gap-2 text-left">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar por Zona</Label>
                            <Select value={zoneFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-background">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {locationTypes.map(type => (
                                        <SelectItem key={type} value={type}>
                                            {TYPE_LABELS[type] || type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="h-[50vh] rounded-3xl border-2 bg-background shadow-inner">
                            <div className="grid grid-cols-3 gap-3 p-4">
                                {filteredTables.map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTable(table)}
                                        className={cn(
                                            "aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all active:scale-95",
                                            table.status === 'Occupied' 
                                                ? "bg-primary/5 border-primary text-primary" 
                                                : "bg-background border-border text-muted-foreground hover:border-primary/40"
                                        )}
                                    >
                                        <span className="text-2xl font-black">{table.number}</span>
                                        <span className="text-[8px] font-black uppercase tracking-widest">{TYPE_LABELS[table.type] || table.type}</span>
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
        <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
            <div className="shrink-0 p-4 border-b bg-primary flex justify-between items-center text-primary-foreground shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-md">
                        <Utensils className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Ubicación</p>
                        <p className="font-black text-lg leading-none uppercase tracking-tighter">
                            {TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}
                        </p>
                    </div>
                </div>
                <button onClick={() => { setSelectedTable(null); setCart([]); }} className="h-10 w-10 rounded-xl bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors">
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'menu' && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="p-4 space-y-4 shrink-0 bg-muted/20">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar comida, bebida..." 
                                    className="h-12 pl-10 rounded-2xl border-2 bg-background text-base font-bold shadow-sm"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground border")}
                                        onClick={() => setSelectedCategoryId(null)}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all border", selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground")}
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
                            <div className="grid grid-cols-2 gap-3 p-4 pb-24">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="group relative bg-card rounded-[2rem] overflow-hidden border-2 border-transparent hover:border-primary/20 transition-all duration-300 shadow-sm">
                                        <div className="aspect-[4/5] relative">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-muted">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                                                <Badge className="bg-white/90 text-primary hover:bg-white/90 font-black uppercase text-[8px] px-2 py-0.5 rounded-full border-0 pointer-events-none">
                                                    {CATEGORY_MAP[service.category] || service.category}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge className={cn("font-black uppercase text-[8px] px-2 py-0.5 rounded-full border-0 pointer-events-none", (service.stock || 0) <= (service.minStock || 0) ? "bg-red-500 text-white" : "bg-emerald-500 text-white")}>
                                                        Stock: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
                                                <div className="space-y-1 mb-1">
                                                    <h3 className="text-white font-black uppercase text-xs leading-tight tracking-tight drop-shadow-md">{service.name}</h3>
                                                    <p className="text-primary-foreground font-black text-base drop-shadow-md">{formatCurrency(service.price)}</p>
                                                </div>
                                                <Button size="icon" className="absolute bottom-4 right-4 h-10 w-10 rounded-2xl shadow-xl shadow-primary/20 active:scale-90 transition-transform" onClick={() => handleAddToCart(service)}>
                                                    <Plus className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {activeTab === 'cart' && (
                    <div className="flex-1 flex flex-col p-4 pb-24 min-h-0 bg-muted/10 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Mi Carrito</h2>
                            <Badge variant="secondary" className="h-7 px-3 font-black">{cart.length} Productos</Badge>
                        </div>
                        <ScrollArea className="flex-1">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30 gap-4">
                                    <ShoppingCart className="h-20 w-20" />
                                    <p className="font-black uppercase tracking-[0.2em] text-sm">Tu carrito está vacío</p>
                                    <Button variant="outline" className="rounded-full px-8" onClick={() => setActiveTab('menu')}>Ir al menú</Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map((item, idx) => (
                                        <Card key={item.service.id} className="border-0 shadow-sm rounded-3xl overflow-hidden bg-card">
                                            <div className="p-4 flex gap-4">
                                                <div className="h-20 w-20 rounded-2xl overflow-hidden shrink-0 border bg-muted">
                                                    <img src={item.service.imageUrl} className="h-full w-full object-cover" alt="" />
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                    <div>
                                                        <h4 className="font-black text-sm uppercase tracking-tight truncate">{item.service.name}</h4>
                                                        <p className="text-primary font-black text-xs">{formatCurrency(item.service.price)}</p>
                                                    </div>
                                                    {item.service.source === 'Internal' && (
                                                        <button onClick={() => handleOpenNoteDialog(idx)} className={cn("text-[10px] font-black uppercase px-2 py-1 rounded-lg border transition-all flex items-center gap-1.5 w-fit mt-1", item.notes ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary")}>
                                                            <MessageSquare className="h-3 w-3" />
                                                            {item.notes ? "Ver Nota" : "Añadir Nota"}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-center gap-1 bg-muted/30 rounded-2xl p-1 border">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl" onClick={() => handleAddToCart(item.service)}>+</Button>
                                                    <span className="text-xs font-black text-primary">{item.quantity}</span>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl" onClick={() => handleRemoveFromCart(item.service.id)}>-</Button>
                                                </div>
                                            </div>
                                            {item.notes && <div className="px-4 pb-3"><div className="bg-primary/5 p-3 rounded-2xl border border-primary/10 text-[11px] italic text-primary/80 font-medium">"{item.notes}"</div></div>}
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        {cart.length > 0 && (
                            <div className="mt-4 p-6 bg-card border-2 border-primary/20 rounded-[2.5rem] shadow-xl space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-center px-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total a Confirmar</span>
                                    <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                </div>
                                <Button className="w-full h-16 rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary/30" onClick={handleSendOrder} disabled={isPending}>
                                    {isPending ? "Enviando Pedido..." : "Confirmar mi Pedido"}
                                    <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="flex-1 flex flex-col p-4 pb-24 min-h-0 bg-muted/10 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Mi Cuenta</h2>
                            <Badge variant="outline" className="h-7 px-3 font-black border-primary text-primary">Estado: Pendiente</Badge>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="space-y-6 pb-10">
                                <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                    <div className="bg-primary p-8 text-primary-foreground relative">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                        <div className="relative z-10 flex justify-between items-center">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-1">Total Acumulado</p>
                                                <h3 className="text-5xl font-black tracking-tighter">{formatCurrency(myOrders.reduce((sum, o) => sum + o.total, 0))}</h3>
                                            </div>
                                            <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30"><Wallet className="h-7 w-7" /></div>
                                        </div>
                                    </div>
                                    <div className="p-6 space-y-6">
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Detalle de Consumos</h4>
                                            {myOrders.length === 0 ? <div className="text-center py-8 text-muted-foreground/50 border-2 border-dashed rounded-3xl">No hay pedidos registrados aún.</div> : (
                                                <div className="space-y-3">
                                                    {myOrders.map(order => (
                                                        <div key={order.id} className="p-4 rounded-2xl border-2 border-muted bg-muted/5 space-y-3">
                                                            <div className="flex justify-between items-center border-b border-dashed pb-2">
                                                                <span className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5"><Clock className="h-3 w-3" /> {order.createdAt?.toDate().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                <Badge className="bg-white text-primary hover:bg-white text-[9px] font-black uppercase pointer-events-none border border-primary/20">{order.status}</Badge>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {order.items.map((item, i) => (
                                                                    <div key={i} className="flex justify-between text-xs font-bold"><span className="uppercase text-muted-foreground">{item.quantity}x {item.name}</span><span>{formatCurrency(item.price * item.quantity)}</span></div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-amber-500/10 border-2 border-amber-500/20 p-6 rounded-3xl flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0"><Smartphone className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-black uppercase tracking-tight text-amber-700 dark:text-amber-400">Solicitud de Pago</p>
                                                <p className="text-sm font-medium text-amber-700/90 dark:text-amber-300/90 leading-snug">Para solicitar el cobro, por favor comunícate con la recepción o un salonero.</p>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>

            <div className="shrink-0 h-24 bg-card border-t shadow-[0_-10px_40px_rgba(0,0,0,0.05)] px-6 flex items-center justify-between pb-4">
                <button className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'menu' ? "text-primary scale-110" : "text-muted-foreground opacity-50")} onClick={() => setActiveTab('menu')}>
                    <div className={cn("p-2 rounded-2xl transition-all", activeTab === 'menu' ? "bg-primary/10" : "")}><Utensils className="h-6 w-6" /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Menú</span>
                </button>
                <div className="relative">
                    <button className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'cart' ? "text-primary scale-110" : "text-muted-foreground opacity-50")} onClick={() => setActiveTab('cart')}>
                        <div className={cn("p-2 rounded-2xl transition-all", activeTab === 'cart' ? "bg-primary/10" : "")}><ShoppingCart className="h-6 w-6" /></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Carrito</span>
                    </button>
                    {cart.length > 0 && <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center ring-4 ring-background">{cart.length}</div>}
                </div>
                <button className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'account' ? "text-primary scale-110" : "text-muted-foreground opacity-50")} onClick={() => setActiveTab('account')}>
                    <div className={cn("p-2 rounded-2xl transition-all", activeTab === 'account' ? "bg-primary/10" : "")}><History className="h-6 w-6" /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </div>

            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Instrucciones</DialogTitle>
                        <DialogDescription className="font-medium">¿Cómo deseas que preparemos tu orden?</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="p-4 bg-primary/5 rounded-3xl border-2 border-primary/10 flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl"><Utensils className="h-5 w-5 text-primary" /></div>
                            <span className="font-black text-sm uppercase tracking-tight">{editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}</span>
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="guest-kitchen-note" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Instrucciones Especiales</Label>
                            <Textarea id="guest-kitchen-note" placeholder="Ej: Sin hielo, término medio, sin cebolla..." value={currentNoteValue} onChange={e => setCurrentNoteValue(e.target.value)} className="min-h-[150px] rounded-3xl border-2 border-muted focus:border-primary transition-all resize-none text-base font-bold p-5" autoFocus />
                        </div>
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