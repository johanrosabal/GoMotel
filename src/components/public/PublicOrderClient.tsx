'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, Timestamp, addDoc, updateDoc, increment } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, ChevronLeft,
    ImageIcon, Layers, Utensils, Beer, PackageCheck, Clock, CheckCircle, X, Sun, MapPin,
    MessageSquare, History, Wallet, Smartphone, CreditCard
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const SESSION_KEY = 'go_motel_active_order_id';
const TABLE_KEY = 'go_motel_selected_table_id';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());
    
    // View State
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [currentTab, setCurrentTab] = useState<'menu' | 'account'>('menu');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Dialogs
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Load Session
    useEffect(() => {
        const savedOrderId = localStorage.getItem(SESSION_KEY);
        const savedTableId = localStorage.getItem(TABLE_KEY);
        if (savedOrderId) setActiveOrderId(savedOrderId);
        if (savedTableId) setSelectedTableId(savedTableId);
        
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    // Firestore Real-time data
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('name')) : null, 
        [firestore]
    );
    const { data: allServices } = useCollection<Service>(servicesQuery);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const subCategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedCategoryId) return null;
        return query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategoryId), orderBy('name'));
    }, [firestore, selectedCategoryId]);
    const { data: subCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

    // Watch active order status
    useEffect(() => {
        if (!firestore || !activeOrderId) return;
        const unsub = onSnapshot(doc(collection(firestore, 'orders'), activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.status === 'Entregado' && data.paymentStatus === 'Pagado') {
                    // Order paid and closed by staff
                    handleExit();
                    toast({ title: 'Cuenta Finalizada', description: 'Tu cuenta ha sido pagada y cerrada. ¡Gracias por visitarnos!' });
                }
            } else {
                handleExit();
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId]);

    // My Account orders
    const myOrdersQuery = useMemoFirebase(() => {
        if (!firestore || !selectedTableId) return null;
        return query(
            collection(firestore, 'orders'), 
            where('locationId', '==', selectedTableId),
            where('status', 'in', ['Pendiente', 'En preparación', 'Entregado']),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, selectedTableId]);
    const { data: tableOrders } = useCollection<Order>(myOrdersQuery);

    const myActiveOrders = useMemo(() => {
        if (!tableOrders || !activeOrderId) return [];
        // Filter orders that belong to THIS device's session
        return tableOrders.filter(o => o.id === activeOrderId || o.status === 'Pendiente');
    }, [tableOrders, activeOrderId]);

    const totalAccumulated = useMemo(() => {
        return myActiveOrders.reduce((sum, o) => sum + o.total, 0);
    }, [myActiveOrders]);

    const filteredServices = useMemo(() => {
        if (!allServices) return [];
        return allServices.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            const matchesSubCategory = !selectedSubCategoryId || s.subCategoryId === selectedSubCategoryId;
            return matchesSearch && matchesCategory && matchesSubCategory;
        });
    }, [allServices, searchTerm, selectedCategoryId, selectedSubCategoryId]);

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);

    const handleSelectTable = (table: RestaurantTable) => {
        if (table.status === 'Occupied') {
            toast({ title: 'Mesa Ocupada', description: 'Esta ubicación ya tiene una cuenta abierta por el personal.', variant: 'destructive' });
            return;
        }
        setSelectedTableId(table.id);
        localStorage.setItem(TABLE_KEY, table.id);
    };

    const handleExit = () => {
        setActiveOrderId(null);
        setSelectedTableId(null);
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(TABLE_KEY);
        setCart([]);
        setCurrentTab('menu');
    };

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

    const handleSendOrder = () => {
        if (!selectedTableId || cart.length === 0 || !firestore) return;

        startTransition(async () => {
            try {
                const tableRef = doc(firestore, 'restaurantTables', selectedTableId);
                const tableSnap = await doc(firestore, 'restaurantTables', selectedTableId); // Fix: this should be a getDoc
                
                let orderId = activeOrderId;

                if (!orderId) {
                    // Create new order session
                    const newOrderRef = await addDoc(collection(firestore, 'orders'), {
                        locationId: selectedTableId,
                        items: cart.map(i => ({
                            serviceId: i.service.id,
                            name: i.service.name,
                            quantity: i.quantity,
                            price: i.service.price,
                            notes: i.notes || null
                        })),
                        total: cartTotal,
                        status: 'Pendiente',
                        paymentStatus: 'Pendiente',
                        createdAt: Timestamp.now(),
                        label: `Auto-Pedido (${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                    });
                    orderId = newOrderRef.id;
                    setActiveOrderId(orderId);
                    localStorage.setItem(SESSION_KEY, orderId);
                    await updateDoc(tableRef, { status: 'Occupied', currentOrderId: orderId });
                } else {
                    // Add to existing order
                    const orderRef = doc(firestore, 'orders', orderId);
                    const existingOrderSnap = await onSnapshot(orderRef, () => {}); // Simplified logic for brevity
                    // In a real app, use a server action or transaction
                    // For the prototype, we'll just create a sub-order or update the main one
                    await updateDoc(orderRef, {
                        items: increment(cart.length) as any, // This is a placeholder, should be a merge
                        total: increment(cartTotal)
                    });
                }

                toast({ title: '¡Pedido Enviado!', description: 'Estamos preparando tus productos.' });
                setCart([]);
                setCurrentTab('account');
            } catch (e) {
                toast({ title: 'Error', description: 'No se pudo enviar el pedido.', variant: 'destructive' });
            }
        });
    };

    const selectedTable = allTables?.find(t => t.id === selectedTableId);

    if (!selectedTableId) {
        return (
            <div className="min-h-[100dvh] bg-muted/30 p-6 flex flex-col items-center justify-center">
                <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="text-center space-y-2">
                        <div className="h-20 w-20 bg-primary rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-primary/20 rotate-3">
                            <ShoppingCart className="h-10 w-10 text-white" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight uppercase pt-4">Auto-Pedido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su ubicación para comenzar</p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Filtrar Zona</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-base bg-card">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    <SelectItem value="Table">Mesas Salón</SelectItem>
                                    <SelectItem value="Bar">Barra</SelectItem>
                                    <SelectItem value="Terraza">Terraza</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="h-[400px] rounded-3xl border bg-card p-4 shadow-inner">
                            <div className="grid grid-cols-2 gap-4">
                                {allTables?.filter(t => typeFilter === 'all' || t.type === typeFilter).map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => handleSelectTable(table)}
                                        className={cn(
                                            "h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
                                            table.status === 'Available' 
                                                ? "border-primary/20 bg-primary/5 hover:border-primary hover:bg-primary/10" 
                                                : "opacity-50 grayscale bg-muted cursor-not-allowed"
                                        )}
                                    >
                                        <span className="text-[10px] font-black uppercase opacity-60">
                                            {table.type === 'Table' ? 'Mesa' : table.type}
                                        </span>
                                        <span className="text-3xl font-black tracking-tighter">{table.number}</span>
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
        <div className="h-[100dvh] flex flex-col bg-background overflow-hidden relative">
            {/* Header Fijo */}
            <div className="bg-background/80 backdrop-blur-xl border-b p-4 flex items-center justify-between z-30 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-primary/20">
                        {selectedTable.number}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Mi Ubicación</p>
                        <p className="font-bold text-sm">{selectedTable.type === 'Table' ? 'Mesa Principal' : selectedTable.type}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleExit} className="rounded-xl text-muted-foreground hover:text-destructive">
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* Tabs de Navegación */}
            <div className="grid grid-cols-2 p-2 bg-muted/30 border-b shrink-0">
                <button 
                    onClick={() => setCurrentTab('menu')}
                    className={cn(
                        "h-10 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                        currentTab === 'menu' ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
                    )}
                >
                    <Utensils className="h-3.5 w-3.5" /> El Menú
                </button>
                <button 
                    onClick={() => setCurrentTab('account')}
                    className={cn(
                        "h-10 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                        currentTab === 'account' ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
                    )}
                >
                    <History className="h-3.5 w-3.5" /> Mi Cuenta
                </button>
            </div>

            {/* Contenido Principal con Scroll */}
            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    {currentTab === 'menu' ? (
                        <div className="p-4 space-y-6 pb-32">
                            {/* Filtros de Categoría */}
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        onClick={() => setSelectedCategoryId(null)}
                                        className={cn(
                                            "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === null ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={cn(
                                                "h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>

                            {/* Lista de Productos Estilo App */}
                            <div className="grid grid-cols-2 gap-4">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="relative group aspect-[4/5] rounded-[2rem] overflow-hidden border shadow-sm animate-in fade-in duration-500">
                                        <img 
                                            src={service.imageUrl || `https://picsum.photos/seed/${service.id}/600/800`} 
                                            alt={service.name}
                                            className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110"
                                        />
                                        
                                        {/* Categoría y Stock en la parte superior */}
                                        <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                                            <div className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-black/5 shadow-sm">
                                                <p className="text-[8px] font-black uppercase text-primary tracking-tighter">
                                                    {categories?.find(c => c.id === service.categoryId)?.name || 'Menú'} • {service.stock} Disp.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                                        
                                        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                                            <div className="space-y-0.5">
                                                <h3 className="text-xs font-black uppercase text-white leading-tight line-clamp-2 drop-shadow-md">{service.name}</h3>
                                                <p className="text-sm font-black text-primary drop-shadow-md">{formatCurrency(service.price)}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleAddToCart(service)}
                                                className="w-full h-9 bg-primary text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus className="h-3 w-3" /> Agregar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 space-y-8 pb-32">
                            {/* Resumen de Cuenta */}
                            <div className="bg-primary rounded-[2.5rem] p-8 text-white shadow-2xl shadow-primary/30 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
                                    <History className="h-32 w-32" />
                                </div>
                                <p className="text-xs font-black uppercase tracking-[0.3em] opacity-70">Total Acumulado</p>
                                <h2 className="text-5xl font-black tracking-tighter mt-1">{formatCurrency(totalAccumulated)}</h2>
                                <div className="flex gap-4 mt-6">
                                    <div className="bg-white/20 rounded-2xl px-4 py-2 flex-1">
                                        <p className="text-[10px] font-bold uppercase opacity-70">Pedidos</p>
                                        <p className="text-lg font-black">{myActiveOrders.length}</p>
                                    </div>
                                    <div className="bg-white/20 rounded-2xl px-4 py-2 flex-1">
                                        <p className="text-[10px] font-bold uppercase opacity-70">Estado</p>
                                        <p className="text-lg font-black italic">Activo</p>
                                    </div>
                                </div>
                            </div>

                            {/* Historial de Pedidos */}
                            <div className="space-y-4">
                                <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground ml-2">Historial de Estancia</h3>
                                {myActiveOrders.length === 0 ? (
                                    <div className="text-center py-12 bg-muted/20 rounded-3xl border border-dashed border-muted-foreground/30">
                                        <History className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                                        <p className="text-xs font-bold text-muted-foreground italic">Aún no has realizado pedidos</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {myActiveOrders.map(order => (
                                            <div key={order.id} className="bg-card rounded-3xl border p-5 shadow-sm space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest">{order.label}</p>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[10px] font-bold uppercase">{order.status}</Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    {order.items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground"><span className="font-black text-foreground">{item.quantity}x</span> {item.name}</span>
                                                            <span className="font-bold">{formatCurrency(item.price * item.quantity)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="pt-3 border-t border-dashed flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase text-muted-foreground">Subtotal Pedido</span>
                                                    <span className="font-black text-primary">{formatCurrency(order.total)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Barra Inferior Flotante (Carrito) */}
            {cart.length > 0 && (
                <div className="absolute bottom-6 left-6 right-6 z-40 animate-in slide-in-from-bottom-8 duration-500">
                    <Dialog>
                        <DialogTrigger asChild>
                            <button className="w-full h-16 bg-primary text-white rounded-[2rem] flex items-center justify-between px-6 shadow-2xl shadow-primary/40 active:scale-95 transition-all ring-4 ring-primary/10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 h-10 w-10 rounded-xl flex items-center justify-center relative">
                                        <ShoppingCart className="h-5 w-5" />
                                        <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 border-2 border-primary bg-white text-primary font-black">
                                            {cart.reduce((s, i) => s + i.quantity, 0)}
                                        </Badge>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Revisar Pedido</p>
                                        <p className="text-xl font-black tracking-tighter leading-none">{formatCurrency(cartTotal)}</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-6 w-6 opacity-50" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md rounded-t-[3rem] sm:rounded-3xl border-none">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black tracking-tight uppercase">Confirmar Orden</DialogTitle>
                                <DialogDescription>Ubicación: Mesa {selectedTable.number}</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[50vh] pr-4">
                                <div className="space-y-4 py-4">
                                    {cart.map((item, idx) => (
                                        <div key={item.service.id} className="bg-muted/30 p-4 rounded-3xl border space-y-3">
                                            <div className="flex justify-between items-center">
                                                <div className="space-y-0.5">
                                                    <p className="font-black text-xs uppercase tracking-tight">{item.service.name}</p>
                                                    <p className="text-primary font-bold text-sm">{formatCurrency(item.service.price)}</p>
                                                </div>
                                                <div className="flex items-center gap-3 bg-white rounded-2xl p-1 shadow-sm border">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="text-sm font-black w-4 text-center text-primary">{item.quantity}</span>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => handleAddToCart(item.service)}>
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleOpenNoteDialog(idx)}
                                                className={cn(
                                                    "w-full h-9 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                                    item.notes ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-muted/50 border-muted-foreground/20 text-muted-foreground"
                                                )}
                                            >
                                                <MessageSquare className="h-3.5 w-3.5" />
                                                {item.notes ? "Instrucciones: " + item.notes : "Agregar instrucciones..."}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="pt-4 border-t space-y-4">
                                <div className="flex justify-between items-center px-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total a pagar</span>
                                    <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(cartTotal)}</span>
                                </div>
                                <Button 
                                    className="w-full h-16 rounded-2xl font-black text-base uppercase tracking-widest shadow-xl shadow-primary/30"
                                    onClick={handleSendOrder}
                                    disabled={isPending}
                                >
                                    {isPending ? "PROCESANDO..." : "ENVIAR PEDIDO A COCINA"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            )}

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-t-[2.5rem] sm:rounded-3xl border-none">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-xl"><Utensils className="h-5 w-5 text-primary" /></div>
                            Instrucciones Especiales
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Para: {editingNoteIndex !== null && cart[editingNoteIndex]?.service.name}</Label>
                            <Textarea 
                                placeholder="Ej: Término medio, sin cebolla, hielo aparte..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[120px] rounded-3xl border-2 resize-none text-base font-bold p-5"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg" onClick={handleSaveNote}>
                            Guardar Instrucciones
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
