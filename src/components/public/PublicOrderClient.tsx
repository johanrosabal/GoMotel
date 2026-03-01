'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, RestaurantTable, ProductCategory, ProductSubCategory, Tax } from '@/types';
import { openTableAccount, addToTableAccount } from '@/lib/actions/restaurant.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Search, ShoppingCart, Plus, Minus, 
    Utensils, Beer, Sun, MapPin, 
    PackageCheck, CheckCircle, ChevronRight, ChevronLeft,
    ImageIcon, MessageSquare, ShoppingBag, X, Info
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

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

    // View State
    const [step, setStep] = useState(1); // 1: Ubicación, 2: Menú, 3: Resumen
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Product Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    // Kitchen Notes state
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    // --- Data Fetching ---
    const tablesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'restaurantTables'), where('status', '==', 'Available')) : null, 
        [firestore]
    );
    const { data: availableTables, isLoading: isLoadingTables } = useCollection<RestaurantTable>(tablesQuery);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
        [firestore]
    );
    const { data: services } = useCollection<Service>(servicesQuery);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes } = useCollection<Tax>(taxesQuery);

    // --- Logic ---
    const locationTypes = useMemo(() => {
        if (!availableTables) return [];
        return Array.from(new Set(availableTables.map(t => t.type))).sort();
    }, [availableTables]);

    const filteredTables = useMemo(() => {
        if (!availableTables) return [];
        return availableTables.filter(t => locationFilter === 'all' || t.type === locationFilter)
            .sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [availableTables, locationFilter]);

    const filteredServices = useMemo(() => {
        if (!services) return [];
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategoryId || s.categoryId === selectedCategoryId;
            return matchesSearch && matchesCategory;
        }).sort((a,b) => a.name.localeCompare(b.name));
    }, [services, searchTerm, selectedCategoryId]);

    const { subtotal, totalTax, grandTotal } = useMemo(() => {
        const sub = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
        let taxTotal = 0;
        
        if (allTaxes) {
            cart.forEach(item => {
                const itemTotal = item.service.price * item.quantity;
                item.service.taxIds?.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        taxTotal += itemTotal * (taxInfo.percentage / 100);
                    }
                });
            });
        }
        return { subtotal: sub, totalTax: taxTotal, grandTotal: sub + taxTotal };
    }, [cart, allTaxes]);

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
            const result = await openTableAccount(selectedTable.id, cart, `Pedido Móvil`);
            if (result.error) {
                toast({ title: 'Error al enviar', description: result.error, variant: 'destructive' });
            } else {
                setStep(3); // Success Screen
                setCart([]);
            }
        });
    };

    const getTypeIcon = (type: string) => {
        if (type === 'Table') return Utensils;
        if (type === 'Bar') return Beer;
        if (type === 'Terraza') return Sun;
        return MapPin;
    };

    if (step === 3) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
                    <CheckCircle className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">¡Pedido Recibido!</h2>
                <p className="text-muted-foreground max-w-xs mx-auto mb-8">
                    Tu pedido para la <span className="font-bold text-foreground">{TYPE_LABELS[selectedTable?.type || ''] || 'Mesa'} {selectedTable?.number}</span> está siendo procesado por nuestro personal.
                </p>
                <Button onClick={() => setStep(2)} className="rounded-xl h-12 px-8 font-bold uppercase tracking-widest">Hacer otro pedido</Button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden relative">
            
            {/* --- Header --- */}
            <header className="px-6 py-4 border-b flex items-center justify-between bg-card shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><ShoppingBag className="h-5 w-5 text-primary" /></div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-widest text-primary leading-none">Auto-Pedido</h1>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Menu Digital Móvil</p>
                    </div>
                </div>
                {selectedTable && (
                    <Badge variant="outline" className="h-8 px-3 font-black bg-primary/5 border-primary/20 text-primary">
                        {TYPE_LABELS[selectedTable.type] || 'Mesa'} {selectedTable.number}
                    </Badge>
                )}
            </header>

            {/* --- Step 1: Ubicación --- */}
            {step === 1 && (
                <div className="flex-1 flex flex-col min-h-0 p-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="mb-8 space-y-2">
                        <h2 className="text-2xl font-black uppercase tracking-tight">¿Dónde te encuentras?</h2>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Selecciona tu mesa o ubicación para empezar</p>
                    </div>

                    <div className="space-y-6 flex-1 flex flex-col min-h-0">
                        {/* Location Chips (Flex-Wrap) */}
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <button 
                                className={cn(
                                    "h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border-2",
                                    locationFilter === 'all' 
                                        ? "bg-primary text-primary-foreground border-primary shadow-lg" 
                                        : "bg-background text-muted-foreground border-border active:scale-95"
                                )}
                                onClick={() => setLocationFilter('all')}
                            >
                                Todas
                            </button>
                            {locationTypes.map(type => (
                                <button 
                                    key={type}
                                    className={cn(
                                        "h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border-2",
                                        locationFilter === type 
                                            ? "bg-primary text-primary-foreground border-primary shadow-lg" 
                                            : "bg-background text-muted-foreground border-border active:scale-95"
                                    )}
                                    onClick={() => setLocationFilter(type)}
                                >
                                    {TYPE_LABELS[type] || type}
                                </button>
                            ))}
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-10">
                                {isLoadingTables ? (
                                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />)
                                ) : filteredTables.map(table => {
                                    const Icon = getTypeIcon(table.type);
                                    return (
                                        <button
                                            key={table.id}
                                            onClick={() => { setSelectedTable(table); setStep(2); }}
                                            className="group relative flex flex-col items-center justify-center aspect-square rounded-2xl border-2 bg-card hover:border-primary hover:shadow-xl transition-all active:scale-95"
                                        >
                                            <div className="p-3 bg-primary/10 rounded-xl mb-2"><Icon className="h-6 w-6 text-primary" /></div>
                                            <span className="font-black text-3xl">{table.number}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{TYPE_LABELS[table.type] || table.type}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            )}

            {/* --- Step 2: Menú --- */}
            {step === 2 && (
                <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-4 duration-500">
                    {/* Filters & Categories */}
                    <div className="p-4 bg-muted/20 space-y-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar platillo o bebida..." 
                                className="pl-9 h-11 bg-background rounded-xl border-2 transition-all focus:border-primary"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Category Chips (Flex-Wrap) */}
                        <div className="flex flex-wrap gap-2">
                            <button 
                                className={cn(
                                    "h-8 px-4 rounded-full font-black text-[9px] uppercase tracking-widest transition-all",
                                    selectedCategoryId === null ? "bg-primary text-primary-foreground shadow-md" : "bg-background border-2 text-muted-foreground hover:border-primary/30"
                                )}
                                onClick={() => setSelectedCategoryId(null)}
                            >
                                Menú Completo
                            </button>
                            {categories?.map(cat => (
                                <button 
                                    key={cat.id}
                                    className={cn(
                                        "h-8 px-4 rounded-full font-black text-[9px] uppercase tracking-widest transition-all",
                                        selectedCategoryId === cat.id ? "bg-primary text-primary-foreground shadow-md" : "bg-background border-2 text-muted-foreground hover:border-primary/30"
                                    )}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid */}
                    <ScrollArea className="flex-1">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 pb-32">
                            {filteredServices.map(service => {
                                const qty = cart.find(i => i.service.id === service.id)?.quantity || 0;
                                return (
                                    <div key={service.id} className="group flex flex-col bg-card border rounded-2xl overflow-hidden shadow-sm relative transition-all">
                                        <div className="aspect-square relative bg-muted overflow-hidden">
                                            <Avatar className="h-full w-full rounded-none">
                                                <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover transition-transform group-hover:scale-110 duration-500" />
                                                <AvatarFallback className="rounded-none bg-transparent opacity-20"><ImageIcon className="h-10 w-10" /></AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-2 right-2 z-10">
                                                <Badge className="font-black bg-black/60 text-white border-none backdrop-blur-sm">
                                                    {formatCurrency(service.price)}
                                                </Badge>
                                            </div>
                                            {qty > 0 && (
                                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center z-10 backdrop-blur-[2px]">
                                                    <Badge className="h-10 w-10 rounded-full font-black text-lg bg-primary text-primary-foreground shadow-lg">{qty}</Badge>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 flex flex-col gap-3 flex-1">
                                            <h3 className="font-black text-[11px] uppercase tracking-tight leading-tight line-clamp-2 h-8">{service.name}</h3>
                                            
                                            <div className="flex items-center gap-1.5 mt-auto">
                                                <Button 
                                                    size="icon" 
                                                    variant="secondary" 
                                                    className="h-8 w-8 rounded-lg shrink-0" 
                                                    onClick={() => handleRemoveFromCart(service.id)}
                                                    disabled={qty === 0}
                                                >
                                                    <Minus className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button 
                                                    className="flex-1 h-8 text-[9px] font-black uppercase tracking-widest rounded-lg"
                                                    onClick={() => handleAddToCart(service)}
                                                    disabled={service.source !== 'Internal' && qty >= (service.stock || 0)}
                                                >
                                                    Agregar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>

                    {/* Floating Cart Button */}
                    {cart.length > 0 && (
                        <div className="absolute bottom-6 left-6 right-6 z-30">
                            <Button 
                                onClick={() => setStep(3)} // Ir a resumen (aquí reutilizo el logic de resumen para enviar)
                                className="w-full h-14 rounded-2xl shadow-2xl shadow-primary/20 flex items-center justify-between px-6 font-black uppercase tracking-widest"
                                onClickCapture={() => setStep(3)} // En una App real aquí abriríamos el resumen
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 px-2 py-1 rounded-lg text-[10px]">{cart.reduce((s,i) => s + i.quantity, 0)} items</div>
                                    <span>Ver Pedido</span>
                                </div>
                                <span className="text-lg">{formatCurrency(grandTotal)}</span>
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* --- Paso 3: Resumen y Confirmación --- */}
            {step === 3 && cart.length > 0 && (
                <div className="flex-1 flex flex-col min-h-0 bg-background animate-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 shrink-0 border-b bg-card">
                        <Button variant="ghost" className="mb-4 h-8 px-0 text-muted-foreground font-bold" onClick={() => setStep(2)}>
                            <ChevronLeft className="mr-1 h-4 w-4" /> Volver al Menú
                        </Button>
                        <h2 className="text-3xl font-black uppercase tracking-tighter">Tu Pedido</h2>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
                            {TYPE_LABELS[selectedTable?.type || ''] || 'Mesa'} {selectedTable?.number}
                        </p>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-4">
                            {cart.map((item, idx) => (
                                <div key={item.service.id} className="flex flex-col gap-2 p-4 rounded-2xl border-2 bg-card relative shadow-sm">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-xs uppercase tracking-tight truncate">{item.service.name}</p>
                                            <p className="text-[10px] font-bold text-primary mt-0.5">{formatCurrency(item.service.price)} c/u</p>
                                        </div>
                                        <div className="flex items-center gap-3 bg-muted/50 p-1 rounded-xl border">
                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => handleRemoveFromCart(item.service.id)}>
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => handleAddToCart(item.service)}>
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <Separator className="opacity-50" />
                                    <div className="flex items-center justify-between">
                                        <button 
                                            onClick={() => handleOpenNoteDialog(idx)}
                                            className={cn(
                                                "text-[9px] font-black uppercase flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors",
                                                item.notes ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            <MessageSquare className="h-3 w-3" />
                                            {item.notes ? "Editar Nota" : "Añadir Instrucción"}
                                        </button>
                                        <p className="font-black text-xs">{formatCurrency(item.service.price * item.quantity)}</p>
                                    </div>
                                    {item.notes && (
                                        <p className="text-[10px] text-primary italic font-medium mt-1 pl-2 border-l-2 border-primary/30">"{item.notes}"</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    <div className="p-6 bg-card border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] space-y-4">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                                <span>Impuestos</span>
                                <span>{formatCurrency(totalTax)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm font-black uppercase tracking-wider text-muted-foreground">Total a pagar</span>
                                <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>

                        <Button 
                            className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/30"
                            disabled={isPending}
                            onClick={handleSendOrder}
                        >
                            {isPending ? "Enviando..." : "Confirmar y Enviar Pedido"}
                        </Button>
                        <p className="text-[9px] text-center text-muted-foreground font-medium flex items-center justify-center gap-1">
                            <Info className="h-3 w-3" /> Los pedidos se añadirán a tu cuenta de mesa
                        </p>
                    </div>
                </div>
            )}

            {/* --- Modals --- */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl mx-4">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Instrucciones Especiales</DialogTitle>
                        <DialogDescription className="text-xs">
                            ¿Algún detalle para la cocina sobre tu <strong>{editingNoteIndex !== null ? cart[editingNoteIndex]?.service.name : ''}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Ej: Término medio, sin cebolla, hielo aparte..."
                            value={currentNoteValue}
                            onChange={e => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] rounded-2xl border-2 resize-none text-sm font-medium focus:border-primary"
                            autoFocus
                        />
                    </div>
                    <DialogFooter className="flex-row gap-2">
                        <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setNoteDialogOpen(false)}>Cerrar</Button>
                        <Button className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest" onClick={handleSaveNote}>Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
