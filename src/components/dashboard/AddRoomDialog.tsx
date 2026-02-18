'use client';

import { useState, useTransition, type ReactNode, useMemo, useEffect } from 'react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveRoom } from '@/lib/actions/room.actions';
import type { Room, RoomType } from '@/types';
import { Separator } from '../ui/separator';
import { DollarSign, Tag, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';
import Link from 'next/link';

interface AddRoomDialogProps {
  children: ReactNode;
  room?: Room;
  roomTypes: RoomType[];
}

const roomSchema = z.object({
  id: z.string().optional(),
  number: z.string().min(1, 'El número de habitación es requerido.'),
  roomTypeId: z.string({ required_error: 'El tipo de habitación es requerido.'}).min(1, 'El tipo de habitación es requerido.'),
});

export default function AddRoomDialog({ children, room, roomTypes }: AddRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof roomSchema>>({
    resolver: zodResolver(roomSchema),
    defaultValues: room ? {
      id: room.id,
      number: room.number,
      roomTypeId: room.roomTypeId,
    } : {
      number: '',
      roomTypeId: undefined,
    },
  });

  const selectedRoomTypeId = form.watch('roomTypeId');

  const selectedRoomType = useMemo(() => {
    return roomTypes.find(rt => rt.id === selectedRoomTypeId);
  }, [selectedRoomTypeId, roomTypes]);

  const onSubmit = (values: z.infer<typeof roomSchema>) => {
    const rt = roomTypes.find(rt => rt.id === values.roomTypeId);
    if (!rt) { 
        toast({ title: 'Error', description: 'Por favor seleccione un tipo de habitación válido.', variant: 'destructive' });
        return; 
    }
     if (!rt.capacity) {
      toast({ title: 'Error', description: 'El tipo de habitación seleccionado no tiene una capacidad definida.', variant: 'destructive' });
      return;
    }

    const hourlyRatePlan = rt.pricePlans?.find(p => p.unit === 'Hours' && p.duration === 1) || rt.pricePlans?.[0];
    const ratePerHour = hourlyRatePlan ? hourlyRatePlan.price : 0;
    
    const formData = new FormData();
    if(values.id) formData.append('id', values.id);
    formData.append('number', values.number);
    formData.append('capacity', String(rt.capacity));
    formData.append('roomTypeId', values.roomTypeId);
    formData.append('roomTypeName', rt.name);
    formData.append('type', rt.name);
    formData.append('description', rt.features?.join(', ') || '');
    formData.append('ratePerHour', String(ratePerHour));

    startTransition(async () => {
      const result = await saveRoom(formData);
      if (result?.error) {
        toast({
          title: 'Error',
          description: typeof result.error === 'string' ? result.error : 'No se pudo guardar la habitación.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '¡Éxito!',
          description: `La habitación "${values.number}" ha sido guardada.`,
        });
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) form.reset(room ? { id: room.id, number: room.number, roomTypeId: room.roomTypeId } : { number: '', roomTypeId: undefined });
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{room ? 'Editar Habitación' : 'Añadir Nueva Habitación'}</DialogTitle>
          <DialogDescription>
            {room
              ? `Actualizar detalles para la habitación ${room.number}.`
              : 'Añada los detalles de la nueva habitación a su motel.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="p.ej., 101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <FormField
              control={form.control}
              name="roomTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Habitación</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={roomTypes.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roomTypes && roomTypes.length > 0 ? (
                        roomTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No hay tipos de habitación.
                          <Button variant="link" asChild className="pl-1">
                            <Link href="/settings/room-types/new">Crear uno</Link>
                          </Button>
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedRoomType && (
              <div className="space-y-4 pt-2">
                <Separator />
                <div className="p-4 rounded-lg border bg-muted/50 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" />Capacidad</h4>
                            <p className="font-semibold">{selectedRoomType.capacity} persona(s)</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-muted-foreground"><Tag className="h-4 w-4" />Características</h4>
                            {selectedRoomType.features && selectedRoomType.features.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {selectedRoomType.features.map(feature => <Badge key={feature} variant="secondary">{feature}</Badge>)}
                                </div>
                            ) : <p className="text-sm text-muted-foreground">Sin características.</p>}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" />Planes de Precios</h4>
                        {selectedRoomType.pricePlans && selectedRoomType.pricePlans.length > 0 ? (
                            <ul className="space-y-1.5 text-sm">
                            {selectedRoomType.pricePlans.map(plan => (
                                <li key={plan.name} className="flex justify-between">
                                    <span className="text-muted-foreground">{plan.name}</span>
                                    <span className="font-medium">{formatCurrency(plan.price)}</span>
                                </li>
                            ))}
                            </ul>
                        ) : <p className="text-sm text-muted-foreground">Sin planes de precios.</p>}
                    </div>
                </div>
              </div>
            )}
           
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar Habitación'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
