'use client';
import { useState, useTransition, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Supplier, Service, Tax } from '@/types';
import { savePurchaseInvoice } from '@/lib/actions/purchase.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency, cn } from '@/lib/utils';
import { es } from 'date-fns/locale';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const purchaseItemSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1."),
  costPrice: z.coerce.number().min(0, "El costo no puede ser negativo."),
  taxIds: z.array(z.string()).optional(),
});

const purchaseInvoiceSchema = z.object({
  supplierId: z.string({ required_error: "Debe seleccionar un proveedor." }),
  invoiceNumber: z.string().min(1, "El número de factura es requerido.").max(25, "El número de factura no debe exceder los 25 caracteres."),
  invoiceDate: z.date({ required_error: "La fecha es requerida." }),
  items: z.array(purchaseItemSchema).min(1, "Debe agregar al menos un producto a la factura."),
  taxesIncluded: z.boolean().default(false),
});

type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;

interface PurchaseInvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PurchaseInvoiceFormDialog({ open, onOpenChange }: PurchaseInvoiceFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [invoiceDay, setInvoiceDay] = useState<string>('');
  const [invoiceMonth, setInvoiceMonth] = useState<string>('');
  const [invoiceYear, setInvoiceYear] = useState<string>('');

  const suppliersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'suppliers'), orderBy('name')) : null, [firestore]);
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersQuery);

  const servicesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'services'), orderBy('name')) : null, [firestore]);
  const { data: services, isLoading: isLoadingServices } = useCollection<Service>(servicesQuery);
  
  const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes'), orderBy('name')) : null, [firestore]);
  const { data: allTaxes, isLoading: isLoadingTaxes } = useCollection<Tax>(taxesQuery);

  const form = useForm<PurchaseInvoiceFormValues>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      supplierId: undefined,
      invoiceNumber: '',
      invoiceDate: new Date(),
      items: [],
      taxesIncluded: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const selectedSupplierId = form.watch('supplierId');
  const items = form.watch('items');
  const taxesIncluded = form.watch('taxesIncluded');

  const availableProducts = useMemo(() => {
    if (!services) return [];
    return services.filter(service => 
      (selectedSupplierId ? service.supplierId === selectedSupplierId : true) &&
      !fields.some(field => field.serviceId === service.id)
    );
  }, [services, selectedSupplierId, fields]);
  
  const searchedProducts = useMemo(() => {
    if (!productSearch) return availableProducts;
    return availableProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [productSearch, availableProducts]);

  const { subtotal, totalTax, totalAmount } = useMemo(() => {
    let currentSubtotal = 0;
    let currentTotalTax = 0;

    items.forEach(item => {
        const itemTotal = item.quantity * item.costPrice;
        let itemSubtotal = itemTotal;
        let itemTax = 0;

        if (taxesIncluded) {
            const itemTaxes = (item.taxIds || [])
                .map(taxId => allTaxes?.find(t => t.id === taxId))
                .filter((t): t is Tax => !!t);
            
            const totalTaxRate = itemTaxes.reduce((sum, tax) => sum + tax.percentage, 0);
            itemSubtotal = itemTotal / (1 + totalTaxRate / 100);
            itemTax = itemTotal - itemSubtotal;
        } else {
            const itemTaxes = (item.taxIds || [])
                .map(taxId => allTaxes?.find(t => t.id === taxId))
                .filter((t): t is Tax => !!t);

            itemTaxes.forEach(tax => {
                itemTax += itemSubtotal * (tax.percentage / 100);
            });
        }
        currentSubtotal += itemSubtotal;
        currentTotalTax += itemTax;
    });

    const currentTotalAmount = currentSubtotal + currentTotalTax;

    return { 
        subtotal: currentSubtotal,
        totalTax: currentTotalTax,
        totalAmount: currentTotalAmount,
    };
  }, [items, taxesIncluded, allTaxes]);

  useEffect(() => {
    if (!open) {
      form.reset({
        supplierId: undefined,
        invoiceNumber: '',
        invoiceDate: new Date(),
        items: [],
        taxesIncluded: false,
      });
      setInvoiceDay('');
      setInvoiceMonth('');
      setInvoiceYear('');
    } else {
      const today = new Date();
      form.setValue('invoiceDate', today, { shouldValidate: true });
      setInvoiceDay(String(today.getDate()));
      setInvoiceMonth(String(today.getMonth() + 1));
      setInvoiceYear(String(today.getFullYear()));
    }
  }, [open, form]);

  useEffect(() => {
    if (invoiceDay && invoiceMonth && invoiceYear) {
      const day = parseInt(invoiceDay, 10);
      const month = parseInt(invoiceMonth, 10) - 1; // JS months are 0-indexed
      const year = parseInt(invoiceYear, 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            form.setValue('invoiceDate', date, { shouldValidate: true });
            form.clearErrors('invoiceDate');
        } else {
            form.setError('invoiceDate', { type: 'manual', message: 'Fecha no válida.' });
        }
      }
    }
  }, [invoiceDay, invoiceMonth, invoiceYear, form]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => String(currentYear - i));
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString('es', { month: 'long' }),
  }));
  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const days = invoiceYear && invoiceMonth ? Array.from({ length: daysInMonth(parseInt(invoiceYear, 10), parseInt(invoiceMonth, 10)) }, (_, i) => String(i + 1)) : Array.from({ length: 31 }, (_, i) => String(i + 1));

  const onSubmit = (values: PurchaseInvoiceFormValues) => {
    const supplier = suppliers?.find(s => s.id === values.supplierId);
    if (!supplier) {
        toast({ title: "Error", description: "Proveedor no válido.", variant: 'destructive' });
        return;
    }

    const payload = {
        ...values,
        supplierName: supplier.name,
        subtotal,
        totalTax,
        totalAmount,
    };
    
    startTransition(async () => {
      const result = await savePurchaseInvoice(payload);
      if (result.error) {
        toast({ title: 'Error al registrar la compra', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: 'La factura de compra ha sido registrada y el inventario actualizado.' });
        onOpenChange(false);
      }
    });
  };

  const addProductToForm = (service: Service) => {
    append({
        serviceId: service.id,
        serviceName: service.name,
        quantity: 1,
        costPrice: service.costPrice || 0,
        taxIds: service.taxIds || [],
    });
    setProductSearch("");
    setProductSearchOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Registrar Factura de Compra</DialogTitle>
          <DialogDescription>
            Complete los detalles de la factura para actualizar el inventario.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 flex flex-col min-h-0">
             <div className="grid md:grid-cols-3 gap-4">
                <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Proveedor</FormLabel>
                        <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={supplierSearchOpen}
                                        className={cn(
                                            "w-full justify-between",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        disabled={isLoadingSuppliers}
                                    >
                                        {field.value
                                            ? suppliers?.find(
                                                (supplier) => supplier.id === field.value
                                            )?.name
                                            : "Seleccione un proveedor"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar proveedor..." />
                                    <CommandList>
                                        <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                                        <CommandGroup>
                                            {suppliers?.map((supplier) => (
                                                <CommandItem
                                                    value={supplier.name}
                                                    key={supplier.id}
                                                    onSelect={() => {
                                                        form.setValue("supplierId", supplier.id)
                                                        setSupplierSearchOpen(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            supplier.id === field.value
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        )}
                                                    />
                                                    {supplier.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Número de Factura</FormLabel>
                        <FormControl><Input placeholder="FAC-12345" {...field} maxLength={25} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="invoiceDate"
                    render={() => (
                        <FormItem>
                          <FormLabel>Fecha de Factura</FormLabel>
                          <div className="grid grid-cols-3 gap-2">
                             <Select onValueChange={setInvoiceDay} value={invoiceDay}>
                               <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Día" />
                                </SelectTrigger>
                               </FormControl>
                               <SelectContent>
                                {days.map((d) => (
                                  <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                               </SelectContent>
                             </Select>
                              <Select onValueChange={setInvoiceMonth} value={invoiceMonth}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Mes" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {months.map((m) => (
                                    <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select onValueChange={setInvoiceYear} value={invoiceYear}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Año" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {years.map((y) => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                          </div>
                          <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            
            <div className="flex-1 min-h-0 flex flex-col space-y-2">
                <h3 className="text-sm font-medium">Artículos de la Factura</h3>
                <div className="border rounded-md flex-1">
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader className="sticky top-0 bg-muted">
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="w-[100px]">Cantidad</TableHead>
                                    <TableHead className="w-[150px]">Costo Unit.</TableHead>
                                    <TableHead className="w-[150px] text-right">Subtotal</TableHead>
                                    <TableHead className="w-[50px]"><span className="sr-only">Quitar</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((item, index) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.serviceName}</TableCell>
                                        <TableCell>
                                            <Input type="number" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} className="text-right" />
                                        </TableCell>
                                         <TableCell>
                                            <Input type="number" step="0.01" {...form.register(`items.${index}.costPrice`, { valueAsNumber: true })} className="text-right" />
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(items[index].quantity * items[index].costPrice)}</TableCell>
                                        <TableCell>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {fields.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Añada productos a la factura.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
                 {form.formState.errors.items && <p className="text-sm font-medium text-destructive">{form.formState.errors.items.message}</p>}

                 <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                    <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-start gap-2">
                            <PlusCircle className="h-4 w-4" />
                            Añadir Producto
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                         <Command>
                            <CommandInput placeholder="Buscar producto..." value={productSearch} onValueChange={setProductSearch} />
                            <CommandList>
                                <CommandEmpty>{isLoadingServices ? 'Cargando productos...' : 'No se encontraron productos.'}</CommandEmpty>
                                <CommandGroup>
                                    {searchedProducts.map((product) => (
                                        <CommandItem key={product.id} onSelect={() => addProductToForm(product)}>
                                            {product.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

            </div>
            
            <FormField
                control={form.control}
                name="taxesIncluded"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel>Los costos unitarios incluyen impuestos</FormLabel>
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className="space-y-1 rounded-lg border p-4">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                </div>
                 <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impuestos:</span>
                    <span>{formatCurrency(totalTax)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>{formatCurrency(totalAmount)}</span>
                </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar Factura de Compra'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
  