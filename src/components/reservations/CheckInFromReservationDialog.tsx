'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy as fbOrderBy } from 'firebase/firestore';
import type { Reservation, SinpeAccount } from '@/types';
import { checkInFromReservation } from '@/lib/actions/reservation.actions';
import { Check, Wallet, Clock, CheckCircle, ChevronRight, AlertCircle, Ban } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '../ui/separator';
import InvoiceSuccessDialog from './InvoiceSuccessDialog';

const checkInSchema = z.object({
    isOpenAccount: z.boolean().default(false),
    paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']).nullable().optional(),
    paymentConfirmed: z.boolean().default(false),
    voucherNumber: z.string().nullable().optional(),
}).refine(data => data.isOpenAccount || !!data.paymentMethod, {
    message: "Debe seleccionar un método de pago.",
    path: ["paymentMethod"],
}).refine(data => {
    if (!data.isOpenAccount && data.paymentMethod === 'Sinpe Movil') {
        return !!data.paymentConfirmed;
    }
    return true;
}, {
    message: 'Debe confirmar que el pago fue recibido.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (!data.isOpenAccount && data.paymentMethod === 'Tarjeta') {
        return data.voucherNumber && data.voucherNumber.trim() !== '';
    }
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});

interface CheckInFromReservationDialogProps {
    reservation: Reservation;
    children: React.ReactNode;
    onCheckInSuccess?: (invoiceId: string | null) => void;
}

export default function CheckInFromReservationDialog({ reservation, children, onCheckInSuccess }: CheckInFromReservationDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const [cashTendered, setCashTendered] = useState('');

    const sinpeAccountsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), fbOrderBy('createdAt', 'asc'));
    }, [firestore]);
    const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    const form = useForm<z.infer<typeof checkInSchema>>({
        resolver: zodResolver(checkInSchema),
        defaultValues: {
            isOpenAccount: false,
            paymentMethod: null,
            paymentConfirmed: false,
            voucherNumber: null,
        },
    });

    const isOpenAccount = form.watch('isOpenAccount');
    const paymentMethod = form.watch('paymentMethod');

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts) return null;
        const paymentAmount = reservation.pricePlanAmount || 0;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + paymentAmount) <= limit) return account;
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, reservation.pricePlanAmount]);

    const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        setCashTendered(rawValue === '' ? '' : new Intl.NumberFormat('en-US').format(Number(rawValue)));
    };

    const numericCashTendered = useMemo(() => Number(cashTendered.replace(/\D/g, '')), [cashTendered]);

    const onSubmit = (values: z.infer<typeof checkInSchema>) => {
        startTransition(async () => {
            const result = await checkInFromReservation(reservation.id, values);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                const id = result.invoiceId || null;
                setOpen(false);
                if (onCheckInSuccess) {
                    onCheckInSuccess(id);
                } else if (id) {
                    setInvoiceId(id);
                    setTimeout(() => setSuccessModalOpen(true), 200);
                } else {
                    toast({ title: '¡Éxito!', description: `El ingreso de ${reservation.guestName} se ha registrado.` });
                }
            }
        });
    };

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>{children}</DialogTrigger>
                <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto scrollbar-hide p-0 border-none bg-background/95 backdrop-blur-xl shadow-2xl">
                    <div className="p-6">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Procesar Ingreso</DialogTitle>
                            <DialogDescription>
                                Gestione el pago para la habitación <span className="text-white font-bold">{reservation.roomNumber}</span>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="my-6 p-4 bg-primary/5 rounded-2xl border border-white/5 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Huésped</span>
                                <span className="font-bold text-white">{reservation.guestName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Plan</span>
                                <span className="font-bold text-white">{reservation.pricePlanName}</span>
                            </div>
                            <Separator className="bg-white/5 my-2" />
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-black uppercase italic tracking-tighter text-primary">Monto a Cobrar</span>
                                <span className="text-2xl font-black text-primary">{formatCurrency(reservation.pricePlanAmount || 0)}</span>
                            </div>
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="isOpenAccount"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4 bg-muted/10 border-white/10">
                                            <div className="space-y-0.5">
                                                <FormLabel className="font-bold text-sm">Manejar como Cuenta Abierta</FormLabel>
                                                <p className="text-xs text-muted-foreground">Se liquida el saldo total al salir.</p>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {!isOpenAccount && (
                                    <div className="space-y-4 rounded-xl border p-4 bg-background shadow-sm border-primary/20">
                                        <FormField
                                            control={form.control}
                                            name="paymentMethod"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Método de Pago</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                        <FormControl><SelectTrigger className="h-12 border-white/10"><SelectValue placeholder="Seleccione método" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Efectivo">Efectivo</SelectItem>
                                                            <SelectItem value="Sinpe Movil">Sinpe Móvil</SelectItem>
                                                            <SelectItem value="Tarjeta">Tarjeta (Voucher)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {paymentMethod === 'Sinpe Movil' && (
                                            <div className='pt-4 border-t border-white/5 space-y-3'>
                                                {targetSinpeAccount ? (
                                                    <div className='p-4 bg-primary/5 rounded-xl text-center border-2 border-dashed border-primary/20'>
                                                        <p className='text-xs font-bold text-muted-foreground uppercase mb-2'>Enviar {formatCurrency(reservation.pricePlanAmount || 0)} a:</p>
                                                        <p className='text-2xl font-black font-mono text-primary'>{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                        <p className='text-[10px] font-black uppercase text-muted-foreground'>{targetSinpeAccount.accountHolder}</p>
                                                        <FormField
                                                            control={form.control}
                                                            name="paymentConfirmed"
                                                            render={({ field }) => (
                                                                <div className="space-y-3 mt-4">
                                                                    <FormItem className="flex items-center space-x-3 space-y-0 rounded-lg border border-white/10 bg-background p-3 text-left">
                                                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                                        <FormLabel className="text-xs font-bold">Pago verificado</FormLabel>
                                                                    </FormItem>
                                                                </div>
                                                            )}
                                                        />
                                                    </div>
                                                ) : <div className='p-3 bg-destructive/5 text-destructive rounded-lg text-xs font-bold text-center border border-destructive/20 uppercase'>Límite excedido en cuentas SINPE</div>}
                                            </div>
                                        )}

                                        {paymentMethod === 'Tarjeta' && (
                                            <FormField
                                                control={form.control}
                                                name="voucherNumber"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-bold">N° Voucher</FormLabel>
                                                        <FormControl><Input {...field} value={field.value || ''} className="h-11 font-mono border-white/10" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}

                                        {paymentMethod === 'Efectivo' && (
                                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold">Paga con</FormLabel>
                                                    <FormControl><Input type="text" inputMode="numeric" value={cashTendered} onChange={handleCashTenderedChange} className="text-right h-11 border-white/10" /></FormControl>
                                                </FormItem>
                                                {numericCashTendered >= (reservation.pricePlanAmount || 0) && (
                                                    <div className="text-right">
                                                        <span className="text-[10px] font-black uppercase text-muted-foreground">Vuelto</span>
                                                        <p className="text-xl font-black text-primary">{formatCurrency(numericCashTendered - (reservation.pricePlanAmount || 0))}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <DialogFooter className='pt-6 border-t border-white/5 mt-6'>
                                    <Button
                                        type="submit"
                                        disabled={isPending || (paymentMethod === 'Sinpe Movil' && !targetSinpeAccount)}
                                        className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/95 text-black font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                                    >
                                        {isPending ? 'Procesando...' : (
                                            <>
                                                <CheckCircle className="mr-2 h-5 w-5" />
                                                Completar Ingreso
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
