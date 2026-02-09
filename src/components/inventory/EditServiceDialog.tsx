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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveService } from '@/lib/actions/service.actions';
import type { Service } from '@/types';

interface EditServiceDialogProps {
  children: ReactNode;
  service?: Service;
  allServices: Service[];
}

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Service name is too short.'),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative.'),
  category: z.enum(['Food', 'Beverage', 'Amenity']),
});

export default function EditServiceDialog({ children, service, allServices }: EditServiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: service || {
      name: '',
      price: 0,
      stock: 0,
      category: 'Food',
    },
  });

  const onSubmit = (values: z.infer<typeof serviceSchema>) => {
    const formData = new FormData();
    if(values.id) formData.append('id', values.id);
    formData.append('name', values.name);
    formData.append('price', String(values.price));
    formData.append('stock', String(values.stock));
    formData.append('category', values.category);

    startTransition(async () => {
      const result = await saveService(formData);
      if (result.error) {
        toast({
          title: 'Error',
          description: 'Failed to save service.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success!',
          description: `Service "${values.name}" has been saved.`,
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
          <DialogTitle>{service ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          <DialogDescription>
            {service
              ? `Update details for ${service.name}.`
              : 'Add a new service to your inventory.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Water Bottle" {...field} />
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
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Beverage">Beverage</SelectItem>
                      <SelectItem value="Food">Food</SelectItem>
                      <SelectItem value="Amenity">Amenity</SelectItem>
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
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
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
                    <FormLabel>Stock</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Service'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
