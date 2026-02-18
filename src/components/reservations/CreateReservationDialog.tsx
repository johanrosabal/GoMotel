'use client';

import { useState, useTransition } from 'react';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy as fbOrderBy } from 'firebase/firestore';
import type { Room } from '@/types';
import DateTimePicker from './DateTimePicker';
import { createReservation } from '@/lib/actions/reservation.actions';
import { addHours, isBefore } from 'date-fns';

interface CreateReservationDialogProps {
  children: React.ReactNode;
}

const reservationSchema = z.object({
  guestName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  roomId: z.string({ required_error: 'Debe seleccionar una habitación.' }),
  checkInDate: z.date({ required_error: 'La fecha de check-in es requerida.' }),
  checkOutDate: z.date({ required_error: 'La fecha de check-out es requerida.' }),
}).refine(data => isBefore(data.checkInDate, data.checkOutDate), {
    message: "La fecha de check-out debe ser posterior a la fecha de check-in.",
    path: ["checkOutDate"],
});

export default function CreateReservationDialog({ children }: CreateReservationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const roomsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'), fbOrderBy('number'));
  }, [firestore]);

  const { data: rooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

  const form = useForm<z.infer<typeof reservationSchema>>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      guestName: '',
      checkInDate: addHours(new Date(), 1),
      checkOutDate: addHours(new Date(), 4),
    },
  });

  const onSubmit = (values: z.infer<typeof reservationSchema>) => {
    const room = rooms?.find(r => r.id === values.roomId);
    if (!room) {
        toast({ title: "Error", description: "Habitación no válida.", variant: "destructive" });
        return;
    }

    const formData = new FormData();
    formData.append('guestName', values.guestName);
    formData.append('roomId', values.roomId);
    formData.append('roomNumber', room.number);
    formData.append('roomType', room.roomTypeName);
    formData.append('checkInDate', values.checkInDate.toISOString());
    formData.append('checkOutDate', values.checkOutDate.toISOString());

    startTransition(async () => {
      const result = await createReservation(formData);
      if (result.error) {
        toast({ title: 'Error al Crear Reservación', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: 'La reservación ha sido creada.' });
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nueva Reservación</DialogTitle>
          <DialogDescription>Complete los detalles para agendar una nueva reservación.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Huésped</FormLabel>
                  <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Habitación</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingRooms}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingRooms ? "Cargando..." : "Seleccione una habitación"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rooms?.map(room => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.number} - {room.roomTypeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Controller
                control={form.control}
                name="checkInDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Fecha y Hora de Check-in</FormLabel>
                        <DateTimePicker date={field.value} setDate={field.onChange} />
                        <FormMessage />
                    </FormItem>
                )}
            />
             <Controller
                control={form.control}
                name="checkOutDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Fecha y Hora de Check-out</FormLabel>
                        <DateTimePicker date={field.value} setDate={field.onChange} />
                        <FormMessage />
                    </FormItem>
                )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creando...' : 'Crear Reservación'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
