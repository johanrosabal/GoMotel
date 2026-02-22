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
import { Clock } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Room, Stay, RoomType, Order } from '@/types';
import CheckoutDialog from './CheckoutDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMinutes, addHours, addDays, addWeeks, addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExtendStayDialogProps {
  children: ReactNode;
  stay?: Stay | null;
  room: Room;
  isOverdue?: boolean;
}

const extendStaySchema = z.object({
  newPlanName: z.string({ required_error: 'Debe seleccionar un nuevo plan de estancia.' }),
});

export default function ExtendStayDialog({ children, stay, room, isOverdue }: ExtendStayDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();

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

  const form = useForm<z.infer<typeof extendStaySchema>>({
    resolver: zodResolver(extendStaySchema),
    defaultValues: { newPlanName: undefined },
  });

  const selectedPlanName = form.watch('newPlanName');

  const calculatedCheckOut = useMemo(() => {
    if (!selectedPlanName || !availablePlans.length || !stay) return null;

    const plan = availablePlans.find(p => p.name === selectedPlanName);
    if (!plan) return null;

    const now = new Date();
    const currentCheckOut = stay.expectedCheckOut.toDate();
    const baseDate = isOverdue && now > currentCheckOut ? now : currentCheckOut;
    
    let checkOutTime = new Date(baseDate);
    
    switch(plan.unit) {
      case 'Minutes': checkOutTime = addMinutes(baseDate, plan.duration); break;
      case 'Hours': checkOutTime = addHours(baseDate, plan.duration); break;
      case 'Days': checkOutTime = addDays(baseDate, plan.duration); break;
      case 'Weeks': checkOutTime = addWeeks(baseDate, plan.duration); break;
      case 'Months': checkOutTime = addMonths(baseDate, plan.duration); break;
    }
    
    return format(checkOutTime, 'PPpp', { locale: es });
  }, [selectedPlanName, availablePlans, stay, isOverdue]);

  const onSubmit = (values: z.infer<typeof extendStaySchema>) => {
    if (!stay) return;
    startTransition(async () => {
      const result = await extendStay(stay.id, values.newPlanName);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: 'La estancia ha sido extendida.' });
        setOpen(false);
      }
    });
  };

  useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, form]);

  const isLoading = isLoadingRoomTypes || isLoadingOrders;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {stay && (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
            <DialogTitle>{isOverdue ? 'Gestionar Estancia Vencida' : 'Extender Estancia'}</DialogTitle>
            <DialogDescription>
                {isOverdue 
                ? `La estancia de ${stay.guestName} ha vencido. Puede extender la estancia o realizar el check-out.`
                : `Añada más tiempo a la estancia de ${stay.guestName}.`
                }
            </DialogDescription>
            </DialogHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                control={form.control}
                name="newPlanName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Extender con Nuevo Plan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoading || availablePlans.length === 0}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione un plan de extensión"} />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {availablePlans.map(plan => (
                            <SelectItem key={plan.name} value={plan.name}>
                            {plan.name}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {calculatedCheckOut && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                            <Clock className="h-4 w-4" />
                            <span>Nueva Salida Estimada</span>
                        </div>
                        <p className="font-semibold text-center pt-1">{calculatedCheckOut}</p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row-reverse gap-2 pt-4">
                    <Button type="submit" disabled={isPending || isLoading || !selectedPlanName} className="flex-1">
                        {isPending ? 'Extendiendo...' : 'Extender Estancia'}
                    </Button>
                    <CheckoutDialog stay={stay} room={room} orders={orders || []}>
                        <Button type="button" variant="destructive" className="flex-1">
                            Realizar Check-Out
                        </Button>
                    </CheckoutDialog>
                </div>
            </form>
            </Form>
        </DialogContent>
      )}
    </Dialog>
  );
}
