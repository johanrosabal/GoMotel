'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    doc,
    getDoc
} from 'firebase/firestore';
import type { Service, RestaurantTable, Order, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Check, X, Utensils, Beer, Sun, MapPin, 
    ChevronRight, History, Receipt, Loader2,
    Package, MessageSquare, ImageIcon,
    UserCircle, ArrowLeft
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

type CartItem = {
  service: Service;
  quantity: number;
  notes?: string;
};

const SESSION_KEY = 'go_motel_order_token';

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // -- State --
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    
    // Note Management
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // Session / Privacy
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [myOrder, setMyOrder] = useState<Order | null>(null);

    // -- Data Fetching --
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

    const subCategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedCategoryId) return null;
        return query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategoryId), orderBy('name'));
    }, [firestore, selectedCategoryId]);
    const { data: subCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

    // -- Session Logic --
    useEffect(() => {
        const savedToken = localStorage.getItem(SESSION_KEY);
        if (savedToken) {
            setActiveOrderId(savedToken);
        }
    }, []);

    useEffect(() => {
        if (!firestore || !activeOrderId) {
            setMyOrder(null);
            return;
        }
        // Listen to MY specific order for privacy
        const unsub = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                // If the order is paid or cancelled, it's no longer "active" for this session
                if (data.status === 'Cancelado' || data.paymentStatus === 'Pagado') {
                    localStorage.removeItem(SESSION_KEY);
                    setActiveOrderId(null);
                    setMyOrder(null);
                } else {
                    setMyOrder({ id: snap.id, ...data });
                }
            } else {
                localStorage.removeItem(SESSION_KEY);
                setActiveOrderId(null);
                setMyOrder(null);
            }
        });
        return () => unsub();
    }, [firestore, activeOrderId]);

    // -- Filters --
    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        return allTables.filter(t => typeFilter === 'all' || t.type === typeFilter);
    }, [allTables, typeFilter]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && (
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                s.category.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            const matchesSubCategory = !selectedSubCategoryId || s.subCategoryId === selectedSubCategoryId;
            return matchesSearch && matchesCategory && matchesSubCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId, selectedSubCategoryId]);

    // -- Actions --
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

    const handleUpdateQuantity = (serviceId: string, delta: number) => {
        setCart(prev => {
            const item = prev.find(i => i.service.id === serviceId);
            if (!item) return prev;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return prev.filter(i => i.service.id !== serviceId);
            return prev.map(i => i.service.id === serviceId ? { ...i, quantity: newQty } : i);
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
    };

    const handleSendOrder = () => {
        if (!selectedTable || cart.length === 0) return;

        startTransition(async () => {
            let result;
            if (activeOrderId) {
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, `Cliente ${selectedTable.number}`, 'Public');
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                if (result.orderId) {
                    localStorage.setItem(SESSION_KEY, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                setCart([]);
                setActiveTab('account');
                toast({ title: "¡Pedido Enviado!", description: "Estamos preparando sus productos." });
            }
        });
    };

    const totalCart = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);

    // -- Views --
    if (!selectedTable) {
        return (
            <div className="min-h-[100dvh] bg-muted/30 p-4 sm:p-8 flex flex-col">
                <div className="max-w-md mx-auto w-full space-y-8 py-10">
                    <div className="text-center space-y-2">
                        <h1 className="text-4xl font-black tracking-tight uppercase">Bienvenido</h1>
                        <p className="text-muted-foreground font-medium">Seleccione su mesa o ubicación para ver el menú.</p>
                    </div>

                    <div className="space-y-4">
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

                        <ScrollArea className="h-[50vh] rounded-3xl border bg-card/50 shadow-inner p-4">
                            <div className="grid grid-cols-2 gap-3 pb-4">
                                {filteredTables.map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTable(table)}
                                        className="flex flex-col items-center justify-center h-28 rounded-2xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all group active:scale-95 shadow-sm"
                                    >
                                        <span className="text-3xl font-black text-primary group-hover:scale-110 transition-transform">{table.number}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{table.type === 'Table' ? 'Mesa' : table.type}</span>
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
        <div className="min-h-[100dvh] flex flex-col bg-background overflow-hidden relative">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-muted/50" onClick={() => setSelectedTable(null)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary leading-none mb-1">Ubicación</p>
                        <p className="font-black text-sm uppercase tracking-tighter">
                            {selectedTable.type === 'Table' ? 'Mesa' : selectedTable.type} {selectedTable.number}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-8 rounded-xl font-bold bg-muted/30">
                        {myOrder ? "Cuenta Activa" : "Nueva Cuenta"}
                    </Badge>
                </div>
            </div>

            {/* Main Scrollable Content */}
            <ScrollArea className="flex-1 h-0">
                <div className="p-4 space-y-6 pb-32">
                    {activeTab === 'menu' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Search and Categories */}
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar algo delicioso..." 
                                        className="h-12 pl-10 rounded-2xl border-2 bg-muted/20 focus:border-primary transition-all shadow-sm"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <ScrollArea className="w-full whitespace-nowrap">
                                    <div className="flex gap-2 pb-2">
                                        <button 
                                            className={cn(
                                                "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-sm",
                                                selectedCategoryId === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                            )}
                                            onClick={() => { setSelectedCategoryId(null); setSelectedSubCategoryId(null); }}
                                        >
                                            Todos
                                        </button>
                                        {categories?.map(cat => (
                                            <button 
                                                key={cat.id}
                                                className={cn(
                                                    "h-9 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-sm",
                                                    selectedCategoryId === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
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

                            {/* Product Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {filteredServices.map(service => (
                                    <div 
                                        key={service.id}
                                        className="group relative flex flex-col bg-card rounded-3xl overflow-hidden border-2 border-transparent hover:border-primary/20 shadow-lg active:scale-95 transition-all duration-300 h-full"
                                    >
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} className="object-cover" />
                                                <AvatarFallback className="rounded-none">
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                                </AvatarFallback>
                                            </Avatar>

                                            {/* Top Overlay: Category & Stock */}
                                            <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
                                                <Badge className="bg-white text-black font-black text-[8px] uppercase px-2 h-5 border-none shadow-md">
                                                    {service.category}
                                                </Badge>
                                                {service.source !== 'Internal' && (
                                                    <Badge variant="secondary" className="bg-white/90 text-primary font-black text-[8px] h-5 border-none shadow-md backdrop-blur-sm">
                                                        STOCK: {service.stock}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Bottom Overlay: Info and Actions */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10 flex flex-col justify-end">
                                                <h3 className="text-white font-black text-[11px] uppercase leading-tight line-clamp-2 drop-shadow-md mb-2">
                                                    {service.name}
                                                </h3>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-primary font-black text-sm tracking-tighter bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-sm">
                                                        {formatCurrency(service.price)}
                                                    </span>
                                                    <Button 
                                                        size="icon" 
                                                        className="h-8 w-8 rounded-xl shadow-xl bg-primary hover:bg-primary/90 transition-transform active:scale-90"
                                                        onClick={() => handleAddToCart(service)}
                                                        disabled={service.source !== 'Internal' && (service.stock || 0) <= 0}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'cart' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="text-center py-4">
                                <h2 className="text-2xl font-black uppercase tracking-tight">Su Carrito</h2>
                                <p className="text-muted-foreground text-sm font-medium">Revise sus artículos antes de enviar.</p>
                            </div>

                            {cart.length === 0 ? (
                                <div className="text-center py-20 bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-muted flex flex-col items-center gap-4">
                                    <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
                                    <p className="font-bold text-muted-foreground uppercase text-xs tracking-widest">El carrito está vacío</p>
                                    <Button variant="outline" className="rounded-2xl h-12 font-black uppercase text-[10px]" onClick={() => setActiveTab('menu')}>Explorar Menú</Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map((item, idx) => (
                                        <Card key={item.service.id} className="rounded-3xl border-2 overflow-hidden shadow-sm">
                                            <CardContent className="p-4 flex gap-4">
                                                <Avatar className="h-16 w-16 rounded-2xl border bg-muted shrink-0">
                                                    <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                                    <AvatarFallback><ImageIcon className="h-6 w-6 text-muted-foreground/30" /></AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <h4 className="font-black text-xs uppercase tracking-tight truncate">{item.service.name}</h4>
                                                        <span className="font-black text-primary text-sm shrink-0">{formatCurrency(item.service.price * item.quantity)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        {item.service.source === 'Internal' ? (
                                                            <button 
                                                                onClick={() => handleOpenNoteDialog(idx)}
                                                                className={cn(
                                                                    "text-[10px] font-black uppercase px-3 py-1 rounded-xl border transition-all flex items-center gap-1.5",
                                                                    item.notes ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                                                                )}
                                                            >
                                                                <MessageSquare className="h-3 w-3" />
                                                                {item.notes ? "Ver Nota" : "+ Nota"}
                                                            </button>
                                                        ) : <div />}
                                                        <div className="flex items-center gap-3 bg-primary/10 rounded-2xl p-1 border border-primary/20">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl hover:bg-background" onClick={() => handleUpdateQuantity(item.service.id, -1)}>
                                                                <Minus className="h-3 w-3 text-primary" />
                                                            </Button>
                                                            <span className="text-xs font-black text-primary w-4 text-center">{item.quantity}</span>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 rounded-xl hover:bg-background" 
                                                                onClick={() => handleUpdateQuantity(item.service.id, 1)}
                                                                disabled={item.service.source !== 'Internal' && item.quantity >= (item.service.stock || 0)}
                                                            >
                                                                <Plus className="h-3 w-3 text-primary" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    
                                    <div className="pt-6 pb-4 space-y-4">
                                        <div className="flex justify-between items-center px-2">
                                            <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Total del pedido</span>
                                            <span className="text-3xl font-black tracking-tighter text-primary">{formatCurrency(totalCart)}</span>
                                        </div>
                                        <Button 
                                            className="w-full h-16 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 gap-3"
                                            onClick={handleSendOrder}
                                            disabled={isPending}
                                        >
                                            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
                                            {isPending ? "Procesando..." : "Confirmar y Enviar"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'account' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                            <div className="text-center py-4">
                                <h2 className="text-2xl font-black uppercase tracking-tight">Mi Consumo</h2>
                                <p className="text-muted-foreground text-sm font-medium">Historial de pedidos en esta sesión.</p>
                            </div>

                            {!myOrder ? (
                                <div className="text-center py-20 bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-muted flex flex-col items-center gap-4">
                                    <Receipt className="h-16 w-16 text-muted-foreground/30" />
                                    <p className="font-bold text-muted-foreground uppercase text-xs tracking-widest">Sin pedidos activos</p>
                                    <Button variant="outline" className="rounded-2xl h-12 font-black uppercase text-[10px]" onClick={() => setActiveTab('menu')}>Ir al Menú</Button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-primary/5 border-2 border-primary/10 rounded-[2.5rem] p-6 text-center space-y-4 shadow-sm">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70">Total Acumulado</p>
                                            <p className="text-5xl font-black tracking-tighter text-primary">{formatCurrency(myOrder.total)}</p>
                                        </div>
                                        <Badge className="bg-primary text-primary-foreground font-black px-4 h-7 rounded-full animate-pulse">
                                            <Package className="h-3 w-3 mr-2" /> EN PROCESO
                                        </Badge>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Detalle de Productos</h3>
                                        <div className="space-y-2">
                                            {myOrder.items.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl border bg-card/50 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary text-xs">
                                                            {item.quantity}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-xs uppercase truncate max-w-[180px]">{item.name}</p>
                                                            <p className="text-[10px] text-muted-foreground font-bold">{formatCurrency(item.price)} c/u</p>
                                                        </div>
                                                    </div>
                                                    <span className="font-black text-xs text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-[2rem] bg-muted/30 border border-dashed flex flex-col items-center text-center gap-3">
                                        <Receipt className="h-8 w-8 text-muted-foreground/50" />
                                        <p className="text-xs font-medium text-muted-foreground leading-relaxed">Para pagar su cuenta, por favor solicite la factura en Recepción o espere a su salida.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="text-xs font-medium">Añada notas para la cocina (ej: sin cebolla, muy caliente).</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Escriba aquí sus indicaciones..." 
                            className="min-h-[120px] rounded-2xl border-2 font-bold text-sm focus:border-primary"
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 z-30 p-4 pb-6 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none">
                <div className="max-w-md mx-auto pointer-events-auto bg-background/80 backdrop-blur-2xl border-2 border-primary/10 rounded-[2.5rem] p-2 flex items-center justify-between shadow-2xl ring-8 ring-black/5">
                    <button 
                        onClick={() => setActiveTab('menu')}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center gap-1 h-14 rounded-[2rem] transition-all duration-300",
                            activeTab === 'menu' ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]" : "text-muted-foreground hover:bg-muted/50"
                        )}
                    >
                        <Utensils className="h-5 w-5" />
                        <span className="text-[9px] font-black uppercase tracking-[0.15em]">Menú</span>
                    </button>
                    
                    <button 
                        onClick={() => setActiveTab('cart')}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center gap-1 h-14 rounded-[2rem] transition-all duration-300 relative",
                            activeTab === 'cart' ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]" : "text-muted-foreground hover:bg-muted/50"
                        )}
                    >
                        <ShoppingCart className="h-5 w-5" />
                        <span className="text-[9px] font-black uppercase tracking-[0.15em]">Carrito</span>
                        {cart.length > 0 && (
                            <Badge className="absolute top-2 right-4 h-5 w-5 flex items-center justify-center p-0 rounded-full border-2 border-background animate-in zoom-in-50">
                                {cart.length}
                            </Badge>
                        )}
                    </button>

                    <button 
                        onClick={() => setActiveTab('account')}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center gap-1 h-14 rounded-[2rem] transition-all duration-300",
                            activeTab === 'account' ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]" : "text-muted-foreground hover:bg-muted/50"
                        )}
                    >
                        <UserCircle className="h-5 w-5" />
                        <span className="text-[9px] font-black uppercase tracking-[0.15em]">Mi Cuenta</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
