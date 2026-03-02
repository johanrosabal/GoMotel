'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, Tax, SinpeAccount, AppliedTax, ProductCategory, ProductSubCategory, RestaurantTable, Order } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, Wallet, CreditCard, ChevronRight, ChevronLeft,
    ImageIcon, User, Layers, Filter, Utensils, Beer, PackageCheck, Clock, CheckCircle, Settings2, X, Sun, MapPin, UserPlus,
    Pencil, Trash2, AlertCircle, MessageSquare, Printer, SmartphoneIcon, Receipt, Info
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // View States
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<'catalog' | 'cart' | 'account'>('catalog');
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<{ service: Service; quantity: number; notes?: string }[]>([]);

    // Note Dialog
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Fetch Tables
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    // Fetch Services
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    // Persistence Logic: Load Session
    useEffect(() => {
        if (selectedTable) {
            const savedOrderId = localStorage.getItem(`active_order_table_${selectedTable.id}`);
            if (savedOrderId) {
                setActiveOrderId(savedOrderId);
            } else {
                setActiveOrderId(null);
                setActiveOrder(null);
            }
        }
    }, [selectedTable]);

    // Firestore Sync: Active Order
    useEffect(() => {
        if (!firestore || !activeOrderId) return;

        const unsubscribe = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                // If payment is confirmed or order cancelled by admin, clear local session
                if (data.paymentStatus === 'Pagado' || data.status === 'Cancelado') {
                    localStorage.removeItem(`active_order_table_${selectedTable?.id}`);
                    setActiveOrderId(null);
                    setActiveOrder(null);
                } else {
                    setActiveOrder({ id: snap.id, ...data });
                }
            } else {
                localStorage.removeItem(`active_order_table_${selectedTable?.id}`);
                setActiveOrderId(null);
                setActiveOrder(null);
            }
        });

        return () => unsubscribe();
    }, [firestore, activeOrderId, selectedTable?.id]);

    // Billing Calculations
    const { subtotal, totalTax, grandTotal, appliedTaxes } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
        let tax = 0;
        const taxes: AppliedTax[] = [];

        if (allTaxes) {
            const taxMap = new Map<string, { name: string; percentage: number; amount: number }>();
            cart.forEach(item => {
                const itemTotal = item.service.price * item.quantity;
                item.service.taxIds?.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        const taxAmount = itemTotal * (taxInfo.percentage / 100);
                        tax += taxAmount;
                        const existing = taxMap.get(taxId);
                        if (existing) existing.amount += taxAmount;
                        else taxMap.set(taxId, { name: taxInfo.name, percentage: taxInfo.percentage, amount: taxAmount });
                    }
                });
            });
            taxMap.forEach((val, id) => taxes.push({ taxId: id, ...val }));
        }

        return { subtotal: sub, totalTax: tax, grandTotal: sub + tax, appliedTaxes: taxes };
    }, [cart, allTaxes]);

    // Cart Actions
    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: 'Añadido al carrito', description: service.name, duration: 1500 });
    };

    const handleRemoveOne = (serviceId: string) => {
        setCart(prev => {
            const item = prev.find(i => i.service.id === serviceId);
            if (item && item.quantity > 1) return prev.map(i => i.service.id === serviceId ? { ...i, quantity: i.quantity - 1 } : i);
            return prev.filter(i => i.service.id !== serviceId);
        });
    };

    const handleRemoveCompletely = (serviceId: string) => {
        setCart(prev => prev.filter(i => i.service.id !== serviceId));
    };

    const handleOpenNote = (index: number) => {
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
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                // IMPORTANT: locationLabel is crucial for KDS to show the table number
                result = await openTableAccount(selectedTable.id, cart, `Pedido Móvil`, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando su orden.' });
                setCart([]);
                if (result.orderId) {
                    setActiveOrderId(result.orderId);
                    localStorage.setItem(`active_order_table_${selectedTable.id}`, result.orderId);
                }
                setActiveTab('account');
            }
        });
    };

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => 
            s.isActive && 
            (!selectedCategoryId || s.categoryId === selectedCategoryId) &&
            (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.code?.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [availableServices, selectedCategoryId, searchTerm]);

    // Render Selection Screen
    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-background flex flex-col p-6 lg:p-12">
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto space-y-12">
                    <div className="space-y-4 animate-in fade-in zoom-in duration-700">
                        <Badge variant="outline" className="px-4 py-1.5 font-black uppercase tracking-[0.3em] border-primary/20 text-primary">Sistema de Auto-Pedido</Badge>
                        <h1 className="text-7xl md:text-9xl font-black uppercase tracking-tighter leading-none drop-shadow-2xl">
                            BIEN<span className="text-primary">VENIDO</span>
                        </h1>
                        <p className="text-muted-foreground text-lg md:text-xl font-medium tracking-wide uppercase">Seleccione su ubicación para comenzar</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full">
                        {allTables?.map(table => (
                            <button
                                key={table.id}
                                onClick={() => setSelectedTable(table)}
                                className={cn(
                                    "group relative aspect-square rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-300 active:scale-95 shadow-lg",
                                    table.status === 'Occupied' 
                                        ? "bg-primary/5 border-primary/40 text-primary" 
                                        : "bg-card border-border hover:border-primary/60"
                                )}
                            >
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{TYPE_LABELS[table.type] || table.type}</span>
                                <span className="text-5xl font-black tracking-tighter">{table.number}</span>
                                {table.status === 'Occupied' && (
                                    <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold uppercase text-primary/80">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Cuenta Activa
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col overflow-hidden">
            {/* Minimal Header */}
            <header className="bg-background/80 backdrop-blur-xl border-b sticky top-0 z-50 px-4 h-16 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedTable(null)} className="h-10 w-10 flex items-center justify-center rounded-2xl hover:bg-muted transition-colors">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h2 className="font-black uppercase tracking-tighter text-sm">{TYPE_LABELS[selectedTable.type]} {selectedTable.number}</h2>
                        <div className="flex items-center gap-1.5">
                            <div className={cn("w-1.5 h-1.5 rounded-full", activeOrderId ? "bg-green-500 animate-pulse" : "bg-muted")} />
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">{activeOrderId ? 'Sesión Activa' : 'Nueva Cuenta'}</span>
                        </div>
                    </div>
                </div>
                {activeOrderId && activeTab !== 'account' && (
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('account')} className="h-9 px-4 rounded-full font-black uppercase text-[10px] tracking-widest border-primary/30 text-primary">
                        Ver Cuenta
                    </Button>
                )}
            </header>

            <main className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'catalog' && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                        <div className="p-4 space-y-4 shrink-0 bg-muted/10 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar comida o bebidas..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 h-12 bg-background border-2 rounded-2xl focus:border-primary transition-all"
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", !selectedCategoryId ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground")}
                                    >Todo</button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground")}
                                        >{cat.name}</button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 pb-24">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="group relative flex flex-col bg-card border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-500">
                                        <div className="aspect-[4/5] relative bg-muted overflow-hidden">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover transition-transform duration-700 group-hover:scale-110" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-12 w-12 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
                                            
                                            <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end">
                                                <Badge className="bg-primary/90 text-white font-black border-none backdrop-blur-md px-3 py-1 text-sm shadow-xl">
                                                    {formatCurrency(service.price)}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge variant="outline" className="bg-black/40 text-white border-white/20 text-[8px] font-black uppercase px-2 py-0.5 backdrop-blur-sm">
                                                        Stock: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="absolute inset-x-0 bottom-0 p-4 space-y-1">
                                                <p className="text-[9px] font-black uppercase text-primary tracking-widest drop-shadow-sm">{service.category === 'Food' ? 'Cocina' : 'Bar'}</p>
                                                <h3 className="text-sm font-black uppercase tracking-tight text-white leading-tight line-clamp-2 drop-shadow-md">{service.name}</h3>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleAddToCart(service)}
                                            className="absolute bottom-3 right-3 h-12 w-12 rounded-2xl bg-white text-primary flex items-center justify-center shadow-2xl active:scale-90 transition-transform z-20 border-2 border-primary/10"
                                        >
                                            <Plus className="h-6 w-6 stroke-[3px]" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {activeTab === 'cart' && (
                    <div className="flex-1 flex flex-col p-4 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Mi <span className="text-primary">Orden</span></h2>
                            <Badge variant="outline" className="h-8 px-4 font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">{cart.length} Artículos</Badge>
                        </div>

                        {cart.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 text-muted-foreground/40">
                                <ShoppingCart className="h-24 w-24 stroke-[1px]" />
                                <p className="text-xl font-black uppercase tracking-widest">Carrito Vacío</p>
                                <Button onClick={() => setActiveTab('catalog')} className="rounded-2xl font-black uppercase tracking-widest h-14 px-8">Explorar Menú</Button>
                            </div>
                        ) : (
                            <>
                                <ScrollArea className="flex-1 -mx-4 px-4">
                                    <div className="space-y-4 pb-10">
                                        {cart.map((item, idx) => (
                                            <div key={item.service.id} className="bg-card border-2 rounded-3xl p-4 shadow-sm relative group overflow-hidden">
                                                <div className="flex gap-4">
                                                    <Avatar className="h-20 w-20 rounded-2xl border-2">
                                                        <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                                        <AvatarFallback className="bg-muted"><ImageIcon className="h-6 w-6" /></AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 space-y-1">
                                                        <h4 className="font-black text-sm uppercase tracking-tight pr-10">{item.service.name}</h4>
                                                        <p className="text-xs font-bold text-primary">{formatCurrency(item.service.price)}</p>
                                                        
                                                        <div className="flex items-center gap-3 mt-3">
                                                            <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 border">
                                                                <button onClick={() => handleRemoveOne(item.service.id)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors"><Minus className="h-3 w-3" /></button>
                                                                <span className="w-8 text-center font-black text-sm">{item.quantity}</span>
                                                                <button onClick={() => handleAddToCart(item.service)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors"><Plus className="h-3 w-3" /></button>
                                                            </div>
                                                            {item.service.source === 'Internal' && (
                                                                <button onClick={() => handleOpenNote(idx)} className={cn("h-10 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all", item.notes ? "bg-primary text-white border-primary" : "bg-background text-muted-foreground border-dashed")}>
                                                                    {item.notes ? 'Ver Nota' : '+ Nota'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveCompletely(item.service.id)}
                                                    className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                {item.notes && <p className="mt-3 p-3 bg-primary/5 rounded-xl text-[11px] font-bold text-primary italic border-l-4 border-primary">"{item.notes}"</p>}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <div className="mt-4 pt-6 border-t space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            <span>Subtotal</span>
                                            <span>{formatCurrency(subtotal)}</span>
                                        </div>
                                        {appliedTaxes.map(t => (
                                            <div key={t.taxId} className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground/60">
                                                <span>{t.name} {t.percentage}%</span>
                                                <span>{formatCurrency(t.amount)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-xs font-black uppercase tracking-[0.2em]">Total</span>
                                            <span className="text-4xl font-black tracking-tighter text-primary">{formatCurrency(grandTotal)}</span>
                                        </div>
                                    </div>
                                    <Button 
                                        onClick={handleSendOrder} 
                                        disabled={isPending} 
                                        className="w-full h-16 rounded-3xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-primary/20"
                                    >
                                        {isPending ? 'Enviando...' : 'Confirmar y Pedir'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="flex-1 flex flex-col p-4 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Su <span className="text-primary">Cuenta</span></h2>
                            <Badge className="h-8 px-4 font-black uppercase tracking-widest bg-green-500 text-white border-none shadow-lg shadow-green-500/20">Activa</Badge>
                        </div>

                        {!activeOrder ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 text-muted-foreground/40">
                                <div className="h-24 w-24 rounded-full bg-muted/20 flex items-center justify-center border-2 border-dashed">
                                    <Receipt className="h-10 w-10 opacity-20" />
                                </div>
                                <p className="text-xl font-black uppercase tracking-widest">No tiene una cuenta activa</p>
                                <Button onClick={() => setActiveTab('catalog')} className="rounded-2xl font-black uppercase tracking-widest h-14 px-8">Hacer un Pedido</Button>
                            </div>
                        ) : (
                            <>
                                <ScrollArea className="flex-1 -mx-4 px-4">
                                    <div className="space-y-3 pb-10">
                                        {activeOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center font-black text-sm border shadow-sm">{item.quantity}</div>
                                                    <div>
                                                        <p className="font-black text-xs uppercase tracking-tight leading-tight">{item.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] font-bold text-muted-foreground">{formatCurrency(item.price)} c/u</span>
                                                            <Badge variant="outline" className="text-[8px] font-black px-1.5 h-4 border-primary/20 text-primary">ENTREGADO</Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="font-black text-sm">{formatCurrency(item.price * item.quantity)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <div className="mt-4 pt-6 border-t-2 border-dashed space-y-4">
                                    <div className="p-5 rounded-3xl bg-primary/5 border-2 border-primary/10 space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                                            <span>Total Consumido</span>
                                            <span>{activeOrder.items.length} Productos</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-black uppercase tracking-[0.2em]">Total</span>
                                            <span className="text-4xl font-black tracking-tighter text-primary">{formatCurrency(activeOrder.total)}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-900/50 rounded-2xl">
                                        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-relaxed uppercase">
                                            Para pagar su cuenta, por favor solicite el cobro al personal del hotel. Aceptamos efectivo, tarjeta y SINPE Móvil.
                                        </p>
                                    </div>
                                    <Button onClick={() => setActiveTab('catalog')} variant="outline" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] border-2">Pedir algo más</Button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </main>

            {/* App-style Bottom Navigation */}
            <nav className="h-20 bg-background border-t grid grid-cols-3 shrink-0 pb-safe shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)]">
                <button 
                    onClick={() => setActiveTab('catalog')} 
                    className={cn("flex flex-col items-center justify-center gap-1 transition-all", activeTab === 'catalog' ? "text-primary scale-110" : "text-muted-foreground opacity-50")}
                >
                    <Utensils className="h-6 w-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Menú</span>
                </button>
                <button 
                    onClick={() => setActiveTab('cart')} 
                    className={cn("flex flex-col items-center justify-center gap-1 transition-all relative", activeTab === 'cart' ? "text-primary scale-110" : "text-muted-foreground opacity-50")}
                >
                    <ShoppingCart className="h-6 w-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Carrito</span>
                    {cart.length > 0 && (
                        <div className="absolute top-3 right-1/2 translate-x-5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center border-2 border-background animate-in zoom-in">{cart.length}</div>
                    )}
                </button>
                <button 
                    onClick={() => setActiveTab('account')} 
                    className={cn("flex flex-col items-center justify-center gap-1 transition-all", activeTab === 'account' ? "text-primary scale-110" : "text-muted-foreground opacity-50")}
                >
                    <Receipt className="h-6 w-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </nav>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Instrucciones de Cocina</DialogTitle>
                        <DialogDescription>Añada indicaciones especiales para su pedido.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                            <div className="bg-primary/10 p-2.5 rounded-xl"><Utensils className="h-5 w-5 text-primary" /></div>
                            <span className="font-black text-sm uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Instrucciones Especiales</Label>
                            <Textarea 
                                placeholder="Ej: Con poca sal, sin cebolla, término medio..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] rounded-2xl border-2 text-sm font-bold resize-none"
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
