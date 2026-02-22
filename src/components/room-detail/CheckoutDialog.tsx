'use client';

import React, { useState, useTransition, type ReactNode, useMemo } from 'react';
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
import type { Room, Stay, Order } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import InvoiceSuccessDialog from '../reservations/InvoiceSuccessDialog';
import { Badge } from '../ui/badge';

interface CheckoutDialogProps {
  children: ReactNode;
  stay?: Stay | null;
  room?: Room | null;
  orders: Order[];
}

export default function CheckoutDialog({ children, stay, room, orders }: CheckoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [generatedInvoiceId, setGeneratedInvoiceId] = useState<string | null>(null);

  const handleCheckout = () => {
    if (!stay || !room) return;
    
    startTransition(async () => {
      const result = await checkOut(stay.id, room.id);
      setOpen(false); // Close checkout dialog immediately
      if (result.error) {
        toast({ title: 'Falló el Check-Out', description: result.error, variant: 'destructive' });
      } else {
        if (result.invoiceId) {
            setGeneratedInvoiceId(result.invoiceId);
            setSuccessModalOpen(true);
        } else {
            toast({ title: '¡Éxito!', description: 'El huésped ha realizado el check-out.' });
        }
      }
    });
  };

  const { duration, roomTotal, servicesTotal, amountPaid, totalDue, allOrders } = useMemo(() => {
    if (!stay || !room) {
      return { duration: 'N/D', roomTotal: 0, servicesTotal: 0, amountPaid: 0, totalDue: 0, allOrders: [] as Order[] };
    }
    
    let roomTotalCalc: number;
    // If pricePlanAmount exists, it includes the base plan + all extensions.
    if (stay.pricePlanAmount != null) {
      roomTotalCalc = stay.pricePlanAmount;
    } else {
      // Fallback for old data or stays without a price plan
      const checkInTime = stay.checkIn.toDate();
      const checkOutTime = new Date(); // Calculate up to now
      const durationMs = checkOutTime.getTime() - checkInTime.getTime();
      const durationHours = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60))); // Minimum 1 hour charge
      roomTotalCalc = durationHours * room.ratePerHour;
    }

    const checkInTime = stay.checkIn.toDate();
    const checkOutTime = new Date();
    const durationText = formatDistance(checkOutTime, checkInTime, { includeSeconds: false, locale: es });
    
    const unpaidOrders = orders.filter(order => order.status !== 'Cancelado' && order.paymentStatus !== 'Pagado');
    const servicesTotalCalc = unpaidOrders.reduce((sum, order) => sum + order.total, 0);
    
    const paidAmount = stay.paymentAmount || 0;
    const totalBill = roomTotalCalc + servicesTotalCalc;
    const finalTotalDue = totalBill - paidAmount;

    return {
      duration: durationText,
      roomTotal: roomTotalCalc,
      servicesTotal: servicesTotalCalc,
      amountPaid: paidAmount,
      totalDue: finalTotalDue < 0 ? 0 : finalTotalDue,
      allOrders: orders.filter(order => order.status !== 'Cancelado'),
    };
  }, [stay, room, orders]);

  return (
    <React.Fragment>
        <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
            <DialogTitle>Confirmar Check-Out</DialogTitle>
            <DialogDescription>Revise la factura final antes de realizar el check-out del huésped.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-96 pr-4">
                <div className="space-y-4">
                    <div className="p-4 rounded-lg border bg-muted/50">
                        <h3 className="font-semibold mb-2">Resumen de Facturación</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Huésped:</span>
                                <span>{stay?.guestName}</span>
                            </div>
                            {stay?.pricePlanName && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Plan Seleccionado:</span>
                                    <span>{stay.pricePlanName}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Duración de la Estancia:</span>
                                <span>~{duration}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Cargo de Habitación</span>
                            <span>{formatCurrency(roomTotal)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Servicios y Pedidos</span>
                            <span>{formatCurrency(servicesTotal)}</span>
                        </div>
                        {allOrders.length > 0 && (
                            <div className="pl-4 ml-2 border-l-2 space-y-1 mt-1">
                                {allOrders.map(order => (
                                    <React.Fragment key={order.id}>
                                        {order.items.map(item => (
                                            <div key={`${order.id}-${item.serviceId}`} className="text-xs flex justify-between items-center text-muted-foreground">
                                                <span>{item.quantity}x {item.name}</span>
                                                {order.paymentStatus === 'Pagado' 
                                                    ? <Badge variant="secondary" className="text-xs">Pagado</Badge>
                                                    : <span>{formatCurrency(item.price * item.quantity)}</span>
                                                }
                                            </div>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                        {amountPaid > 0 && (
                            <div className="flex justify-between text-green-600 dark:text-green-400 !mt-2">
                                <span className="font-medium">Adelanto Pagado ({stay?.paymentMethod})</span>
                                <span className="font-medium">-{formatCurrency(amountPaid)}</span>
                            </div>
                        )}
                    </div>

                    <div className="!mt-4 pt-4 border-t flex justify-between font-bold text-xl">
                        <span>Total a Pagar</span>
                        <span>{formatCurrency(totalDue)}</span>
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCheckout} disabled={isPending} variant="destructive">
                {isPending ? 'Procesando...' : 'Confirmar y Realizar Check-Out'}
            </Button>
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
