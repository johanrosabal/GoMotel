'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, ChevronRight, X, Utensils, Beer, Sun, 
    MapPin, Clock, CheckCircle, Info, History, 
    MessageSquare, AlertCircle, ImageIcon, SmartphoneIcon
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { useToast } from '@/hooks/use-toast';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

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

    // UI State
    const [view, setView] = useState<'menu' | 'cart' | 'account'>('menu');
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    
    // Data State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [localOrderId, setLocalOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);

    // Note Dialog State
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        const storedOrderId = localStorage.getItem('guest_active_order_id');
        if (storedOrderId) setLocalOrderId(storedOrderId);
        return () => clearInterval(timer);
    }, []);

    // Listen to current order in real-time
    useEffect(() => {
        if (!firestore || !localOrderId) return;
        const unsub = onSnapshot(doc(firestore, 'orders', localOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Cancelado' || data.paymentStatus === 'Pagado') {
                    localStorage.removeItem('guest_active_order_id');
                    setLocalOrderId(null);
                    setActiveOrder(null);
                } else {
                    setActiveOrder({ id: snap.id, ...data });
                }
            } else {
                localStorage.removeItem('guest_active_order_id');
                setLocalOrderId(null);
                setActiveOrder(null);
            }
        });
        return () => unsub();
    }, [firestore, localOrderId]);

    // Data Fetching
    const [services, setServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setServices);
    }, []);

    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: tables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, selectedCategoryId]);

    const cartTotal = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);

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

    const handleConfirmOrder = () => {
        if (!selectedTableId || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (localOrderId) {
                result = await addToTableAccount(localOrderId, cart);
            } else {
                result = await openTableAccount(selectedTableId, cart, 'Auto-Pedido', 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    localStorage.setItem('guest_active_order_id', result.orderId);
                    setLocalOrderId(result.orderId);
                }
                toast({ title: '¡Pedido Enviado!', description: 'Estamos preparando su orden.' });
                setCart([]);
                setView('account');
            }
        });
    };

    const selectedTable = tables?.find(t => t.id === selectedTableId);

    if (!selectedTableId) {
        return (
            <div className="min-h-screen bg-muted/30 p-6 flex flex-col items-center justify-center animate-in fade-in duration-500">
                <div className="w-full max-w-md space-y-8 text-center">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su mesa para comenzar a ordenar.</p>
                    </div>
                    <ScrollArea className="h-[60vh] w-full rounded-3xl border bg-background shadow-2xl p-4">
                        <div className="grid grid-cols-2 gap-4 p-2">
                            {tables?.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => setSelectedTableId(table.id)}
                                    className="flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group active:scale-95"
                                >
                                    <span className="text-3xl font-black group-hover:text-primary transition-colors">{table.number}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{table.type}</span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative overflow-hidden shadow-2xl">
            {/* Header */}
            <header className="shrink-0 p-4 border-b bg-background/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black shadow-lg shadow-primary/20">
                        {selectedTable.number}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Mesa Seleccionada</p>
                        <p className="text-sm font-bold uppercase">{selectedTable.type}</p>
                    </div>
                </div>
                <button onClick={() => setSelectedTableId(null)} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                    <X className="h-5 w-5" />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden flex flex-col bg-muted/10">
                {view === 'menu' && (
                    <>
                        <div className="p-4 space-y-4 shrink-0 bg-background border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="¿Qué se le antoja hoy?..." 
                                    className="pl-10 h-12 rounded-2xl border-2 bg-muted/20 border-transparent focus:border-primary transition-all"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", !selectedCategoryId ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground")}
                                        onClick={() => setSelectedCategoryId(null)}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground")}
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
                                    <div key={service.id} className="group bg-card border rounded-3xl overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-300">
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none">
                                                    <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                                                <Badge className="bg-black/60 backdrop-blur-md text-[8px] font-black uppercase border-0">{service.category === 'Food' ? 'Comida' : 'Bebida'}</Badge>
                                                {service.source !== 'Internal' && service.stock <= service.minStock! && (
                                                    <Badge variant="destructive" className="text-[8px] font-black uppercase">Últimas {service.stock}</Badge>
                                                )}
                                            </div>
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 p-3 pt-8">
                                                <p className="text-white font-black text-xs uppercase leading-tight line-clamp-2">{service.name}</p>
                                                <p className="text-primary font-black text-sm mt-1">{formatCurrency(service.price)}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleAddToCart(service)}
                                            disabled={service.source !== 'Internal' && service.stock <= 0}
                                            className="w-full py-3 bg-background hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest border-t disabled:opacity-50"
                                        >
                                            <Plus className="h-3 w-3" /> Añadir
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </>
                )}

                {view === 'cart' && (
                    <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-right duration-300">
                        <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                            <ShoppingCart className="h-6 w-6 text-primary" /> Mi Carrito
                        </h2>
                        {cart.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center"><ShoppingCart className="h-10 w-10 text-muted-foreground/30" /></div>
                                <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Su carrito está vacío</p>
                                <Button onClick={() => setView('menu')} variant="outline" className="rounded-2xl font-black uppercase text-[10px] tracking-widest">Explorar Menú</Button>
                            </div>
                        ) : (
                            <>
                                <ScrollArea className="flex-1 -mx-2 px-2">
                                    <div className="space-y-4 pb-10">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="bg-card border-2 border-primary/10 rounded-[2rem] p-4 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-black uppercase text-xs tracking-tight">{item.service.name}</p>
                                                        <p className="text-primary font-black text-xs">{formatCurrency(item.service.price)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-muted/50 p-1 rounded-2xl border">
                                                        <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-8 w-8 rounded-xl bg-background flex items-center justify-center shadow-sm"><Minus className="h-3 w-3" /></button>
                                                        <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                                                        <button onClick={() => handleAddToCart(item.service)} className="h-8 w-8 rounded-xl bg-background flex items-center justify-center shadow-sm"><Plus className="h-3 w-3" /></button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-2 border-t border-dashed">
                                                    <button onClick={() => handleOpenNoteDialog(idx)} className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2 hover:text-primary transition-colors">
                                                        <MessageSquare className="h-3 w-3" /> {item.notes ? "Editar nota" : "Añadir nota de cocina"}
                                                    </button>
                                                    <p className="font-black text-sm">{formatCurrency(item.service.price * item.quantity)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <div className="pt-6 border-t space-y-4">
                                    <div className="flex justify-between items-end">
                                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total de este pedido</p>
                                        <p className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</p>
                                    </div>
                                    <Button 
                                        className="w-full h-16 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20"
                                        onClick={handleConfirmOrder}
                                        disabled={isPending}
                                    >
                                        {isPending ? "Procesando..." : "Confirmar y Ordenar"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {view === 'account' && (
                    <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-right duration-300">
                        <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                            <SmartphoneIcon className="h-6 w-6 text-primary" /> Mi Cuenta
                        </h2>
                        {!activeOrder ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center"><History className="h-10 w-10 text-muted-foreground/30" /></div>
                                <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">No hay una cuenta activa</p>
                                <Button onClick={() => setView('menu')} variant="outline" className="rounded-2xl font-black uppercase text-[10px] tracking-widest">Hacer un Pedido</Button>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1">
                                <div className="space-y-6 pb-10">
                                    <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                        <div className="bg-primary p-8 text-primary-foreground relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="relative z-10 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Acumulado</p>
                                                    <p className="text-4xl font-black tracking-tighter">{formatCurrency(activeOrder.total)}</p>
                                                </div>
                                                <Badge className="bg-white/20 backdrop-blur-md border-0 font-black uppercase text-[10px] px-4 h-8">{activeOrder.status}</Badge>
                                            </div>
                                        </div>
                                        <CardContent className="p-6 space-y-6">
                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Detalle de Consumo</h4>
                                                <div className="space-y-3">
                                                    {activeOrder.items.map((item, i) => (
                                                        <div key={i} className="flex justify-between items-start text-sm">
                                                            <div className="flex-1">
                                                                <p className="font-bold uppercase leading-none">{item.name}</p>
                                                                <p className="text-[10px] text-muted-foreground mt-1">{item.quantity} Unid. x {formatCurrency(item.price)}</p>
                                                            </div>
                                                            <p className="font-black text-primary">{formatCurrency(item.price * item.quantity)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <Separator className="border-dashed" />
                                            
                                            <div className="bg-amber-50 dark:bg-amber-950/20 p-5 rounded-3xl border-2 border-amber-200/50 flex gap-4">
                                                <div className="h-10 w-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                                                    <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-black uppercase tracking-widest text-amber-800 dark:text-amber-300">¿Desea pagar?</p>
                                                    <p className="text-sm font-medium text-amber-700/90 dark:text-amber-200/80 leading-snug">
                                                        Para solicitar el cobro, por favor comuníquate con la recepción o un salonero.
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <div className="flex justify-center">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <Clock className="h-3 w-3" /> Actualizado en tiempo real
                                        </p>
                                    </div>
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Nav */}
            <nav className="shrink-0 h-20 bg-background border-t flex items-center justify-around px-6 relative z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                <button onClick={() => setView('menu')} className={cn("flex flex-col items-center gap-1.5 transition-all", view === 'menu' ? "text-primary scale-110" : "text-muted-foreground")}>
                    <Utensils className={cn("h-6 w-6", view === 'menu' && "fill-primary/10")} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Menú</span>
                </button>
                <button onClick={() => setView('cart')} className={cn("flex flex-col items-center gap-1.5 transition-all relative", view === 'cart' ? "text-primary scale-110" : "text-muted-foreground")}>
                    <ShoppingCart className={cn("h-6 w-6", view === 'cart' && "fill-primary/10")} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Carrito</span>
                    {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary text-primary-foreground text-[10px] font-black rounded-full flex items-center justify-center border-2 border-background animate-in zoom-in">{cart.length}</span>}
                </button>
                <button onClick={() => setView('account')} className={cn("flex flex-col items-center gap-1.5 transition-all", view === 'account' ? "text-primary scale-110" : "text-muted-foreground")}>
                    <History className={cn("h-6 w-6", view === 'account' && "fill-primary/10")} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </nav>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-t-[2.5rem] sm:rounded-3xl border-0">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter">Nota de Cocina</DialogTitle>
                        <DialogDescription className="font-medium">Indicaciones especiales para su preparación.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Término medio, sin cebolla, hielo aparte..." 
                            value={currentNoteValue} 
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-3xl border-2 bg-muted/20 p-4 font-bold text-sm"
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
