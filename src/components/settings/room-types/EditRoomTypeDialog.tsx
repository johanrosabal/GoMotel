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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveRoomType } from '@/lib/actions/roomType.actions';
import type { RoomType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface EditRoomTypeDialogProps {
  children: ReactNode;
  roomType?: RoomType;
}

const roomTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre es demasiado corto.'),
  features: z.array(z.string()).optional(),
});

export default function EditRoomTypeDialog({ children, roomType }: EditRoomTypeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [newFeature, setNewFeature] = useState('');

  const form = useForm<z.infer<typeof roomTypeSchema>>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: roomType ? {
        ...roomType,
        features: roomType.features || [],
    } : {
      name: '',
      features: [],
    },
  });

  const features = form.watch('features', roomType?.features || []);

  const handleAddFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      form.setValue('features', [...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (indexToRemove: number) => {
    const newFeatures = features.filter((_, index) => index !== indexToRemove);
    form.setValue('features', newFeatures);
  };

  const onSubmit = (values: z.infer<typeof roomTypeSchema>) => {
    const formData = new FormData();
    if(values.id) formData.append('id', values.id);
    formData.append('name', values.name);
    if(values.features) {
      values.features.forEach(feature => formData.append('features', feature));
    }

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
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            form.reset(roomType ? { ...roomType, features: roomType.features || [] } : { name: '', features: [] });
        }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
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
            
            <FormItem>
              <FormLabel>Características</FormLabel>
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="p.ej. Wi-Fi de alta velocidad"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddFeature();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleAddFeature}>
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Añadir Característica</span>
                </Button>
              </div>
              <div className="space-y-2 pt-2">
                {features.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {features.map((feature, index) => (
                      <Badge key={index} variant="secondary" className="pl-2 pr-1 py-0.5 text-sm">
                        {feature}
                        <button 
                          type="button" 
                          onClick={() => handleRemoveFeature(index)}
                          className="ml-1.5 p-0.5 rounded-full hover:bg-destructive/20 text-destructive"
                          aria-label={`Eliminar ${feature}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground px-1">Aún no se han añadido características.</p>
                )}
              </div>
            </FormItem>

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
