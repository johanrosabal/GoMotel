'use client';

import { useState, useTransition, type ReactNode, useMemo } from 'react';
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

  const handleCheckout = () => {
    if (!stay || !room) return;
    startTransition(async () => {
      try {
        const result = await checkOut(stay.id, room.id);
        if (result.error) {
          toast({ title: 'Falló el Check-Out', description: result.error, variant: 'destructive' });
        } else {
          toast({ title: '¡Éxito!', description: 'El huésped ha realizado el check-out.' });
        }
      } finally {
        setOpen(false);
      }
    });
  };

  const { duration, roomTotal, servicesTotal, finalTotal } = useMemo(() => {
    if (!stay || !room) {
      return { duration: 'N/D', roomTotal: 0, servicesTotal: 0, finalTotal: 0 };
    }
    
    let roomTotalCalc: number;
    if (stay.pricePlanAmount != null) {
      roomTotalCalc = stay.pricePlanAmount;
    } else {
      // Fallback for old data or stays without a price plan
      const checkInTime = stay.checkIn.toDate();
      const checkOutTime = new Date();
      const durationMs = checkOutTime.getTime() - checkInTime.getTime();
      const durationHours = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60)));
      roomTotalCalc = durationHours * room.ratePerHour;
    }

    const checkInTime = stay.checkIn.toDate();
    const checkOutTime = new Date();
    const durationText = formatDistance(checkOutTime, checkInTime, { includeSeconds: false, locale: es });
    
    const servicesTotalCalc = orders.reduce((sum, order) => sum + order.total, 0);
    const finalTotalCalc = roomTotalCalc + servicesTotalCalc;

    return {
      duration: durationText,
      roomTotal: roomTotalCalc,
      servicesTotal: servicesTotalCalc,
      finalTotal: finalTotalCalc,
    };
  }, [stay, room, orders]);

  return (
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
                </div>

                <div className="!mt-4 pt-4 border-t flex justify-between font-bold text-xl">
                    <span>Factura Total</span>
                    <span>{formatCurrency(finalTotal)}</span>
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
  );
}
