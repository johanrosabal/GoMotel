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
import { ScrollArea } from '../ui/scroll-area';
import { Plus, Minus, ShoppingCart, ImageIcon, Check, CheckCircle } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import InvoiceSuccessDialog from '../reservations/InvoiceSuccessDialog';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';

const Stepper = ({ step }: { step: number }) => {
    const steps = ['Seleccionar Productos', 'Revisar y Pagar', 'Confirmación'];
    return (
        <div className="flex items-start w-full mb-6 px-4">
            {steps.map((label, index) => (
                <React.Fragment key={index}>
                    <div className="flex flex-col items-center text-center w-28">
                        <div className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold",
                            step > index + 1 ? "bg-primary border-primary text-primary-foreground" :
                            step === index + 1 ? "border-primary text-primary" :
                            "border-border text-muted-foreground bg-muted/50"
                        )}>
                            {step > index + 1 ? <Check className="h-5 w-5" /> : index + 1}
                        </div>
                        <p className={cn(
                            "text-xs mt-2",
                            step === index + 1 ? "font-semibold text-primary" : "text-muted-foreground"
                        )}>{label}</p>
                    </div>
                    {index < steps.length - 1 && (
                        <div className={cn(
                            "flex-1 h-0.5 mt-4",
                            step > index + 1 ? "bg-primary" : "bg-border"
                        )} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};


interface OrderServiceDialogProps {
  children: ReactNode;
  stayId?: string;
  availableServices: Service[];
}

type CartItem = {
  service: Service;
  quantity: number;
};

const orderPaymentSchema = z.object({
  payNow: z.boolean().default(false),
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

export default function OrderServiceDialog({ children, stayId, availableServices }: OrderServiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const [step, setStep] = useState(1);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof orderPaymentSchema>>({
    resolver: zodResolver(orderPaymentSchema),
    defaultValues: { payNow: false, paymentConfirmed: false, voucherNumber: '', paymentMethod: undefined },
  });
  
  const payNow = form.watch('payNow');
  const paymentMethod = form.watch('paymentMethod');

  const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes')) : null, [firestore]);
  const { data: allTaxes, isLoading: isLoadingTaxes } = useCollection<Tax>(taxesQuery);
  const sinpeAccountsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'sinpeAccounts'), where('isActive', '==', true), orderBy('createdAt', 'asc')) : null, [firestore]);
  const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);
  
  const { subtotal, totalTax, grandTotal, appliedTaxes } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);
    
    let tax = 0;
    const taxes: AppliedTax[] = [];

    if (allTaxes) {
        const taxMap = new Map<string, { name: string; percentage: number; amount: number }>();

        cart.forEach(item => {
            const itemTotal = item.service.price * item.quantity;
            item.service.taxIds?.forEach(taxId => {
                const taxInfo = allTaxes.find(t => t.id === taxId);
                if (taxInfo) {
                    const taxAmount = itemTotal * (taxInfo.percentage / 100);
                    tax += taxAmount;
                    
                    const existingTax = taxMap.get(taxId);
                    if (existingTax) {
                        existingTax.amount += taxAmount;
                    } else {
                        taxMap.set(taxId, { name: taxInfo.name, percentage: taxInfo.percentage, amount: taxAmount });
                    }
                }
            });
        });

        taxMap.forEach((value, key) => {
            taxes.push({ taxId: key, ...value });
        });
    }

    const grand = sub + tax;
    return { subtotal: sub, totalTax: tax, grandTotal: grand, appliedTaxes: taxes };
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
        setInvoiceId(null);
    }
  }, [open, form]);

  const activeServices = availableServices.filter(s => s.isActive);

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

  const getCartQuantity = (serviceId: string) => {
    return cart.find((item) => item.service.id === serviceId)?.quantity || 0;
  };
  
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
        if (result.invoiceId) {
          setInvoiceId(result.invoiceId);
        }
        setStep(3);
      }
    });
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pedir Servicios</DialogTitle>
            <DialogDescription>
              {step === 1 ? "Seleccione productos y agréguelos al carrito." : "Confirme el pedido y elija un método de pago."}
            </DialogDescription>
          </DialogHeader>

          <Stepper step={step} />

          {step === 1 && (
            <div className="grid md:grid-cols-2 gap-6 flex-1 min-h-0">
                <div className='flex flex-col'>
                    <h3 className="font-semibold mb-2">Servicios Disponibles</h3>
                    <ScrollArea className="flex-1 pr-4 border rounded-lg">
                        <div className='p-2 space-y-2'>
                        {activeServices.map((service) => (
                            <div key={service.id} className="flex items-center justify-between p-2 rounded-md border">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-16 w-16 rounded-md">
                                        <AvatarImage src={service.imageUrl || undefined} alt={service.name} className="object-cover" />
                                        <AvatarFallback className="rounded-md bg-muted">
                                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium">{service.name}</p>
                                        <p className="text-sm text-muted-foreground">{formatCurrency(service.price)} - {service.source === 'Internal' ? 'Producción Interna' : `Existencias: ${service.stock}`}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleRemoveFromCart(service)} disabled={getCartQuantity(service.id) === 0}>
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="w-6 text-center">{getCartQuantity(service.id)}</span>
                                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleAddToCart(service)} disabled={service.source !== 'Internal' && getCartQuantity(service.id) >= service.stock}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                </div>
                <div className='flex flex-col'>
                    <h3 className="font-semibold mb-2">Pedido Actual</h3>
                    <div className="border rounded-lg p-4 flex-1 flex flex-col">
                        {cart.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                <ShoppingCart className="h-12 w-12" />
                                <p className="mt-2">Su carrito está vacío.</p>
                            </div>
                        ) : (
                            <>
                            <ScrollArea className="flex-1 -mr-4 pr-4">
                                <div className="space-y-2">
                                    {cart.map(item => (
                                        <div key={item.service.id} className="flex justify-between items-center text-sm">
                                            <div>
                                                <p className="font-medium">{item.service.name}</p>
                                                <p className="text-muted-foreground">{item.quantity} x {formatCurrency(item.service.price)}</p>
                                            </div>
                                            <p className="font-semibold">{formatCurrency(item.service.price * item.quantity)}</p>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="mt-4 pt-4 border-t flex justify-between font-bold text-lg">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
          )}

          {step === 2 && (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Cart Summary */}
                        <div className="space-y-4">
                             <h3 className="font-semibold">Resumen del Pedido</h3>
                             <Card>
                                 <CardContent className="pt-6 space-y-2">
                                     {cart.map(item => (
                                        <div key={item.service.id} className="flex justify-between items-center text-sm">
                                            <div>
                                                <p className="font-medium">{item.quantity}x {item.service.name}</p>
                                            </div>
                                            <p>{formatCurrency(item.service.price * item.quantity)}</p>
                                        </div>
                                     ))}
                                     <div className="border-t pt-2 mt-2 !space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <p className="text-muted-foreground">Subtotal</p>
                                            <p>{formatCurrency(subtotal)}</p>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <p className="text-muted-foreground">Impuestos</p>
                                            <p>{formatCurrency(totalTax)}</p>
                                        </div>
                                         <div className="flex justify-between font-bold text-lg pt-1">
                                            <p>Total</p>
                                            <p>{formatCurrency(grandTotal)}</p>
                                        </div>
                                     </div>
                                 </CardContent>
                             </Card>
                        </div>
                        {/* Payment Options */}
                        <div className="space-y-4">
                             <h3 className="font-semibold">Opciones de Pago</h3>
                            <FormField
                                control={form.control}
                                name="payNow"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                    <FormLabel>Pagar Ahora</FormLabel>
                                    <p className="text-[13px] text-muted-foreground">
                                        Generar una factura y procesar el pago de inmediato.
                                    </p>
                                    </div>
                                    <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    </FormControl>
                                </FormItem>
                                )}
                            />

                            {payNow && (
                                <div className="space-y-4 rounded-lg border p-4">
                                     <FormField
                                        control={form.control}
                                        name="paymentMethod"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Método de Pago</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccione un método" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Efectivo">Efectivo</SelectItem>
                                                        <SelectItem value="Sinpe Movil">Sinpe Móvil</SelectItem>
                                                        <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {paymentMethod === 'Sinpe Movil' && (
                                        <div className='space-y-4 pt-4 border-t'>
                                            {isLoadingSinpe ? (
                                                <p className="text-sm text-muted-foreground text-center">Buscando cuenta SINPE...</p>
                                            ) : targetSinpeAccount ? (
                                                <div className="space-y-3">
                                                    <div className='p-4 bg-muted rounded-lg text-center'>
                                                        <p className='text-sm text-muted-foreground'>Transferir <span className='font-bold'>{formatCurrency(grandTotal)}</span> a:</p>
                                                        <p className='py-1 text-2xl font-mono font-extrabold tracking-widest'>{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                        <p className='text-sm font-semibold'>{targetSinpeAccount.accountHolder}</p>
                                                    </div>
                                                    <FormField
                                                        control={form.control}
                                                        name="paymentConfirmed"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border bg-background p-4 shadow-sm">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value}
                                                                        onCheckedChange={field.onChange}
                                                                    />
                                                                </FormControl>
                                                                <div className="space-y-1 leading-none">
                                                                    <FormLabel>Confirmar Pago Recibido</FormLabel>
                                                                    <FormMessage className="pt-1" />
                                                                </div>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            ) : (
                                                <div className='p-3 bg-destructive/10 text-destructive rounded-md text-sm font-semibold text-center'>
                                                    No hay cuentas SINPE disponibles.
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
                                                    <FormControl><Input placeholder="Ingrese el número de voucher" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                     {paymentMethod && paymentMethod !== 'Sinpe Movil' && (
                                        <div className="p-3 bg-green-100/50 dark:bg-green-900/20 rounded-lg text-sm text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/50">
                                            <div className="flex justify-between items-center font-semibold">
                                                <span className='flex items-center gap-2'><CheckCircle className="h-4 w-4" />Monto a Cobrar:</span>
                                                <span className="font-bold text-base">{formatCurrency(grandTotal)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            </Form>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center justify-center text-center py-10 flex-1">
                <CheckCircle className="h-20 w-20 text-green-500 mb-4" />
                <h3 className="text-2xl font-bold">¡Pedido Confirmado!</h3>
                <p className="text-muted-foreground mt-2 max-w-sm">
                    {invoiceId ? "La factura ha sido generada y el pedido está en proceso." : "El pedido ha sido añadido a la cuenta de la habitación."}
                </p>
                {invoiceId && (
                     <p className="text-muted-foreground text-sm mt-1">Puede descargar o compartir la factura desde el diálogo de éxito que aparecerá al cerrar.</p>
                )}
            </div>
          )}

          <DialogFooter className="mt-auto pt-4 border-t">
            {step === 1 && (
                <>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                </Button>
                <Button onClick={() => setStep(2)} disabled={cart.length === 0}>
                    Siguiente
                </Button>
                </>
            )}
            {step === 2 && (
                <>
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    Atrás
                </Button>
                <Button type="button" variant="secondary" onClick={() => handleSubmit({ payNow: false })} disabled={isPending}>
                    Dejar Pendiente
                </Button>
                <Button type="submit" form="order-service-form" onClick={form.handleSubmit(handleSubmit)} disabled={isPending || !payNow}>
                    Pagar y Confirmar
                </Button>
                </>
            )}
            {step === 3 && (
                <Button type="button" onClick={() => {
                    setOpen(false);
                    if (invoiceId) {
                        setSuccessModalOpen(true);
                    }
                }}>
                    Cerrar
                </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InvoiceSuccessDialog
          open={successModalOpen}
          onOpenChange={setSuccessModalOpen}
          invoiceId={invoiceId}
      />
    </>
  );
}
