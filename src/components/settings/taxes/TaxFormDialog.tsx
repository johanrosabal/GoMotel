'use client';
import { useState, useTransition, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Tax } from '@/types';
import { saveTax } from '@/lib/actions/tax.actions';
import { Textarea } from '@/components/ui/textarea';

const taxSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  percentage: z.coerce.number().min(0, 'El porcentaje no puede ser negativo.').max(100, 'El porcentaje no puede ser mayor a 100.'),
  description: z.string().optional(),
});

interface TaxFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tax?: Tax;
  children?: React.ReactNode;
}

export default function TaxFormDialog({ open, onOpenChange, tax, children }: TaxFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof taxSchema>>({
    resolver: zodResolver(taxSchema),
    defaultValues: tax || { name: '', percentage: 0, description: '' },
  });

  useEffect(() => {
    form.reset(tax || { name: '', percentage: 0, description: '' });
  }, [tax, open, form]);

  const onSubmit = (values: z.infer<typeof taxSchema>) => {
    startTransition(async () => {
      await saveTax(values);
      toast({ title: 'Éxito', description: `Impuesto "${values.name}" guardado.` });
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tax ? 'Editar Impuesto' : 'Nuevo Impuesto'}</DialogTitle>
          <DialogDescription>
            {tax ? `Editando "${tax.name}".` : 'Crear un nuevo impuesto para sus productos.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="taxformdialog-form-main">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Impuesto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: IVA" {...field} id="taxformdialog-input-ej-iva" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Porcentaje (%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="13" {...field} id="taxformdialog-input-13" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Una breve descripción del impuesto." {...field} id="taxformdialog-textarea-una-breve-descripci-n" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} id="taxformdialog-button-cancelar">Cancelar</Button>
              <Button type="submit" disabled={isPending} id="taxformdialog-button-1">
                {isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
