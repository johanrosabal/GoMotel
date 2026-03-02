'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, onSnapshot, DocumentData } from 'firebase/firestore';
import type { Service, Tax, RestaurantTable, Order, AppliedTax, ProductCategory, ProductSubCategory } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { getServices } from '@/lib/actions/service.actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, ChevronRight, CheckCircle, 
    Smartphone, MapPin, X, Utensils, Beer, Sun, Trash2, MessageSquare, Clock, Package, Receipt, ArrowLeft
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

export default function PublicOrderClient() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'account'>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

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

    useEffect(() => {
        if (selectedTable) {
            const savedId = localStorage.getItem(`activeOrderId_${selectedTable.id}`);
            if (savedId) setActiveOrderId(savedId);
            else setActiveOrderId(null);
        }
    }, [selectedTable]);

    useEffect(() => {
        if (!firestore || !activeOrderId) {
            setCurrentOrder(null);
            return;
        }

        const unsub = onSnapshot(doc(firestore, 'orders', activeOrderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Order;
                if (data.paymentStatus === 'Pagado') {
                    if (selectedTable) localStorage.removeItem(`activeOrderId_${selectedTable.id}`);
                    setActiveOrderId(null);
                    setCurrentOrder(null);
                } else {
                    setCurrentOrder({ id: snap.id, ...data });
                }
            } else {
                if (selectedTable) localStorage.removeItem(`activeOrderId_${selectedTable.id}`);
                setActiveOrderId(null);
                setCurrentOrder(null);
            }
        });

        return () => unsub();
    }, [firestore, activeOrderId, selectedTable]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.isActive && s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            const matchesSubCategory = !selectedSubCategoryId || s.subCategoryId === selectedSubCategoryId;
            return matchesSearch && matchesCategory && matchesSubCategory;
        });
    }, [availableServices, searchTerm, selectedCategoryId, selectedSubCategoryId]);

    const { subtotal, totalTax, grandTotal } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
        let taxTotal = 0;
        if (allTaxes) {
            cart.forEach(item => {
                item.service.taxIds?.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) taxTotal += (item.service.price * item.quantity) * (taxInfo.percentage / 100);
                });
            });
        }
        return { subtotal: sub, totalTax: taxTotal, grandTotal: sub + taxTotal };
    }, [cart, allTaxes]);

    const handleAddToCart = (service: Service) => {
        setCart(prev => {
            const existing = prev.find(i => i.service.id === service.id);
            if (existing) {
                return prev.map(i => i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { service, quantity: 1 }];
        });
        toast({ title: "Agregado", description: `${service.name} listo para pedir.` });
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

    const handleRemoveCompletely = (serviceId: string) => {
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
                result = await addToTableAccount(activeOrderId, cart);
            } else {
                result = await openTableAccount(selectedTable.id, cart, undefined, 'Public');
            }

            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "¡Pedido Enviado!", description: "Su orden está siendo preparada." });
                if (result.orderId) {
                    localStorage.setItem(`activeOrderId_${selectedTable.id}`, result.orderId);
                    setActiveOrderId(result.orderId);
                }
                setCart([]);
                setActiveTab('account');
            }
        });
    };

    if (!selectedTable) {
        return (
            <div className="min-h-screen bg-muted/30 flex flex-col p-4 sm:p-8">
                <div className="max-w-4xl mx-auto w-full space-y-12 pt-12">
                    <div className="text-center space-y-4">
                        <div className="inline-block p-4 rounded-3xl bg-primary/10 mb-4">
                            <Utensils className="h-12 w-12 text-primary" />
                        </div>
                        <h1 className="text-6xl sm:text-8xl font-black uppercase tracking-tighter text-primary drop-shadow-2xl">
                            Bienvenido
                        </h1>
                        <p className="text-lg font-bold text-muted-foreground uppercase tracking-widest">Seleccione su ubicación para comenzar</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {['Table', 'Bar', 'Terraza'].map(type => {
                            const Icon = type === 'Table' ? Utensils : type === 'Bar' ? Beer : Sun;
                            return (
                                <Card key={type} className="group hover:border-primary transition-all duration-300 cursor-default">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-center gap-3">
                                            <Icon className="h-5 w-5 text-primary" />
                                            <CardTitle className="text-sm font-black uppercase tracking-widest">{TYPE_LABELS[type] || type}</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-2 gap-2">
                                        {allTables?.filter(t => t.type === type).map(table => (
                                            <Button 
                                                key={table.id} 
                                                variant="outline" 
                                                className="h-14 text-xl font-black hover:bg-primary hover:text-white transition-all rounded-xl"
                                                onClick={() => setSelectedTable(table)}
                                            >
                                                {table.number}
                                            </Button>
                                        ))}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-background overflow-hidden max-w-md mx-auto border-x shadow-2xl relative">
            <div className="bg-primary p-6 text-white shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                <div className="flex justify-between items-start relative z-10">
                    <div className="space-y-1">
                        <button onClick={() => { setSelectedTable(null); setActiveTab('menu'); }} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity">
                            <ArrowLeft className="h-3 w-3" /> Cambiar Mesa
                        </button>
                        <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">
                            {TYPE_LABELS[selectedTable.type] || selectedTable.type} {selectedTable.number}
                        </h2>
                        <Badge className="bg-white/20 text-white border-none font-bold text-[10px] px-3">SISTEMA DE AUTO-PEDIDO</Badge>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-xl">
                            {cart.length}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex border-b bg-muted/30 sticky top-0 z-20 shrink-0">
                <button onClick={() => setActiveTab('menu')} className={cn("flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-4", activeTab === 'menu' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground")}>
                    <Package className="h-4 w-4 mx-auto mb-1" /> Catálogo
                </button>
                <button onClick={() => setActiveTab('cart')} className={cn("flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-4 relative", activeTab === 'cart' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground")}>
                    <ShoppingCart className="h-4 w-4 mx-auto mb-1" /> Pedido
                    {cart.length > 0 && <span className="absolute top-2 right-4 h-4 w-4 bg-primary text-white rounded-full text-[8px] flex items-center justify-center animate-bounce">{cart.length}</span>}
                </button>
                <button onClick={() => setActiveTab('account')} className={cn("flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-4", activeTab === 'account' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground")}>
                    <Receipt className="h-4 w-4 mx-auto mb-1" /> Mi Cuenta
                </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'menu' && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="p-4 space-y-4 shrink-0 bg-background shadow-sm">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Buscar por nombre..." className="pl-10 h-12 rounded-2xl border-2 transition-all focus:border-primary" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <ScrollArea className="w-full">
                                <div className="flex gap-2 pb-2">
                                    <button onClick={() => { setSelectedCategoryId(null); setSelectedSubCategoryId(null); }} className={cn("h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shrink-0", selectedCategoryId === null ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>Todos</button>
                                    {categories?.map(cat => (
                                        <button key={cat.id} onClick={() => { setSelectedCategoryId(cat.id); setSelectedSubCategoryId(null); }} className={cn("h-8 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shrink-0", selectedCategoryId === cat.id ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{cat.name}</button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 gap-4 p-4 pb-24">
                                {filteredServices.map(service => (
                                    <div key={service.id} className="group flex flex-col bg-card border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                                        <div className="aspect-square relative overflow-hidden bg-muted">
                                            <img src={service.imageUrl || 'https://placehold.co/400x400?text=Producto'} alt={service.name} className="object-cover w-full h-full" />
                                            <div className="absolute top-2 right-2">
                                                <Badge className="bg-primary/90 text-white font-black">{formatCurrency(service.price)}</Badge>
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                            <button onClick={() => handleAddToCart(service)} className="absolute bottom-2 right-2 h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                                                <Plus className="h-6 w-6" />
                                            </button>
                                        </div>
                                        <div className="p-3">
                                            <h3 className="font-black text-[11px] uppercase tracking-tight line-clamp-2 leading-tight">{service.name}</h3>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {activeTab === 'cart' && (
                    <div className="flex-1 flex flex-col p-4">
                        <div className="flex justify-between items-end mb-6">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Mi Pedido</h3>
                            <button onClick={() => setCart([])} className="text-[10px] font-black uppercase text-destructive tracking-widest">Vaciar</button>
                        </div>
                        <ScrollArea className="flex-1 pr-4">
                            {cart.length === 0 ? (
                                <div className="text-center py-20 opacity-20 flex flex-col items-center">
                                    <ShoppingCart className="h-24 w-24 mb-4" />
                                    <p className="text-xl font-black uppercase tracking-widest">Carrito Vacío</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {cart.map((item, idx) => (
                                        <div key={item.service.id} className="p-4 rounded-3xl border bg-card shadow-sm space-y-3">
                                            <div className="flex gap-4">
                                                <div className="h-16 w-16 rounded-2xl overflow-hidden shrink-0 border shadow-inner">
                                                    <img src={item.service.imageUrl || 'https://placehold.co/100x100'} className="object-cover w-full h-full" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-xs uppercase truncate">{item.service.name}</p>
                                                    <p className="text-primary font-bold">{formatCurrency(item.service.price)}</p>
                                                    <button onClick={() => handleOpenNoteDialog(idx)} className={cn("mt-2 text-[9px] font-black uppercase px-2 py-1 rounded-md border flex items-center gap-1", item.notes ? "bg-primary text-white" : "text-muted-foreground")}>
                                                        <MessageSquare className="h-3 w-3" /> {item.notes ? "Nota guardada" : "+ Nota de cocina"}
                                                    </button>
                                                </div>
                                                <button onClick={() => handleRemoveCompletely(item.service.id)} className="h-8 w-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-1 bg-muted rounded-full p-1 border">
                                                    <button onClick={() => handleRemoveFromCart(item.service.id)} className="h-8 w-8 rounded-full bg-background flex items-center justify-center shadow-sm"><Minus className="h-4 w-4" /></button>
                                                    <span className="w-10 text-center font-black">{item.quantity}</span>
                                                    <button onClick={() => handleAddToCart(item.service)} className="h-8 w-8 rounded-full bg-background flex items-center justify-center shadow-sm"><Plus className="h-4 w-4" /></button>
                                                </div>
                                                <p className="text-lg font-black">{formatCurrency(item.service.price * item.quantity)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        <div className="pt-6 border-t mt-4 space-y-4">
                            <div className="flex justify-between items-center text-2xl font-black uppercase tracking-tighter">
                                <span>Total</span>
                                <span className="text-primary">{formatCurrency(grandTotal)}</span>
                            </div>
                            <Button onClick={handleSendOrder} disabled={cart.length === 0 || isPending} className="w-full h-16 rounded-3xl text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/30">
                                {isPending ? "PROCESANDO..." : "CONFIRMAR PEDIDO"}
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="flex-1 flex flex-col p-4 overflow-hidden">
                        <div className="flex justify-between items-end mb-6">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Estado de Cuenta</h3>
                            <Badge variant="outline" className="font-black text-[10px] tracking-widest border-primary/20 text-primary uppercase">Mesa: {selectedTable.number}</Badge>
                        </div>
                        
                        {!currentOrder ? (
                            <div className="text-center py-20 opacity-20 flex flex-col items-center flex-1">
                                <Receipt className="h-24 w-24 mb-4" />
                                <p className="text-xl font-black uppercase tracking-widest">Sin consumos</p>
                                <p className="text-xs mt-2 font-bold">Empiece a pedir desde el catálogo</p>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <ScrollArea className="flex-1 -mr-4 pr-4">
                                    <div className="space-y-3">
                                        <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 mb-4 flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-lg">
                                                <Clock className="h-6 w-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Orden Activa</p>
                                                <p className="font-black text-sm truncate uppercase">{currentOrder.label || 'Su Consumo'}</p>
                                            </div>
                                            <Badge className="font-black text-[10px] uppercase bg-green-600">EN CURSO</Badge>
                                        </div>

                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Detalle de Productos</h4>
                                            {currentOrder.items.map((item, idx) => (
                                                <div key={idx} className="p-4 rounded-2xl border bg-card flex justify-between items-start gap-4 shadow-sm">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-xs uppercase truncate tracking-tight">{item.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{item.quantity} Unid.</span>
                                                            <span className="text-muted-foreground text-[10px] font-medium">@{formatCurrency(item.price)}</span>
                                                        </div>
                                                        {item.notes && <p className="mt-2 text-[9px] text-primary italic font-medium border-l-2 pl-2 border-primary/20">"{item.notes}"</p>}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                        <p className="font-black text-sm">{formatCurrency(item.price * item.quantity)}</p>
                                                        {item.category === 'Food' ? (
                                                            <Badge variant="secondary" className={cn("text-[8px] font-black uppercase tracking-tighter", currentOrder.kitchenStatus === 'Entregado' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                                                                {currentOrder.kitchenStatus === 'Entregado' ? 'Listo' : currentOrder.kitchenStatus === 'En preparación' ? 'Preparando' : 'Pendiente'}
                                                            </Badge>
                                                        ) : item.category === 'Beverage' ? (
                                                            <Badge variant="secondary" className={cn("text-[8px] font-black uppercase tracking-tighter", currentOrder.barStatus === 'Entregado' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}>
                                                                {currentOrder.barStatus === 'Entregado' ? 'Listo' : currentOrder.barStatus === 'En preparación' ? 'Preparando' : 'Pendiente'}
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </ScrollArea>
                                
                                <div className="pt-6 border-t mt-4 bg-muted/20 p-6 rounded-3xl border">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
                                            <span>Subtotal</span>
                                            <span>{formatCurrency(currentOrder.total)}</span>
                                        </div>
                                        <div className="flex justify-between text-2xl font-black uppercase tracking-tighter">
                                            <span>Total General</span>
                                            <span className="text-primary">{formatCurrency(currentOrder.total)}</span>
                                        </div>
                                    </div>
                                    <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Solicite el cierre de cuenta a recepción</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-t-3xl sm:rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter">Nota de Cocina</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase tracking-widest">Instrucciones especiales para su pedido</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-xl"><Utensils className="h-5 w-5 text-primary" /></div>
                            <span className="font-black text-sm uppercase tracking-tight">{editingNoteIndex !== null && cart[editingNoteIndex] ? cart[editingNoteIndex].service.name : ''}</span>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="kitchen-note-public" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Escriba sus instrucciones aquí</Label>
                            <Textarea 
                                id="kitchen-note-public" 
                                placeholder="Ej: Término medio, sin cebolla, mucha salsa..." 
                                value={currentNoteValue} 
                                onChange={e => setCurrentNoteValue(e.target.value)} 
                                className="min-h-[140px] rounded-2xl border-2 resize-none text-base font-bold transition-all focus:border-primary" 
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
