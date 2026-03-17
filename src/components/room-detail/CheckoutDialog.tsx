'use client';

import React, { useState, useTransition, type ReactNode, useMemo, useEffect } from 'react';
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
import { checkOut } from '@/lib/actions/room.actions';
import type { Room, Stay, Order, SinpeAccount } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import InvoiceSuccessDialog from '../reservations/InvoiceSuccessDialog';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { CheckCircle, Smartphone, Wallet, CreditCard, ChevronRight, ChevronLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

interface CheckoutDialogProps {
  children: ReactNode;
  stay?: Stay | null;
  room?: Room | null;
  orders: Order[];
}

const checkoutPaymentSchema = z.object({
  paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']),
  paymentConfirmed: z.boolean().default(false),
  voucherNumber: z.string().optional(),
}).refine(data => {
    if (data.paymentMethod === 'Sinpe Movil') return !!data.paymentConfirmed;
    return true;
}, {
    message: 'Debe confirmar el pago SINPE.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (data.paymentMethod === 'Tarjeta') return data.voucherNumber && data.voucherNumber.trim() !== '';
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});

export default function CheckoutDialog({ children, stay, room, orders }: CheckoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: Summary, 2: Payment
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [generatedInvoiceId, setGeneratedInvoiceId] = useState<string | null>(null);
  const [cashTendered, setCashTendered] = useState('');

  const form = useForm<z.infer<typeof checkoutPaymentSchema>>({
    resolver: zodResolver(checkoutPaymentSchema),
    defaultValues: { paymentMethod: 'Efectivo', paymentConfirmed: false, voucherNumber: '' },
  });

  const paymentMethod = form.watch('paymentMethod');

  const sinpeAccountsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), orderBy('createdAt', 'asc')) : null, 
    [firestore]
  );
  const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

  const billing = useMemo(() => {
    if (!stay || !room) return { duration: 'N/D', roomTotal: 0, servicesTotal: 0, upfrontPaid: 0, totalDue: 0, unpaidOrders: [] };
    
    const roomTotal = stay.pricePlanAmount || 0;
    const unpaidOrders = orders.filter(o => o.status !== 'Cancelado' && o.paymentStatus !== 'Pagado');
    const servicesTotal = unpaidOrders.reduce((sum, o) => sum + o.total, 0);
    const upfrontPaid = stay.paymentAmount || 0;
    const totalDue = (roomTotal + servicesTotal) - upfrontPaid;

    const duration = formatDistance(new Date(), stay.checkIn.toDate(), { locale: es });

    return { duration, roomTotal, servicesTotal, upfrontPaid, totalDue: totalDue < 0 ? 0 : totalDue, unpaidOrders };
  }, [stay, room, orders]);

  const targetSinpeAccount = useMemo(() => {
    if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts) return null;
    for (const account of activeSinpeAccounts) {
        const limit = account.limitAmount || Infinity;
        if ((account.balance + billing.totalDue) <= limit) return account;
    }
    return null;
  }, [paymentMethod, activeSinpeAccounts, billing.totalDue]);

  useEffect(() => {
    if (!open) {
        setStep(1);
        form.reset();
        setCashTendered('');
    }
  }, [open, form]);

  const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setCashTendered(rawValue === '' ? '' : new Intl.NumberFormat('en-US').format(Number(rawValue)));
  };

  const numericCashTendered = Number(cashTendered.replace(/\D/g, ''));

  const handleProcessCheckout = (values: z.infer<typeof checkoutPaymentSchema>) => {
    if (!stay || !room) return;
    
    startTransition(async () => {
      const result = await checkOut(stay.id, room.id, {
          paymentMethod: values.paymentMethod,
          voucherNumber: values.voucherNumber,
          amountPaid: billing.totalDue,
      });

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        setOpen(false);
        if (result.invoiceId) {
            setGeneratedInvoiceId(result.invoiceId);
            setSuccessModalOpen(true);
        } else {
            toast({ title: '¡Éxito!', description: 'Check-out completado correctamente.' });
        }
      }
    });
  };

  const onNextStep = () => {
      if (billing.totalDue > 0) {
          setStep(2);
      } else {
          // Si el total es 0, procesar directamente con valores por defecto
          handleProcessCheckout({
              paymentMethod: 'Efectivo',
              paymentConfirmed: true
          });
      }
  };

  return (
    <React.Fragment>
        <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{step === 1 ? 'Resumen de Check-Out' : 'Procesar Pago'}</DialogTitle>
                <DialogDescription>
                    {step === 1 
                        ? `Liquidación de cuenta para ${stay?.guestName}.` 
                        : `Seleccione el método de pago para los ${formatCurrency(billing.totalDue)} pendientes.`}
                </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh] pr-4">
                {step === 1 ? (
                    <div className="space-y-6 py-2">
                        <div className="p-4 rounded-xl bg-muted/50 border space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground font-medium uppercase tracking-tighter">Estancia</span>
                                <span className="font-bold">{billing.duration}</span>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Hospedaje ({stay?.pricePlanName})</span>
                                    <span className="font-semibold">{formatCurrency(billing.roomTotal)}</span>
                                </div>
                                {billing.unpaidOrders.length > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span>Consumos y Servicios</span>
                                        <span className="font-semibold">{formatCurrency(billing.servicesTotal)}</span>
                                    </div>
                                )}
                                {billing.upfrontPaid > 0 && (
                                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-bold">
                                        <span>Pagos Adelantados</span>
                                        <span>-{formatCurrency(billing.upfrontPaid)}</span>
                                    </div>
                                )}
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex justify-between items-center pt-1">
                                <span className={cn(
                                    "text-lg font-black uppercase tracking-tight",
                                    billing.totalDue === 0 ? "text-green-600" : "text-foreground"
                                )}>
                                    Total Pendiente
                                </span>
                                <span className={cn(
                                    "text-2xl font-black tracking-tighter",
                                    billing.totalDue === 0 ? "text-green-600" : "text-primary"
                                )}>
                                    {formatCurrency(billing.totalDue)}
                                </span>
                            </div>
                        </div>

                        {billing.unpaidOrders.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Detalle de Consumos</h4>
                                <div className="space-y-1">
                                    {billing.unpaidOrders.map(order => (
                                        <div key={order.id} className="p-2 border rounded-lg bg-background text-xs space-y-1">
                                            {order.items.map(item => (
                                                <div key={item.serviceId} className="flex justify-between">
                                                    <span>{item.quantity}x {item.name}</span>
                                                    <span>{formatCurrency(item.price * item.quantity)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <Form {...form}>
                        <form id="checkout-payment-form" className="space-y-4 py-2" onSubmit={(e) => e.preventDefault()}>
                            <FormField
                                control={form.control}
                                name="paymentMethod"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Método de Pago</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-12 text-base font-bold">
                                                    <SelectValue placeholder="Seleccione método" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Efectivo" className="py-3">
                                                    <div className="flex items-center gap-3"><Wallet className="h-4 w-4" /> Efectivo</div>
                                                </SelectItem>
                                                <SelectItem value="Sinpe Movil" className="py-3">
                                                    <div className="flex items-center gap-3"><Smartphone className="h-4 w-4" /> SINPE Móvil</div>
                                                </SelectItem>
                                                <SelectItem value="Tarjeta" className="py-3">
                                                    <div className="flex items-center gap-3"><CreditCard className="h-4 w-4" /> Tarjeta (Voucher)</div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {paymentMethod === 'Efectivo' && (
                                <div className="p-4 rounded-xl bg-muted/30 border space-y-4">
                                    <div className="space-y-2">
                                        <Label>Monto Recibido</Label>
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="₡0.00"
                                            value={cashTendered}
                                            onChange={handleCashTenderedChange}
                                            className="h-12 text-right text-xl font-bold"
                                        />
                                    </div>
                                    {numericCashTendered >= billing.totalDue && (
                                        <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                                            <span className="font-bold text-sm uppercase">Vuelto</span>
                                            <span className="text-xl font-black text-primary">{formatCurrency(numericCashTendered - billing.totalDue)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {paymentMethod === 'Sinpe Movil' && (
                                <div className="space-y-4">
                                    {isLoadingSinpe ? (
                                        <p className="text-center text-sm py-4">Buscando cuenta disponible...</p>
                                    ) : targetSinpeAccount ? (
                                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4 text-center">
                                            <p className="text-sm text-muted-foreground">Solicitar transferencia a:</p>
                                            <div className="space-y-1">
                                                <p className="text-3xl font-black font-mono tracking-tighter">{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                <p className="text-sm font-bold uppercase">{targetSinpeAccount.accountHolder}</p>
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="paymentConfirmed"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border bg-background p-4 text-left shadow-sm">
                                                        <FormControl>
                                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                        </FormControl>
                                                        <div className="space-y-1 leading-none">
                                                            <FormLabel className="font-bold">He recibido el pago</FormLabel>
                                                            <p className="text-xs text-muted-foreground">Confirme que el dinero ya está en la cuenta.</p>
                                                        </div>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm text-center font-bold border border-destructive/20">
                                            No hay cuentas SINPE disponibles con límite suficiente. Use otro método.
                                        </div>
                                    )}
                                </div>
                            )}

                            {paymentMethod === 'Tarjeta' && (
                                <FormField
                                    control={form.control}
                                    name="voucherNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Número de Voucher</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ingrese el código de transacción" {...field} className="h-12 font-mono text-center text-lg" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </form>
                    </Form>
                )}
            </ScrollArea>

            <DialogFooter className="gap-2 pt-4 border-t">
                {step === 1 ? (
                    <>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 h-12" disabled={isPending}>Cancelar</Button>
                        <Button 
                            type="button" 
                            onClick={onNextStep} 
                            className={cn(
                                "flex-1 h-12 font-black uppercase text-[10px] tracking-widest shadow-lg transition-all",
                                billing.totalDue === 0 ? "bg-green-600 hover:bg-green-700 shadow-green-500/20" : ""
                            )}
                            disabled={isPending}
                        >
                            {isPending ? "Procesando..." : (
                                billing.totalDue > 0 ? (
                                    <>Pasar a Cobro <ChevronRight className="ml-2 h-4 w-4" /></>
                                ) : (
                                    <>Finalizar Check-Out <CheckCircle className="ml-2 h-4 w-4" /></>
                                )
                            )}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={isPending} className="h-12">
                            <ChevronLeft className="mr-2 h-4 w-4" /> Volver
                        </Button>
                        <Button 
                            type="button"
                            onClick={form.handleSubmit(handleProcessCheckout)} 
                            disabled={isPending || (paymentMethod === 'Sinpe Movil' && !targetSinpeAccount)} 
                            variant="destructive" 
                            className="flex-1 h-12 font-black uppercase tracking-wider shadow-red-500/20 shadow-xl"
                        >
                            {isPending ? 'Procesando...' : (
                                <>
                                    <CheckCircle className="mr-2 h-5 w-5" /> Finalizar y Cobrar
                                </>
                            )}
                        </Button>
                    </>
                )}
            </DialogFooter>
        </DialogContent>
        </Dialog>
        <InvoiceSuccessDialog
            open={successModalOpen}
            onOpenChange={setSuccessModalOpen}
            invoiceId={generatedInvoiceId}
        />
    </React.Fragment>
  );
}