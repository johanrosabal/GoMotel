'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot } from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    ChevronRight, ImageIcon, Utensils, Beer, Clock, CheckCircle, X, Sun, MapPin, 
    MessageSquare, Trash2, ReceiptText, User, LayoutGrid
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

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
    const [now, setNow] = useState(new Date());
    
    // UI State
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [zoneFilter, setZoneFilter] = useState<string>('all');
    
    // Order State
    const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
    const [orderFromFirestore, setOrderFromFirestore] = useState<Order | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);

    // Dialogs
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // --- LOGICA DE PERSISTENCIA DE SESIÓN ---
    // Al seleccionar una mesa, buscamos si este dispositivo ya tiene una cuenta abierta ahí.
    useEffect(() => {
        if (selectedTable && typeof window !== 'undefined') {
            const savedOrderId = localStorage.getItem(`active_order_${selectedTable.id}`);
            if (savedOrderId) {
                setCurrentOrderId(savedOrderId);
            }
        } else {
            setCurrentOrderId(null);
            setOrderFromFirestore(null);
        }
    }, [selectedTable]);

    // Escuchar la orden activa en Firestore
    useEffect(() => {
        if (!firestore || !currentOrderId) return;

        const unsubscribe = onSnapshot(doc(firestore, 'orders', currentOrderId), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as Order;
                // Si la orden ya no está pendiente (fue pagada o cancelada), limpiamos la sesión
                if (data.status !== 'Pendiente') {
                    if (selectedTable) localStorage.removeItem(`active_order_${selectedTable.id}`);
                    setCurrentOrderId(null);
                    setOrderFromFirestore(null);
                } else {
                    setOrderFromFirestore({ id: snapshot.id, ...data });
                }
            } else {
                // Si el documento ya no existe
                if (selectedTable) localStorage.removeItem(`active_order_${selectedTable.id}`);
                setCurrentOrderId(null);
                setOrderFromFirestore(null);
            }
        });

        return () => unsubscribe();
    }, [firestore, currentOrderId, selectedTable]);

    // Data Fetching
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

    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), orderBy('number')) : null, 
        [firestore]
    );
    const { data: allTables } = useCollection<RestaurantTable>(tablesQuery);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        let filtered = allTables;
        if (zoneFilter !== 'all') {
            filtered = allTables.filter(t => t.type === zoneFilter);
        }
        return filtered.sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [allTables, zoneFilter]);

    const locationTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type)));
    }, [allTables]);

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

    // Cart Actions
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
        toast({ title: "Añadido", description: `${service.name} al carrito.`, duration: 1500 });
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
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (currentOrderId) {
                result = await addToTableAccount(currentOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Cuenta ${selectedTable.number}`, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Pedido enviado!', description: 'Estamos preparando sus productos.' });
                if (result.orderId) {
                    localStorage.setItem(`active_order_${selectedTable.id}`, result.orderId);
                    setCurrentOrderId(result.orderId);
                }
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.service.price * i.quantity, 0), [cart]);

    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-muted/30 p-4 flex flex-col items-center justify-center">
                <div className="w-full max-w-md space-y-8 text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="space-y-2">
                        <h1 className="text-6xl font-black uppercase tracking-tighter text-primary drop-shadow-[0_10px_10px_rgba(0,0,0,0.1)]">
                            ¡Bienvenido!
                        </h1>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Seleccione su ubicación para comenzar</p>
                    </div>

                    <div className="bg-background p-6 rounded-[2rem] shadow-2xl border-2 space-y-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 text-left block">Filtrar por Zona</Label>
                            <Select value={zoneFilter} onValueChange={setZoneFilter}>
                                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-lg bg-muted/20">
                                    <SelectValue placeholder="Todas las zonas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las zonas</SelectItem>
                                    {locationTypes.map(type => (
                                        <SelectItem key={type} value={type}>{TYPE_LABELS[type] || type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="h-[400px] pr-4">
                            <div className="grid grid-cols-2 gap-3">
                                {filteredTables.map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTable(table)}
                                        className={cn(
                                            "h-24 rounded-2xl border-2 flex flex-col items-center justify-center transition-all active:scale-95",
                                            table.status === 'Occupied' 
                                                ? "bg-primary/5 border-primary/20 text-primary" 
                                                : "bg-background border-border hover:border-primary/40"
                                        )}
                                    >
                                        <span className="text-3xl font-black">{table.number}</span>
                                        <span className="text-[10px] font-black uppercase opacity-60">{TYPE_LABELS[table.type] || table.type}</span>
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
        <div className="flex flex-col h-screen w-full overflow-hidden bg-muted/20">
            {/* Header Fijo */}
            <div className="bg-background border-b px-6 py-4 flex items-center justify-between shadow-sm z-20 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedTable(null)} className="h-10 w-10 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter leading-none">{TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}</h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase text-muted-foreground">Sesión Activa</span>
                        </div>
                    </div>
                </div>
                {orderFromFirestore && (
                    <Badge className="bg-primary text-primary-foreground font-black px-3 py-1 rounded-full text-[10px] shadow-lg">
                        CUENTA: {formatCurrency(orderFromFirestore.total)}
                    </Badge>
                )}
            </div>

            {/* Contenido Principal */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'menu' && (
                    <div className="flex flex-col h-full animate-in fade-in duration-300">
                        <div className="p-4 border-b bg-background/50 backdrop-blur-md space-y-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar..." 
                                    className="pl-9 h-12 bg-background border-2 rounded-2xl font-medium"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap pb-2">
                                <div className="flex gap-2">
                                    <button 
                                        className={cn(
                                            "px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                            !selectedCategoryId ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                                        )}
                                        onClick={() => { setSelectedCategoryId(null); setSelectedSubCategoryId(null); }}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn(
                                                "px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                                            )}
                                            onClick={() => { setSelectedCategoryId(cat.id); setSelectedSubCategoryId(null); }}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" className="hidden" />
                            </ScrollArea>
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            <div className="grid grid-cols-2 gap-4 pb-24">
                                {filteredServices.map(service => (
                                    <div 
                                        key={service.id}
                                        className="group flex flex-col bg-card border rounded-[2rem] overflow-hidden shadow-sm active:scale-95 transition-all duration-300 relative"
                                    >
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            
                                            {/* Top Badges */}
                                            <div className="absolute top-3 inset-x-3 flex justify-between items-start z-10">
                                                <Badge className="bg-black/60 text-white border-0 backdrop-blur-md text-[8px] font-black uppercase px-2 py-0.5 rounded-lg">
                                                    {service.category === 'Beverage' ? 'Bebida' : service.category === 'Food' ? 'Comida' : 'Amenidad'}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge className={cn(
                                                        "border-0 backdrop-blur-md text-[8px] font-black uppercase px-2 py-0.5 rounded-lg",
                                                        (service.stock || 0) <= (service.minStock || 0) ? "bg-red-500/80 text-white" : "bg-emerald-500/80 text-white"
                                                    )}>
                                                        STOCK: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Bottom Info Overlay */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-10 z-10">
                                                <h3 className="font-black text-[13px] uppercase tracking-tight text-white leading-none mb-1">{service.name}</h3>
                                                <p className="text-primary font-black text-sm drop-shadow-sm">{formatCurrency(service.price)}</p>
                                            </div>

                                            {/* Add Button */}
                                            <button 
                                                onClick={() => handleAddToCart(service)}
                                                className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-90 transition-transform z-20 border-2 border-white/20"
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
                    <div className="flex flex-col h-full p-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                <ShoppingCart className="h-6 w-6" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Tu Pedido</h2>
                        </div>

                        <ScrollArea className="flex-1 -mx-2 px-2">
                            {cart.length === 0 ? (
                                <div className="text-center py-20 opacity-30 flex flex-col items-center">
                                    <ShoppingCart className="h-20 w-20 mb-4" />
                                    <p className="font-black uppercase tracking-widest text-xs">Carrito Vacío</p>
                                </div>
                            ) : (
                                <div className="space-y-4 pb-10">
                                    {cart.map((item, idx) => (
                                        <div key={item.service.id} className="flex flex-col p-4 rounded-3xl border-2 bg-card shadow-sm gap-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-sm uppercase truncate leading-none mb-1">{item.service.name}</p>
                                                    <p className="text-xs font-bold text-primary">{formatCurrency(item.service.price)}</p>
                                                </div>
                                                <div className="flex items-center gap-3 bg-muted/50 rounded-full p-1 border shadow-inner">
                                                    <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-8 w-8 rounded-full bg-background flex items-center justify-center shadow-sm active:bg-primary/10">
                                                        <Minus className="h-3.5 w-3.5" />
                                                    </button>
                                                    <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                                                    <button onClick={() => handleAddToCart(item.service)} className="h-8 w-8 rounded-full bg-background flex items-center justify-center shadow-sm active:bg-primary/10">
                                                        <Plus className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-dashed">
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleOpenNoteDialog(idx)} className="h-9 px-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-primary/5 transition-colors">
                                                        <MessageSquare className="h-3 w-3" /> {item.notes ? "Editar Nota" : "Añadir Nota"}
                                                    </button>
                                                    <button onClick={() => setCart(prev => prev.filter(i => i.service.id !== item.service.id))} className="h-9 w-9 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <p className="font-black text-lg tracking-tighter">{formatCurrency(item.service.price * item.quantity)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        <div className="mt-auto space-y-4 pt-6 bg-muted/20 -mx-6 px-6 border-t-2 border-dashed">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Carrito</span>
                                <span className="text-4xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</span>
                            </div>
                            <Button 
                                className="w-full h-16 rounded-[1.5rem] font-black text-lg uppercase tracking-widest shadow-xl shadow-primary/20"
                                disabled={cart.length === 0 || isPending}
                                onClick={handleSendOrder}
                            >
                                {isPending ? "ENVIANDO..." : "ENVIAR PEDIDO"}
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="flex flex-col h-full p-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                <ReceiptText className="h-6 w-6" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tighter">Mi Cuenta</h2>
                        </div>

                        <ScrollArea className="flex-1">
                            {!orderFromFirestore ? (
                                <div className="text-center py-20 opacity-30 flex flex-col items-center">
                                    <Clock className="h-20 w-20 mb-4" />
                                    <p className="font-black uppercase tracking-widest text-xs">No hay consumos registrados</p>
                                </div>
                            ) : (
                                <div className="space-y-6 pb-10">
                                    <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-card">
                                        <div className="bg-primary p-8 text-primary-foreground relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="relative z-10 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Estado de Cuenta</p>
                                                    <h3 className="text-4xl font-black tracking-tighter mt-1">{formatCurrency(orderFromFirestore.total)}</h3>
                                                </div>
                                                <Badge className="bg-white/20 border-0 text-white font-black uppercase px-4 py-1.5 rounded-full text-[10px]">
                                                    Pendiente
                                                </Badge>
                                            </div>
                                        </div>
                                        <CardContent className="p-8 space-y-6">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <LayoutGrid className="h-4 w-4 text-primary" />
                                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Productos Consumidos</h4>
                                                </div>
                                                {orderFromFirestore.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center group">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-xs uppercase truncate leading-none mb-1">{item.name}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground">{item.quantity} x {formatCurrency(item.price)}</p>
                                                        </div>
                                                        <p className="font-black text-sm tracking-tighter text-foreground/80">{formatCurrency(item.price * item.quantity)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <Separator className="bg-muted/50" />
                                            
                                            <div className="p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/20 text-center space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Solicitar Pago</p>
                                                <p className="text-sm font-bold text-amber-700/90 dark:text-amber-300 leading-tight">
                                                    Para realizar el cobro, por favor comuníquese con el personal de servicio.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                )}
            </div>

            {/* Navbar Inferior */}
            <div className="h-24 bg-background border-t px-6 flex items-center justify-around z-30 shrink-0 pb-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] rounded-t-[2.5rem]">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-all duration-300",
                        activeTab === 'menu' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <div className={cn("p-2.5 rounded-2xl transition-all", activeTab === 'menu' && "bg-primary/10 shadow-inner")}>
                        <LayoutGrid className="h-6 w-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Menú</span>
                </button>

                <button 
                    onClick={() => setActiveTab('cart')}
                    className={cn(
                        "flex flex-col items-center gap-1 relative transition-all duration-300",
                        activeTab === 'cart' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <div className={cn("p-2.5 rounded-2xl transition-all", activeTab === 'cart' && "bg-primary/10 shadow-inner")}>
                        <ShoppingCart className="h-6 w-6" />
                    </div>
                    {cart.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black h-5 w-5 flex items-center justify-center rounded-full shadow-lg animate-bounce border-2 border-background">
                            {cart.length}
                        </span>
                    )}
                    <span className="text-[9px] font-black uppercase tracking-widest">Carrito</span>
                </button>

                <button 
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-all duration-300",
                        activeTab === 'account' ? "text-primary scale-110" : "text-muted-foreground opacity-50"
                    )}
                >
                    <div className={cn("p-2.5 rounded-2xl transition-all", activeTab === 'account' && "bg-primary/10 shadow-inner")}>
                        <ReceiptText className="h-6 w-6" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Cuenta</span>
                </button>
            </div>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Instrucciones</DialogTitle>
                        <DialogDescription className="font-bold text-xs uppercase tracking-widest opacity-60">
                            Añada indicaciones especiales para la cocina.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-3xl border-2 border-primary/10 flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary"><Utensils className="h-5 w-5" /></div>
                            <span className="font-black text-sm uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Su Nota Especial</Label>
                            <Textarea 
                                placeholder="Ej: Sin cebolla, término medio, etc..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[140px] rounded-3xl border-2 resize-none text-sm font-bold p-4 focus:ring-primary/20"
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