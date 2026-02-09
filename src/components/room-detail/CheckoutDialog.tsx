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
      const result = await checkOut(stay.id, room.id);
      if (result.error) {
        toast({ title: 'Check-Out Failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success!', description: 'Guest has been checked out.' });
        setOpen(false);
      }
    });
  };

  const { duration, roomTotal, servicesTotal, finalTotal } = useMemo(() => {
    if (!stay || !room) {
      return { duration: 'N/A', roomTotal: 0, servicesTotal: 0, finalTotal: 0 };
    }
    const checkInTime = stay.checkIn.toDate();
    const checkOutTime = new Date();
    const durationMs = checkOutTime.getTime() - checkInTime.getTime();
    const durationHours = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60)));

    const durationText = formatDistance(checkOutTime, checkInTime, { includeSeconds: false });
    const roomTotalCalc = durationHours * room.ratePerHour;
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
          <DialogTitle>Confirm Check-Out</DialogTitle>
          <DialogDescription>Review the final bill before checking out the guest.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-96 pr-4">
            <div className="space-y-4">
                <div className="p-4 rounded-lg border bg-muted/50">
                    <h3 className="font-semibold mb-2">Billing Summary</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Guest:</span>
                            <span>{stay?.guestName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Stay Duration:</span>
                            <span>~{duration}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Room Charge</span>
                        <span>{formatCurrency(roomTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Services & Orders</span>
                        <span>{formatCurrency(servicesTotal)}</span>
                    </div>
                </div>

                <div className="!mt-4 pt-4 border-t flex justify-between font-bold text-xl">
                    <span>Total Bill</span>
                    <span>{formatCurrency(finalTotal)}</span>
                </div>
            </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCheckout} disabled={isPending} variant="destructive">
            {isPending ? 'Processing...' : 'Confirm & Check-Out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
