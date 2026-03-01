'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    Search, ShoppingCart, Plus, Minus, Utensils, Beer, Sun, MapPin, 
    X, CheckCircle, Clock, History, ChevronRight, ImageIcon, Smartphone, PackageCheck
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CartItem = {
    service: Service;
    quantity: number;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // Device Session Logic
    const [sessionId, setSessionId] = useState<string | null>(null);
    useEffect(() => {
        const stored = localStorage.getItem('motel_order_session_token');
        if (stored) {
            setSessionId(stored);
        } else {
            const newId = Math.random().toString(36).substring(2, 15);
            localStorage.setItem('motel_order_session_token', newId);
            setSessionId(newId);
        }
    }, []);

    // Selection View
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [view, setView] = useState<'menu' | 'cart' | 'account'>('menu');

    // Filter & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [zoneFilter, setZoneFilter] = useState<string>('all');

    // Cart
    const [cart, setCart] = useState<CartItem[]>([]);

    // Data
    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: tables } = useCollection<RestaurantTable>(tablesQuery);

    const [services, setServices] = useState<Service[]>([]);
    useEffect(() => { getServices().then(setServices); }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const subCategoriesQuery = useMemoFirebase(() => 
        firestore && selectedCategoryId ? query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategoryId), orderBy('name')) : null, 
        [firestore, selectedCategoryId]
    );
    const { data: subCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

    // Active Order tracking for the current device
    useEffect(() => {
        if (!firestore || !selectedTableId || !sessionId) return;
        
        // Find if there is an active order for this table AND this session
        const q = query(
            collection(firestore, 'orders'), 
            where('locationId', '==', selectedTableId),
            where('status', '==', 'Pendience'),
            where('label', '==', `Móvil-${sessionId.substring(0,4)}`)
        );

        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                setActiveOrderId(snap.docs[0].id);
            } else {
                setActiveOrderId(null);
            }
        });
        return () => unsub();
    }, [firestore, selectedTableId, sessionId]);

    const zones = useMemo(() => Array.from(new Set(tables?.map(t => t.type) || [])), [tables]);
    const filteredTables = useMemo(() => {
        if (!tables) return [];
        return tables.filter(t => zoneFilter === 'all' || t.type === zoneFilter);
    }, [tables, zoneFilter]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Agregado", description: `${service.name} al carrito.` });
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

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);

    const handleConfirmOrder = () => {
        if (!selectedTableId || cart.length === 0 || !sessionId) return;

        startTransition(async () => {
            let result;
            const label = `Móvil-${sessionId.substring(0,4)}`;
            
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTableId, cart, label, 'Public');
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "¡Pedido Enviado!", description: "Su orden está siendo preparada." });
                setCart([]);
                setView('account');
            }
        });
    };

    if (!selectedTableId) {
        return (
            <div className="flex flex-col min-h-screen bg-muted/30 p-6 animate-in fade-in duration-500">
                <div className="max-w-md mx-auto w-full space-y-8">
                    <div className="text-center space-y-2">
                        <div className="inline-flex p-4 rounded-3xl bg-primary/10 text-primary mb-2">
                            <Utensils className="h-10 w-10" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight uppercase">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su mesa para ver el menú</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtrar Zona</Label>
                            <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                <SelectTrigger className="w-40 h-9 rounded-xl border-2 font-bold text-xs bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {filteredTables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => setSelectedTableId(table.id)}
                                    className="flex flex-col items-center justify-center aspect-square rounded-2xl border-2 bg-background hover:border-primary hover:text-primary transition-all active:scale-95 shadow-sm group"
                                >
                                    <span className="text-2xl font-black tracking-tighter mb-1">{table.number}</span>
                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-50 group-hover:opacity-100">{table.type}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-background overflow-hidden relative">
            {/* Header */}
            <div className="bg-background border-b px-4 py-3 flex items-center justify-between shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedTableId(null)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary leading-none mb-1">Mesa Seleccionada</p>
                        <p className="text-sm font-black tracking-tight">{tables?.find(t => t.id === selectedTableId)?.number}</p>
                    </div>
                </div>
                <button onClick={() => setView('account')} className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 relative">
                    <History className="h-5 w-5" />
                    {activeOrderId && <span className="absolute -top-1 -right-1 h-3 w-3 bg-orange-500 rounded-full border-2 border-background animate-pulse" />}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {view === 'menu' && (
                    <div className="flex flex-col h-full">
                        <div className="p-4 space-y-4 shrink-0 bg-muted/10 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar en el catálogo..." 
                                    className="pl-10 h-12 bg-background border-2 rounded-2xl focus:border-primary transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", !selectedCategoryId ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground")}
                                        onClick={() => setSelectedCategoryId(null)}
                                    >Todos</button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id} 
                                            className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", selectedCategoryId === cat.id ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground")}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                        >{cat.name}</button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-3 p-4 pb-32">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="bg-card border-2 rounded-3xl overflow-hidden flex flex-col shadow-sm">
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            
                                            {/* Top Label */}
                                            <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
                                                <Badge className="bg-white/90 text-primary border-none shadow-sm backdrop-blur-md text-[8px] font-black uppercase tracking-widest h-5">
                                                    {service.category === 'Beverage' ? 'Bebida' : service.category === 'Food' ? 'Comida' : 'Amenidad'}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge variant="outline" className={cn("bg-white/90 border-none shadow-sm backdrop-blur-md text-[8px] font-black h-5", service.stock < 5 ? "text-destructive" : "text-zinc-600")}>
                                                        STOCK: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Bottom Info Overlay */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-8">
                                                <h3 className="font-black text-[11px] uppercase tracking-tight text-white leading-tight mb-3 line-clamp-2 min-h-[2.4em]">
                                                    {service.name}
                                                </h3>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-black text-primary drop-shadow-md">
                                                        {formatCurrency(service.price)}
                                                    </span>
                                                    <Button 
                                                        size="icon" 
                                                        className="h-8 w-8 rounded-xl shadow-lg shadow-primary/20" 
                                                        onClick={() => handleAddToCart(service)}
                                                        disabled={service.source !== 'Internal' && service.stock <= 0}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {view === 'cart' && (
                    <div className="flex flex-col h-full bg-muted/10 p-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Mi Pedido</h2>
                            <Badge variant="outline" className="h-7 font-black">{cart.length} artículos</Badge>
                        </div>
                        
                        <ScrollArea className="flex-1 pr-2">
                            {cart.length === 0 ? (
                                <div className="text-center py-20 text-muted-foreground flex flex-col items-center gap-4">
                                    <ShoppingCart className="h-12 w-12 opacity-10" />
                                    <p className="font-black uppercase text-[10px] tracking-widest">Su carrito está vacío</p>
                                    <Button variant="outline" onClick={() => setView('menu')} className="rounded-xl font-bold mt-2">Volver al Menú</Button>
                                </div>
                            ) : (
                                <div className="space-y-3 pb-32">
                                    {cart.map(item => (
                                        <div key={item.service.id} className="bg-background border-2 rounded-2xl p-3 flex items-center justify-between gap-4 shadow-sm animate-in slide-in-from-right-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-[11px] uppercase truncate tracking-tight">{item.service.name}</p>
                                                <p className="text-[10px] font-bold text-primary">{formatCurrency(item.service.price)}</p>
                                            </div>
                                            <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-1 border">
                                                <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-7 w-7 flex items-center justify-center rounded-lg bg-background text-muted-foreground hover:text-destructive transition-colors">
                                                    <Minus className="h-3.5 w-3.5" />
                                                </button>
                                                <span className="text-xs font-black w-4 text-center text-primary">{item.quantity}</span>
                                                <button 
                                                    onClick={() => handleAddToCart(item.service)} 
                                                    disabled={item.service.source !== 'Internal' && item.quantity >= item.service.stock}
                                                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-background text-primary disabled:opacity-30"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                )}

                {view === 'account' && (
                    <div className="flex flex-col h-full p-4 bg-muted/10">
                        <div className="text-center space-y-2 mb-8">
                            <div className="inline-flex p-4 rounded-full bg-primary/10 text-primary">
                                <History className="h-8 w-8" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Historial de Consumo</h2>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Solo pedidos de esta sesión</p>
                        </div>

                        {!activeOrderId ? (
                            <div className="text-center py-12 bg-background border-2 border-dashed rounded-3xl p-8">
                                <p className="text-sm font-medium text-muted-foreground">Aún no tiene pedidos activos para esta estancia.</p>
                                <Button onClick={() => setView('menu')} className="mt-6 rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Pedir Algo Ahora</Button>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1 pb-32">
                                <ActiveAccountView orderId={activeOrderId} />
                            </ScrollArea>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Floating Navigation */}
            <div className="fixed bottom-0 inset-x-0 p-4 z-30 pointer-events-none">
                <div className="max-w-md mx-auto pointer-events-auto">
                    {view === 'cart' && cart.length > 0 && (
                        <div className="mb-4 bg-background border-2 border-primary/20 rounded-2xl p-4 shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-4">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total a pagar</p>
                                <p className="text-xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</p>
                            </div>
                            <Button 
                                onClick={handleConfirmOrder} 
                                disabled={isPending}
                                className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"
                            >
                                {isPending ? "ENVIANDO..." : "CONFIRMAR PEDIDO"}
                            </Button>
                        </div>
                    )}

                    <div className="bg-background/80 backdrop-blur-xl border-2 rounded-3xl p-2 flex items-center justify-between shadow-2xl shadow-black/10">
                        <button 
                            onClick={() => setView('menu')}
                            className={cn("flex-1 h-12 flex flex-col items-center justify-center gap-1 transition-all rounded-2xl", view === 'menu' ? "bg-primary text-white shadow-lg" : "text-muted-foreground")}
                        >
                            <Utensils className="h-4 w-4" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Menú</span>
                        </button>
                        <button 
                            onClick={() => setView('cart')}
                            className={cn("flex-1 h-12 flex flex-col items-center justify-center gap-1 transition-all rounded-2xl relative", view === 'cart' ? "bg-primary text-white shadow-lg" : "text-muted-foreground")}
                        >
                            <ShoppingCart className="h-4 w-4" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Carrito</span>
                            {cart.length > 0 && <span className="absolute top-2 right-4 h-4 w-4 bg-orange-500 rounded-full border-2 border-background text-[8px] flex items-center justify-center font-bold text-white">{cart.length}</span>}
                        </button>
                        <button 
                            onClick={() => setView('account')}
                            className={cn("flex-1 h-12 flex flex-col items-center justify-center gap-1 transition-all rounded-2xl", view === 'account' ? "bg-primary text-white shadow-lg" : "text-muted-foreground")}
                        >
                            <History className="h-4 w-4" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Cuenta</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ActiveAccountView({ orderId }: { orderId: string }) {
    const { firestore } = useFirebase();
    const orderRef = useMemoFirebase(() => firestore ? doc(firestore, 'orders', orderId) : null, [firestore, orderId]);
    const { data: order } = useDoc<Order>(orderRef);

    if (!order) return <p className="text-center text-xs py-10 animate-pulse">Cargando historial...</p>;

    return (
        <div className="space-y-4">
            <div className="p-5 bg-background rounded-3xl border-2 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-dashed">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado de Cuenta</span>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 uppercase text-[9px] font-black">{order.status}</Badge>
                </div>
                <div className="space-y-3">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                <p className="text-[11px] font-black uppercase tracking-tight">{item.quantity}x {item.name}</p>
                                {item.notes && <p className="text-[9px] italic text-primary mt-0.5">"{item.notes}"</p>}
                            </div>
                            <span className="text-[11px] font-bold">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    ))}
                </div>
                <Separator className="bg-muted/50" />
                <div className="flex justify-between items-center pt-2">
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Acumulado</span>
                    <span className="text-xl font-black text-primary tracking-tighter">{formatCurrency(order.total)}</span>
                </div>
            </div>
            
            <div className="p-4 bg-orange-50 border-2 border-orange-500/20 rounded-2xl flex items-center gap-4">
                <div className="bg-orange-100 p-2 rounded-xl text-orange-600">
                    <Clock className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase text-orange-700">Pedido en Proceso</p>
                    <p className="text-[9px] font-medium text-orange-600/80">Personal del motel está atendiendo su solicitud.</p>
                </div>
            </div>
        </div>
    );
}

function useDoc<T>(ref: any) {
    const [data, setData] = useState<T | null>(null);
    useEffect(() => {
        if (!ref) return;
        return onSnapshot(ref, (snap: any) => {
            if (snap.exists()) setData({ id: snap.id, ...snap.data() } as T);
        });
    }, [ref]);
    return { data };
}
