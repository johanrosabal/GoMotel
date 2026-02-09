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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveRoomType } from '@/lib/actions/roomType.actions';
import type { RoomType } from '@/types';

interface EditRoomTypeDialogProps {
  children: ReactNode;
  roomType?: RoomType;
}

const roomTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre es demasiado corto.'),
  features: z.string().optional(),
});

export default function EditRoomTypeDialog({ children, roomType }: EditRoomTypeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof roomTypeSchema>>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: roomType ? {
        ...roomType,
        features: roomType.features?.join(', ') || '',
    } : {
      name: '',
      features: '',
    },
  });

  const onSubmit = (values: z.infer<typeof roomTypeSchema>) => {
    const formData = new FormData();
    if(values.id) formData.append('id', values.id);
    formData.append('name', values.name);
    if(values.features) formData.append('features', values.features);

    startTransition(async () => {
      const result = await saveRoomType(formData);
      if (result.error) {
        toast({
          title: 'Error',
          description: 'No se pudo guardar el tipo de habitación.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '¡Éxito!',
          description: `El tipo de habitación "${values.name}" ha sido guardado.`,
        });
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{roomType ? 'Editar Tipo de Habitación' : 'Añadir Nuevo Tipo de Habitación'}</DialogTitle>
          <DialogDescription>
            {roomType
              ? `Actualizar detalles para ${roomType.name}.`
              : 'Añadir un nuevo tipo de habitación a su sistema.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Tipo de Habitación</FormLabel>
                  <FormControl>
                    <Input placeholder="p.ej., Suite Presidencial" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="features"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Características</FormLabel>
                  <FormControl>
                    <Input placeholder="p.ej., Wi-Fi, Aire Acondicionado, TV..." {...field} />
                  </FormControl>
                   <FormDescription>
                    Separe las características con comas.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
