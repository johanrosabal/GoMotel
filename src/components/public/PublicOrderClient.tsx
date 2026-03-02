
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { RestaurantTable, Service, ProductCategory, ProductSubCategory, Order, Tax } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
    Search, ShoppingCart, Plus, Minus, Utensils, Beer, Sun, MapPin, 
    ChevronRight, ChevronLeft, ImageIcon, Clock, CheckCircle, Trash2,
    MessageSquare, Smartphone, Wallet, CreditCard, Info
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // -- App State --
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'account'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    // -- Dialog States --
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // -- Data Fetching --
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

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    // -- Persistence Logic --
    useEffect(() => {
        if (!selectedTable) {
            setActiveOrderId(null);
            setActiveOrder(null);
            return;
        }

        const sessionKey = `pos_order_${selectedTable.id}`;
        const savedOrderId = localStorage.getItem(sessionKey);

        if (savedOrderId) {
            setActiveOrderId(savedOrderId);
            const unsub = onSnapshot(doc(firestore!, 'orders', savedOrderId), (snap) => {
                if (snap.exists()) {
                    const data = { id: snap.id, ...snap.data() } as Order;
                    if (data.paymentStatus === 'Pagado' || data.status === 'Cancelado') {
                        localStorage.removeItem(sessionKey);
                        setActiveOrderId(null);
                        setActiveOrder(null);
                    } else {
                        setActiveOrder(data);
                    }
                } else {
                    localStorage.removeItem(sessionKey);
                    setActiveOrderId(null);
                    setActiveOrder(null);
                }
            });
            return () => unsub();
        }
    }, [selectedTable, firestore]);

    // -- Cart Logic --
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

    const handleClearCart = () => setCart([]);

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
                result = await openTableAccount(selectedTable.id, cart, `Cliente ${selectedTable.number}`, 'Public');
                if (result.orderId) {
                    localStorage.setItem(`pos_order_${selectedTable.id}`, result.orderId);
                    setActiveOrderId(result.orderId);
                }
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "¡Pedido Enviado!", description: "Su orden está en preparación." });
                handleClearCart();
                setActiveTab('account');
            }
        });
    };

    // -- Calculations --
    const { subtotal, totalTax, grandTotal } = useMemo(() => {
        const sub = cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);
        let tax = 0;
        if (allTaxes) {
            cart.forEach(item => {
                const itemTotal = item.service.price * item.quantity;
                item.service.taxIds?.forEach(tId => {
                    const tInfo = allTaxes.find(tx => tx.id === tId);
                    if (tInfo) tax += itemTotal * (tInfo.percentage / 100);
                });
            });
        }
        return { subtotal: sub, totalTax: tax, grandTotal: sub + tax };
    }, [cart, allTaxes]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => 
            s.isActive && 
            (!selectedCategoryId || s.categoryId === selectedCategoryId) &&
            (s.name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [availableServices, selectedCategoryId, searchTerm]);

    // -- UI Components --
    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-background flex flex-col p-6 items-center justify-center space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-7xl font-black uppercase tracking-tighter drop-shadow-2xl">
                        BIENVENIDO A <span className="text-primary">GO MOTEL</span>
                    </h1>
                    <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">Seleccione su ubicación para empezar a ordenar</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-4xl">
                    {allTables?.map(table => (
                        <button
                            key={table.id}
                            onClick={() => setSelectedTable(table)}
                            className="flex flex-col items-center p-8 rounded-3xl border-4 border-muted bg-card hover:border-primary hover:bg-primary/5 transition-all group active:scale-95 shadow-xl"
                        >
                            <span className="text-5xl font-black tracking-tighter group-hover:text-primary transition-colors">{table.number}</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-2">{TYPE_LABELS[table.type] || table.type}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden">
            {/* Header */}
            <div className="bg-card border-b p-4 flex items-center justify-between shadow-md shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedTable(null)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 transition-colors">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="font-black uppercase tracking-tighter leading-none">{TYPE_LABELS[selectedTable.type]} {selectedTable.number}</h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Sesión Activa</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-1 bg-muted p-1 rounded-xl">
                    <button onClick={() => setActiveTab('menu')} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'menu' ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}>Carta</button>
                    <button onClick={() => setActiveTab('account')} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all relative", activeTab === 'account' ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}>
                        Cuenta
                        {activeOrder && <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-white flex items-center justify-center rounded-full text-[8px] border-2 border-card">!</span>}
                    </button>
                </div>
            </div>

            {/* Main View */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'menu' ? (
                    <>
                        <div className="p-4 border-b space-y-4 shrink-0 bg-muted/10">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="¿Qué se le antoja hoy?" 
                                    className="pl-9 h-12 rounded-2xl border-none bg-muted font-bold"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap pb-2">
                                <div className="flex gap-2">
                                    <button onClick={() => setSelectedCategoryId(null)} className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", !selectedCategoryId ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground")}>Todos</button>
                                    {categories?.map(cat => (
                                        <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", selectedCategoryId === cat.id ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground")}>{cat.name}</button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-32">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="group bg-card border rounded-3xl overflow-hidden shadow-xl flex flex-col">
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-12 w-12 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-between">
                                                <Badge className="w-fit bg-white/20 backdrop-blur-md border-none text-[8px] font-black uppercase tracking-widest">
                                                    {service.category === 'Food' ? 'Comida' : 'Bebida'}
                                                </Badge>
                                                <div>
                                                    <h3 className="font-black text-xs uppercase tracking-tight text-white line-clamp-2">{service.name}</h3>
                                                    <p className="text-lg font-black text-primary drop-shadow-md mt-1">{formatCurrency(service.price)}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleAddToCart(service)}
                                                className="absolute bottom-4 right-4 h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all z-20"
                                            >
                                                <Plus className="h-6 w-6" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </>
                ) : (
                    <ScrollArea className="flex-1 p-4 pb-32">
                        <div className="space-y-6">
                            <div className="text-center space-y-1">
                                <h3 className="text-4xl font-black uppercase tracking-tighter">Su Cuenta</h3>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Resumen de consumos en esta mesa</p>
                            </div>

                            {!activeOrder ? (
                                <div className="text-center py-20 opacity-20 flex flex-col items-center gap-4">
                                    <ShoppingCart className="h-20 w-20" />
                                    <p className="font-black uppercase text-xs tracking-[0.2em]">Aún no ha realizado pedidos</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-card border rounded-3xl overflow-hidden shadow-lg">
                                        <div className="p-4 bg-muted/30 border-b">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Artículos Pedidos</span>
                                                <Badge variant="outline" className="text-[8px] font-black border-primary/20 text-primary">EN CURSO</Badge>
                                            </div>
                                        </div>
                                        <div className="divide-y">
                                            {activeOrder.items.map((item, idx) => {
                                                const itemStatus = item.category === 'Food' ? activeOrder.kitchenStatus : 
                                                                 item.category === 'Beverage' ? activeOrder.barStatus : 
                                                                 activeOrder.status;

                                                return (
                                                    <div key={idx} className="p-4 flex gap-4">
                                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary">{item.quantity}</div>
                                                        <div className="flex-1">
                                                            <p className="font-black text-xs uppercase tracking-tight">{item.name}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <p className="text-[10px] text-muted-foreground font-bold">{formatCurrency(item.price)} c/u</p>
                                                                <Badge className={cn(
                                                                    "font-black uppercase text-[8px] px-2 h-4 pointer-events-none",
                                                                    itemStatus === 'Entregado' ? "bg-emerald-500 text-white" :
                                                                    itemStatus === 'En preparación' ? "bg-amber-500 text-white" :
                                                                    "bg-muted text-muted-foreground"
                                                                )}>
                                                                    {itemStatus || 'Pendiente'}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-black text-sm">{formatCurrency(item.price * item.quantity)}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="p-6 bg-primary/5 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-black uppercase text-muted-foreground">Total Consumido</span>
                                                <span className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(activeOrder.total)}</span>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 flex items-center gap-4">
                                                <Info className="h-5 w-5 text-amber-500 shrink-0" />
                                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 leading-tight uppercase">
                                                    Para cancelar su cuenta, por favor solicite el cobro a nuestro personal de salón.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Bottom Floating Cart Bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 inset-x-6 z-50 animate-in slide-in-from-bottom-10 duration-500">
                    <Card className="bg-primary border-none shadow-2xl shadow-primary/40 rounded-[2rem] overflow-hidden">
                        <CardContent className="p-2 flex items-center gap-2">
                            <button 
                                onClick={() => setActiveTab('menu')}
                                className="flex-1 p-4 text-white flex flex-col items-start"
                            >
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Nuevo Pedido</span>
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="h-5 w-5" />
                                    <span className="text-2xl font-black tracking-tighter">{formatCurrency(grandTotal)}</span>
                                </div>
                            </button>
                            <Button 
                                onClick={handleSendOrder}
                                disabled={isPending}
                                className="h-16 px-8 rounded-3xl bg-white text-primary hover:bg-white/90 font-black uppercase tracking-widest text-xs shadow-xl"
                            >
                                {isPending ? "ENVIANDO..." : "CONFIRMAR"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Kitchen Notes Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl mx-4">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest">Añada notas para la preparación</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-xl"><Utensils className="h-5 w-5 text-primary" /></div>
                            <span className="font-black text-xs uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Notas para la cocina</Label>
                            <Textarea 
                                placeholder="Ej: Sin cebolla, término medio, etc."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] rounded-2xl border-2 resize-none text-sm font-bold bg-muted/20"
                                autoFocus
                            />
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
