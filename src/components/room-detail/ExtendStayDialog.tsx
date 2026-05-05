'use client';

import { useState, useTransition, type ReactNode, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { extendStay } from '@/lib/actions/room.actions';
import { Clock, CheckCircle, Smartphone, AlertTriangle, LogOut, Zap, CalendarPlus } from 'lucide-react';
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
    payNow: z.boolean().default(false),
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
        defaultValues: { newPlanName: undefined, payNow: true, paymentConfirmed: false, voucherNumber: '', paymentMethod: undefined },
    });

    const selectedPlanName = form.watch('newPlanName');
    const payNow = form.watch('payNow');
    const paymentMethod = form.watch('paymentMethod');

    const selectedPlan = useMemo(() => {
        if (!selectedPlanName || !availablePlans.length) return null;
        return availablePlans.find(p => p.name === selectedPlanName);
    }, [selectedPlanName, availablePlans]);

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts || !selectedPlan) {
            return null;
        }
        const paymentAmount = selectedPlan.price;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + paymentAmount) <= limit) {
                return account;
            }
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, selectedPlan]);

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
        if (!stay) return;
        startTransition(async () => {
            const result = await extendStay({
                stayId: stay.id,
                ...values,
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
            form.reset({ newPlanName: undefined, payNow: false, paymentConfirmed: false, voucherNumber: '', paymentMethod: undefined });
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

    const isLoading = isLoadingRoomTypes || isLoadingOrders || isLoadingSinpe;
    const submitButtonText = payNow ? 'Pagar y Extender' : 'Confirmar Extensión';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            {stay && (
                <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto scrollbar-hide p-0 border-none bg-slate-950/60 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2.5rem]">
                    <div className="relative overflow-hidden">
                        {/* Decorative background glow */}
                        <div className={cn(
                            "absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none",
                            isOverdue ? "bg-rose-500" : "bg-primary"
                        )} />
                        
                        <div className="p-8 relative z-10">
                            <DialogHeader className="mb-8">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={cn(
                                        "p-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-inner",
                                        isOverdue ? "text-rose-500" : "text-primary"
                                    )}>
                                        <CalendarPlus className="h-6 w-6" />
                                    </div>
                                    <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                        {isOverdue ? 'Gestionar Vencida' : 'Extender Estancia'}
                                    </DialogTitle>
                                </div>
                                <DialogDescription className="text-slate-400 font-medium leading-relaxed">
                                    {isOverdue
                                        ? `La estancia de ${stay.guestName} ha finalizado. Seleccione un nuevo plan o proceda al cierre.`
                                        : `Añada tiempo adicional a la estancia actual de ${stay.guestName}.`
                                    }
                                </DialogDescription>
                            </DialogHeader>

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" id="extendstaydialog-form-main" data-testid="extendstaydialog-main-form">
                                    <FormField
                                        control={form.control}
                                        name="newPlanName"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Nuevo Plan de Estancia</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} disabled={isLoading || availablePlans.length === 0}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl text-slate-200 focus:ring-primary/20 transition-all font-bold" id="extendstaydialog-selecttrigger-1" data-testid="extendstaydialog-extend-plan-select">
                                                            <SelectValue placeholder={isLoading ? "Cargando planes..." : "Seleccione un plan de extensión"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                                                        {availablePlans.map(plan => (
                                                            <SelectItem key={plan.name} value={plan.name} className="py-3 font-bold focus:bg-primary/20 focus:text-primary">
                                                                {plan.name} — <span className="text-primary">{formatCurrency(plan.price)}</span>
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
                                        <div className="space-y-6 pt-6 border-t border-white/5">
                                            <FormField
                                                control={form.control}
                                                name="payNow"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center justify-between rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-5 shadow-inner group hover:border-primary/30 transition-all">
                                                        <div className="space-y-1">
                                                            <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-300">Pagar Extensión Ahora</FormLabel>
                                                            <p className="text-[10px] text-slate-500 font-medium">Genera factura inmediata por este tiempo.</p>
                                                        </div>
                                                        <FormControl>
                                                            <Switch
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange} 
                                                                className="data-[state=checked]:bg-primary"
                                                                id="extendstaydialog-switch-1" 
                                                                data-testid="extendstaydialog-pay-extension-switch"
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            
                                            <AnimatePresence>
                                                {payNow && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="space-y-6 rounded-[2rem] border border-primary/20 bg-primary/[0.03] p-6 shadow-xl"
                                                    >
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
                                                                            <SelectItem value="Sinpe Movil" className="py-2.5 font-bold">Sinpe Móvil</SelectItem>
                                                                            <SelectItem value="Tarjeta" className="py-2.5 font-bold">Tarjeta</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        {paymentMethod === 'Sinpe Movil' && (
                                                            <div className='space-y-4 pt-4 border-t border-primary/10'>
                                                                {isLoadingSinpe ? <p className="text-center text-[10px] uppercase font-bold animate-pulse">Consultando canales...</p> : targetSinpeAccount ? (
                                                                    <div className="space-y-4">
                                                                        <div className='p-5 bg-slate-950/50 rounded-2xl text-center border border-primary/20 shadow-inner'>
                                                                            <p className='text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 mb-2'>Enviar <span className='text-white'>{formatCurrency(selectedPlan.price)}</span> a:</p>
                                                                            <p className='text-3xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]'>{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                                            <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1'>{targetSinpeAccount.accountHolder}</p>
                                                                        </div>
                                                                        <FormField
                                                                            control={form.control}
                                                                            name="paymentConfirmed"
                                                                            render={({ field }) => (
                                                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border border-white/5 bg-slate-950/50 p-5 shadow-sm">
                                                                                    <FormControl>
                                                                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 rounded-md border-primary/50 data-[state=checked]:bg-primary" id="extendstaydialog-checkbox-1" data-testid="extendstaydialog-confirm-payment-checkbox" />
                                                                                    </FormControl>
                                                                                    <div className="space-y-1">
                                                                                        <FormLabel className="text-xs font-black uppercase tracking-widest text-slate-300">Pago verificado</FormLabel>
                                                                                        <p className="text-[9px] text-slate-500 font-medium italic">* Verifique la recepción en la cuenta bancaria.</p>
                                                                                    </div>
                                                                                </FormItem>
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
                                                                    {cashTendered && selectedPlan && numericCashTendered >= selectedPlan.price && (
                                                                        <motion.div 
                                                                            initial={{ opacity: 0, y: 5 }}
                                                                            animate={{ opacity: 1, y: 0 }}
                                                                            className="flex justify-between items-center p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20"
                                                                        >
                                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Vuelto Sugerido</span>
                                                                            <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                                                                                {formatCurrency(numericCashTendered - selectedPlan.price)}
                                                                            </span>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        )}
                                                        {paymentMethod && paymentMethod !== 'Sinpe Movil' && (
                                                            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 flex justify-between items-center">
                                                                <span className='text-[10px] font-black uppercase tracking-widest text-primary'>Total a Cobrar</span>
                                                                <span className="font-black text-xl text-white tracking-tighter">{formatCurrency(selectedPlan.price)}</span>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                                        <Button 
                                            type="submit" 
                                            disabled={isPending || isLoading || !selectedPlanName} 
                                            className="h-14 rounded-2xl bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                                            id="extendstaydialog-button-1" 
                                            data-testid="extendstaydialog-submit-button"
                                        >
                                            {isPending ? <Zap className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
                                            {isPending ? 'Procesando...' : submitButtonText}
                                        </Button>
                                        
                                        {isOverdue && (
                                            <CheckoutDialog stay={stay} room={room} orders={orders || []} onCheckoutSuccess={onExtensionSuccess}>
                                                <Button type="button" variant="ghost" className="h-14 rounded-2xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-black uppercase tracking-[0.2em] text-[11px] transition-all hover:scale-[1.02] active:scale-[0.98]" id="extendstaydialog-button-realizar-check-out" data-testid="extendstaydialog-action-checkout-button">
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
