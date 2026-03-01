'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    doc, 
    getDoc, 
    updateDoc, 
    addDoc, 
    limit, 
    increment, 
    runTransaction 
} from 'firebase/firestore';
import type { Service, Tax, SinpeAccount, AppliedTax, RestaurantTable, Order, OrderItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, Wallet, CreditCard, ChevronRight, ChevronLeft,
    ImageIcon, User, Layers, Filter, Utensils, Beer, PackageCheck, Clock, CheckCircle, X, Sun, MapPin,
    MessageSquare, History
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const SESSION_ORDER_KEY = 'go_motel_active_order_id';

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
    const [step, setStep] = useState(1); // 1: Welcome/Table, 2: Menu, 3: Cart/Payment
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    
    // Kitchen Notes
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Persistence: Recover session on load
    useEffect(() => {
        const savedOrderId = localStorage.getItem(SESSION_ORDER_KEY);
        if (savedOrderId && firestore) {
            setActiveOrderId(savedOrderId);
            setStep(2); // Jump to menu
        }
    }, [firestore]);

    // Firestore Real-time data
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
        [firestore]
    );
    const { data: services } = useCollection<Service>(servicesQuery);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    const sinpeAccountsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), orderBy('createdAt', 'asc')) : null, 
        [firestore]
    );
    const { data: activeSinpeAccounts } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    // Watch active order for payment status
    useEffect(() => {
        if (!activeOrderId || !firestore) return;
        const unsub = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    localStorage.removeItem(SESSION_ORDER_KEY);
                    setActiveOrderId(null);
                    setStep(1);
                    toast({ title: "Cuenta Cerrada", description: "Su pago ha sido procesado. ¡Gracias por su visita!" });
                }
            }
        });
        return () => unsub();
    }, [activeOrderId, firestore, toast]);

    const filteredServices = useMemo(() => {
        if (!services) return [];
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [services, searchTerm, categoryFilter]);

    const totals = useMemo(() => {
        const sub = cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0);
        let taxTotal = 0;
        const taxMap = new Map<string, AppliedTax>();

        if (allTaxes) {
            cart.forEach(item => {
                const itemTotal = item.service.price * item.quantity;
                item.service.taxIds?.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        const amount = itemTotal * (taxInfo.percentage / 100);
                        taxTotal += amount;
                        const existing = taxMap.get(taxId);
                        if (existing) existing.amount += amount;
                        else taxMap.set(taxId, { taxId, name: taxInfo.name, percentage: taxInfo.percentage, amount });
                    }
                });
            });
        }
        return { subtotal: sub, totalTax: taxTotal, grandTotal: sub + taxTotal, appliedTaxes: Array.from(taxMap.values()) };
    }, [cart, allTaxes]);

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

    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTable(table);
        startTransition(async () => {
            const orderRef = doc(collection(firestore!, 'orders'));
            const newOrder: Omit<Order, 'id'> = {
                locationId: table.id,
                locationType: table.type,
                label: `Cliente Móvil - ${table.number}`,
                items: [],
                total: 0,
                createdAt: Timestamp.now(),
                status: 'Pendiente',
                paymentStatus: 'Pendiente'
            };
            await updateDoc(doc(firestore!, 'restaurantTables', table.id), { status: 'Occupied', currentOrderId: orderRef.id });
            await addDoc(collection(firestore!, 'orders'), newOrder);
            
            localStorage.setItem(SESSION_ORDER_KEY, orderRef.id);
            setActiveOrderId(orderRef.id);
            setStep(2);
        });
    };

    const handleSendOrder = () => {
        if (!activeOrderId || cart.length === 0) return;
        startTransition(async () => {
            const orderRef = doc(firestore!, 'orders', activeOrderId);
            const snap = await getDoc(orderRef);
            if (!snap.exists()) return;
            
            const existingItems = snap.data().items as OrderItem[];
            const newItems = cart.map(i => ({
                serviceId: i.service.id,
                name: i.service.name,
                quantity: i.quantity,
                price: i.service.price,
                notes: i.notes || null
            }));

            await updateDoc(orderRef, {
                items: [...existingItems, ...newItems],
                total: increment(totals.grandTotal),
                status: 'Pendiente'
            });

            // Update stock
            for (const item of cart) {
                if (item.service.source !== 'Internal') {
                    await updateDoc(doc(firestore!, 'services', item.service.id), { stock: increment(-item.quantity) });
                }
            }

            setCart([]);
            setStep(2);
            toast({ title: "Pedido Enviado", description: "En breve lo llevaremos a su ubicación." });
        });
    };

    // Step 1: Selection
    if (step === 1) {
        return (
            <div className="h-[100dvh] w-full flex flex-col bg-muted/30 p-6">
                <div className="flex-1 flex flex-col items-center justify-center space-y-8 max-w-md mx-auto w-full text-center">
                    <div className="p-6 bg-primary/10 rounded-full"><Utensils className="h-12 w-12 text-primary" /></div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-black uppercase tracking-tight">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Por favor, seleccione su ubicación para comenzar a ordenar.</p>
                    </div>
                    
                    <ScrollArea className="w-full h-96 border rounded-2xl bg-background shadow-sm">
                        <div className="p-4 grid grid-cols-2 gap-3">
                            {allTables?.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => handleSelectTable(table)}
                                    disabled={table.status === 'Occupied' || isPending}
                                    className={cn(
                                        "h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all",
                                        table.status === 'Occupied' 
                                            ? "opacity-50 grayscale bg-muted cursor-not-allowed" 
                                            : "hover:border-primary hover:bg-primary/5 active:scale-95"
                                    )}
                                >
                                    <span className="text-xs font-black uppercase text-muted-foreground">{table.type}</span>
                                    <span className="text-2xl font-black">{table.number}</span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        );
    }

    // Step 2 & 3: Menu & Cart
    return (
        <div className="h-[100dvh] w-full flex flex-col bg-background overflow-hidden relative">
            {/* Header */}
            <header className="h-16 border-b flex items-center justify-between px-4 bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black">GM</div>
                    <h2 className="font-black text-sm uppercase tracking-tighter">Auto-Pedido</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                        <History className="h-5 w-5" />
                    </Button>
                    <button 
                        onClick={() => setStep(3)}
                        className="relative h-10 w-10 flex items-center justify-center bg-muted rounded-full"
                    >
                        <ShoppingCart className="h-5 w-5" />
                        {cart.length > 0 && (
                            <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-[10px] font-black rounded-full flex items-center justify-center animate-in zoom-in">
                                {cart.reduce((s, i) => s + i.quantity, 0)}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Menu View */}
            <div className={cn("flex-1 flex flex-col overflow-hidden", step === 3 && "hidden")}>
                <div className="p-4 border-b space-y-4 bg-muted/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="¿Qué se le antoja hoy?" 
                            className="pl-9 h-12 bg-background border-none shadow-sm rounded-2xl"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex gap-2 pb-2">
                            {['all', 'Food', 'Beverage', 'Amenity'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className={cn(
                                        "px-5 h-9 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                        categoryFilter === cat ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    {cat === 'all' ? 'Todo' : cat === 'Food' ? 'Comidas' : cat === 'Beverage' ? 'Bebidas' : 'Extras'}
                                </button>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>

                <ScrollArea className="flex-1">
                    <div className="grid grid-cols-2 gap-4 p-4 pb-32">
                        {filteredServices.map(service => (
                            <div key={service.id} className="group relative aspect-[4/5] bg-card rounded-3xl overflow-hidden shadow-lg active:scale-95 transition-transform border border-border/10">
                                <img src={service.imageUrl || 'https://picsum.photos/seed/food/400/500'} className="h-full w-full object-cover" alt="" />
                                
                                {/* Info Top: Category & Stock */}
                                <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/60 to-transparent flex justify-between items-start">
                                    <span className="bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-black text-primary uppercase shadow-sm">
                                        {service.category === 'Food' ? 'Cocina' : 'Bar'}
                                    </span>
                                    {service.source !== 'Internal' && (
                                        <span className="text-[10px] font-black text-white drop-shadow-md">
                                            {service.stock} Disp.
                                        </span>
                                    )}
                                </div>

                                {/* Info Bottom: Name, Price, Add Button */}
                                <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black via-black/40 to-transparent">
                                    <h3 className="text-white font-black text-sm uppercase leading-tight line-clamp-2 mb-1">{service.name}</h3>
                                    <p className="text-primary font-black text-lg mb-3">{formatCurrency(service.price)}</p>
                                    <Button 
                                        className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20"
                                        onClick={() => handleAddToCart(service)}
                                    >
                                        Agregar
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                {/* Floating Bottom Bar */}
                {cart.length > 0 && (
                    <div className="absolute bottom-6 inset-x-6 z-50 animate-in slide-in-from-bottom-10">
                        <button 
                            onClick={() => setStep(3)}
                            className="w-full h-16 bg-primary text-primary-foreground rounded-3xl shadow-2xl flex items-center justify-between px-8 ring-4 ring-primary/20"
                        >
                            <div className="flex flex-col items-start leading-none">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Ver Carrito</span>
                                <span className="text-xl font-black">{formatCurrency(totals.grandTotal)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-black uppercase">{cart.reduce((s,i) => s+i.quantity, 0)} Items</span>
                                <ChevronRight className="h-6 w-6" />
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* Cart View */}
            {step === 3 && (
                <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-right-10">
                    <div className="flex items-center gap-4 mb-8">
                        <Button variant="ghost" size="icon" onClick={() => setStep(2)} className="rounded-full h-12 w-12 bg-muted/50">
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Su Carrito</h2>
                    </div>

                    <ScrollArea className="flex-1 -mx-2 px-2">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 opacity-20">
                                <ShoppingCart className="h-20 w-20" />
                                <p className="font-black uppercase mt-4">Carrito Vacío</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {cart.map((item, idx) => (
                                    <div key={item.service.id} className="bg-card p-4 rounded-3xl border shadow-sm flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <img src={item.service.imageUrl} className="h-12 w-12 rounded-xl object-cover" alt="" />
                                                <div>
                                                    <p className="font-black text-xs uppercase">{item.service.name}</p>
                                                    <p className="text-primary font-black">{formatCurrency(item.service.price)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 bg-primary/10 rounded-2xl p-1.5 border border-primary/20">
                                                <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-8 w-8 flex items-center justify-center bg-background rounded-xl shadow-sm text-primary">
                                                    <Minus className="h-4 w-4" />
                                                </button>
                                                <span className="text-sm font-black text-primary min-w-[20px] text-center">{item.quantity}</span>
                                                <button onClick={() => handleAddToCart(item.service)} className="h-8 w-8 flex items-center justify-center bg-background rounded-xl shadow-sm text-primary">
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                        {item.service.source === 'Internal' && (
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleOpenNoteDialog(idx)}
                                                    className={cn(
                                                        "text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border transition-all flex items-center gap-2",
                                                        item.notes ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground"
                                                    )}
                                                >
                                                    <MessageSquare className="h-3 w-3" />
                                                    {item.notes ? "Instrucciones Guardadas" : "Añadir Instrucciones"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    <div className="pt-6 border-t space-y-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
                                <span>Subtotal</span>
                                <span>{formatCurrency(totals.subtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="font-black uppercase tracking-tight">Total a Pagar</span>
                                <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(totals.grandTotal)}</span>
                            </div>
                        </div>
                        <Button 
                            className="w-full h-16 rounded-3xl font-black uppercase tracking-widest text-base shadow-2xl shadow-primary/20"
                            disabled={cart.length === 0 || isPending}
                            onClick={handleSendOrder}
                        >
                            {isPending ? "PROCESANDO..." : "ENVIAR PEDIDO"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase">Instrucciones</DialogTitle>
                        <DialogDescription className="font-medium">¿Cómo desea que preparemos su {editingNoteIndex !== null ? cart[editingNoteIndex].service.name : 'producto'}?</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Término medio, sin cebolla, muy caliente..." 
                            className="min-h-[120px] rounded-2xl border-2 resize-none font-bold text-sm p-4 focus:border-primary"
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-2xl font-black uppercase tracking-widest" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
