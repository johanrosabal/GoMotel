'use client';

import React, { useState, useTransition, type ReactNode, useEffect, useMemo, useRef } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Service, Tax, SinpeAccount, AppliedTax } from '@/types';
import { createOrder } from '@/lib/actions/order.actions';
import { Plus, Minus, ShoppingCart, ImageIcon, Check, CheckCircle, MessageSquare, Utensils, Wallet, X, ConciergeBell, History, ReceiptText, Zap, ChevronRight, ChevronLeft, CreditCard, Smartphone, Clock, Search } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const Stepper = ({ step }: { step: number }) => {
    const steps = [
        { label: 'Productos', icon: ShoppingCart },
        { label: 'Pago', icon: Wallet },
        { label: 'Confirmar', icon: CheckCircle }
    ];
    
    return (
        <div className="flex flex-col items-center justify-center h-full w-24 md:w-32 bg-slate-900/40 border-r border-white/5 py-12 gap-12 relative">
            {steps.map((s, index) => (
                <div key={index} className="flex flex-col items-center relative z-10 group">
                    <div className={cn(
                        "flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-[1.2rem] transition-all duration-500 shadow-lg relative",
                        step > index + 1 
                            ? "bg-emerald-500 text-black shadow-emerald-500/20" 
                            : step === index + 1 
                                ? "bg-primary text-black shadow-primary/20 scale-110 ring-4 ring-primary/20" 
                                : "bg-white/5 border border-white/10 text-slate-500"
                    )}>
                        {step > index + 1 ? <Check className="h-5 w-5 md:h-6 md:w-6" /> : <s.icon className="h-4 w-4 md:h-5 md:w-5" />}
                        
                        {/* Connecting Line (Vertical) */}
                        {index < steps.length - 1 && (
                            <div className="absolute top-[100%] left-1/2 -translate-x-1/2 w-[2px] h-12 bg-white/5 overflow-hidden">
                                <motion.div 
                                    className="absolute inset-0 bg-gradient-to-b from-primary to-emerald-500"
                                    initial={{ y: '-100%' }}
                                    animate={{ y: step > index + 1 ? '0%' : '-100%' }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        )}
                    </div>
                    <p className={cn(
                        "text-[8px] md:text-[9px] mt-4 font-black uppercase tracking-[0.2em] transition-colors duration-500 text-center px-1",
                        step === index + 1 ? "text-primary" : "text-slate-600"
                    )}>{s.label}</p>
                </div>
            ))}
        </div>
    );
};


interface OrderServiceDialogProps {
    children: ReactNode;
    stayId?: string;
    availableServices: Service[];
    onOrderSuccess?: (invoiceId: string) => void;
}

type CartItem = {
    service: Service;
    quantity: number;
    notes?: string;
};

const orderPaymentSchema = z.object({
    payNow: z.boolean().default(true),
    paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']).optional(),
    paymentConfirmed: z.boolean().default(false),
    voucherNumber: z.string().optional(),
}).refine(data => {
    if (data.payNow) return !!data.paymentMethod;
    return true;
}, {
    message: "Debe seleccionar un método de pago.",
    path: ["paymentMethod"],
}).refine(data => {
    if (data.payNow && data.paymentMethod === 'Sinpe Movil') return !!data.paymentConfirmed;
    return true;
}, {
    message: 'Debe confirmar que el pago fue recibido.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (data.payNow && data.paymentMethod === 'Tarjeta') return data.voucherNumber && data.voucherNumber.trim() !== '';
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});

export default function OrderServiceDialog({ children, stayId, availableServices, onOrderSuccess }: OrderServiceDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [cart, setCart] = useState<CartItem[]>([]);
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const [step, setStep] = useState(1);
    const [cashTendered, setCashTendered] = useState('');

    // Kitchen Notes state
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [currentNoteValue, setCurrentNoteValue] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const form = useForm<z.infer<typeof orderPaymentSchema>>({
        resolver: zodResolver(orderPaymentSchema),
        defaultValues: { payNow: true, paymentConfirmed: false, voucherNumber: '', paymentMethod: undefined },
    });

    const payNow = form.watch('payNow');
    const paymentMethod = form.watch('paymentMethod');

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
    const { data: allTaxes, isLoading: isLoadingTaxes } = useCollection<Tax>(taxesQuery);
    const sinpeAccountsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sinpeAccounts'), where('isActive', '==', true), orderBy('createdAt', 'asc')) : null, [firestore]);
    const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    const translateCategory = (cat: string) => {
        const map: Record<string, string> = {
            'BEVERAGE': 'Bebidas',
            'FOOD': 'Comidas',
            'OTHER': 'Otros',
            'SERVICE': 'Servicios',
            'MINIBAR': 'Minibar',
            'RESTAURANT': 'Restaurante'
        };
        return map[cat.toUpperCase()] || cat;
    };

    const categories = useMemo(() => {
        const cats = Array.from(new Set(availableServices.map(s => s.category).filter(Boolean)));
        return cats.sort();
    }, [availableServices]);

    const filteredServices = useMemo(() => {
        return availableServices.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = !selectedCategory || s.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchQuery, selectedCategory]);

    const { subtotal, totalTax, grandTotal, appliedTaxes, cumulativeTaxPercentage } = useMemo(() => {
        let totalSub = 0;
        let taxTotal = 0;
        const taxMap = new Map<string, { name: string; percentage: number; amount: number }>();

        const serviceTax = allTaxes?.find(t =>
            t.name.toLowerCase().includes('servicio') ||
            t.name.toLowerCase().includes('service')
        );

        cart.forEach(item => {
            const itemQuantityPrice = item.service.price * item.quantity;
            const effectiveTaxIds = new Set(item.service.taxIds || []);
            
            // Stays always get service tax in this hotel's business logic (matching POS)
            if (serviceTax) {
                effectiveTaxIds.add(serviceTax.id);
            }

            let cumulativePercentage = 0;
            const matchingTaxes: Tax[] = [];

            if (allTaxes) {
                effectiveTaxIds.forEach(taxId => {
                    const taxInfo = allTaxes.find(t => t.id === taxId);
                    if (taxInfo) {
                        cumulativePercentage += taxInfo.percentage;
                        matchingTaxes.push(taxInfo);
                    }
                });
            }

            let itemSubtotal = 0;
            let itemTotalWithTax = 0;

            // FORCE included logic for this component as per system configuration
            // Unless explicitly set to false, we assume taxes are included in the price
            const isIncluded = item.service.taxIncluded !== false;

            if (isIncluded) {
                // If included: Price is the total. Subtotal is Price / (1 + Tax%)
                itemTotalWithTax = itemQuantityPrice;
                itemSubtotal = itemTotalWithTax / (1 + (cumulativePercentage / 100));
            } else {
                // If NOT included: Subtotal is Price. Total is Subtotal * (1 + Tax%)
                itemSubtotal = itemQuantityPrice;
                itemTotalWithTax = itemSubtotal * (1 + (cumulativePercentage / 100));
            }

            totalSub += itemSubtotal;
            
            matchingTaxes.forEach(t => {
                const taxAmount = item.service.taxIncluded 
                    ? itemTotalWithTax * (t.percentage / (100 + cumulativePercentage))
                    : itemSubtotal * (t.percentage / 100);
                
                const existingTax = taxMap.get(t.id);
                if (existingTax) {
                    existingTax.amount += taxAmount;
                } else {
                    taxMap.set(t.id, { name: t.name, percentage: t.percentage, amount: taxAmount });
                }
            });
        });

        const taxes: AppliedTax[] = [];
        let totalPct = 0;
        taxMap.forEach((value, key) => {
            taxes.push({ taxId: key, ...value });
            taxTotal += value.amount;
            totalPct += value.percentage;
        });

        return { 
            subtotal: totalSub, 
            totalTax: taxTotal, 
            grandTotal: totalSub + taxTotal, 
            appliedTaxes: taxes,
            cumulativeTaxPercentage: totalPct
        };
    }, [cart, allTaxes]);

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts) return null;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + grandTotal) <= limit) return account;
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, grandTotal]);

    useEffect(() => {
        if (!open) {
            setStep(1);
            setCart([]);
            form.reset();
            setCashTendered('');
        }
    }, [open, form]);

    useEffect(() => {
        if (!payNow) {
            setCashTendered('');
        }
    }, [payNow]);

    useEffect(() => {
        setCashTendered('');
    }, [paymentMethod]);

    const activeServices = availableServices.filter(s => s.isActive && (s.source === 'Internal' || (s.source !== 'Internal' && s.stock > 0)));

    const handleAddToCart = (service: Service) => {
        setCart((prevCart) => {
            const existingItem = prevCart.find((item) => item.service.id === service.id);
            if (existingItem) {
                return prevCart.map((item) =>
                    item.service.id === service.id
                        ? { ...item, quantity: item.service.source === 'Internal' ? item.quantity + 1 : Math.min(item.quantity + 1, service.stock) }
                        : item
                );
            }
            return [...prevCart, { service, quantity: 1 }];
        });
    };

    const handleRemoveFromCart = (service: Service) => {
        setCart((prevCart) => {
            const existingItem = prevCart.find((item) => item.service.id === service.id);
            if (existingItem && existingItem.quantity > 1) {
                return prevCart.map((item) =>
                    item.service.id === service.id ? { ...item, quantity: item.quantity - 1 } : item
                );
            }
            return prevCart.filter((item) => item.service.id !== service.id);
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

    const getCartQuantity = (serviceId: string) => {
        return cart.find((item) => item.service.id === serviceId)?.quantity || 0;
    };
    const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        if (rawValue === '') {
            setCashTendered('');
        } else {
            setCashTendered(new Intl.NumberFormat('en-US').format(Number(rawValue)));
        }
    };

    const numericCashTendered = useMemo(() => {
        return Number(cashTendered.replace(/\D/g, ''));
    }, [cashTendered]);

    const handleSubmit = (paymentValues: z.infer<typeof orderPaymentSchema>) => {
        if (!stayId) return;

        startTransition(async () => {
            const paymentDetails = paymentValues.payNow ? {
                paymentMethod: paymentValues.paymentMethod!,
                voucherNumber: paymentValues.voucherNumber,
                total: grandTotal,
                subtotal: subtotal,
                taxes: appliedTaxes,
            } : undefined;

            const result = await createOrder(stayId, cart, paymentDetails);

            if (result.error) {
                toast({ title: 'Pedido Fallido', description: result.error, variant: 'destructive' });
            } else {
                setStep(3);
            }
        });
    };

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>{children}</DialogTrigger>
                <DialogContent className="sm:max-w-[98vw] w-[98vw] h-[98vh] bg-slate-950/80 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[2rem] p-0 overflow-hidden flex flex-row border-t-white/20">
                    <Stepper step={step} />

                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
                        <div className="p-8 pb-4 flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                                    <Utensils className="h-7 w-7 text-primary" />
                                    Pedir Servicios
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 mt-1 font-medium tracking-wide">
                                    {step === 1 ? "Explore el menú y gestione su pedido." : "Confirme el pedido y elija un método de pago."}
                                </DialogDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full hover:bg-white/5 text-slate-500">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div 
                                    key="step1"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex-1 min-h-0 overflow-hidden flex flex-col"
                                >
                                    <div className="grid md:grid-cols-5 gap-0 flex-1 min-h-0 bg-white/[0.02]">
                                        {/* Product List */}
                                        <div className='col-span-3 flex flex-col min-h-0 h-full bg-slate-950/20'>
                                            <div className="p-8 pb-4 space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Catálogo de Servicios</h3>
                                                    <Badge variant="outline" className="text-[9px] font-bold border-white/5 bg-white/5 text-slate-400 px-3">
                                                        {filteredServices.length} Disponibles
                                                    </Badge>
                                                </div>

                                                <div className="flex gap-3">
                                                    <div className="relative flex-1 group">
                                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors" />
                                                        <Input 
                                                            placeholder="Buscar productos..." 
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            className="h-12 pl-12 bg-white/5 border-white/10 rounded-2xl text-sm font-bold text-white focus-visible:ring-primary/20 placeholder:text-slate-700"
                                                        />
                                                    </div>
                                                </div>

                                                <ScrollArea className="w-full">
                                                    <div className="flex gap-2 pb-2">
                                                        <Button 
                                                            variant={!selectedCategory ? "default" : "ghost"}
                                                            onClick={() => setSelectedCategory(null)}
                                                            className={cn(
                                                                "h-9 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                                !selectedCategory ? "bg-primary text-black shadow-lg shadow-primary/10" : "bg-white/5 text-slate-500 hover:bg-white/10"
                                                            )}
                                                        >
                                                            Todos
                                                        </Button>
                                                        {categories.map(cat => {
                                                            const map: Record<string, string> = {
                                                                'BEVERAGE': 'Bebidas',
                                                                'FOOD': 'Comidas',
                                                                'OTHER': 'Otros',
                                                                'SERVICE': 'Servicios',
                                                                'MINIBAR': 'Minibar',
                                                                'RESTAURANT': 'Restaurante'
                                                            };
                                                            const label = map[cat.toUpperCase()] || cat;
                                                            return (
                                                                <Button 
                                                                    key={cat}
                                                                    variant={selectedCategory === cat ? "default" : "ghost"}
                                                                    onClick={() => setSelectedCategory(cat)}
                                                                    className={cn(
                                                                        "h-9 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                                                        selectedCategory === cat ? "bg-primary text-black shadow-lg shadow-primary/10" : "bg-white/5 text-slate-500 hover:bg-white/10"
                                                                    )}
                                                                >
                                                                    {label}
                                                                </Button>
                                                            );
                                                        })}
                                                    </div>
                                                    <ScrollBar orientation="horizontal" className="opacity-0" />
                                                </ScrollArea>
                                            </div>

                                            <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 pb-12 custom-scrollbar">
                                                <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
                                                    {isLoadingTaxes ? (
                                                        <div className="col-span-full py-40 flex flex-col items-center justify-center">
                                                            <div className="relative mb-8">
                                                                <motion.div 
                                                                    animate={{ rotate: 360 }}
                                                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                                    className="h-20 w-20 rounded-full border-2 border-primary/10 border-t-primary shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                                                                />
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <Utensils className="h-7 w-7 text-primary/40 animate-pulse" />
                                                                </div>
                                                            </div>
                                                            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60 mb-2">Cargando Experiencia</h4>
                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700 animate-pulse">Preparando el menú para usted</p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {filteredServices.map((service) => (
                                                                <motion.div 
                                                                    key={service.id} 
                                                                    whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.05)' }}
                                                                    whileActive={{ scale: 0.98 }}
                                                                    onClick={() => handleAddToCart(service)}
                                                                    className="group relative flex items-center justify-between p-4 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:border-primary/40 transition-all duration-300 cursor-pointer overflow-hidden"
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    
                                                                    <div className="flex items-center gap-4 relative z-10">
                                                                        <div className="relative h-16 w-16 rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl group-hover:border-primary/40 transition-all duration-500">
                                                                            <Avatar className="h-full w-full rounded-none">
                                                                                <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                                                                <AvatarFallback className="rounded-none bg-slate-800">
                                                                                    <Utensils className="h-6 w-6 text-white/10" />
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                            {getCartQuantity(service.id) > 0 && (
                                                                                <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center">
                                                                                    <div className="bg-primary text-black text-[10px] font-black h-6 w-6 rounded-full flex items-center justify-center shadow-lg">
                                                                                        {getCartQuantity(service.id)}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <p className="font-black uppercase text-[12px] tracking-tight text-white group-hover:text-primary transition-colors line-clamp-1">{service.name}</p>
                                                                            <div className="flex items-center gap-2">
                                                                                <p className="text-sm font-black text-primary/80 tracking-tighter">
                                                                                    {formatCurrency(service.price)}
                                                                                </p>
                                                                                {service.stock > 0 && service.stock <= 5 && (
                                                                                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 animate-pulse">Stock Bajo</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="relative z-10">
                                                                        <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-all duration-500">
                                                                            <Plus className="h-5 w-5" />
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            ))}
                                                            {filteredServices.length === 0 && (
                                                                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-20">
                                                                    <Search className="h-12 w-12 mb-4" />
                                                                    <p className="text-xs font-black uppercase tracking-widest">No se encontraron productos</p>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cart Summary Sidebar */}
                                        <div className='col-span-2 flex flex-col p-8 bg-white/[0.03] border-l border-white/5 relative'>
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/60 mb-6">Tu Pedido</h3>
                                            
                                            <div className="flex-1 flex flex-col min-h-0">
                                                {cart.length === 0 ? (
                                                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                                                        <div className="h-20 w-20 rounded-[2rem] border-2 border-dashed border-white/20 flex items-center justify-center">
                                                            <ShoppingCart className="h-10 w-10" />
                                                        </div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed max-w-[120px]">Su carrito está esperando ser llenado</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex-1 overflow-y-auto pr-4 -mr-4 custom-scrollbar">
                                                            <div className="space-y-4">
                                                                {cart.map((item, index) => (
                                                                    <motion.div 
                                                                        key={item.service.id}
                                                                        layout
                                                                        initial={{ opacity: 0, y: 10 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        className="group relative bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all"
                                                                    >
                                                                        <div className="flex items-center gap-4 mb-3">
                                                                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-900 border border-white/5">
                                                                                <Avatar className="h-full w-full rounded-none">
                                                                                    <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                                                                    <AvatarFallback className="bg-slate-900 text-[10px]">{item.service.name[0]}</AvatarFallback>
                                                                                </Avatar>
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center justify-between">
                                                                                    <p className="text-[10px] font-black uppercase tracking-tight text-white line-clamp-1">{item.service.name}</p>
                                                                                    <p className="text-[10px] font-black text-primary ml-2">{formatCurrency(item.service.price * item.quantity)}</p>
                                                                                </div>
                                                                                <div className="flex items-center justify-between mt-1">
                                                                                    <p className="text-[9px] font-bold text-slate-500 uppercase">{item.quantity} x {formatCurrency(item.service.price)}</p>
                                                                                    <button 
                                                                                        type="button"
                                                                                        onClick={() => handleOpenNoteDialog(index)}
                                                                                        className={cn(
                                                                                            "flex items-center gap-1.5 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                                                                                            item.notes ? "bg-primary/20 text-primary" : "bg-white/10 text-slate-400 hover:bg-white/20"
                                                                                        )}
                                                                                    >
                                                                                        <MessageSquare className="h-2.5 w-2.5" />
                                                                                        {item.notes ? "Ver Nota" : "+ Nota"}
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        {item.notes && (
                                                                            <p className="text-[9px] text-primary/60 italic font-medium ml-1 border-l-2 pl-2 border-primary/20 line-clamp-2">"{item.notes}"</p>
                                                                        )}
                                                                    </motion.div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                                                            <div className="flex justify-between items-center px-1">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Neto</span>
                                                                <span className="text-2xl font-black text-primary tracking-tighter shadow-primary/20 drop-shadow-sm">{formatCurrency(subtotal)}</span>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div 
                                    key="step2"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex-1 min-h-0 overflow-hidden flex flex-col h-full"
                                >
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(handleSubmit)} id="order-payment-form" className="h-full">
                                            <div className="grid md:grid-cols-5 gap-0 flex-1 min-h-0 h-full bg-white/[0.02]">
                                                {/* Summary Column */}
                                                <div className='col-span-3 flex flex-col min-h-0 h-full p-8 pr-4'>
                                                    <div className="flex items-center justify-between mb-6">
                                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/60">Resumen del Pedido</h3>
                                                        <Badge variant="outline" className="text-[10px] font-bold border-white/5 bg-white/5 text-slate-400">
                                                            {cart.length} Ítems
                                                        </Badge>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto pr-4 -mr-4 custom-scrollbar">
                                                        <div className="space-y-4">
                                                            {cart.map((item) => (
                                                                <div key={item.service.id} className="bg-white/5 rounded-2xl p-5 border border-white/5 flex items-center justify-between">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-900 border border-white/10">
                                                                            <Avatar className="h-full w-full rounded-none">
                                                                                <AvatarImage src={item.service.imageUrl || undefined} className="object-cover" />
                                                                                <AvatarFallback className="bg-slate-900 text-xs">{item.service.name[0]}</AvatarFallback>
                                                                            </Avatar>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[11px] font-black uppercase tracking-tight text-white">{item.service.name}</p>
                                                                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{item.quantity} x {formatCurrency(item.service.price)}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm font-black text-white tracking-tighter">{formatCurrency(item.service.price * item.quantity)}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Payment Panel */}
                                                <div className='col-span-2 flex flex-col p-8 bg-white/[0.03] border-l border-white/5 relative h-full overflow-hidden'>
                                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/60 mb-6">Finalizar Cuenta</h3>
                                                    
                                                    <div className="flex-1 overflow-y-auto pr-4 -mr-4 custom-scrollbar">
                                                        <div className="flex flex-col gap-6 pb-8">
                                                        <FormField
                                                            control={form.control}
                                                            name="payNow"
                                                            render={({ field }) => (
                                                                <FormItem className="flex flex-row items-center justify-between rounded-[1.5rem] border border-primary/20 bg-primary/5 p-5 shadow-xl">
                                                                    <div className="space-y-0.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <Zap className="h-3 w-3 text-primary animate-pulse" />
                                                                            <FormLabel className="text-xs font-black uppercase tracking-widest text-primary">Facturar Ahora</FormLabel>
                                                                        </div>
                                                                        <p className="text-[9px] text-primary/60 font-medium italic">El cobro se procesará de inmediato.</p>
                                                                    </div>
                                                                    <FormControl>
                                                                        <Switch
                                                                            checked={field.value}
                                                                            onCheckedChange={field.onChange}
                                                                            className="data-[state=checked]:bg-primary shadow-lg shadow-primary/20"
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />

                                                        <AnimatePresence mode="wait">
                                                            {payNow ? (
                                                                <motion.div 
                                                                    key="payment-options"
                                                                    initial={{ opacity: 0, y: 20 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: -20 }}
                                                                    className="space-y-6"
                                                                >
                                                                    <FormField
                                                                        control={form.control}
                                                                        name="paymentMethod"
                                                                        render={({ field }) => (
                                                                            <FormItem className="space-y-4">
                                                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Método de Pago</FormLabel>
                                                                                <div className="grid grid-cols-3 gap-2">
                                                                                    {[
                                                                                        { id: 'Efectivo', icon: Wallet, label: 'Efectivo' },
                                                                                        { id: 'Sinpe Movil', icon: Smartphone, label: 'Sinpe' },
                                                                                        { id: 'Tarjeta', icon: CreditCard, label: 'Tarjeta' }
                                                                                    ].map((method) => (
                                                                                        <button
                                                                                            key={method.id}
                                                                                            type="button"
                                                                                            onClick={() => field.onChange(method.id)}
                                                                                            className={cn(
                                                                                                "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-2",
                                                                                                field.value === method.id 
                                                                                                    ? "bg-primary border-primary text-black shadow-lg shadow-primary/20" 
                                                                                                    : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
                                                                                            )}
                                                                                        >
                                                                                            <method.icon className="h-5 w-5" />
                                                                                            <span className="text-[8px] font-black uppercase tracking-widest">{method.label}</span>
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />

                                                                    {paymentMethod === 'Sinpe Movil' && (
                                                                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                                                                            {isLoadingSinpe ? (
                                                                                <p className="text-[10px] font-bold uppercase text-center py-4 animate-pulse">Buscando cuenta...</p>
                                                                            ) : targetSinpeAccount ? (
                                                                                <div className="p-5 rounded-[2rem] bg-primary/[0.03] border border-primary/20 space-y-4 text-center">
                                                                                    <p className='text-[10px] font-black text-primary/70 uppercase tracking-widest'>Transferir <span className='text-white'>{formatCurrency(grandTotal)}</span> a:</p>
                                                                                    <p className='text-3xl font-black font-mono tracking-tighter text-white'>{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                                                    <FormField
                                                                                        control={form.control}
                                                                                        name="paymentConfirmed"
                                                                                        render={({ field }) => (
                                                                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-xl border border-white/5 bg-slate-950/50 p-4 text-left">
                                                                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-lg border-primary/40" /></FormControl>
                                                                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-300">Pago Recibido</FormLabel>
                                                                                            </FormItem>
                                                                                        )}
                                                                                    />
                                                                                </div>
                                                                            ) : (
                                                                                <div className='p-4 bg-rose-500/10 text-rose-500 rounded-2xl text-[10px] font-black uppercase text-center border border-rose-500/20 tracking-widest'>No hay cuentas disponibles</div>
                                                                            )}
                                                                        </motion.div>
                                                                    )}

                                                                    {paymentMethod === 'Tarjeta' && (
                                                                        <FormField
                                                                            control={form.control}
                                                                            name="voucherNumber"
                                                                            render={({ field }) => (
                                                                                <FormItem className="space-y-2">
                                                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Voucher</FormLabel>
                                                                                    <FormControl><Input placeholder="ULTIMOS 6 DIGITOS" {...field} className="h-12 bg-white/5 border-white/10 rounded-xl text-center font-mono tracking-widest uppercase text-primary" /></FormControl>
                                                                                    <FormMessage />
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                    )}

                                                                    {paymentMethod === 'Efectivo' && (
                                                                        <div className="space-y-4">
                                                                            <div className="space-y-2">
                                                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Monto Recibido</Label>
                                                                                <Input type="text" inputMode="numeric" placeholder="₡ 0.00" value={cashTendered} onChange={handleCashTenderedChange} className="h-12 bg-white/5 border-white/10 rounded-xl text-right text-lg font-black tracking-tight" />
                                                                            </div>
                                                                            {cashTendered && grandTotal > 0 && numericCashTendered >= grandTotal && (
                                                                                <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Vuelto</span>
                                                                                    <span className="text-xl font-black text-emerald-400 tracking-tighter">{formatCurrency(numericCashTendered - grandTotal)}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </motion.div>
                                                            ) : (
                                                                <motion.div 
                                                                    key="pending-info"
                                                                    initial={{ opacity: 0 }} 
                                                                    animate={{ opacity: 1 }} 
                                                                    className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white/[0.02] rounded-[2rem] border border-dashed border-white/10"
                                                                >
                                                                    <Clock className="h-10 w-10 text-slate-700 mb-4" />
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-relaxed max-w-[150px]">El pedido se añadirá al saldo pendiente de la habitación</p>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>

                                                <div className="mt-auto pt-8 border-t border-white/10 space-y-4 bg-slate-950/20 px-8 pb-8">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                                                            <span>Subtotal Neto</span>
                                                            <span>{formatCurrency(subtotal)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                                                            <span>Impuestos ({cumulativeTaxPercentage}%)</span>
                                                            <span>{formatCurrency(totalTax)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center px-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Total Final</span>
                                                        <span className="text-4xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">{formatCurrency(grandTotal)}</span>
                                                    </div>
                                                </div>
                                                </div>
                                            </div>
                                        </form>
                                    </Form>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div 
                                    key="step3"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center justify-center text-center py-20 flex-1"
                                >
                                    <div className="relative">
                                        <motion.div 
                                            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                                            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                                            className="h-24 w-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20"
                                        >
                                            <CheckCircle className="h-12 w-12 text-black" />
                                        </motion.div>
                                        <motion.div 
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 2] }}
                                            transition={{ duration: 1, repeat: Infinity }}
                                            className="absolute inset-0 bg-emerald-500 rounded-[2.5rem] -z-10"
                                        />
                                    </div>
                                    <h3 className="text-4xl font-black uppercase italic tracking-tighter text-white mt-8">¡Pedido Enviado!</h3>
                                    <p className="text-slate-500 mt-2 font-medium tracking-wide max-w-sm">
                                        El pedido ha sido procesado con éxito y ya está en camino.
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="p-8 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
                            {step === 1 ? (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500 hover:text-white" id="orderservicedialog-cancel-button">
                                        Cancelar
                                    </Button>
                                    <Button 
                                        type="button" 
                                        onClick={() => setStep(2)} 
                                        disabled={cart.length === 0} 
                                        className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        id="orderservicedialog-next-button"
                                    >
                                        Continuar al Pago <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </>
                            ) : step === 2 ? (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => setStep(1)} className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500 hover:text-white" id="orderservicedialog-back-button">
                                        <ChevronLeft className="mr-2 h-4 w-4" /> Volver
                                    </Button>
                                    <div className="flex gap-3">
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            onClick={() => handleSubmit({ payNow: false, paymentConfirmed: false })} 
                                            disabled={isPending} 
                                            className="h-12 px-8 rounded-2xl border-white/10 bg-white/5 font-black uppercase tracking-widest text-[10px] text-slate-300 hover:bg-white/10"
                                            id="orderservicedialog-pending-button"
                                        >
                                            Dejar Pendiente
                                        </Button>
                                        <Button 
                                            type="button" 
                                            onClick={form.handleSubmit(handleSubmit)} 
                                            disabled={isPending || (payNow && !paymentMethod)} 
                                            className="h-12 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-emerald-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            id="orderservicedialog-pay-button"
                                        >
                                            {isPending ? <Zap className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                            Finalizar Pedido
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <Button 
                                    type="button" 
                                    onClick={() => setOpen(false)} 
                                    className="w-full h-14 rounded-2xl bg-white text-black font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl transition-all hover:scale-[1.01]"
                                    id="orderservicedialog-close-button"
                                >
                                    Entendido
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Note Dialog */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="sm:max-w-md bg-slate-900 border-white/10 shadow-2xl rounded-[2rem] p-8">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            Nota de Cocina
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            Agregue instrucciones especiales para este producto.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <Textarea 
                            placeholder="Ej: Sin cebolla, término medio, etc..." 
                            value={currentNoteValue}
                            onChange={(e) => setCurrentNoteValue(e.target.value)}
                            className="min-h-[120px] bg-white/5 border-white/10 rounded-2xl focus:ring-primary/20 text-white font-medium"
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setNoteDialogOpen(false)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancelar</Button>
                        <Button onClick={handleSaveNote} className="bg-primary text-black rounded-xl font-black uppercase tracking-widest text-[10px]">Guardar Nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
