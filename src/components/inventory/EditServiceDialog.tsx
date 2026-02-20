'use client';

import { useState, useTransition, type ReactNode, useEffect } from 'react';
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
import { saveService } from '@/lib/actions/service.actions';
import type { Service, ProductCategory, ProductSubCategory } from '@/types';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';

interface EditServiceDialogProps {
  children?: ReactNode;
  service?: Service;
  allServices: Service[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  categoryId?: string;
  subCategoryId?: string;
}

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre del servicio es demasiado corto.'),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo.'),
  stock: z.coerce.number().int().min(0, 'Las existencias no pueden ser negativas.'),
  category: z.enum(['Food', 'Beverage', 'Amenity']),
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  description: z.string().optional(),
});

export default function EditServiceDialog({ children, service, allServices, open: controlledOpen, onOpenChange: setControlledOpen, categoryId: preselectedCategoryId, subCategoryId: preselectedSubCategoryId }: EditServiceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;
  
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: service || {
      name: '',
      price: 0,
      stock: 0,
      category: 'Food',
      categoryId: preselectedCategoryId,
      subCategoryId: preselectedSubCategoryId,
      description: '',
    },
  });

  const selectedCategoryId = form.watch('categoryId');

  const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<ProductCategory>(categoriesQuery);
  
  const subCategoriesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedCategoryId) return null;
    return query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategoryId), orderBy('name'));
  }, [firestore, selectedCategoryId]);
  const { data: subCategories, isLoading: isLoadingSubCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

  useEffect(() => {
    if (open) {
      form.reset(service ? {
        ...service,
        categoryId: service.categoryId || preselectedCategoryId,
        subCategoryId: service.subCategoryId || preselectedSubCategoryId
      } : {
        name: '',
        price: 0,
        stock: 0,
        category: 'Food',
        categoryId: preselectedCategoryId,
        subCategoryId: preselectedSubCategoryId,
        description: '',
      });
    }
  }, [open, service, form, preselectedCategoryId, preselectedSubCategoryId]);

  const onSubmit = (values: z.infer<typeof serviceSchema>) => {
    const formData = new FormData();
    if(values.id) formData.append('id', values.id);
    formData.append('name', values.name);
    formData.append('price', String(values.price));
    formData.append('stock', String(values.stock));
    formData.append('category', values.category);
    if (values.categoryId) formData.append('categoryId', values.categoryId);
    if (values.subCategoryId) formData.append('subCategoryId', values.subCategoryId);
    if (values.description) formData.append('description', values.description);

    startTransition(async () => {
      const result = await saveService(formData);
      if (result.error) {
        toast({
          title: 'Error',
          description: 'No se pudo guardar el servicio.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '¡Éxito!',
          description: `El servicio "${values.name}" ha sido guardado.`,
        });
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? 'Editar Producto' : 'Añadir Nuevo Producto'}</DialogTitle>
          <DialogDescription>
            {service
              ? `Actualizar detalles para ${service.name}.`
              : 'Añadir un nuevo producto a su inventario.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCategories}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="subCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-Categoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingSubCategories || !selectedCategoryId}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>{subCategories?.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Producto</FormLabel>
                  <FormControl>
                    <Input placeholder="p.ej., Botella de Agua" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría (Contable)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione una categoría contable" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Beverage">Bebida</SelectItem>
                      <SelectItem value="Food">Comida</SelectItem>
                      <SelectItem value="Amenity">Amenidad</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Existencias</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar Producto'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
