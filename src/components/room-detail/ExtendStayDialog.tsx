'use client';

import { useState, useTransition, type ReactNode, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { extendStay } from '@/lib/actions/room.actions';
import { Clock, CheckCircle, Smartphone, AlertTriangle, LogOut, Zap, CalendarPlus, X, Tag, Sparkles, HelpCircle, Info, BadgePercent, ShieldCheck } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Room, Stay, RoomType, Order, SinpeAccount } from '@/types';
import CheckoutDialog from './CheckoutDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMinutes, addHours, addDays, addWeeks, addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';

interface ExtendStayDialogProps {
    children: ReactNode;
    stay?: Stay | null;
    room: Room;
    isOverdue?: boolean;
    onExtensionSuccess?: (invoiceId: string) => void;
}

const extendStaySchema = z.object({
    newPlanName: z.string({ required_error: 'Debe seleccionar un nuevo plan de estancia.' }),
    payNow: z.boolean().default(true),
    applyDiscount: z.boolean().default(false),
    customPrice: z.coerce.number().min(0, "El monto no puede ser negativo.").optional(),
    discountReason: z.string().optional(),
    customReasonText: z.string().optional(),
    waiveDigitalFee: z.boolean().default(true),
    paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']).optional(),
    paymentConfirmed: z.boolean().optional(),
    voucherNumber: z.string().optional(),
}).refine(data => {
    if (data.payNow) return !!data.paymentMethod;
    return true;
}, {
    message: "Debe seleccionar un método de pago.",
    path: ["paymentMethod"],
}).refine(data => {
    if (data.payNow && data.paymentMethod === 'Sinpe Movil') {
        return data.paymentConfirmed === true;
    }
    return true;
}, {
    message: 'Debe confirmar el pago SINPE.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (data.payNow && data.paymentMethod === 'Tarjeta' && data.voucherNumber) {
        return data.voucherNumber.trim() !== '';
    }
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});

export default function ExtendStayDialog({ children, stay, room, isOverdue, onExtensionSuccess }: ExtendStayDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [cashTendered, setCashTendered] = useState('');

    const roomTypesQuery = useMemoFirebase(() => {
        if (!firestore || !room) return null;
        return query(collection(firestore, 'roomTypes'), where('__name__', '==', room.roomTypeId));
    }, [firestore, room]);
    const { data: roomTypes, isLoading: isLoadingRoomTypes } = useCollection<RoomType>(roomTypesQuery);
    const roomType = useMemo(() => roomTypes?.[0], [roomTypes]);
    const availablePlans = useMemo(() => roomType?.pricePlans?.sort((a, b) => a.price - b.price) || [], [roomType]);

    const ordersQuery = useMemoFirebase(() => {
        if (!firestore || !stay) return null;
        return query(collection(firestore, 'orders'), where('stayId', '==', stay.id));
    }, [firestore, stay]);
    const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);

    const sinpeAccountsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), orderBy('createdAt', 'asc'));
    }, [firestore]);
    const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    const form = useForm<z.infer<typeof extendStaySchema>>({
        resolver: zodResolver(extendStaySchema),
        defaultValues: { 
            newPlanName: undefined, 
            payNow: true, 
            applyDiscount: false, 
            customPrice: undefined, 
            discountReason: 'Cliente Frecuente', 
            customReasonText: '', 
            waiveDigitalFee: true,
            paymentConfirmed: false, 
            voucherNumber: '', 
            paymentMethod: undefined 
        },
    });

    const selectedPlanName = form.watch('newPlanName');
    const payNow = true; // Forzado a true siempre
    const paymentMethod = form.watch('paymentMethod');
    const applyDiscount = form.watch('applyDiscount');
    const customPrice = form.watch('customPrice');
    const discountReason = form.watch('discountReason');
    const customReasonText = form.watch('customReasonText');
    const waiveDigitalFee = form.watch('waiveDigitalFee');

    const selectedPlan = useMemo(() => {
        if (!selectedPlanName || !availablePlans.length) return null;
        return availablePlans.find(p => p.name === selectedPlanName);
    }, [selectedPlanName, availablePlans]);

    // Set initial customPrice when plan is selected or discount enabled
    useEffect(() => {
        if (selectedPlan && applyDiscount && (customPrice === undefined || customPrice === 0)) {
            form.setValue('customPrice', selectedPlan.price);
        }
    }, [selectedPlan, applyDiscount, customPrice, form]);

    const effectivePlanPrice = useMemo(() => {
        if (!selectedPlan) return 0;
        if (applyDiscount && customPrice !== undefined && !isNaN(customPrice) && customPrice >= 0) {
            return customPrice;
        }
        return selectedPlan.price;
    }, [selectedPlan, applyDiscount, customPrice]);

    const discountAmount = useMemo(() => {
        if (!selectedPlan || !applyDiscount) return 0;
        return Math.max(0, selectedPlan.price - effectivePlanPrice);
    }, [selectedPlan, applyDiscount, effectivePlanPrice]);

    const isPriceHigherThanOriginal = useMemo(() => {
        return !!selectedPlan && applyDiscount && customPrice !== undefined && customPrice > selectedPlan.price;
    }, [selectedPlan, applyDiscount, customPrice]);

    const isMonthlyPlan = useMemo(() => {
        return selectedPlanName?.toLowerCase().includes('mensual') || selectedPlan?.unit === 'Months';
    }, [selectedPlanName, selectedPlan]);

    const extraFee = (paymentMethod === 'Sinpe Movil' || paymentMethod === 'Tarjeta') && !waiveDigitalFee ? 2000 : 0;
    const totalToPay = selectedPlan ? effectivePlanPrice + extraFee : 0;

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts || !selectedPlan) {
            return null;
        }
        const paymentAmount = totalToPay;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + paymentAmount) <= limit) {
                return account;
            }
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, selectedPlan, totalToPay]);

    const calculatedCheckOut = useMemo(() => {
        if (!selectedPlanName || !availablePlans.length || !stay) return null;

        const plan = availablePlans.find(p => p.name === selectedPlanName);
        if (!plan) return null;

        const now = new Date();
        const currentCheckOut = stay.expectedCheckOut.toDate();
        const baseDate = isOverdue && now > currentCheckOut ? now : currentCheckOut;

        let checkOutTime = new Date(baseDate);

        switch (plan.unit) {
            case 'Minutes': checkOutTime = addMinutes(baseDate, plan.duration); break;
            case 'Hours': checkOutTime = addHours(baseDate, plan.duration); break;
            case 'Days': checkOutTime = addDays(baseDate, plan.duration); break;
            case 'Weeks': checkOutTime = addWeeks(baseDate, plan.duration); break;
            case 'Months': checkOutTime = addMonths(baseDate, plan.duration); break;
        }

        return format(checkOutTime, 'p', { locale: es });
    }, [selectedPlanName, availablePlans, stay, isOverdue]);

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

    const onSubmit = (values: z.infer<typeof extendStaySchema>) => {
        if (!stay || !selectedPlan) return;

        if (values.applyDiscount) {
            if (values.customPrice === undefined || isNaN(values.customPrice) || values.customPrice < 0) {
                toast({ title: 'Monto inválido', description: 'Debe ingresar un monto válido con descuento.', variant: 'destructive' });
                return;
            }
            if (values.customPrice > selectedPlan.price) {
                toast({ 
                    title: 'Monto superior al plan', 
                    description: `El monto con descuento (${formatCurrency(values.customPrice)}) no puede superar la tarifa regular del plan (${formatCurrency(selectedPlan.price)}).`, 
                    variant: 'destructive' 
                });
                return;
            }
        }

        if (values.payNow && values.paymentMethod === 'Efectivo') {
            if (!cashTendered || numericCashTendered <= 0) {
                toast({ title: 'Monto en efectivo requerido', description: 'Debe ingresar el monto recibido en efectivo.', variant: 'destructive' });
                return;
            }
            if (numericCashTendered < totalToPay) {
                toast({ title: 'Monto insuficiente', description: `El monto ingresado (${formatCurrency(numericCashTendered)}) es menor al total a pagar (${formatCurrency(totalToPay)}).`, variant: 'destructive' });
                return;
            }
        }

        const finalReason = values.discountReason === 'Otro' 
            ? (values.customReasonText || 'Descuento especial') 
            : (values.discountReason || 'Descuento aplicado');

        startTransition(async () => {
            const result = await extendStay({
                stayId: stay.id,
                newPlanName: values.newPlanName,
                payNow: values.payNow,
                applyDiscount: values.applyDiscount,
                customPrice: values.applyDiscount ? values.customPrice : selectedPlan.price,
                discountAmount: values.applyDiscount ? discountAmount : 0,
                discountReason: values.applyDiscount && discountAmount > 0 ? finalReason : undefined,
                waiveDigitalFee: values.waiveDigitalFee,
                paymentMethod: values.paymentMethod,
                paymentConfirmed: values.paymentConfirmed,
                voucherNumber: values.voucherNumber,
            });
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                const id = result.invoiceId;
                setOpen(false);
                if (id && onExtensionSuccess) {
                    setTimeout(() => onExtensionSuccess(id), 200);
                } else {
                    toast({ title: '¡Éxito!', description: 'La estancia ha sido extendida.' });
                }
            }
        });
    };

    useEffect(() => {
        if (open) {
            form.reset({ 
                newPlanName: undefined, 
                payNow: true, 
                applyDiscount: false, 
                customPrice: undefined, 
                discountReason: 'Cliente Frecuente', 
                customReasonText: '', 
                waiveDigitalFee: true,
                paymentConfirmed: false, 
                voucherNumber: '', 
                paymentMethod: undefined 
            });
            setCashTendered('');
        }
    }, [open, form]);

    useEffect(() => {
        if (isMonthlyPlan) {
            form.setValue('paymentMethod', 'Efectivo');
        }
    }, [isMonthlyPlan, form]);

    useEffect(() => {
        setCashTendered('');
    }, [paymentMethod, effectivePlanPrice, waiveDigitalFee]);

    const isLoading = isLoadingRoomTypes || isLoadingOrders || isLoadingSinpe;
    const submitButtonText = payNow ? 'Pagar y Extender' : 'Confirmar Extensión';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            {stay && (
                <DialogContent className="w-[95vw] sm:max-w-lg p-0 border-none bg-slate-950/80 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2.5rem] [&>button]:hidden">
                    <div className="relative overflow-hidden">
                        {/* Custom Close Button */}
                        <button 
                            type="button" 
                            onClick={() => setOpen(false)} 
                            className="absolute right-6 top-6 z-50 p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:scale-105 active:scale-95 transition-all shadow-lg backdrop-blur-md"
                            id="custom-close-button"
                            data-testid="extendstaydialog-close-btn"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        {/* Decorative background glow */}
                        <div className={cn(
                            "absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none",
                            isOverdue ? "bg-rose-500" : "bg-primary"
                        )} />
                        
                        <div className="p-5 sm:p-8 relative z-10 max-h-[88vh] overflow-y-auto scrollbar-hide">
                            <DialogHeader className="mb-6">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "p-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-inner",
                                            isOverdue ? "text-rose-500" : "text-primary"
                                        )}>
                                            <CalendarPlus className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                                {isOverdue ? 'Gestionar Vencida' : 'Extender Estancia'}
                                            </DialogTitle>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl text-right">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-primary block">Habitación</span>
                                        <span className="text-base font-black text-white">{room.number}</span>
                                    </div>
                                </div>
                                <DialogDescription className="text-slate-400 font-medium leading-relaxed">
                                    {isOverdue
                                        ? `La estancia de ${stay.guestName} en Hab. ${room.number} ha finalizado. Seleccione un nuevo plan o proceda al cierre.`
                                        : `Añada tiempo adicional a la estancia de ${stay.guestName} (Hab. ${room.number}) y registre el cobro.`
                                    }
                                </DialogDescription>
                            </DialogHeader>

                            {/* Banner de Instrucciones para Descuentos */}
                            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2 mb-6">
                                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                                    <Info className="h-4 w-4 shrink-0 text-primary" />
                                    <span>Instrucciones para Editar Monto / Descuento:</span>
                                </div>
                                <p className="text-[11px] text-slate-300 leading-relaxed">
                                    Para cobrar una tarifa diferente al precio regular, active la opción <strong className="text-white font-semibold">«Aplicar Descuento al Cliente»</strong>. Esto habilitará la edición del monto a cobrar. El sistema registrará formalmente la diferencia como un descuento concedido y quedará documentado en el historial de la estancia y en la factura.
                                </p>
                            </div>

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" id="extendstaydialog-form-main" data-testid="extendstaydialog-main-form">
                                    <FormField
                                        control={form.control}
                                        name="newPlanName"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Nuevo Plan de Estancia</FormLabel>
                                                <Select onValueChange={(val) => {
                                                    field.onChange(val);
                                                    const p = availablePlans.find(plan => plan.name === val);
                                                    if (p) {
                                                        form.setValue('customPrice', p.price);
                                                    }
                                                }} value={field.value} disabled={isLoading || availablePlans.length === 0}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl text-slate-200 focus:ring-primary/20 transition-all font-bold" id="extendstaydialog-selecttrigger-1" data-testid="extendstaydialog-extend-plan-select">
                                                            <SelectValue placeholder={isLoading ? "Cargando planes..." : "Seleccione un plan de extensión"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                                                        {availablePlans.map(plan => (
                                                            <SelectItem key={plan.name} value={plan.name} className="py-3 font-bold focus:bg-primary/20 focus:text-primary">
                                                                <div className="flex justify-between items-center w-full gap-4">
                                                                    <span>{plan.name}</span>
                                                                    <span className="text-primary font-mono">{formatCurrency(plan.price)}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <AnimatePresence>
                                        {calculatedCheckOut && (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0, y: -10 }}
                                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                                className="p-5 bg-primary/5 rounded-3xl border border-primary/20 shadow-lg shadow-primary/5"
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-primary/70">Nueva Salida Estimada</p>
                                                        <p className="text-xl font-black text-white italic tracking-tighter">{calculatedCheckOut}</p>
                                                    </div>
                                                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                                                        <Clock className="h-6 w-6 text-primary" />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {selectedPlan && (
                                        <div className="space-y-6 pt-2">
                                            {/* SECCIÓN DE DESCUENTO EDITABLE */}
                                            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                                                <FormField
                                                    control={form.control}
                                                    name="applyDiscount"
                                                    render={({ field }) => (
                                                        <div className="flex items-center justify-between">
                                                            <div className="space-y-0.5">
                                                                <div className="flex items-center gap-2">
                                                                    <BadgePercent className="h-4 w-4 text-emerald-400" />
                                                                    <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                                                                        Aplicar Descuento al Cliente
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400">
                                                                    Habilitar edición de monto de extensión
                                                                </p>
                                                            </div>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={(checked) => {
                                                                        field.onChange(checked);
                                                                        if (checked && selectedPlan) {
                                                                            form.setValue('customPrice', selectedPlan.price);
                                                                        }
                                                                    }}
                                                                    id="extendstaydialog-discount-switch"
                                                                    data-testid="extendstaydialog-discount-switch"
                                                                />
                                                            </FormControl>
                                                        </div>
                                                    )}
                                                />

                                                <AnimatePresence>
                                                    {applyDiscount && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0, y: -8 }}
                                                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                                                            exit={{ opacity: 0, height: 0, y: -8 }}
                                                            className="space-y-4 pt-3 border-t border-white/10 overflow-hidden"
                                                        >
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                <FormField
                                                                    control={form.control}
                                                                    name="customPrice"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                                                                Monto con Descuento (₡)
                                                                            </FormLabel>
                                                                            <FormControl>
                                                                                <Input
                                                                                    type="number"
                                                                                    min={0}
                                                                                    max={selectedPlan.price}
                                                                                    value={field.value ?? ''}
                                                                                    onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                                                                                    className="h-12 bg-white/5 border-emerald-500/30 focus:border-emerald-500 rounded-xl text-lg font-mono font-bold text-white"
                                                                                    placeholder="₡ 0"
                                                                                    id="extendstaydialog-custom-price-input"
                                                                                    data-testid="extendstaydialog-custom-price-input"
                                                                                />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                <FormField
                                                                    control={form.control}
                                                                    name="discountReason"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                                Motivo del Descuento
                                                                            </FormLabel>
                                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                                <FormControl>
                                                                                    <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold" id="extendstaydialog-discount-reason-select" data-testid="extendstaydialog-discount-reason-select">
                                                                                        <SelectValue placeholder="Seleccione motivo" />
                                                                                    </SelectTrigger>
                                                                                </FormControl>
                                                                                <SelectContent className="bg-slate-900 border-white/10 rounded-xl">
                                                                                    <SelectItem value="Cliente Frecuente" className="font-bold">Cliente Frecuente</SelectItem>
                                                                                    <SelectItem value="Cortesía Comercial" className="font-bold">Cortesía Comercial</SelectItem>
                                                                                    <SelectItem value="Promoción Especial" className="font-bold">Promoción Especial</SelectItem>
                                                                                    <SelectItem value="Compensación de Servicio" className="font-bold">Compensación de Servicio</SelectItem>
                                                                                    <SelectItem value="Autorización Administrativa" className="font-bold">Autorización Administrativa</SelectItem>
                                                                                    <SelectItem value="Otro" className="font-bold">Otro (Especificar)</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </div>

                                                            {discountReason === 'Otro' && (
                                                                <FormField
                                                                    control={form.control}
                                                                    name="customReasonText"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                                Especifique el Motivo
                                                                            </FormLabel>
                                                                            <FormControl>
                                                                                <Input
                                                                                    {...field}
                                                                                    placeholder="Ej. Promoción aprobada por gerencia..."
                                                                                    className="h-11 bg-white/5 border-white/10 rounded-xl text-sm"
                                                                                    id="extendstaydialog-custom-reason-input"
                                                                                    data-testid="extendstaydialog-custom-reason-input"
                                                                                />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            )}

                                                            {isPriceHigherThanOriginal && (
                                                                <p className="text-xs text-rose-400 font-bold flex items-center gap-1.5">
                                                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                                                    El monto con descuento no puede ser mayor que la tarifa regular ({formatCurrency(selectedPlan.price)}).
                                                                </p>
                                                            )}

                                                            {discountAmount > 0 && (
                                                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <Tag className="h-4 w-4 text-emerald-400" />
                                                                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                                                                            Descuento Aplicado al Cliente
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-sm font-black text-emerald-300">
                                                                        -{formatCurrency(discountAmount)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* SECCIÓN DE MÉTODO DE PAGO */}
                                            <div className="space-y-6 rounded-[2rem] border border-primary/20 bg-primary/[0.03] p-6 shadow-xl">
                                                <FormField
                                                    control={form.control}
                                                    name="paymentMethod"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-3">
                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Método de Pago</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold" id="extendstaydialog-selecttrigger-2" data-testid="extendstaydialog-2-select">
                                                                        <SelectValue placeholder="Seleccione método" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent className="bg-slate-900 border-white/10 rounded-xl">
                                                                    <SelectItem value="Efectivo" className="py-2.5 font-bold">Efectivo</SelectItem>
                                                                    {!isMonthlyPlan && <SelectItem value="Sinpe Movil" className="py-2.5 font-bold">Sinpe Móvil</SelectItem>}
                                                                    {!isMonthlyPlan && <SelectItem value="Tarjeta" className="py-2.5 font-bold">Tarjeta</SelectItem>}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                {/* Checkbox para exonerar recargo digital de ₡2000 */}
                                                {(paymentMethod === 'Sinpe Movil' || paymentMethod === 'Tarjeta') && (
                                                    <FormField
                                                        control={form.control}
                                                        name="waiveDigitalFee"
                                                        render={({ field }) => (
                                                            <label className="flex items-center space-x-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3.5 cursor-pointer hover:bg-slate-950/60 transition-all">
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                    className="h-5 w-5 rounded-md border-primary/50 data-[state=checked]:bg-primary"
                                                                    id="extendstaydialog-waive-fee-checkbox"
                                                                    data-testid="extendstaydialog-waive-fee-checkbox"
                                                                />
                                                                <div className="space-y-0.5 ml-3">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                                                                        <span className="text-xs font-bold text-slate-200">
                                                                            Exonerar recargo digital ({formatCurrency(2000)})
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400">
                                                                        No cobrar el recargo de SINPE / Tarjeta para esta extensión.
                                                                    </p>
                                                                </div>
                                                            </label>
                                                        )}
                                                    />
                                                )}

                                                {paymentMethod === 'Sinpe Movil' && (
                                                    <div className='space-y-4 pt-4 border-t border-primary/10'>
                                                        {isLoadingSinpe ? <p className="text-center text-[10px] uppercase font-bold animate-pulse">Consultando canales...</p> : targetSinpeAccount ? (
                                                            <div className="space-y-4">
                                                                <div className='p-5 bg-slate-950/50 rounded-2xl text-center border border-primary/20 shadow-inner'>
                                                                    <p className='text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 mb-2'>Enviar <span className='text-white font-bold'>{formatCurrency(totalToPay)}</span> a:</p>
                                                                    <p className='text-2xl sm:text-3xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]'>{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                                    <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1'>{targetSinpeAccount.accountHolder}</p>
                                                                </div>
                                                                <FormField
                                                                    control={form.control}
                                                                    name="paymentConfirmed"
                                                                    render={({ field }) => (
                                                                        <label className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border border-white/5 bg-slate-950/50 p-5 shadow-sm cursor-pointer">
                                                                            <Checkbox 
                                                                                checked={field.value} 
                                                                                onCheckedChange={field.onChange} 
                                                                                className="h-5 w-5 rounded-md border-primary/50 data-[state=checked]:bg-primary" 
                                                                                id="extendstaydialog-checkbox-1" 
                                                                                data-testid="extendstaydialog-confirm-payment-checkbox" 
                                                                            />
                                                                            <div className="space-y-1 ml-3">
                                                                                <span className="text-xs font-black uppercase tracking-widest text-slate-300">Pago verificado</span>
                                                                                <p className="text-[9px] text-slate-500 font-medium italic">* Verifique la recepción en la cuenta bancaria.</p>
                                                                            </div>
                                                                        </label>
                                                                    )}
                                                                />
                                                            </div>
                                                        ) : <p className='p-4 bg-rose-500/10 text-rose-500 rounded-2xl text-[10px] font-black uppercase text-center border border-rose-500/20'>Sin canales SINPE disponibles.</p>}
                                                    </div>
                                                )}
                                                {paymentMethod === 'Tarjeta' && (
                                                    <FormField
                                                        control={form.control}
                                                        name="voucherNumber"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary/70">N° de Voucher (Últimos 4-6)</FormLabel>
                                                                <FormControl><Input {...field} className="h-12 bg-white/5 border-white/10 rounded-xl font-mono text-center text-lg uppercase" id="extendstaydialog-input-1" data-testid="extendstaydialog-voucher-number-input" /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                )}
                                                {paymentMethod === 'Efectivo' && (
                                                    <div className="space-y-4 pt-4 border-t border-primary/10">
                                                        <FormItem>
                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary/70">Monto Recibido</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    placeholder="₡ 0.00"
                                                                    value={cashTendered}
                                                                    onChange={handleCashTenderedChange}
                                                                    className="h-14 bg-white/5 border-white/10 rounded-xl text-right text-xl font-black text-white" id="extendstaydialog-input-monto-recibido" data-testid="extendstaydialog-payment-amount-input"
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                        <AnimatePresence>
                                                            {cashTendered && selectedPlan && numericCashTendered >= totalToPay && (
                                                                <motion.div 
                                                                    initial={{ opacity: 0, y: 5 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    className="flex justify-between items-center p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20"
                                                                >
                                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Vuelto Sugerido</span>
                                                                    <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                                                                        {formatCurrency(numericCashTendered - totalToPay)}
                                                                    </span>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                )}

                                                <div className="space-y-2 p-4 bg-primary/10 rounded-2xl border border-primary/20">
                                                    {applyDiscount && discountAmount > 0 && (
                                                        <div className="flex justify-between items-center text-xs text-slate-400">
                                                            <span>Precio Original:</span>
                                                            <span className="line-through">{formatCurrency(selectedPlan.price)}</span>
                                                        </div>
                                                    )}
                                                    {applyDiscount && discountAmount > 0 && (
                                                        <div className="flex justify-between items-center text-xs text-emerald-400 font-bold">
                                                            <span>Descuento aplicado:</span>
                                                            <span>-{formatCurrency(discountAmount)}</span>
                                                        </div>
                                                    )}
                                                    {(paymentMethod === 'Sinpe Movil' || paymentMethod === 'Tarjeta') && (
                                                        <div className="flex justify-between items-center text-xs text-slate-400">
                                                            <span>Recargo Digital:</span>
                                                            {waiveDigitalFee ? (
                                                                <span className="text-emerald-400 font-bold">Exonerado (₡0)</span>
                                                            ) : (
                                                                <span>+{formatCurrency(2000)}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center pt-2 border-t border-primary/20">
                                                        <span className='text-[10px] font-black uppercase tracking-widest text-primary'>Total a Cobrar</span>
                                                        <span className="font-black text-xl text-white tracking-tighter">{formatCurrency(totalToPay)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                                        <Button 
                                            type="submit" 
                                            disabled={isPending || isLoading || !selectedPlanName || isPriceHigherThanOriginal} 
                                            className="h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                                            id="extendstaydialog-button-1" 
                                            data-testid="extendstaydialog-submit-button"
                                        >
                                            {isPending ? <Zap className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
                                            {isPending ? 'Procesando...' : submitButtonText}
                                        </Button>
                                        
                                        {isOverdue && (
                                            <CheckoutDialog stay={stay} room={room} orders={orders || []} onCheckoutSuccess={onExtensionSuccess}>
                                                <Button type="button" variant="ghost" className="h-14 rounded-2xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/20 hover:text-white font-black uppercase tracking-[0.2em] text-[11px] transition-all hover:scale-[1.02] active:scale-[0.98]" id="extendstaydialog-button-realizar-check-out" data-testid="extendstaydialog-action-checkout-button">
                                                    <LogOut className="mr-2 h-4 w-4" /> Realizar Check-Out
                                                </Button>
                                            </CheckoutDialog>
                                        )}
                                    </div>
                                </form>
                            </Form>
                        </div>
                    </div>
                </DialogContent>
            )}
        </Dialog>
    );
}
