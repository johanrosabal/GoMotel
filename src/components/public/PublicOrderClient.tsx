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
    ChevronRight, ChevronLeft,
    ImageIcon, Utensils, Beer, Clock, CheckCircle, X, Sun, MapPin,
    Trash2, MessageSquare, ListFilter, Receipt, History
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const TYPE_LABELS: Record<string, string> = {
    'Table': 'Mesa',
    'Bar': 'Barra',
    'Terraza': 'Terraza'
};

const PREP_STATUS_MAP: Record<string, { label: string, color: string }> = {
    'Pendiente': { label: 'En Cola', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    'En preparación': { label: 'Cocinando', color: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' },
    'Entregado': { label: 'Listo', color: 'bg-green-100 text-green-700 border-green-200' },
    'Cancelado': { label: 'Cancelado', color: 'bg-red-100 text-red-700 border-red-200' }
};

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [view, setView] = useState<'welcome' | 'select-table' | 'catalog'>('welcome');
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    
    // Filtros Catálogo
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    
    // Carrito y UI
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [tab, setTab] = useState<'menu' | 'account'>('menu');
    
    // Notas de Cocina
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Cargar Servicios
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    useEffect(() => {
        getServices().then(setAvailableServices);
    }, []);

    // Consultas Firebase
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

    // Persistencia de Sesión: Cargar OrderID al seleccionar mesa
    useEffect(() => {
        if (selectedTable) {
            const savedOrderId = localStorage.getItem(`gomotel_order_${selectedTable.id}`);
            if (savedOrderId) {
                setActiveOrderId(savedOrderId);
            } else {
                setActiveOrderId(null);
                setActiveOrder(null);
            }
        }
    }, [selectedTable]);

    // Escuchar Orden Activa en tiempo real
    useEffect(() => {
        if (activeOrderId && firestore) {
            const unsubscribe = onSnapshot(doc(firestore, 'orders', activeOrderId), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as Order;
                    // Si ya se pagó, limpiar sesión
                    if (data.paymentStatus === 'Pagado') {
                        localStorage.removeItem(`gomotel_order_${selectedTable?.id}`);
                        setActiveOrderId(null);
                        setActiveOrder(null);
                    } else {
                        setActiveOrder({ id: docSnap.id, ...data });
                    }
                } else {
                    localStorage.removeItem(`gomotel_order_${selectedTable?.id}`);
                    setActiveOrderId(null);
                    setActiveOrder(null);
                }
            });
            return () => unsubscribe();
        }
    }, [activeOrderId, firestore, selectedTable]);

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

    const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0), [cart]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
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

    const handleClearItem = (serviceId: string) => {
        setCart(prev => prev.filter(i => i.service.id !== serviceId));
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
            if (activeOrderId) {
                // Ya tiene una cuenta, añadir a la existente
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                // Abrir cuenta nueva
                result = await openTableAccount(selectedTable.id, cart, `Cliente Móvil`, 'Public');
            }

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    localStorage.setItem(`gomotel_order_${selectedTable.id}`, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                toast({ title: '¡Pedido Enviado!', description: 'Estamos preparando sus productos.' });
                setCart([]);
                setCartOpen(false);
                setTab('account');
            }
        });
    };

    const zoneTypes = useMemo(() => {
        if (!allTables) return [];
        return Array.from(new Set(allTables.map(t => t.type)));
    }, [allTables]);

    // VISTA: BIENVENIDA
    if (view === 'welcome') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-6 bg-background relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent -z-10" />
                <div className="text-center space-y-8 max-w-lg animate-in fade-in zoom-in duration-700">
                    <div className="space-y-2">
                        <h1 className="text-7xl sm:text-8xl font-black uppercase tracking-tighter leading-none drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)] bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
                            GO<br />MOTEL
                        </h1>
                        <p className="text-lg font-bold tracking-[0.3em] uppercase text-primary/80">Room Service & Bar</p>
                    </div>
                    <div className="bg-muted/30 p-6 rounded-3xl border-2 border-dashed border-primary/20 backdrop-blur-sm">
                        <p className="text-sm font-medium text-muted-foreground leading-relaxed italic">
                            "Disfrute de la mejor gastronomía y coctelería desde la comodidad de su habitación o mesa. Rapidez y privacidad garantizada."
                        </p>
                    </div>
                    <Button 
                        size="lg" 
                        onClick={() => setView('select-table')}
                        className="w-full h-20 text-xl font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary/30 active:scale-95 transition-all group"
                    >
                        Empezar Pedido <ChevronRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </div>
        );
    }

    // VISTA: SELECCIÓN DE MESA (Privada, sin mostrar ocupación)
    if (view === 'select-table') {
        return (
            <div className="flex flex-col h-full bg-background animate-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 border-b bg-muted/10">
                    <Button variant="ghost" onClick={() => setView('welcome')} className="mb-4 -ml-2 text-muted-foreground font-bold">
                        <ChevronLeft className="mr-1 h-4 w-4" /> Volver
                    </Button>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">¿Dónde se encuentra?</h2>
                    <p className="text-sm text-muted-foreground font-medium">Seleccione su número de mesa o habitación.</p>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {allTables?.sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => { setSelectedTable(table); setView('catalog'); }}
                                    className="h-28 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center group active:scale-95 shadow-sm"
                                >
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary transition-colors">
                                        {TYPE_LABELS[table.type] || table.type}
                                    </span>
                                    <span className="text-4xl font-black tracking-tighter text-foreground group-hover:text-primary transition-colors">{table.number}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </ScrollArea>
            </div>
        );
    }

    // VISTA: CATÁLOGO Y CUENTA
    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
            {/* Header Fijo */}
            <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b sticky top-0 z-30 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary text-primary-foreground rounded-xl shadow-lg">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Ubicación</p>
                        <p className="text-sm font-black uppercase tracking-tighter text-primary">
                            {TYPE_LABELS[selectedTable?.type || ''] || selectedTable?.type} {selectedTable?.number}
                        </p>
                    </div>
                </div>
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold gap-2">
                            <ListFilter className="h-4 w-4" /> Zonas
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
                        <DropdownMenuItem onClick={() => setView('select-table')} className="font-bold py-3 uppercase text-xs">
                            <History className="mr-2 h-4 w-4" /> Cambiar Mesa
                        </DropdownMenuItem>
                        <Separator className="my-1" />
                        {zoneTypes.map(type => (
                            <DropdownMenuItem key={type} onClick={() => {}} className="py-3 font-medium uppercase text-[10px] tracking-widest">
                                {getLocationLabel(type)}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Navegación por Pestañas */}
            <div className="flex border-b bg-muted/20 shrink-0">
                <button 
                    onClick={() => setTab('menu')}
                    className={cn(
                        "flex-1 h-14 flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest transition-all",
                        tab === 'menu' ? "bg-background border-b-4 border-primary text-primary" : "text-muted-foreground opacity-60"
                    )}
                >
                    <Utensils className="h-4 w-4" /> Menú
                </button>
                <button 
                    onClick={() => setTab('account')}
                    className={cn(
                        "flex-1 h-14 flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest transition-all",
                        tab === 'account' ? "bg-background border-b-4 border-primary text-primary" : "text-muted-foreground opacity-60"
                    )}
                >
                    <Receipt className="h-4 w-4" /> Mi Cuenta
                    {activeOrder && activeOrder.items.length > 0 && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                </button>
            </div>

            {/* Contenido Dinámico */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {tab === 'menu' ? (
                    <div className="flex flex-col h-full">
                        {/* Filtros de Categoría */}
                        <div className="p-4 border-b space-y-4 shrink-0 bg-muted/5">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar comida o bebida..." 
                                    className="pl-9 h-12 bg-background rounded-2xl border-2 transition-all focus:border-primary"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex gap-2 pb-2">
                                    <button 
                                        className={cn(
                                            "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                            selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                        )}
                                        onClick={() => { setSelectedCategoryId(null); setSelectedSubCategoryId(null); }}
                                    >
                                        Todos
                                    </button>
                                    {categories?.map(cat => (
                                        <button 
                                            key={cat.id}
                                            className={cn(
                                                "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all",
                                                selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            )}
                                            onClick={() => { setSelectedCategoryId(cat.id); setSelectedSubCategoryId(null); }}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>

                        {/* Listado de Productos */}
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 pb-24">
                                {filteredServices.map(service => (
                                    <button
                                        key={service.id}
                                        onClick={() => handleAddToCart(service)}
                                        className="group flex flex-col bg-card border rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 text-left active:scale-95"
                                    >
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                                <AvatarFallback className="rounded-none bg-transparent">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-2 right-2 z-10">
                                                <Badge className="font-black bg-background/90 text-primary border-primary/20 backdrop-blur-sm shadow-sm pointer-events-none">
                                                    {formatCurrency(service.price)}
                                                </Badge>
                                            </div>
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
                                                <h3 className="font-black text-[11px] uppercase tracking-tight text-white line-clamp-2 leading-tight">
                                                    {service.name}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "w-full py-2 px-2 text-center border-t",
                                            service.source === 'Internal' ? "bg-indigo-50/50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400" : "bg-emerald-50/50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                        )}>
                                            <span className="text-[9px] font-black uppercase tracking-widest">
                                                {service.source === 'Internal' ? 'Platillo de Cocina' : 'Producto de Bar'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 bg-muted/5">
                        <div className="p-6 max-w-lg mx-auto space-y-6">
                            {activeOrder ? (
                                <>
                                    <div className="flex flex-col items-center text-center space-y-2 py-4">
                                        <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                                            <Receipt className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter">Tu Consumo</h3>
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                            Estado de tu cuenta en tiempo real
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        {activeOrder.items.map((item, idx) => {
                                            // El estado del artículo depende de su categoría
                                            const statusKey = item.category === 'Food' ? activeOrder.kitchenStatus : activeOrder.barStatus;
                                            const status = PREP_STATUS_MAP[statusKey || 'Pendiente'] || PREP_STATUS_MAP['Pendiente'];
                                            
                                            return (
                                                <div key={idx} className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <p className="font-black text-sm uppercase tracking-tight">{item.name}</p>
                                                            <p className="text-xs text-muted-foreground font-bold">{item.quantity} x {formatCurrency(item.price)}</p>
                                                        </div>
                                                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-3 h-6 border-2", status.color)}>
                                                            {status.label}
                                                        </Badge>
                                                    </div>
                                                    {item.notes && (
                                                        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-[10px] text-amber-700 dark:text-amber-400 font-medium italic">
                                                            <MessageSquare className="h-3 w-3 shrink-0" />
                                                            "{item.notes}"
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="bg-primary p-6 rounded-3xl text-primary-foreground shadow-xl space-y-4">
                                        <div className="flex justify-between items-end border-b border-primary-foreground/20 pb-4">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Total acumulado</span>
                                            <span className="text-4xl font-black tracking-tighter leading-none">{formatCurrency(activeOrder.total)}</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white/20 rounded-xl"><Smartphone className="h-5 w-5" /></div>
                                            <p className="text-[11px] leading-relaxed font-bold opacity-90">
                                                Para pagar su cuenta, por favor solicítelo al personal o espere al momento del Check-out. Aceptamos efectivo, tarjeta y SINPE.
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center py-20 space-y-6 opacity-40">
                                    <History className="h-20 w-20" />
                                    <p className="text-xl font-black uppercase tracking-widest">Sin consumos registrados</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Barra Inferior del Carrito */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-background via-background to-transparent z-40">
                    <Button 
                        size="lg" 
                        onClick={() => setCartOpen(true)}
                        className="w-full h-16 rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-between px-6 font-black text-sm uppercase tracking-widest animate-in slide-in-from-bottom-full duration-500"
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <ShoppingCart className="h-6 w-6" />
                                <Badge className="absolute -top-3 -right-3 h-6 w-6 rounded-full flex items-center justify-center bg-white text-primary p-0 border-none font-black shadow-md">
                                    {cart.length}
                                </Badge>
                            </div>
                            <span>Ver Carrito</span>
                        </div>
                        <span className="text-lg tracking-tighter bg-white/20 px-4 py-1 rounded-xl backdrop-blur-sm">
                            {formatCurrency(cartTotal)}
                        </span>
                    </Button>
                </div>
            )}

            {/* Diálogo del Carrito */}
            <Dialog open={cartOpen} onOpenChange={setCartOpen}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-t-3xl sm:rounded-3xl border-none shadow-2xl">
                    <div className="bg-primary p-6 text-primary-foreground relative">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Mi Pedido</DialogTitle>
                        <DialogDescription className="text-primary-foreground/70 font-medium uppercase text-[10px] tracking-widest">
                            Confirmación de artículos para {TYPE_LABELS[selectedTable?.type || ''] || selectedTable?.type} {selectedTable?.number}
                        </DialogDescription>
                        <div className="absolute top-6 right-6">
                            <ShoppingCart className="h-8 w-8 opacity-20" />
                        </div>
                    </div>
                    
                    <ScrollArea className="max-h-[50vh] p-6">
                        <div className="space-y-4">
                            {cart.map((item, idx) => (
                                <div key={item.service.id} className="flex flex-col gap-2 p-4 rounded-2xl bg-muted/30 border-2 transition-colors hover:border-primary/20 group">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-xs uppercase tracking-tight truncate">{item.service.name}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <p className="text-[11px] font-black text-primary">{formatCurrency(item.service.price)}</p>
                                                {item.service.source === 'Internal' && (
                                                    <button 
                                                        onClick={() => handleOpenNoteDialog(idx)}
                                                        className={cn(
                                                            "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border transition-all flex items-center gap-1.5 shadow-sm",
                                                            item.notes ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-primary/5"
                                                        )}
                                                    >
                                                        <MessageSquare className="h-3 w-3" />
                                                        {item.notes ? "Nota" : "+ Instrucciones"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-background rounded-xl p-1 border shadow-sm">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="text-xs font-black w-6 text-center tabular-nums">{item.quantity}</span>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleAddToCart(item.service)}>
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleClearItem(item.service.id)}
                                            className="h-10 w-10 text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    {item.notes && (
                                        <p className="text-[10px] text-primary italic font-medium ml-1 border-l-2 pl-3 border-primary/20 line-clamp-2 bg-primary/5 p-2 rounded-r-lg">
                                            "{item.notes}"
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <div className="p-6 bg-muted/10 border-t space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtotal a enviar</span>
                            <span className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(cartTotal)}</span>
                        </div>
                        <Button 
                            className="w-full h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20"
                            onClick={handleSendOrder}
                            disabled={isPending || cart.length === 0}
                        >
                            {isPending ? "Procesando..." : activeOrderId ? "Añadir a mi Cuenta" : "Confirmar y Enviar"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Diálogo de Notas de Cocina */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl sm:rounded-3xl border-none">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="text-xs font-medium uppercase tracking-widest">
                            Personalice su pedido (ej: término de carne, sin cebolla, etc.)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border-2 border-primary/10 flex items-center gap-4">
                            <div className="bg-primary text-white p-3 rounded-xl shadow-lg"><Utensils className="h-5 w-5" /></div>
                            <span className="font-black text-sm uppercase tracking-tight">
                                {editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="kitchen-note-public" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Escriba sus instrucciones aquí</Label>
                            <Textarea 
                                id="kitchen-note-public"
                                placeholder="Ej: Término medio, con poca sal, sin aderezo..."
                                value={currentNoteValue}
                                onChange={e => setCurrentNoteValue(e.target.value)}
                                className="min-h-[140px] rounded-2xl border-2 resize-none text-base font-bold transition-all focus:border-primary shadow-inner"
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

function getLocationLabel(type: string) {
    if (type === 'Table') return 'Mesas';
    if (type === 'Bar') return 'Barra';
    if (type === 'Terraza') return 'Terraza';
    return type;
}
