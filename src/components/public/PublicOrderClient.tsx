'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { 
    collection, query, where, orderBy, doc, onSnapshot, 
    addDoc, Timestamp, runTransaction, increment, updateDoc, getDocs 
} from 'firebase/firestore';
import type { Service, Tax, RestaurantTable, Order, AppliedTax, ProductCategory, ProductSubCategory } from '@/types';
import { 
    Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
    Dialog, DialogContent, DialogDescription, DialogFooter, 
    DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
    Search, ShoppingCart, Plus, Minus, Trash2, 
    Smartphone, User, Utensils, Beer, PackageCheck, 
    Clock, CheckCircle, X, Sun, MapPin, MessageSquare, 
    ChevronRight, ChevronLeft, CreditCard, Wallet, 
    AlertCircle, Image as ImageIcon, SmartphoneIcon
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const ZONE_LABELS: Record<string, string> = {
    'Table': 'Mesas',
    'Bar': 'Barra',
    'Terraza': 'Terraza',
    'Pooles': 'Pooles'
};

const ZONE_ICON: Record<string, any> = {
    'Table': Utensils,
    'Bar': Beer,
    'Terraza': Sun,
    'Pooles': MapPin
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());

    // State Management
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [zoneFilter, setZoneFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // UI Dialogs
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Session Management
    const [sessionOrderIds, setSessionOrderIds] = useState<string[]>([]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        const stored = localStorage.getItem('my_orders_session');
        if (stored) setSessionOrderIds(JSON.parse(stored));
        return () => clearInterval(timer);
    }, []);

    const updateSessionOrders = (id: string) => {
        const newIds = [...sessionOrderIds, id];
        setSessionOrderIds(newIds);
        localStorage.setItem('my_orders_session', JSON.stringify(newIds));
    };

    // Data Fetching
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
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('name')) : null, 
        [firestore]
    );
    const { data: services } = useCollection<Service>(servicesQuery);

    const taxesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'taxes')) : null, [firestore]
    );
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    // Filter Logic
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

    // Cart Logic
    const { subtotal, totalTax, grandTotal, appliedTaxes } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
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
        toast({ title: "Añadido", description: `${service.name} al carrito.` });
    };

    const handleRemoveOne = (serviceId: string) => {
        setCart(prev => {
            const item = prev.find(i => i.service.id === serviceId);
            if (item && item.quantity > 1) {
                return prev.map(i => i.service.id === serviceId ? { ...i, quantity: i.quantity - 1 } : i);
            }
            return prev.filter(i => i.service.id !== serviceId);
        });
    };

    const handleRemoveAll = (serviceId: string) => {
        setCart(prev => prev.filter(i => i.service.id !== serviceId));
        toast({ title: "Eliminado", description: "Producto removido del carrito." });
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
        setEditingNoteIndex(null);
    };

    const handleSendOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            try {
                await runTransaction(firestore!, async (transaction) => {
                    const tableRef = doc(firestore!, 'restaurantTables', selectedTable.id);
                    const orderRef = doc(collection(firestore!, 'orders'));
                    
                    const newOrder = {
                        locationType: selectedTable.type,
                        locationId: selectedTable.id,
                        label: `Pedido Móvil - ${selectedTable.number}`,
                        items: cart.map(i => ({
                            serviceId: i.service.id,
                            name: i.service.name,
                            quantity: i.quantity,
                            price: i.service.price,
                            notes: i.notes || null
                        })),
                        total: grandTotal,
                        createdAt: Timestamp.now(),
                        status: 'Pendiente',
                        paymentStatus: 'Pendiente',
                        source: 'Public'
                    };

                    transaction.set(orderRef, newOrder);
                    transaction.update(tableRef, { status: 'Occupied', currentOrderId: orderRef.id });
                    updateSessionOrders(orderRef.id);
                });

                setCart([]);
                setActiveTab('account');
                toast({ title: "¡Pedido Enviado!", description: "Estamos preparando tus productos." });
            } catch (e: any) {
                toast({ title: "Error", description: e.message, variant: "destructive" });
            }
        });
    };

    // My Account Logic (Filtered by Session)
    const [myOrders, setMyOrders] = useState<Order[]>([]);
    useEffect(() => {
        if (!firestore || sessionOrderIds.length === 0) return;
        const q = query(collection(firestore, 'orders'), where('__name__', 'in', sessionOrderIds.slice(-10)));
        return onSnapshot(q, (snap) => {
            setMyOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)).sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
        });
    }, [firestore, sessionOrderIds]);

    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center animate-in fade-in duration-500">
                <div className="w-full max-w-md space-y-8 text-center">
                    <div className="space-y-2">
                        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
                            <Utensils className="h-10 w-10 text-primary" />
                        </div>
                        <h1 className="text-4xl font-black uppercase tracking-tight">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">¿Dónde se encuentra? Seleccione su mesa para ver el menú.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2 text-left">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                            <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-background">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {locationTypes.map(t => (
                                        <SelectItem key={t} value={t}>{ZONE_LABELS[t] || t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="h-[400px] border-2 rounded-3xl bg-muted/20 p-4">
                            <div className="grid grid-cols-2 gap-3 pb-10">
                                {filteredTables.map(table => {
                                    const Icon = ZONE_ICON[table.type] || MapPin;
                                    return (
                                        <button
                                            key={table.id}
                                            onClick={() => setSelectedTable(table)}
                                            className="group flex flex-col items-center justify-center p-6 bg-background border-2 rounded-2xl transition-all hover:border-primary hover:shadow-xl active:scale-95"
                                        >
                                            <div className="p-3 bg-muted rounded-xl group-hover:bg-primary/10 transition-colors">
                                                <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                            </div>
                                            <span className="mt-3 font-black text-3xl tracking-tighter">{table.number}</span>
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{ZONE_LABELS[table.type] || table.type}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 flex flex-col max-w-md mx-auto relative shadow-2xl">
            {/* Header */}
            <div className="bg-background border-b px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <SmartphoneIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Mesa Seleccionada</p>
                        <p className="text-xl font-black text-primary tracking-tighter">{selectedTable.number}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedTable(null)} className="rounded-full">
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* Content Tabs */}
            <div className="flex-1 flex flex-col overflow-hidden pb-24">
                {activeTab === 'menu' && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-4 duration-300">
                        <div className="p-4 bg-background border-b space-y-4 shadow-sm">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar comida o bebida..." 
                                    className="pl-10 h-12 bg-muted/50 border-0 rounded-2xl text-base"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn(
                                            "h-9 px-5 rounded-full font-black text-[11px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-background border-2 text-muted-foreground"
                                        )}
                                        onClick={() => setSelectedCategoryId(null)}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn(
                                                "h-9 px-5 rounded-full font-black text-[11px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-background border-2 text-muted-foreground"
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
                            <div className="grid grid-cols-2 gap-4 p-4 pb-10">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="bg-background rounded-[2rem] overflow-hidden border-2 border-transparent hover:border-primary/20 shadow-sm flex flex-col">
                                        <div className="aspect-square relative overflow-hidden bg-muted group">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover transition-transform group-hover:scale-110 duration-500" />
                                                <AvatarFallback className="rounded-none">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-3 left-3 flex flex-col gap-1">
                                                <Badge className="bg-black/60 backdrop-blur-md text-white border-0 font-black text-[8px] uppercase tracking-widest px-2 h-5">
                                                    {service.category}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge className={cn(
                                                        "border-0 font-black text-[8px] uppercase tracking-widest px-2 h-5",
                                                        service.stock <= (service.minStock || 5) ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                                                    )}>
                                                        STOCK: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-end">
                                                <h3 className="font-black text-sm uppercase tracking-tight text-white leading-tight drop-shadow-md">{service.name}</h3>
                                                <p className="text-primary-foreground font-black text-lg mt-1">{formatCurrency(service.price)}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleAddToCart(service)}
                                                className="absolute bottom-3 right-3 w-10 h-10 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-transform"
                                            >
                                                <Plus className="h-6 w-6" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {activeTab === 'cart' && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-4 duration-300 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Mi Carrito</h2>
                            <Badge variant="outline" className="h-8 px-4 font-black bg-background border-2 rounded-xl text-primary">{cart.length} ITEMS</Badge>
                        </div>

                        <ScrollArea className="flex-1 -mx-2 pr-2">
                            {cart.length === 0 ? (
                                <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center opacity-20">
                                        <ShoppingCart className="h-12 w-12" />
                                    </div>
                                    <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">Tu carrito está vacío</p>
                                    <Button onClick={() => setActiveTab('menu')} variant="outline" className="rounded-2xl h-12 font-black text-xs uppercase tracking-widest border-2">Explorar Menú</Button>
                                </div>
                            ) : (
                                <div className="space-y-4 pb-10">
                                    {cart.map((item, idx) => (
                                        <div key={item.service.id} className="bg-background rounded-3xl p-4 border-2 shadow-sm relative group">
                                            <div className="flex gap-4">
                                                <Avatar className="h-20 w-20 rounded-2xl border-2">
                                                    <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                                    <AvatarFallback><ImageIcon className="h-8 w-8 text-muted-foreground/20" /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex justify-between items-start pr-8">
                                                        <h4 className="font-black text-sm uppercase tracking-tight truncate">{item.service.name}</h4>
                                                        <p className="font-black text-primary text-base">{formatCurrency(item.service.price * item.quantity)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center bg-muted/50 rounded-xl p-1 border">
                                                            <button onClick={() => handleRemoveOne(item.service.id)} className="w-8 h-8 flex items-center justify-center bg-background rounded-lg shadow-sm"><Minus className="h-3 w-3" /></button>
                                                            <span className="w-10 text-center font-black text-sm">{item.quantity}</span>
                                                            <button onClick={() => handleAddToCart(item.service)} className="w-8 h-8 flex items-center justify-center bg-background rounded-lg shadow-sm"><Plus className="h-3 w-3" /></button>
                                                        </div>
                                                        {item.service.source === 'Internal' && (
                                                            <button onClick={() => handleOpenNote(idx)} className="h-10 px-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-black text-[10px] uppercase flex items-center gap-2">
                                                                <MessageSquare className="h-3 w-3" /> {item.notes ? 'Editar Nota' : 'Añadir Nota'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Botón Eliminar Evidente */}
                                            <button 
                                                onClick={() => handleRemoveAll(item.service.id)}
                                                className="absolute top-4 right-4 w-8 h-8 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            {item.notes && (
                                                <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-dashed border-primary/20 text-xs italic text-primary">
                                                    "{item.notes}"
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {cart.length > 0 && (
                            <Card className="border-0 shadow-2xl overflow-hidden rounded-3xl mt-4">
                                <CardContent className="p-6 bg-primary text-primary-foreground">
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs font-bold uppercase opacity-70">
                                            <span>Subtotal</span>
                                            <span>{formatCurrency(subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold uppercase opacity-70">
                                            <span>Impuestos</span>
                                            <span>{formatCurrency(totalTax)}</span>
                                        </div>
                                        <Separator className="bg-white/20" />
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-sm font-black uppercase tracking-widest">Total Pedido</span>
                                            <span className="text-3xl font-black tracking-tighter">{formatCurrency(grandTotal)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-0">
                                    <Button 
                                        disabled={isPending}
                                        onClick={handleSendOrder}
                                        className="w-full h-16 rounded-none bg-background text-primary hover:bg-muted text-base font-black uppercase tracking-widest border-t-4 border-primary"
                                    >
                                        {isPending ? 'Enviando...' : 'Confirmar y Pedir'}
                                        <ChevronRight className="ml-2 h-5 w-5" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-4 duration-300 p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-3xl font-black uppercase tracking-tighter">Mi Cuenta</h2>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Resumen de consumo actual</p>
                            </div>
                            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-xl">
                                <CreditCard className="h-7 w-7" />
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="space-y-6 pb-10">
                                <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                    <div className="bg-primary p-8 text-primary-foreground relative">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                        <div className="relative z-10 flex justify-between items-center">
                                            <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Total Acumulado</span>
                                            <Badge variant="outline" className="border-white/30 text-white font-black text-[10px] px-4 py-1.5 rounded-full pointer-events-none">
                                                {myOrders.length} PEDIDOS
                                            </Badge>
                                        </div>
                                        <p className="text-5xl font-black tracking-tighter mt-4 relative z-10">
                                            {formatCurrency(myOrders.reduce((sum, o) => sum + o.total, 0))}
                                        </p>
                                    </div>
                                    <CardContent className="p-8 pt-10 space-y-8">
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                                                <Clock className="h-3 w-3" /> Historial de Sesión
                                            </h4>
                                            {myOrders.length === 0 ? (
                                                <div className="text-center py-10 border-2 border-dashed rounded-3xl opacity-40">
                                                    <p className="text-xs font-bold uppercase tracking-widest">Sin consumos registrados</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {myOrders.map(order => (
                                                        <div key={order.id} className="space-y-3 p-4 bg-muted/30 rounded-3xl border-2 border-transparent hover:border-primary/10 transition-all">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-[10px] font-black text-muted-foreground">
                                                                    {formatDistance(order.createdAt.toDate(), now, { locale: es, addSuffix: true })}
                                                                </span>
                                                                <Badge className={cn(
                                                                    "pointer-events-none uppercase text-[9px] font-black px-3 h-5 rounded-full",
                                                                    order.status === 'Pendiente' ? "bg-orange-500 text-white" : "bg-emerald-500 text-white"
                                                                )}>
                                                                    {order.status}
                                                                </Badge>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {order.items.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between text-xs font-bold">
                                                                        <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                                                                        <span>{formatCurrency(item.price * item.quantity)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <Separator className="opacity-50" />
                                                            <div className="flex justify-between items-center font-black text-sm">
                                                                <span className="uppercase tracking-widest text-[10px]">Total Pedido</span>
                                                                <span className="text-primary">{formatCurrency(order.total)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-6 bg-amber-50 dark:bg-amber-950/20 rounded-[2rem] border-2 border-amber-200 dark:border-amber-800/50 flex gap-4 items-center">
                                            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900 rounded-2xl flex items-center justify-center shrink-0">
                                                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <p className="text-sm font-medium text-amber-700 dark:text-amber-300 leading-tight">
                                                Para solicitar el cobro, por favor comunícate con la recepción o un salonero.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>

            {/* Bottom Navigation */}
            <div className="bg-background border-t px-6 h-20 flex items-center justify-between fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-all",
                        activeTab === 'menu' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <Utensils className="h-6 w-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Menú</span>
                </button>
                
                <button 
                    onClick={() => setActiveTab('cart')}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-all relative",
                        activeTab === 'cart' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <ShoppingCart className="h-6 w-6" />
                    {cart.length > 0 && (
                        <span className="absolute -top-2 -right-3 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center rounded-full ring-4 ring-background animate-in zoom-in duration-300">
                            {cart.length}
                        </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest">Carrito</span>
                </button>

                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-all",
                        activeTab === 'account' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <Wallet className="h-6 w-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </div>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] p-8 border-0">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">Instrucciones</DialogTitle>
                        <DialogDescription className="font-medium">¿Cómo desea que preparemos su pedido?</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="p-4 bg-primary/5 rounded-3xl border-2 border-primary/10 flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl"><Utensils className="h-5 w-5 text-primary" /></div>
                            <span className="font-black text-sm uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Notas especiales</Label>
                            <Textarea 
                                placeholder="Ej: Término medio, sin cebolla, mucha salsa..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] rounded-3xl border-2 bg-muted/20 focus:bg-background transition-all resize-none text-base font-bold p-4"
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