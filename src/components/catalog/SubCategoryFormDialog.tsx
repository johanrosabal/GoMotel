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
import type { ProductSubCategory } from '@/types';
import { saveSubCategory } from '@/lib/actions/catalog.actions';
import { Textarea } from '@/components/ui/textarea';

const subCategorySchema = z.object({
  id: z.string().optional(),
  categoryId: z.string(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  description: z.string().optional(),
});

interface SubCategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  subCategory?: ProductSubCategory;
}

export default function SubCategoryFormDialog({ open, onOpenChange, categoryId, subCategory }: SubCategoryFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof subCategorySchema>>({
    resolver: zodResolver(subCategorySchema),
    defaultValues: subCategory ? { ...subCategory, categoryId } : { name: '', description: '', categoryId },
  });

  useEffect(() => {
    form.reset(subCategory ? { ...subCategory, categoryId } : { name: '', description: '', categoryId });
  }, [subCategory, open, form, categoryId]);

  const onSubmit = (values: z.infer<typeof subCategorySchema>) => {
    startTransition(async () => {
      await saveSubCategory(values);
      toast({ title: 'Éxito', description: `Sub-categoría "${values.name}" guardada.` });
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subCategory ? 'Editar Sub-categoría' : 'Nueva Sub-categoría'}</DialogTitle>
          <DialogDescription>
            {subCategory ? `Editando "${subCategory.name}".` : 'Crear una nueva sub-categoría.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Gaseosas" {...field} />
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
                    <Textarea placeholder="Una breve descripción de la sub-categoría." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
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
