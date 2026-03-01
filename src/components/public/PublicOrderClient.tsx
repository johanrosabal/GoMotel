'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    doc, 
    onSnapshot,
    addDoc,
    Timestamp,
    increment,
    runTransaction,
    limit,
    getDocs
} from 'firebase/firestore';
import type { Service, Tax, SinpeAccount, AppliedTax, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { getServices } from '@/lib/actions/service.actions';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, Wallet, CreditCard, ChevronRight, ChevronLeft,
    ImageIcon, Utensils, Beer, PackageCheck, Clock, CheckCircle, X, Sun, MapPin, 
    MessageSquare, ReceiptText, History, User
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

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
    
    // View Management
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [step, setStep] = useState(1); // 1: Table, 2: Menu, 3: Cart/Payment
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [cart, setCart] = useState<CartItem[]>([]);

    // Kitchen Notes
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Persistence: Recover active order from localStorage
    useEffect(() => {
        const savedId = localStorage.getItem(SESSION_ORDER_KEY);
        if (savedId) {
            setActiveOrderId(savedId);
            setStep(2);
        }
    }, []);

    // Monitor active order status (if paid, clear session)
    useEffect(() => {
        if (!activeOrderId || !firestore) return;
        const unsub = onSnapshot(doc(collection(firestore, 'orders'), activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    localStorage.removeItem(SESSION_ORDER_KEY);
                    setActiveOrderId(null);
                    setSelectedTable(null);
                    setStep(1);
                    toast({ title: 'Cuenta Pagada', description: 'Su sesión ha finalizado. ¡Gracias!' });
                }
            } else {
                // Order might have been deleted or archived
                localStorage.removeItem(SESSION_ORDER_KEY);
                setActiveOrderId(null);
                setStep(1);
            }
        });
        return () => unsub();
    }, [activeOrderId, firestore, toast]);

    // Data Fetching
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const activeOrderRef = useMemoFirebase(() => {
        if (!firestore || !activeOrderId) return null;
        return doc(collection(firestore, 'orders'), activeOrderId);
    }, [firestore, activeOrderId]);
    const { data: currentOrder } = useCollection<Order>(useMemoFirebase(() => {
        if (!firestore || !activeOrderId) return null;
        return query(collection(firestore, 'orders'), where('__name__', '==', activeOrderId));
    }, [firestore, activeOrderId]));

    const orderData = currentOrder?.[0] || null;

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => typeFilter === 'all' || t.type === typeFilter);
    }, [allTables, typeFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && (s.name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    const { subtotal, grandTotal } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
        return { subtotal: sub, grandTotal: sub }; // Simple for customer view
    }, [cart]);

    const handleSelectTable = (table: RestaurantTable) => {
        setSelectedTable(table);
        // If table is occupied, client can still join if they have the ID or if we allow multi-device
        // For MVP, we assume clicking a table opens/joins a session
        setStep(2);
    };

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: 'Añadido', description: `${service.name} al carrito.` });
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

    const handleConfirmOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            try {
                await runTransaction(firestore!, async (transaction) => {
                    // Create order or join existing
                    let orderId = activeOrderId;
                    const orderRef = orderId ? doc(collection(firestore!, 'orders'), orderId) : doc(collection(firestore!, 'orders'));
                    
                    if (!orderId) {
                        const newOrder: Omit<Order, 'id'> = {
                            locationType: selectedTable.type,
                            locationId: selectedTable.id,
                            label: `Cliente - ${selectedTable.number}`,
                            items: cart.map(i => ({
                                serviceId: i.service.id,
                                name: i.service.name,
                                quantity: i.quantity,
                                price: i.service.price,
                                notes: i.notes || null
                            })),
                            total: subtotal,
                            createdAt: Timestamp.now(),
                            status: 'Pendiente',
                            paymentStatus: 'Pendiente'
                        };
                        transaction.set(orderRef, newOrder);
                        orderId = orderRef.id;
                    } else {
                        const snap = await transaction.get(orderRef);
                        const existingData = snap.data() as Order;
                        const updatedItems = [...existingData.items];
                        
                        cart.forEach(item => {
                            const found = updatedItems.find(ui => ui.serviceId === item.service.id && ui.notes === (item.notes || null));
                            if (found) found.quantity += item.quantity;
                            else updatedItems.push({
                                serviceId: item.service.id,
                                name: item.service.name,
                                quantity: item.quantity,
                                price: item.service.price,
                                notes: item.notes || null
                            });
                        });

                        transaction.update(orderRef, {
                            items: updatedItems,
                            total: increment(subtotal)
                        });
                    }

                    // Update Table status
                    const tableRef = doc(collection(firestore!, 'restaurantTables'), selectedTable.id);
                    transaction.update(tableRef, { status: 'Occupied', currentOrderId: orderId });
                    
                    // Update Stock
                    for (const item of cart) {
                        if (item.service.source !== 'Internal') {
                            const sRef = doc(collection(firestore!, 'services'), item.service.id);
                            transaction.update(sRef, { stock: increment(-item.quantity) });
                        }
                    }

                    setActiveOrderId(orderId);
                    localStorage.setItem(SESSION_ORDER_KEY, orderId);
                });

                toast({ title: '¡Pedido Enviado!', description: 'Su orden está siendo procesada.' });
                setCart([]);
                setStep(2);
            } catch (e: any) {
                toast({ title: 'Error', description: e.message, variant: 'destructive' });
            }
        });
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-zinc-50 font-sans overflow-hidden">
            {/* Header Sticky */}
            <div className="shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-30">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-xl">
                        <Utensils className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="font-black text-lg uppercase tracking-tighter leading-none">Auto-Pedido</h1>
                        {selectedTable && <p className="text-[10px] font-black text-primary uppercase mt-1 tracking-widest">Mesa {selectedTable.number}</p>}
                    </div>
                </div>
                {activeOrderId && (
                    <button 
                        onClick={() => setStep(step === 4 ? 2 : 4)}
                        className={cn(
                            "h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all border-2",
                            step === 4 ? "bg-primary text-white border-primary shadow-lg" : "bg-white text-muted-foreground hover:bg-zinc-50"
                        )}
                    >
                        <History className="h-4 w-4" /> {step === 4 ? 'Volver' : 'Mi Cuenta'}
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-hidden relative">
                {/* Step 1: Table Selection */}
                {step === 1 && (
                    <div className="h-full flex flex-col p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black uppercase tracking-tight">¿Dónde se encuentra?</h2>
                            <p className="text-sm text-muted-foreground font-medium">Seleccione su mesa o barra para comenzar.</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    <SelectItem value="Table">Mesa de Salón</SelectItem>
                                    <SelectItem value="Bar">Barra</SelectItem>
                                    <SelectItem value="Terraza">Terraza</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 pb-10">
                                {filteredTables.map(table => {
                                    const isOccupied = table.status === 'Occupied';
                                    return (
                                        <button
                                            key={table.id}
                                            onClick={() => handleSelectTable(table)}
                                            className={cn(
                                                "h-32 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95",
                                                isOccupied ? "bg-primary/5 border-primary/20" : "bg-white hover:border-primary/40"
                                            )}
                                        >
                                            <span className="text-4xl font-black">{table.number}</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                                                {table.type === 'Table' ? 'Mesa' : table.type}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Step 2: Menu / Step 4: Account History */}
                {(step === 2 || step === 4) && (
                    <div className="h-full flex flex-col">
                        {step === 4 ? (
                            <div className="flex-1 flex flex-col p-6 animate-in zoom-in-95 duration-300">
                                <div className="mb-6 flex items-center justify-between">
                                    <h2 className="text-2xl font-black uppercase tracking-tight">Su Consumo</h2>
                                    <Badge variant="outline" className="h-8 font-black uppercase tracking-widest bg-primary/10 border-primary/20 text-primary">
                                        En Proceso
                                    </Badge>
                                </div>
                                
                                <ScrollArea className="flex-1">
                                    {orderData ? (
                                        <div className="space-y-4 pb-10">
                                            {orderData.items.map((item, i) => (
                                                <div key={i} className="bg-white p-4 rounded-2xl border-2 shadow-sm flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <p className="font-black text-xs uppercase tracking-tight">{item.name}</p>
                                                        <p className="text-[10px] text-muted-foreground font-bold">{item.quantity} x {formatCurrency(item.price)}</p>
                                                        {item.notes && <p className="text-[9px] text-primary italic mt-1 font-medium">"{item.notes}"</p>}
                                                    </div>
                                                    <p className="font-black text-sm text-primary">{formatCurrency(item.price * item.quantity)}</p>
                                                </div>
                                            ))}
                                            <Separator className="my-6" />
                                            <div className="bg-primary text-white p-6 rounded-3xl shadow-xl shadow-primary/20 flex justify-between items-center">
                                                <span className="font-black uppercase tracking-[0.2em] text-[10px] opacity-80">Total Acumulado</span>
                                                <span className="text-3xl font-black tracking-tighter">{formatCurrency(orderData.total)}</span>
                                            </div>
                                            <div className="p-4 bg-muted/50 rounded-2xl border border-dashed text-center">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed">
                                                    El pago se realiza directamente en la recepción al desocupar la habitación o mesa.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-40">
                                            <History className="h-16 w-16 mb-4" />
                                            <p className="text-sm font-bold uppercase tracking-widest">Sin historial aún</p>
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 border-b bg-white space-y-4 shrink-0">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Buscar antojo..." 
                                            className="pl-9 h-12 bg-zinc-50 border-2 rounded-2xl transition-all focus:border-primary"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <ScrollArea className="w-full whitespace-nowrap">
                                        <div className="flex gap-2 pb-2">
                                            <button 
                                                className={cn(
                                                    "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                    selectedCategoryId === null ? "bg-primary text-white shadow-lg" : "bg-zinc-100 text-muted-foreground"
                                                )}
                                                onClick={() => setSelectedCategoryId(null)}
                                            >
                                                Todo
                                            </button>
                                            {categories?.map(cat => (
                                                <button 
                                                    key={cat.id}
                                                    className={cn(
                                                        "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                        selectedCategoryId === cat.id ? "bg-primary text-white shadow-lg" : "bg-zinc-100 text-muted-foreground"
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
                                    <div className="grid grid-cols-2 gap-4 p-4 pb-32">
                                        {filteredServices.map(service => (
                                            <div 
                                                key={service.id} 
                                                className="bg-white rounded-3xl border-2 overflow-hidden shadow-sm relative group active:scale-95 transition-transform"
                                            >
                                                <div className="aspect-[4/5] relative">
                                                    <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
                                                    
                                                    {/* Top Category/Stock Badge */}
                                                    <div className="absolute top-3 left-3 z-10">
                                                        <div className="bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 border">
                                                            <span className="text-[10px] font-black text-black uppercase tracking-widest">{service.category === 'Food' ? 'Cocina' : 'Bar'}</span>
                                                            <span className="w-1 h-1 rounded-full bg-primary" />
                                                            <span className="text-[10px] font-black text-primary uppercase">Stock: {service.stock}</span>
                                                        </div>
                                                    </div>

                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                                                    
                                                    <div className="absolute inset-x-0 bottom-0 p-4 space-y-3">
                                                        <div className="space-y-0.5">
                                                            <h3 className="font-black text-sm uppercase tracking-tight text-white leading-none drop-shadow-md">{service.name}</h3>
                                                            <p className="text-primary font-black text-base drop-shadow-md">{formatCurrency(service.price)}</p>
                                                        </div>
                                                        <Button 
                                                            onClick={() => handleAddToCart(service)}
                                                            className="w-full h-10 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-white text-black hover:bg-primary hover:text-white shadow-xl border-none"
                                                        >
                                                            <Plus className="h-3 w-3 mr-1" /> Agregar
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </>
                        )}
                    </div>
                )}

                {/* Step 3: Shopping Cart Detail */}
                {step === 3 && (
                    <div className="h-full flex flex-col p-6 animate-in slide-in-from-right-10 duration-500 bg-white">
                        <div className="mb-8 flex items-center justify-between">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Mi Pedido</h2>
                            <button onClick={() => setStep(2)} className="h-10 w-10 flex items-center justify-center rounded-2xl bg-zinc-100"><X className="h-5 w-5"/></button>
                        </div>

                        <ScrollArea className="flex-1 -mx-2 px-2">
                            <div className="space-y-4 pb-10">
                                {cart.map((item, idx) => (
                                    <div key={item.service.id} className="bg-zinc-50 p-4 rounded-3xl border-2 space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="font-black text-sm uppercase tracking-tight leading-none">{item.service.name}</p>
                                                <p className="text-[10px] font-bold text-primary mt-1">{formatCurrency(item.service.price)} x unidad</p>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white rounded-2xl p-1.5 shadow-sm border">
                                                <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-8 w-8 rounded-xl hover:bg-zinc-50 flex items-center justify-center text-muted-foreground"><Minus className="h-4 w-4"/></button>
                                                <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                                                <button onClick={() => handleAddToCart(item.service)} className="h-8 w-8 rounded-xl hover:bg-zinc-50 flex items-center justify-center text-primary"><Plus className="h-4 w-4"/></button>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleOpenNoteDialog(idx)}
                                            className={cn(
                                                "w-full h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border-2 transition-all",
                                                item.notes ? "bg-primary/10 border-primary text-primary" : "bg-white border-zinc-200 text-muted-foreground"
                                            )}
                                        >
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            {item.notes ? "Instrucciones Guardadas" : "Instrucciones de cocina"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        <div className="mt-auto pt-6 space-y-4">
                            <div className="flex justify-between items-center px-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtotal neto</span>
                                <span className="text-3xl font-black tracking-tighter">{formatCurrency(subtotal)}</span>
                            </div>
                            <Button 
                                onClick={handleConfirmOrder} 
                                disabled={isPending || cart.length === 0}
                                className="w-full h-16 rounded-[2rem] font-black text-base uppercase tracking-widest shadow-2xl shadow-primary/20"
                            >
                                {isPending ? 'ENVIANDO...' : 'CONFIRMAR PEDIDO'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Action Bar */}
            {step === 2 && cart.length > 0 && (
                <div className="absolute bottom-8 inset-x-6 z-40 animate-in fade-in slide-in-from-bottom-10 duration-700">
                    <button 
                        onClick={() => setStep(3)}
                        className="w-full h-16 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-between px-8 border-4 border-white/20 backdrop-blur-md"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 h-10 w-10 rounded-full flex items-center justify-center">
                                <ShoppingCart className="h-5 w-5" />
                            </div>
                            <span className="font-black text-sm uppercase tracking-widest">Ver mi pedido</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="bg-white/20 h-8 px-3 rounded-full flex items-center justify-center text-[10px] font-black">{cart.reduce((s,i) => s + i.quantity, 0)} ítems</span>
                            <span className="text-xl font-black tracking-tighter">{formatCurrency(subtotal)}</span>
                        </div>
                    </button>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-xl"><Sun className="h-5 w-5 text-primary" /></div>
                            Instrucciones Especiales
                        </DialogTitle>
                        <DialogDescription>
                            ¿Cómo desea que preparemos su {editingNoteIndex !== null ? cart[editingNoteIndex].service.name : 'producto'}?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Sin cebolla, término medio, gaseosa bien fría..." 
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[150px] rounded-[1.5rem] border-2 text-base font-medium p-4"
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest" onClick={handleSaveNote}>
                            GUARDAR INSTRUCCIONES
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
