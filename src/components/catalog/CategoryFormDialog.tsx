'use client';
import { useState, useTransition, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { ProductCategory } from '@/types';
import { saveCategory } from '@/lib/actions/catalog.actions';
import { Textarea } from '@/components/ui/textarea';

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  description: z.string().optional(),
});

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: ProductCategory;
}

export default function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: category || { name: '', description: '' },
  });

  useEffect(() => {
    form.reset(category || { name: '', description: '' });
  }, [category, open, form]);

  const onSubmit = (values: z.infer<typeof categorySchema>) => {
    startTransition(async () => {
      await saveCategory(values);
      toast({ title: 'Éxito', description: `Categoría "${values.name}" guardada.` });
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
          <DialogDescription>
            {category ? `Editando "${category.name}".` : 'Crear una nueva categoría para sus productos.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="categoryformdialog-form-main">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Bebidas" {...field} id="categoryformdialog-input-ej-bebidas" />
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
                    <Textarea placeholder="Una breve descripción de la categoría." {...field} id="categoryformdialog-textarea-una-breve-descripci-n" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} id="categoryformdialog-button-cancelar">Cancelar</Button>
              <Button type="submit" disabled={isPending} id="categoryformdialog-button-1">
                {isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
