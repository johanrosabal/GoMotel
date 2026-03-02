'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import type { Service, Tax, SinpeAccount, AppliedTax, ProductCategory, ProductSubCategory, RestaurantTable, Order } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Smartphone, Wallet, CreditCard, ChevronRight, ChevronLeft,
    ImageIcon, User, Layers, Filter, Utensils, Beer, PackageCheck, Clock, CheckCircle, X, Sun, MapPin,
    Trash2, MessageSquare, SmartphoneIcon, UtensilsCrossed
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza',
    'Pooles': 'Pooles'
};

const PREP_STATUS_MAP: Record<string, { label: string, color: string }> = {
    'Pendiente': { label: 'En Cola', color: 'bg-muted text-muted-foreground' },
    'En preparación': { label: 'Preparando', color: 'bg-amber-100 text-amber-700 animate-pulse' },
    'Entregado': { label: 'Listo', color: 'bg-green-100 text-green-700' },
    'Cancelado': { label: 'Cancelado', color: 'bg-red-100 text-red-700' }
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // --- UI State ---
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<string>('');
    const [step, setStep] = useState(1); // 1: Catalog, 2: Account/Status
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // --- Logic State ---
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);

    // --- Dialogs ---
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // --- Data Fetching ---
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const subCategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedCategoryId) return null;
        return query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategoryId), orderBy('name'));
    }, [firestore, selectedCategoryId]);
    const { data: subCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

    const tablesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, [firestore]);
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        const types = Array.from(new Set(allTables.map(t => t.type)));
        return types.sort();
    }, [allTables]);

    // Set initial tab
    useEffect(() => {
        if (locationTypes.length > 0 && !activeTab) {
            setActiveTab(locationTypes[0]);
        }
    }, [locationTypes, activeTab]);

    // --- Session Persistence Logic ---
    useEffect(() => {
        if (!selectedTable) {
            setActiveOrderId(null);
            setActiveOrder(null);
            return;
        }

        const savedOrderId = localStorage.getItem(`gomotel_active_order_${selectedTable.id}`);
        if (savedOrderId) {
            setActiveOrderId(savedOrderId);
        }
    }, [selectedTable]);

    useEffect(() => {
        if (!activeOrderId || !firestore) {
            setActiveOrder(null);
            return;
        }

        const unsubscribe = onSnapshot(doc(firestore, 'orders', activeOrderId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Order;
                // Si la orden ya fue pagada, limpiamos la sesión
                if (data.paymentStatus === 'Pagado') {
                    localStorage.removeItem(`gomotel_active_order_${selectedTable?.id}`);
                    setActiveOrderId(null);
                    setActiveOrder(null);
                } else {
                    setActiveOrder({ id: docSnap.id, ...data });
                }
            } else {
                localStorage.removeItem(`gomotel_active_order_${selectedTable?.id}`);
                setActiveOrderId(null);
                setActiveOrder(null);
            }
        });

        return () => unsubscribe();
    }, [activeOrderId, firestore, selectedTable]);

    // --- Calculations ---
    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && (
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                s.code?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            const matchesSubCategory = !selectedSubCategoryId || s.subCategoryId === selectedSubCategoryId;
            return matchesSearch && matchesCategory && matchesSubCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId, selectedSubCategoryId]);

    const { subtotal, totalTax, grandTotal, appliedTaxes } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
        let tax = 0;
        const taxMap = new Map<string, AppliedTax>();

        if (allTaxes) {
            const serviceTax = allTaxes.find(t => t.name.toLowerCase().includes('servicio') || t.name.toLowerCase().includes('service'));
            
            cart.forEach(item => {
                const itemTotal = item.service.price * item.quantity;
                const effectiveTaxIds = new Set(item.service.taxIds || []);
                if (serviceTax) effectiveTaxIds.add(serviceTax.id);

                effectiveTaxIds.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        const taxAmount = itemTotal * (taxInfo.percentage / 100);
                        tax += taxAmount;
                        const existing = taxMap.get(taxId);
                        if (existing) existing.amount += taxAmount;
                        else taxMap.set(taxId, { taxId, name: taxInfo.name, percentage: taxInfo.percentage, amount: taxAmount });
                    }
                });
            });
        }
        return { subtotal: sub, totalTax: tax, grandTotal: sub + tax, appliedTaxes: Array.from(taxMap.values()) };
    }, [cart, allTaxes]);

    // --- Actions ---
    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { service, quantity: 1 }];
        });
    };

    const handleRemoveFromCart = (serviceId: string) => {
        setCart(prev => {
            const item = prev.find(i => i.service.id === serviceId);
            if (item && item.quantity > 1) return prev.map(i => i.service.id === serviceId ? { ...i, quantity: i.quantity - 1 } : i);
            return prev.filter(i => i.service.id !== serviceId);
        });
    };

    const handleClearCart = () => setCart([]);

    const handleSendOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                // Añadir a cuenta existente
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                // Abrir cuenta nueva
                result = await openTableAccount(selectedTable.id, cart, `Cliente ${selectedTable.number}`, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    localStorage.setItem(`gomotel_active_order_${selectedTable.id}`, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando su orden.' });
                handleClearCart();
                setStep(2); // Ir a la pestaña de cuenta
            }
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

    // --- Render Helpers ---
    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12 overflow-y-auto">
                <div className="max-w-6xl mx-auto space-y-12">
                    <div className="space-y-4">
                        <Button variant="ghost" className="text-muted-foreground hover:text-white p-0" onClick={() => window.history.back()}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Volver
                        </Button>
                        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
                            ¿DÓNDE SE ENCUENTRA?
                        </h1>
                        <p className="text-muted-foreground text-lg font-bold uppercase tracking-[0.2em]">Seleccione su número de mesa o habitación.</p>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-white/5 border border-white/10 h-14 p-1.5 rounded-2xl mb-8 w-full justify-start overflow-x-auto no-scrollbar">
                            {locationTypes.map(type => (
                                <TabsTrigger 
                                    key={type} 
                                    value={type}
                                    className="rounded-xl px-8 font-black uppercase text-xs tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all"
                                >
                                    {TYPE_LABELS[type] || type}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {locationTypes.map(type => (
                            <TabsContent key={type} value={type} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {allTables?.filter(t => t.type === type).map(table => (
                                        <button
                                            key={table.id}
                                            onClick={() => setSelectedTable(table)}
                                            className="group relative flex flex-col items-center justify-center min-h-[160px] rounded-3xl border-2 border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 active:scale-95 shadow-xl"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground group-hover:text-primary transition-colors">
                                                {TYPE_LABELS[table.type] || table.type}
                                            </span>
                                            <span className="text-5xl font-black tracking-tighter mt-1">{table.number}</span>
                                        </button>
                                    ))}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">
            {/* Header Fijo */}
            <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between z-50 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" className="rounded-full bg-white/5" onClick={() => { setSelectedTable(null); setStep(1); handleClearCart(); }}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="font-black text-xs uppercase tracking-widest text-primary leading-none">Ubicación</h2>
                        <p className="font-black text-xl tracking-tighter uppercase">{TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant={step === 1 ? "primary" : "ghost"}
                        className={cn("h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest", step === 1 ? "bg-primary shadow-lg shadow-primary/20" : "bg-white/5")}
                        onClick={() => setStep(1)}
                    >
                        Catálogo
                    </Button>
                    <Button 
                        variant={step === 2 ? "primary" : "ghost"}
                        className={cn("h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest relative", step === 2 ? "bg-primary shadow-lg shadow-primary/20" : "bg-white/5")}
                        onClick={() => setStep(2)}
                    >
                        Mi Cuenta
                        {activeOrder && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black" />}
                    </Button>
                </div>
            </div>

            <main className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {step === 1 ? (
                        <motion.div 
                            key="catalog"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex flex-col h-full"
                        >
                            <div className="p-4 border-b border-white/5 bg-white/[0.02] space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar platillo o bebida..." 
                                        className="pl-9 h-12 bg-white/5 border-white/10 rounded-2xl text-base font-bold transition-all focus:ring-2 focus:ring-primary/20"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <ScrollArea className="w-full whitespace-nowrap">
                                    <div className="flex gap-2 pb-2">
                                        <button 
                                            className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", !selectedCategoryId ? "bg-primary text-white" : "bg-white/5 text-muted-foreground")}
                                            onClick={() => { setSelectedCategoryId(null); setSelectedSubCategoryId(null); }}
                                        >
                                            Todos
                                        </button>
                                        {categories?.map(cat => (
                                            <button 
                                                key={cat.id}
                                                className={cn("h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all", selectedCategoryId === cat.id ? "bg-primary text-white" : "bg-white/5 text-muted-foreground")}
                                                onClick={() => { setSelectedCategoryId(cat.id); setSelectedSubCategoryId(null); }}
                                            >
                                                {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="grid grid-cols-2 gap-3 p-4 pb-32">
                                    {filteredServices.map(service => (
                                        <button
                                            key={service.id}
                                            onClick={() => handleAddToCart(service)}
                                            className="group flex flex-col bg-white/[0.03] border border-white/5 rounded-[2rem] overflow-hidden hover:border-primary/40 transition-all active:scale-95 text-left"
                                        >
                                            <div className="aspect-square relative overflow-hidden bg-muted">
                                                <Avatar className="h-full w-full rounded-none">
                                                    <AvatarImage src={service.imageUrl || undefined} className="object-cover transition-transform group-hover:scale-110 duration-700" />
                                                    <AvatarFallback className="rounded-none bg-white/5">
                                                        <ImageIcon className="h-8 w-8 text-white/10" />
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="absolute top-3 right-3">
                                                    <Badge className="font-black bg-black/60 backdrop-blur-md border-white/10 shadow-xl">
                                                        {formatCurrency(service.price)}
                                                    </Badge>
                                                </div>
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 p-4 pt-10">
                                                    <h3 className="font-black text-xs uppercase leading-tight drop-shadow-md">{service.name}</h3>
                                                </div>
                                            </div>
                                            <div className="p-3 mt-auto">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter truncate max-w-[80px]">
                                                        {service.source === 'Internal' ? 'Chef' : 'Stock: ' + (service.stock || 0)}
                                                    </span>
                                                    <div className="bg-primary p-1.5 rounded-full shadow-lg shadow-primary/30">
                                                        <Plus className="h-3 w-3" />
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="account"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col h-full"
                        >
                            <ScrollArea className="flex-1 p-6 pb-32">
                                {!activeOrder && cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                                        <div className="p-10 rounded-full bg-white/[0.03] border border-white/5">
                                            <UtensilsCrossed className="h-16 w-16 text-white/10" />
                                        </div>
                                        <p className="text-xl font-black uppercase tracking-widest text-muted-foreground">Su cuenta está vacía</p>
                                        <Button variant="outline" className="rounded-2xl border-white/10" onClick={() => setStep(1)}>Explorar Menú</Button>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {activeOrder && (
                                            <section className="space-y-4">
                                                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3">
                                                    Consumos de la Estancia
                                                    <div className="h-px flex-1 bg-primary/20" />
                                                </h3>
                                                <div className="grid gap-3">
                                                    {activeOrder.items.map((item, idx) => {
                                                        const status = item.category === 'Food' ? activeOrder.kitchenStatus : activeOrder.barStatus;
                                                        const statusInfo = PREP_STATUS_MAP[status || 'Pendiente'] || PREP_STATUS_MAP['Pendiente'];
                                                        return (
                                                            <div key={idx} className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-base tracking-tight uppercase truncate">{item.name}</p>
                                                                    <p className="text-xs font-bold text-muted-foreground">{item.quantity} Unidades • {formatCurrency(item.price * item.quantity)}</p>
                                                                </div>
                                                                <Badge className={cn("rounded-lg font-black uppercase text-[10px] px-3 py-1", statusInfo.color)}>
                                                                    {statusInfo.label}
                                                                </Badge>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        )}

                                        {cart.length > 0 && (
                                            <section className="space-y-4">
                                                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-amber-500 flex items-center gap-3">
                                                    Nuevos por Enviar
                                                    <div className="h-px flex-1 bg-amber-500/20" />
                                                </h3>
                                                <div className="grid gap-3">
                                                    {cart.map((item, idx) => (
                                                        <div key={item.service.id} className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-base tracking-tight uppercase truncate">{item.service.name}</p>
                                                                    <p className="text-xs font-bold text-amber-500/70">{formatCurrency(item.service.price * item.quantity)}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleRemoveFromCart(item.service.id)}><Minus className="h-3 w-3" /></Button>
                                                                    <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleAddToCart(item.service)}><Plus className="h-3 w-3" /></Button>
                                                                </div>
                                                                <Button 
                                                                    variant="destructive" 
                                                                    size="icon" 
                                                                    className="h-10 w-10 rounded-xl shadow-lg"
                                                                    onClick={() => setCart(prev => prev.filter(i => i.service.id !== item.service.id))}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                            {item.service.source === 'Internal' && (
                                                                <button onClick={() => handleOpenNoteDialog(idx)} className="mt-3 w-full p-2 bg-black/20 rounded-xl border border-white/5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-black/40 transition-colors">
                                                                    <MessageSquare className="h-3 w-3" /> {item.notes ? 'Editar nota: "' + item.notes + '"' : '+ Añadir instrucciones para cocina'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        )}
                                    </div>
                                )}
                            </ScrollArea>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer Flotante Acciones */}
                {cart.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent z-[60]">
                        <Card className="bg-primary border-none shadow-2xl shadow-primary/20 rounded-[2.5rem] overflow-hidden">
                            <CardContent className="p-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-none">Total por enviar</p>
                                    <p className="text-3xl font-black tracking-tighter text-white">{formatCurrency(grandTotal)}</p>
                                </div>
                                <Button 
                                    className="h-14 px-8 rounded-3xl bg-white text-primary hover:bg-white/90 font-black uppercase text-xs tracking-[0.2em] shadow-xl"
                                    onClick={handleSendOrder}
                                    disabled={isPending}
                                >
                                    {isPending ? 'Enviando...' : activeOrderId ? 'Añadir a mi Cuenta' : 'Confirmar Pedido'}
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>

            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md bg-[#1a1a1a] border-white/10 text-white rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">Instrucciones</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-bold">Añada notas para la preparación.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary block mb-1">Producto</span>
                            <span className="font-black text-lg uppercase tracking-tight">{editingNoteIndex !== null ? cart[editingNoteIndex]?.service.name : ''}</span>
                        </div>
                        <Textarea 
                            placeholder="Ej: Sin cebolla, extra picante, término medio..."
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] bg-white/5 border-white/10 rounded-2xl text-base font-bold focus:ring-primary/20"
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="flex-1 rounded-2xl font-black uppercase text-xs" onClick={() => setNoteDialogOpen(false)}>Cancelar</Button>
                        <Button className="flex-1 rounded-2xl bg-primary text-white font-black uppercase text-xs" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}