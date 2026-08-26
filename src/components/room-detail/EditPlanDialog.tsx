'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Room, Stay, RoomType, SinpeAccount } from '@/types';
import { updateStayPlan } from '@/lib/actions/room.actions';
import { addMinutes, addHours, addDays, addWeeks, addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Wallet, Smartphone, CreditCard, CheckCircle, Zap, X, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface EditPlanDialogProps {
    children: React.ReactNode;
    stay: Stay;
    room: Room;
    onSuccess?: () => void;
}

const editPlanSchema = z.object({
    newPlanName: z.string({ required_error: 'Debe seleccionar un plan de estancia.' }),
    paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta'], {
        required_error: 'Debe seleccionar un método de pago.',
    }),
    paymentConfirmed: z.boolean().default(false),
    voucherNumber: z.string().nullable().optional(),
}).refine(data => {
    if (data.paymentMethod === 'Sinpe Movil') return !!data.paymentConfirmed;
    return true;
}, {
    message: 'Debe confirmar que el pago por SINPE fue verificado.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (data.paymentMethod === 'Tarjeta') return data.voucherNumber && data.voucherNumber.trim() !== '';
    return true;
}, {
    message: 'El número de voucher es requerido.',
    path: ['voucherNumber'],
});

export default function EditPlanDialog({ children, stay, room, onSuccess }: EditPlanDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const [cashTendered, setCashTendered] = useState('');
    const [cashError, setCashError] = useState<string | null>(null);

    const roomTypesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'roomTypes'));
    }, [firestore]);
    const { data: roomTypes, isLoading: isLoadingRoomTypes } = useCollection<RoomType>(roomTypesQuery);

    const sinpeAccountsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sinpeAccounts'), where('isActive', '==', true));
    }, [firestore]);
    const { data: activeSinpeAccounts } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    const roomType = useMemo(() => roomTypes?.find(rt => rt.id === room.roomTypeId), [roomTypes, room]);
    const availablePlans = useMemo(() => roomType?.pricePlans?.sort((a, b) => a.price - b.price) || [], [roomType]);

    // Calculate time elapsed since checkIn
    const checkInDate = useMemo(() => {
        if (!stay?.checkIn) return new Date();
        return stay.checkIn.toDate ? stay.checkIn.toDate() : new Date((stay.checkIn as any).seconds * 1000);
    }, [stay]);

    const elapsedMinutes = useMemo(() => {
        return Math.floor((new Date().getTime() - checkInDate.getTime()) / (1000 * 60));
    }, [checkInDate]);

    const isEditable = elapsedMinutes <= 10;

    const form = useForm<z.infer<typeof editPlanSchema>>({
        resolver: zodResolver(editPlanSchema),
        defaultValues: {
            newPlanName: stay.pricePlanName || undefined,
            paymentMethod: stay.paymentMethod as any || 'Efectivo',
            paymentConfirmed: false,
            voucherNumber: stay.voucherNumber || '',
        },
    });

    const selectedPlanName = form.watch('newPlanName');
    const paymentMethod = form.watch('paymentMethod');

    const selectedPlan = useMemo(() => {
        if (!selectedPlanName || !availablePlans.length) return null;
        return availablePlans.find(p => p.name === selectedPlanName);
    }, [selectedPlanName, availablePlans]);

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts || !selectedPlan) return null;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + selectedPlan.price) <= limit) return account;
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, selectedPlan]);

    const calculatedCheckOut = useMemo(() => {
        if (!selectedPlan || !checkInDate) return null;
        let checkOutTime = new Date(checkInDate);
        switch (selectedPlan.unit) {
            case 'Minutes': checkOutTime = addMinutes(checkInDate, selectedPlan.duration); break;
            case 'Hours': checkOutTime = addHours(checkInDate, selectedPlan.duration); break;
            case 'Days': checkOutTime = addDays(checkInDate, selectedPlan.duration); break;
            case 'Weeks': checkOutTime = addWeeks(checkInDate, selectedPlan.duration); break;
            case 'Months': checkOutTime = addMonths(checkInDate, selectedPlan.duration); break;
        }
        return format(checkOutTime, 'p', { locale: es });
    }, [selectedPlan, checkInDate]);

    useEffect(() => {
        if (open) {
            form.reset({
                newPlanName: stay.pricePlanName || undefined,
                paymentMethod: (stay.paymentMethod as any) || 'Efectivo',
                paymentConfirmed: false,
                voucherNumber: stay.voucherNumber || '',
            });
            setCashTendered(stay.paymentAmount ? new Intl.NumberFormat('en-US').format(stay.paymentAmount) : '');
            setCashError(null);
        }
    }, [open, form, stay]);

    const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        setCashError(null);
        if (rawValue === '') {
            setCashTendered('');
        } else {
            setCashTendered(new Intl.NumberFormat('en-US').format(Number(rawValue)));
        }
    };

    const numericCashTendered = useMemo(() => {
        return Number(cashTendered.replace(/\D/g, ''));
    }, [cashTendered]);

    const onSubmit = (values: z.infer<typeof editPlanSchema>) => {
        if (!stay) return;

        // Strict Cash validation: Monto recibido en efectivo NUNCA en blanco
        if (values.paymentMethod === 'Efectivo') {
            if (!cashTendered || numericCashTendered <= 0) {
                setCashError('Debe ingresar el monto recibido en efectivo.');
                toast({ title: 'Monto en efectivo requerido', description: 'Por favor ingrese el monto recibido.', variant: 'destructive' });
                return;
            }
            if (selectedPlan && numericCashTendered < selectedPlan.price) {
                setCashError(`El monto debe ser igual o mayor a ${formatCurrency(selectedPlan.price)}.`);
                toast({ title: 'Monto insuficiente', description: 'El monto ingresado es menor al precio del nuevo plan.', variant: 'destructive' });
                return;
            }
        }

        startTransition(async () => {
            const result = await updateStayPlan({
                stayId: stay.id,
                newPlanName: values.newPlanName,
                paymentMethod: values.paymentMethod,
                paymentConfirmed: values.paymentConfirmed,
                voucherNumber: values.voucherNumber,
                paymentAmount: values.paymentMethod === 'Efectivo' ? numericCashTendered : selectedPlan?.price,
            });

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                setOpen(false);
                toast({ 
                    title: '¡Plan de Estancia Actualizado!', 
                    description: `Nuevo plan: ${values.newPlanName}. Hora de salida recalculada: ${calculatedCheckOut}` 
                });
                if (onSuccess) onSuccess();
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            {stay && (
                <DialogContent className="w-[95vw] sm:max-w-md p-0 border-none bg-slate-950/60 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2.5rem] [&>button]:hidden">
                    <div className="relative overflow-hidden">
                        <button 
                            type="button" 
                            onClick={() => setOpen(false)} 
                            className="absolute right-6 top-6 z-50 p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:scale-105 active:scale-95 transition-all shadow-lg backdrop-blur-md"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="p-5 sm:p-8 relative z-10 max-h-[85vh] overflow-y-auto scrollbar-hide">
                            <DialogHeader className="mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                        <Clock className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">
                                            Editar Plan de Estancia
                                        </DialogTitle>
                                        <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mt-0.5">
                                            Permitido los primeros 10 min (Transcurridos: {elapsedMinutes} min)
                                        </p>
                                    </div>
                                </div>
                            </DialogHeader>

                            {!isEditable ? (
                                <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-center space-y-3">
                                    <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto" />
                                    <h4 className="text-sm font-black text-rose-400 uppercase">Tiempo Límite Expirado</h4>
                                    <p className="text-xs text-slate-300">
                                        Han transcurrido {elapsedMinutes} minutos desde el Check-in. La edición del plan inicial solo se permite en los primeros 10 minutos.
                                    </p>
                                    <Button onClick={() => setOpen(false)} variant="secondary" className="mt-2 rounded-xl">
                                        Cerrar
                                    </Button>
                                </div>
                            ) : (
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                        {/* Select New Price Plan */}
                                        <FormField
                                            control={form.control}
                                            name="newPlanName"
                                            render={({ field }) => (
                                                <FormItem className="space-y-2">
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                                                        Nuevo Plan de Estancia
                                                    </FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl text-slate-200 font-bold">
                                                                <SelectValue placeholder="Seleccione nuevo plan" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
                                                            {availablePlans.map((plan) => (
                                                                <SelectItem key={plan.name} value={plan.name} className="focus:bg-white/10 py-3">
                                                                    <div className="flex items-center justify-between w-full gap-4">
                                                                        <span className="font-bold">{plan.name} ({plan.duration} {plan.unit})</span>
                                                                        <span className="font-mono text-emerald-400 font-black">{formatCurrency(plan.price)}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Recalculated Output Summary */}
                                        {selectedPlan && (
                                            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-400">Hora de Check-in:</span>
                                                    <span className="font-mono font-bold text-white">{format(checkInDate, 'p', { locale: es })}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-400">Nueva Hora de Salida:</span>
                                                    <span className="font-mono font-bold text-amber-400">{calculatedCheckOut}</span>
                                                </div>
                                                <div className="flex justify-between text-sm pt-2 border-t border-white/5">
                                                    <span className="font-bold text-slate-300">Nuevo Total Estancia:</span>
                                                    <span className="font-mono font-black text-emerald-400">{formatCurrency(selectedPlan.price)}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Re-ask Payment Method */}
                                        <div className="space-y-4 pt-4 border-t border-white/5">
                                            <FormField
                                                control={form.control}
                                                name="paymentMethod"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-3">
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                                                            Método de Pago
                                                        </FormLabel>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {[
                                                                { value: 'Efectivo', label: 'Efectivo', icon: Wallet },
                                                                { value: 'Sinpe Movil', label: 'Sinpe Móvil', icon: Smartphone },
                                                                { value: 'Tarjeta', label: 'Tarjeta', icon: CreditCard },
                                                            ].map((item) => {
                                                                const Icon = item.icon;
                                                                const isSelected = field.value === item.value;
                                                                return (
                                                                    <button
                                                                        key={item.value}
                                                                        type="button"
                                                                        onClick={() => field.onChange(item.value)}
                                                                        className={cn(
                                                                            "h-16 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all",
                                                                            isSelected
                                                                                ? "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
                                                                                : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                                                                        )}
                                                                    >
                                                                        <Icon className="h-5 w-5" />
                                                                        <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {/* SINPE Mobile Details */}
                                            {paymentMethod === 'Sinpe Movil' && (
                                                <div className="space-y-4 pt-2">
                                                    {targetSinpeAccount ? (
                                                        <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 text-center space-y-2">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-primary">Transferir {formatCurrency(selectedPlan?.price || 0)} a:</span>
                                                            <p className="text-2xl font-black font-mono text-white">{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase">{targetSinpeAccount.accountHolder}</p>
                                                            
                                                            <FormField
                                                                control={form.control}
                                                                name="paymentConfirmed"
                                                                render={({ field }) => (
                                                                    <FormItem className="pt-2">
                                                                        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 text-left">
                                                                            <FormControl>
                                                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                                            </FormControl>
                                                                            <span className="text-xs font-bold text-white">Pago verificado en cuenta</span>
                                                                        </div>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="p-3 bg-white/5 text-slate-400 rounded-xl text-xs text-center border border-white/10">
                                                            Sin cuenta SINPE configurada
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Card Voucher */}
                                            {paymentMethod === 'Tarjeta' && (
                                                <FormField
                                                    control={form.control}
                                                    name="voucherNumber"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-2 pt-2">
                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">N° Voucher de Tarjeta *</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} value={field.value || ''} placeholder="Ej: 123456" className="h-12 bg-white/5 border-white/10 font-mono text-white text-center rounded-xl" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            {/* Cash Tendered Input (Mandatory field for Efectivo) */}
                                            {paymentMethod === 'Efectivo' && (
                                                <div className="space-y-3 pt-2">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                                                            Monto Recibido en Efectivo *
                                                        </label>
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            placeholder="₡ 0.00"
                                                            value={cashTendered}
                                                            onChange={handleCashTenderedChange}
                                                            className={cn(
                                                                "h-14 bg-white/5 border-white/10 rounded-xl text-right text-xl font-black text-white",
                                                                cashError && "border-rose-500 focus:ring-rose-500"
                                                            )}
                                                        />
                                                        {cashError && (
                                                            <p className="text-xs text-rose-400 font-semibold mt-1">{cashError}</p>
                                                        )}
                                                    </div>

                                                    {cashTendered && selectedPlan && numericCashTendered >= selectedPlan.price && (
                                                        <div className="flex justify-between items-center p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Vuelto Sugerido</span>
                                                            <span className="text-xl font-black text-emerald-400">
                                                                {formatCurrency(numericCashTendered - selectedPlan.price)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4">
                                            <Button
                                                type="submit"
                                                disabled={isPending || !selectedPlanName || (paymentMethod === 'Efectivo' && (!cashTendered || numericCashTendered <= 0))}
                                                className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                {isPending ? <Zap className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
                                                {isPending ? 'Actualizando...' : 'Guardar y Recalcular Estancia'}
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            )}
                        </div>
                    </div>
                </DialogContent>
            )}
        </Dialog>
    );
}
