'use client';

import { useState, useTransition, type ReactNode } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveRoom } from '@/lib/actions/room.actions';
import type { Room, RoomType } from '@/types';

interface AddRoomDialogProps {
  children: ReactNode;
  room?: Room;
  roomTypes: RoomType[];
}

const roomSchema = z.object({
  id: z.string().optional(),
  number: z.string().min(1, 'El número de habitación es requerido.'),
  type: z.string({ required_error: 'El tipo de habitación es requerido.'}).min(1, 'El tipo de habitación es requerido.'),
  capacity: z.coerce.number().int().min(1, 'La capacidad debe ser al menos 1.'),
  ratePerHour: z.coerce.number().min(0, 'La tarifa por hora no puede ser negativa.'),
  description: z.string().max(200, 'La descripción no puede exceder los 200 caracteres.').optional(),
});

export default function AddRoomDialog({ children, room, roomTypes }: AddRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof roomSchema>>({
    resolver: zodResolver(roomSchema),
    defaultValues: room ? {
      ...room,
      description: room.description || '',
    } : {
      number: '',
      type: roomTypes[0]?.name || '',
      capacity: 1,
      ratePerHour: 20,
      description: '',
    },
  });

  const onSubmit = (values: z.infer<typeof roomSchema>) => {
    const formData = new FormData();
    if(values.id) formData.append('id', values.id);
    formData.append('number', values.number);
    formData.append('type', values.type);
    formData.append('capacity', String(values.capacity));
    formData.append('ratePerHour', String(values.ratePerHour));
    if (values.description) formData.append('description', values.description);

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
        if (!isOpen) form.reset(room ? {...room, description: room.description || ''} : { number: '', type: roomTypes[0]?.name || '', capacity: 1, ratePerHour: 20, description: '' });
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Habitación</FormLabel>
                    <FormControl>
                      <Input placeholder="p.ej., 101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roomTypes.map((type) => (
                            <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ratePerHour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa por Hora ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describa las características de la habitación..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <DialogFooter>
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
