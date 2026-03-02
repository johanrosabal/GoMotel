'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory, Tax, AppliedTax } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, ImageIcon, Utensils, Beer, Sun, MapPin, 
    X, Clock, CheckCircle, Smartphone, History, Filter
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    // UI States
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);
    
    // Session State (Account Persistence)
    const [sessionOrderId, setSessionOrderId] = useState<string | null>(null);
    const [activeOrderData, setActiveOrderData] = useState<Order | null>(null);

    // Kitchen Notes Dialog
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Fetch Data
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

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

    // PERSISTENCE LOGIC: Recover order ID from localStorage for the selected table
    useEffect(() => {
        if (selectedTable) {
            const savedId = localStorage.getItem(`pos_session_order_${selectedTable.id}`);
            if (savedId) {
                setSessionOrderId(savedId);
            } else {
                setSessionOrderId(null);
                setActiveOrderData(null);
            }
        }
    }, [selectedTable]);

    // SYNC LOGIC: Listen to the active order in real-time
    useEffect(() => {
        if (!firestore || !sessionOrderId) return;

        const unsub = onSnapshot(doc(firestore, 'orders', sessionOrderId), (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as Order;
                // If the order is paid or cancelled, clear the session
                if (data.paymentStatus === 'Pagado' || data.status === 'Cancelado') {
                    if (selectedTable) localStorage.removeItem(`pos_session_order_${selectedTable.id}`);
                    setSessionOrderId(null);
                    setActiveOrderData(null);
                } else {
                    setActiveOrderData(data);
                }
            } else {
                if (selectedTable) localStorage.removeItem(`pos_session_order_${selectedTable.id}`);
                setSessionOrderId(null);
                setActiveOrderData(null);
            }
        });

        return () => unsub();
    }, [firestore, sessionOrderId, selectedTable]);

    // Filter Logic
    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        const types = Array.from(new Set(allTables.map(t => t.type)));
        const order = ['Table', 'Bar', 'Terraza'];
        return types.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }, [allTables]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && (s.name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = selectedCategoryId === 'all' || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId]);

    // Cart Logic
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

    // Billing Logic
    const { subtotal, totalTax, grandTotal, appliedTaxes } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
        let tax = 0;
        const taxMap = new Map<string, AppliedTax>();

        if (allTaxes) {
            const serviceTax = allTaxes.find(t => t.name.toLowerCase().includes('servicio'));
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

    const handleSendOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (sessionOrderId) {
                // If there's already an active account, add to it
                result = await addToTableAccount(sessionOrderId, cart);
            } else {
                // Otherwise open a new one
                result = await openTableAccount(selectedTable.id, cart, `Cliente ${selectedTable.number}`, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido Enviado!', description: 'Estamos preparando su orden.' });
                if (result.orderId) {
                    localStorage.setItem(`pos_session_order_${selectedTable.id}`, result.orderId);
                    setSessionOrderId(result.orderId);
                }
                handleClearCart();
                setShowCart(false);
                setActiveTab('account');
            }
        });
    };

    // Render Table Selection
    if (!selectedTable) {
        return (
            <div className="flex flex-col min-h-screen bg-[#0a0a0a] text-white">
                <div className="p-8 lg:p-16 text-center space-y-4">
                    <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
                        BIENVENIDO
                    </h1>
                    <p className="text-lg font-bold text-primary tracking-[0.3em] uppercase opacity-80">
                        Seleccione su ubicación para ordenar
                    </p>
                </div>

                <div className="flex-1 px-4 pb-12">
                    <Tabs defaultValue={locationTypes[0]} className="w-full max-w-4xl mx-auto">
                        <TabsList className="grid w-full h-14 bg-white/5 border border-white/10 rounded-2xl mb-8 overflow-hidden" style={{ gridTemplateColumns: `repeat(${locationTypes.length}, 1fr)` }}>
                            {locationTypes.map(type => (
                                <TabsTrigger 
                                    key={type} 
                                    value={type}
                                    className="font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white h-full transition-all"
                                >
                                    {type === 'Table' ? 'Mesas' : type === 'Bar' ? 'Barra' : type}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {locationTypes.map(type => (
                            <TabsContent key={type} value={type} className="animate-in fade-in zoom-in-95 duration-300">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {allTables?.filter(t => t.type === type).map(table => (
                                        <button
                                            key={table.id}
                                            onClick={() => setSelectedTable(table)}
                                            className="group aspect-square rounded-3xl bg-white/5 border-2 border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-primary/20 hover:border-primary transition-all active:scale-95"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                                                {type === 'Table' ? 'Mesa' : type === 'Bar' ? 'Barra' : type}
                                            </span>
                                            <span className="text-5xl font-black tracking-tighter">{table.number}</span>
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

    // Render Ordering Interface
    return (
        <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">
            {/* Header Profesional */}
            <header className="shrink-0 bg-black/40 backdrop-blur-xl border-b border-white/10 p-4">
                <div className="container flex items-center justify-between mx-auto max-w-5xl">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                            <Utensils className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-tighter leading-none">GO MOTEL</h2>
                            <p className="text-[9px] font-bold text-primary tracking-widest uppercase">Auto-Servicio Digital</p>
                        </div>
                    </div>
                    
                    <Badge variant="outline" className="h-10 px-4 font-black uppercase text-xs tracking-widest border-2 bg-white/5 backdrop-blur-sm border-primary/20 text-primary">
                        {selectedTable.type === 'Table' ? 'Mesa' : selectedTable.type === 'Bar' ? 'Barra' : selectedTable.type} {selectedTable.number}
                    </Badge>
                </div>
            </header>

            {/* Navegación por Pestañas (Catálogo vs Mi Cuenta) */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="bg-black/20 border-b border-white/5 p-2 shrink-0">
                    <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto h-12 bg-white/5 border border-white/10 rounded-xl p-1">
                        <TabsTrigger value="all" className="rounded-lg font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary">Menú</TabsTrigger>
                        <TabsTrigger value="account" className="rounded-lg font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary gap-2 relative">
                            Mi Cuenta
                            {activeOrderData && (
                                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center text-[8px] border-2 border-black animate-pulse">
                                    {activeOrderData.items.length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Contenido: Menú */}
                <TabsContent value="all" className="flex-1 flex flex-col min-h-0 m-0 animate-in fade-in duration-300">
                    <div className="p-4 bg-black/20 border-b border-white/5 space-y-4 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar en el menú..." 
                                className="pl-10 h-12 bg-white/5 border-white/10 rounded-2xl text-base font-bold focus:ring-primary"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="flex gap-2">
                            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                                <SelectTrigger className="h-10 bg-white/5 border-white/10 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                                    <div className="flex items-center gap-2"><Filter className="h-3.5 w-3.5" /><SelectValue placeholder="Categoría" /></div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todo el Menú</SelectItem>
                                    {categories?.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="grid grid-cols-2 gap-4 p-4 pb-24 max-w-5xl mx-auto">
                            {filteredServices.map(service => (
                                <button
                                    key={service.id}
                                    onClick={() => handleAddToCart(service)}
                                    className="group flex flex-col bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden hover:bg-white/10 transition-all active:scale-95 text-left"
                                >
                                    <div className="aspect-square relative overflow-hidden bg-white/5">
                                        <Avatar className="h-full w-full rounded-none">
                                            <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover transition-transform group-hover:scale-110 duration-500" />
                                            <AvatarFallback className="rounded-none bg-transparent">
                                                <ImageIcon className="h-8 w-8 text-white/10" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute top-3 right-3">
                                            <Badge className="font-black bg-primary text-white border-none shadow-xl">
                                                {formatCurrency(service.price)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col gap-1">
                                        <h3 className="font-black text-xs uppercase tracking-tight leading-tight line-clamp-2">{service.name}</h3>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{service.category === 'Food' ? 'Cocina' : 'Barra'}</p>
                                        <div className="mt-2 flex justify-end">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                                <Plus className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </TabsContent>

                {/* Contenido: Mi Cuenta */}
                <TabsContent value="account" className="flex-1 flex flex-col min-h-0 m-0 animate-in fade-in duration-300">
                    <ScrollArea className="flex-1">
                        <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-6">
                            {!activeOrderData ? (
                                <div className="text-center py-24 space-y-6">
                                    <div className="h-24 w-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                                        <History className="h-10 w-10 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black uppercase tracking-tighter">Sin actividad</h3>
                                        <p className="text-sm text-muted-foreground font-medium max-w-[240px] mx-auto">Aún no ha realizado pedidos para esta ubicación.</p>
                                    </div>
                                    <Button onClick={() => setActiveTab('all')} className="rounded-2xl h-12 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl">Ver el Menú Ahora</Button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-primary/10 border-2 border-primary/20 rounded-3xl p-6 text-center space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Total de Consumo</p>
                                        <p className="text-5xl font-black tracking-tighter text-primary">{formatCurrency(activeOrderData.total)}</p>
                                        <div className="flex items-center justify-center gap-2 pt-2">
                                            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-green-500">Cuenta Activa</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Historial de Pedidos</h4>
                                        <div className="space-y-2">
                                            {activeOrderData.items.map((item, idx) => {
                                                const itemStatus = item.category === 'Food' ? activeOrderData.kitchenStatus : activeOrderData.barStatus;
                                                return (
                                                    <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-sm">{item.quantity}</div>
                                                            <div>
                                                                <p className="font-black text-xs uppercase tracking-tight">{item.name}</p>
                                                                <p className="text-[10px] font-bold text-muted-foreground">{formatCurrency(item.price * item.quantity)}</p>
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className={cn(
                                                            "font-black text-[8px] uppercase px-3 py-1 border-2 tracking-widest",
                                                            itemStatus === 'Entregado' ? "bg-green-500/10 border-green-500/30 text-green-500" :
                                                            itemStatus === 'En preparación' ? "bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse" :
                                                            "bg-white/10 border-white/20 text-muted-foreground"
                                                        )}>
                                                            {itemStatus || 'Pendiente'}
                                                        </Badge>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-amber-500/10 border-2 border-amber-500/20 rounded-3xl p-6 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                                <Smartphone className="h-5 w-5 text-black" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-black uppercase tracking-tighter text-amber-300">Pagar ahora</h4>
                                                <p className="text-[10px] font-bold text-amber-200/60 uppercase">Solicitar la factura a su móvil</p>
                                            </div>
                                        </div>
                                        <p className="text-xs font-medium text-amber-200/80 leading-relaxed">Si desea cancelar su cuenta, por favor solicite la asistencia del personal o espere a que el recepcionista procese su cobro final.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            {/* Barra Inferior del Carrito (Solo si hay items) */}
            {cart.length > 0 && activeTab !== 'account' && (
                <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black via-black to-transparent animate-in slide-in-from-bottom-full duration-500">
                    <button 
                        onClick={() => setShowCart(true)}
                        className="w-full h-16 bg-primary rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-between px-6 active:scale-95 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center relative">
                                <ShoppingCart className="h-5 w-5 text-white" />
                                <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-white text-primary text-[10px] font-black flex items-center justify-center shadow-md">
                                    {cart.reduce((s, i) => s + i.quantity, 0)}
                                </span>
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-none">Ver mi pedido</p>
                                <p className="text-xl font-black tracking-tighter leading-tight">{formatCurrency(grandTotal)}</p>
                            </div>
                        </div>
                        <ChevronRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            )}

            {/* Modal del Carrito (Revisión Final) */}
            <Dialog open={showCart} onOpenChange={setShowCart}>
                <DialogContent className="sm:max-w-md bg-[#0f0f0f] border-white/10 text-white p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b border-white/5">
                        <DialogTitle className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                            <ShoppingCart className="h-6 w-6 text-primary" /> Revisar Pedido
                        </DialogTitle>
                        <DialogDescription className="text-white/40 font-medium">Verifique sus productos antes de enviar a cocina.</DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[50vh]">
                        <div className="p-6 space-y-4">
                            {cart.map((item, idx) => (
                                <div key={item.service.id} className="flex flex-col gap-2 p-4 bg-white/5 border border-white/10 rounded-2xl">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm uppercase tracking-tight truncate">{item.service.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-[10px] font-bold text-primary">{formatCurrency(item.service.price)}</p>
                                                {item.service.source === 'Internal' && (
                                                    <button onClick={() => handleOpenNoteDialog(idx)} className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-all flex items-center gap-1", item.notes ? "bg-primary text-white border-primary" : "bg-white/10 text-white/60 border-white/10")}>
                                                        {item.notes ? "Ver Instrucción" : "+ Instrucción"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1 border border-white/5">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-white/10" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-white/10" onClick={() => handleAddToCart(item.service)}>
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    {item.notes && (
                                        <p className="text-[9px] text-primary italic font-medium ml-1 border-l-2 pl-2 border-primary/20 line-clamp-2">"{item.notes}"</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <div className="p-6 pt-4 border-t border-white/5 bg-white/[0.02] space-y-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            {appliedTaxes.map(tax => (
                                <div key={tax.taxId} className="flex justify-between text-[10px] font-bold text-white/30 uppercase">
                                    <span>{tax.name} {tax.percentage}%</span>
                                    <span>{formatCurrency(tax.amount)}</span>
                                </div>
                            ))}
                            <Separator className="bg-white/10 my-2" />
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black uppercase text-white/60">Total Pedido</span>
                                <span className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>

                        <Button 
                            onClick={handleSendOrder} 
                            disabled={isPending || cart.length === 0}
                            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
                        >
                            {isPending ? 'Enviando...' : sessionOrderId ? 'Añadir a mi cuenta' : 'Confirmar y Enviar'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Notas de Cocina */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md bg-[#0f0f0f] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Instrucciones de Cocina</DialogTitle>
                        <DialogDescription>Añada indicaciones para la preparación.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nota Especial</Label>
                            <Textarea 
                                placeholder="Ej: Con poca sal, sin cebolla, etc."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] bg-white/5 border-white/10 rounded-2xl resize-none font-bold"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" className="h-12 rounded-2xl font-bold border-white/10" onClick={() => setNoteDialogOpen(false)}>Cancelar</Button>
                        <Button className="h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
